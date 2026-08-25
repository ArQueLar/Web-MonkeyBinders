// api/create-payment.js
// Genera los parámetros firmados para iniciar un pago con Redsys. El frontend
// recibe estos datos y los manda mediante un formulario que se autoenvía por
// POST a la URL de Redsys (así funciona su integración "por Redirección" —
// el navegador del cliente va físicamente a su página de pago).
//
//   GET  ?searchServicePoints=1&postalCode=X&country=ES  -> busca puntos de
//        recogida cercanos (público, no necesita sesión — es solo para que
//        el cliente elija dónde recoger su pedido durante el checkout)
//
//   POST body: { items, customerEmail, customerName, deliveryMethod,
//                servicePointId?, shippingAddress }
//        Calculamos el TOTAL (artículos + envío) aquí, en el servidor —
//        nunca nos fiamos de un importe que mande el navegador, para que
//        nadie pueda manipular lo que paga.

import { buildMerchantParameters, signParameters, getRedsysUrl } from './_lib/redsys.js';
import { calculateCartWeight, calculateShippingCost } from './_lib/shipping-pricing.js';
import { searchSendcloudServicePoints, getSendcloudShippingQuote } from './_lib/sendcloud.js';

function generateOrderReference() {
    const numericPrefix = String(Date.now()).slice(-4);
    const randomSuffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `${numericPrefix}${randomSuffix}`; // 10 caracteres, válido para Redsys (4-12, empieza en dígitos)
}

export default async function handler(req, res) {
    // --- GET: buscar puntos de recogida cercanos (para el checkout) ---
    if (req.method === 'GET' && req.query.searchServicePoints) {
        const { postalCode, country } = req.query;
        if (!postalCode) {
            return res.status(400).json({ success: false, error: 'Falta el código postal' });
        }
        try {
            const points = await searchSendcloudServicePoints(country || 'ES', postalCode);
            return res.status(200).json({ success: true, points });
        } catch (err) {
            return res.status(502).json({ success: false, error: `Sendcloud: ${err.message}` });
        }
    }

    // --- GET con ?testShippingQuote=1 : consulta puntual para ver la respuesta
    // real de Sendcloud y confirmar el nombre del campo del precio. Quítalo (o
    // déjalo, no molesta) una vez esté confirmado y usado en calculateShippingCost. ---
    if (req.method === 'GET' && req.query.testShippingQuote) {
        const { postalCode, country } = req.query;
        if (!postalCode) {
            return res.status(400).json({ success: false, error: 'Falta el código postal (?postalCode=28001)' });
        }
        try {
            const quote = await getSendcloudShippingQuote({
                toCountryCode: country || 'ES',
                toPostalCode: postalCode,
                fromCountryCode: 'ES',
                fromPostalCode: process.env.SENDCLOUD_FROM_POSTAL_CODE,
                carrierCode: 'correos'
            });
            return res.status(200).json({ success: true, rawResponse: quote });
        } catch (err) {
            return res.status(502).json({ success: false, error: `Sendcloud: ${err.message}` });
        }
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Método no permitido' });
    }

    const MERCHANT_CODE = process.env.REDSYS_MERCHANT_CODE;
    const TERMINAL = process.env.REDSYS_TERMINAL;
    const SECRET_KEY = process.env.REDSYS_SECRET_KEY;
    const SITE_URL = process.env.SITE_URL;

    if (!MERCHANT_CODE || !TERMINAL || !SECRET_KEY || !SITE_URL) {
        return res.status(500).json({ success: false, error: 'Faltan variables de entorno de Redsys en Vercel' });
    }

    const { items, customerEmail, customerName, deliveryMethod, servicePointId, shippingAddress } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, error: 'El carrito está vacío' });
    }
    if (!customerEmail || !shippingAddress || !shippingAddress.postalCode) {
        return res.status(400).json({ success: false, error: 'Faltan datos de envío' });
    }
    if (deliveryMethod === 'pickup' && !servicePointId) {
        return res.status(400).json({ success: false, error: 'Falta elegir el punto de recogida' });
    }

    // --- CÁLCULO DEL TOTAL, DE VERDAD, EN EL SERVIDOR ---
    // El precio de cada artículo viene del navegador (es el que ya vio el cliente
    // en la tienda), pero el ENVÍO lo calculamos nosotros siempre — así nadie
    // puede manipular ese importe aunque sí pueda ver/tocar el del carrito.
    const subtotal = items.reduce((sum, item) => sum + (Number(item.price) || 0) * (item.quantity || 1), 0);
    const weightKg = calculateCartWeight(items);
    const shippingCost = calculateShippingCost(weightKg, subtotal);
    const total = Math.round((subtotal + shippingCost) * 100) / 100;

    const order = generateOrderReference();

    // Guardamos aquí todo lo necesario para crear el pedido en Odoo y la
    // etiqueta de envío cuando Redsys confirme el pago — nos lo devuelve tal
    // cual en la notificación, así no necesitamos ninguna base de datos propia.
    const merchantData = Buffer.from(JSON.stringify({
        items, customerEmail, customerName, deliveryMethod, servicePointId, shippingAddress, shippingCost
    })).toString('base64');

    const amountInCents = Math.round(total * 100).toString();

    const merchantParams = {
        Ds_Merchant_Amount: amountInCents,
        Ds_Merchant_Currency: '978',
        Ds_Merchant_Order: order,
        Ds_Merchant_ProductDescription: 'Pedido Monkey Binders',
        Ds_Merchant_MerchantCode: MERCHANT_CODE,
        Ds_Merchant_MerchantURL: `${SITE_URL}/api/redsys-notification`,
        Ds_Merchant_UrlOK: `${SITE_URL}/pago-exito.html?order=${order}`,
        Ds_Merchant_UrlKO: `${SITE_URL}/pago-error.html?order=${order}`,
        Ds_Merchant_Terminal: TERMINAL,
        Ds_Merchant_MerchantData: merchantData,
        Ds_Merchant_TransactionType: '0',
        Ds_Merchant_ConsumerLanguage: '001'
    };

    const merchantParameters = buildMerchantParameters(merchantParams);
    const signature = signParameters(SECRET_KEY, order, merchantParameters);

    return res.status(200).json({
        success: true,
        redsysUrl: getRedsysUrl(),
        order,
        subtotal,
        shippingCost,
        total,
        formFields: {
            Ds_SignatureVersion: 'HMAC_SHA256_V1',
            Ds_MerchantParameters: merchantParameters,
            Ds_Signature: signature
        }
    });
}