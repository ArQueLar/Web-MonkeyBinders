// api/create-payment.js
// Genera los parámetros firmados para iniciar un pago con Redsys. El frontend
// recibe estos datos y los manda mediante un formulario que se autoenvía por
// POST a la URL de Redsys (así es como funciona su integración "por Redirección" —
// el navegador del cliente va físicamente a la página de pago de Redsys).
//
// body esperado: { amount, items, customerEmail, customerName }
//   amount: importe TOTAL en euros (con IVA incluido), ej. 49.99
//   items: array de líneas del carrito (se guardan en Ds_Merchant_MerchantData
//          para poder crear el pedido en Odoo cuando llegue la confirmación real)

import { buildMerchantParameters, signParameters, getRedsysUrl } from './_lib/redsys.js';

// Genera un número de pedido válido para Redsys: 4-12 caracteres, y los 4
// primeros deben ser numéricos. Usamos los últimos dígitos del timestamp +
// unos caracteres aleatorios, así nunca se repite entre pedidos.
function generateOrderReference() {
    const numericPrefix = String(Date.now()).slice(-4);
    const randomSuffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `${numericPrefix}${randomSuffix}`; // 10 caracteres en total
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Método no permitido' });
    }

    const MERCHANT_CODE = process.env.REDSYS_MERCHANT_CODE;
    const TERMINAL = process.env.REDSYS_TERMINAL;
    const SECRET_KEY = process.env.REDSYS_SECRET_KEY;
    const SITE_URL = process.env.SITE_URL; // ej: https://tudominio.com (sin barra al final)

    if (!MERCHANT_CODE || !TERMINAL || !SECRET_KEY || !SITE_URL) {
        return res.status(500).json({ success: false, error: 'Faltan variables de entorno de Redsys en Vercel' });
    }

    const { amount, items, customerEmail, customerName } = req.body || {};

    if (!amount || Number(amount) <= 0) {
        return res.status(400).json({ success: false, error: 'Importe inválido' });
    }
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, error: 'El carrito está vacío' });
    }

    const order = generateOrderReference();

    // Guardamos aquí todo lo necesario para crear el pedido en Odoo cuando
    // Redsys confirme el pago — Redsys nos lo devuelve tal cual en la
    // notificación, así no necesitamos ninguna base de datos propia.
    const merchantData = Buffer.from(JSON.stringify({ items, customerEmail, customerName })).toString('base64');

    const amountInCents = Math.round(Number(amount) * 100).toString();

    const merchantParams = {
        Ds_Merchant_Amount: amountInCents,
        Ds_Merchant_Currency: '978', // Euro
        Ds_Merchant_Order: order,
        Ds_Merchant_ProductDescription: 'Pedido Monkey Binders',
        Ds_Merchant_MerchantCode: MERCHANT_CODE,
        Ds_Merchant_MerchantURL: `${SITE_URL}/api/redsys-notification`,
        Ds_Merchant_UrlOK: `${SITE_URL}/pago-exito.html?order=${order}`,
        Ds_Merchant_UrlKO: `${SITE_URL}/pago-error.html?order=${order}`,
        Ds_Merchant_Terminal: TERMINAL,
        Ds_Merchant_MerchantData: merchantData,
        Ds_Merchant_TransactionType: '0', // Autorización estándar
        Ds_Merchant_ConsumerLanguage: '001' // Español
    };

    const merchantParameters = buildMerchantParameters(merchantParams);
    const signature = signParameters(SECRET_KEY, order, merchantParameters);

    return res.status(200).json({
        success: true,
        redsysUrl: getRedsysUrl(),
        order,
        formFields: {
            Ds_SignatureVersion: 'HMAC_SHA256_V1',
            Ds_MerchantParameters: merchantParameters,
            Ds_Signature: signature
        }
    });
}
