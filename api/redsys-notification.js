// api/redsys-notification.js
// Redsys llama a este endpoint DIRECTAMENTE DESDE SUS SERVIDORES (nunca desde
// el navegador del cliente) en cuanto un pago se resuelve — es la única fuente
// fiable de si un pago se ha completado de verdad. La redirección del
// navegador a Ds_Merchant_UrlOK/UrlKO es solo para la experiencia del
// cliente, NUNCA hay que fiarse de ella para dar un pedido por pagado.
//
// Verificamos la firma (para asegurarnos de que la notificación viene de
// verdad de Redsys y no está manipulada) y, si el pago está autorizado,
// creamos el pedido en Odoo con los datos que guardamos en
// Ds_Merchant_MerchantData al iniciar el pago.

import { verifyNotification, isPaymentAuthorized } from './_lib/redsys.js';
import { callOdoo } from './_lib/auth.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).send('Método no permitido');
    }

    const SECRET_KEY = process.env.REDSYS_SECRET_KEY;
    const { Ds_MerchantParameters, Ds_Signature } = req.body || {};

    if (!Ds_MerchantParameters || !Ds_Signature) {
        return res.status(400).send('Faltan parámetros');
    }

    const params = verifyNotification(SECRET_KEY, Ds_MerchantParameters, Ds_Signature);
    if (!params) {
        // Firma inválida: o no viene de Redsys, o los datos están corruptos/manipulados.
        // No hacemos NADA con esto — ni marcamos ningún pedido como pagado.
        console.error('Notificación de Redsys con firma inválida, se ignora.');
        return res.status(400).send('Firma inválida');
    }

    const responseCode = params.Ds_Response;
    if (!isPaymentAuthorized(responseCode)) {
        // Pago denegado o con error — no es un fallo nuestro, solo confirmamos
        // recepción a Redsys y no creamos ningún pedido.
        console.log(`Pago no autorizado para el pedido ${params.Ds_Order}, código ${responseCode}`);
        return res.status(200).send('OK');
    }

    // Pago autorizado de verdad — recuperamos el carrito que guardamos al
    // iniciar el pago, y creamos el pedido en Odoo.
    let cartData;
    try {
        cartData = JSON.parse(Buffer.from(params.Ds_MerchantData || '', 'base64').toString('utf8'));
    } catch (e) {
        console.error('No se pudo leer Ds_Merchant_MerchantData del pedido', params.Ds_Order);
        return res.status(200).send('OK'); // confirmamos a Redsys igualmente, el pago SÍ se cobró
    }

    try {
        await createOdooOrderFromPayment(params.Ds_Order, cartData, Number(params.Ds_Amount) / 100);
    } catch (err) {
        // Si falla la creación en Odoo, el dinero YA se ha cobrado — esto necesita
        // revisión manual, no se puede "reintentar" sin más como si nada.
        console.error(`⚠️ Pago cobrado (pedido ${params.Ds_Order}) pero falló crear el pedido en Odoo:`, err.message);
    }

    // Redsys solo necesita un 200 para no reintentar la notificación
    return res.status(200).send('OK');
}

async function createOdooOrderFromPayment(orderReference, cartData, amountTotal) {
    const ODOO_URL = process.env.ODOO_URL;
    const ODOO_DB = process.env.ODOO_DB;
    const ODOO_LOGIN = process.env.ODOO_LOGIN;
    const ODOO_API_KEY = process.env.ODOO_API_KEY;

    const uid = await callOdoo(ODOO_URL, 'common', 'authenticate', [ODOO_DB, ODOO_LOGIN, ODOO_API_KEY, {}]);
    if (!uid) throw new Error('No se pudo autenticar con Odoo');

    // Buscamos (o creamos) el cliente por email
    const email = cartData.customerEmail;
    let partnerId;
    const existingPartners = await callOdoo(ODOO_URL, 'object', 'execute_kw', [
        ODOO_DB, uid, ODOO_API_KEY,
        'res.partner', 'search_read',
        [[['email', '=', email]]],
        { fields: ['id'], limit: 1 }
    ]);
    if (existingPartners.length > 0) {
        partnerId = existingPartners[0].id;
    } else {
        partnerId = await callOdoo(ODOO_URL, 'object', 'execute_kw', [
            ODOO_DB, uid, ODOO_API_KEY,
            'res.partner', 'create',
            [{ name: cartData.customerName || email, email }]
        ]);
    }

    // Construimos las líneas del pedido. Cada item del carrito lleva un id tipo
    // "odoo-123" (123 = id de la plantilla de producto) — usamos ese producto,
    // pero con el precio y el nombre EXACTOS que pagó el cliente (por si llevaba
    // opciones de grabado/tamaño que cambian el precio respecto al de catálogo).
    const orderLines = [];
    for (const item of cartData.items) {
        const templateId = Number(String(item.id).split('-')[1]);
        let productVariantId = null;

        if (templateId) {
            const templateData = await callOdoo(ODOO_URL, 'object', 'execute_kw', [
                ODOO_DB, uid, ODOO_API_KEY,
                'product.template', 'read',
                [[templateId]],
                { fields: ['product_variant_id'] }
            ]);
            if (templateData.length) {
                productVariantId = Array.isArray(templateData[0].product_variant_id)
                    ? templateData[0].product_variant_id[0]
                    : templateData[0].product_variant_id;
            }
        }

        if (productVariantId) {
            orderLines.push([0, 0, {
                product_id: productVariantId,
                name: item.name,
                product_uom_qty: item.quantity || 1,
                price_unit: item.price
            }]);
        } else {
            // Si no encontramos el producto en Odoo, añadimos la línea igualmente
            // como texto libre (sin product_id) — mejor eso que perder el pedido.
            orderLines.push([0, 0, {
                name: `${item.name} (producto no vinculado a Odoo)`,
                product_uom_qty: item.quantity || 1,
                price_unit: item.price
            }]);
        }
    }

    const newOrderId = await callOdoo(ODOO_URL, 'object', 'execute_kw', [
        ODOO_DB, uid, ODOO_API_KEY,
        'sale.order', 'create',
        [{
            partner_id: partnerId,
            client_order_ref: orderReference, // referencia de Redsys, para poder cruzar ambos sistemas
            order_line: orderLines
        }]
    ]);

    // Confirmamos el pedido directamente (ya está pagado, no tiene sentido dejarlo en presupuesto)
    await callOdoo(ODOO_URL, 'object', 'execute_kw', [
        ODOO_DB, uid, ODOO_API_KEY,
        'sale.order', 'action_confirm',
        [[newOrderId]]
    ]);

    console.log(`✓ Pedido creado en Odoo (id ${newOrderId}) para el pago ${orderReference}, importe ${amountTotal}€`);
}
