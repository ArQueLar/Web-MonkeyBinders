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
import { searchSendcloudServicePoints } from './_lib/sendcloud.js';
import { priceCartFromOdoo, CartValidationError } from './_lib/pricing.js';
import crypto from 'crypto';

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const POSTAL_RE = /^[A-Za-z0-9 -]{3,10}$/;
const COUNTRY_RE = /^[A-Za-z]{2}$/;
const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

function generateOrderReference() {
    const numericPrefix = String(Date.now()).slice(-4);
    const randomSuffix = crypto.randomBytes(5).toString('hex').slice(0, 6).toUpperCase();
    return `${numericPrefix}${randomSuffix}`; // 10 caracteres, válido para Redsys (4-12, empieza en dígitos)
}

export default async function handler(req, res) {
    // --- GET: buscar puntos de recogida cercanos (para el checkout) ---
    if (req.method === 'GET' && req.query.searchServicePoints) {
        const { postalCode, country } = req.query;
        if (!POSTAL_RE.test(String(postalCode || '')) || (country && !COUNTRY_RE.test(String(country)))) {
            return res.status(400).json({ success: false, error: 'Código postal o país no válido' });
        }
        try {
            const points = await searchSendcloudServicePoints(country || 'ES', postalCode);
            return res.status(200).json({ success: true, points });
        } catch (err) {
            console.error('searchServicePoints:', err.message);
            return res.status(502).json({ success: false, error: 'No se pudieron buscar puntos de recogida' });
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

    const body = req.body || {};
    const customerEmail = clip(body.customerEmail, 254);
    const customerName = clip(body.customerName, 120);
    const deliveryMethod = body.deliveryMethod === 'pickup' ? 'pickup' : 'home';
    const servicePointId = body.servicePointId ? clip(String(body.servicePointId), 40) : undefined;
    const sa = body.shippingAddress || {};
    const shippingAddress = {
        street: clip(sa.street, 200),
        city: clip(sa.city, 100),
        postalCode: clip(sa.postalCode, 10),
        country: COUNTRY_RE.test(String(sa.country || '')) ? String(sa.country).toUpperCase() : 'ES',
        phone: clip(sa.phone, 30)
    };

    if (!EMAIL_RE.test(customerEmail) || !customerName) {
        return res.status(400).json({ success: false, error: 'Email o nombre no válidos' });
    }
    if (!POSTAL_RE.test(shippingAddress.postalCode)) {
        return res.status(400).json({ success: false, error: 'Faltan datos de envío' });
    }
    if (deliveryMethod === 'pickup' && !servicePointId) {
        return res.status(400).json({ success: false, error: 'Falta elegir el punto de recogida' });
    }

    // --- CÁLCULO DEL TOTAL, DE VERDAD, EN EL SERVIDOR ---
    // Precio y nombre de cada artículo se recalculan desde Odoo; lo que mande el
    // navegador (precio, nombre) se ignora. El envío también se calcula aquí.
    let items;
    try {
        items = await priceCartFromOdoo(body.items);
    } catch (err) {
        if (err instanceof CartValidationError) {
            return res.status(400).json({ success: false, error: err.message });
        }
        console.error('priceCartFromOdoo:', err.message);
        return res.status(502).json({ success: false, error: 'No se pudo validar el carrito. Inténtalo de nuevo.' });
    }
    const subtotal = Math.round(items.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) / 100;
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