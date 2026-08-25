// api/admin/orders.js
// Trae TODOS los pedidos confirmados (de cualquier cliente), con sus líneas
// (para saber qué hay que fabricar), su estado real de envío en Odoo y su
// número de seguimiento de Sendcloud si ya se creó. También gestiona varias
// acciones en el mismo archivo (por el límite de 12 funciones serverless del
// plan gratuito de Vercel):
//   GET  -> lista todos los pedidos
//         -> ?downloadLabel=URL  ->  descarga (con autenticación) el PDF de una etiqueta de Sendcloud
//   POST -> body: { action, ... }
//         "ready"          { pickingId }               -> marca la transferencia como lista
//         "deliver"        { pickingId }                -> valida la transferencia como entregada en Odoo
//         "create-label"   { orderId }                  -> crea el envío + etiqueta en Sendcloud
//         "check-tracking" { trackingNumber }           -> consulta el estado REAL en Sendcloud
// Solo accesible con sesión de administrador.

import { getAdminSessionFromRequest, callOdoo } from '../_lib/auth.js';
import { createSendcloudParcel, getSendcloudParcelByTrackingNumber, downloadSendcloudLabel, listSendcloudShippingMethods } from '../_lib/sendcloud.js';

// Peso por defecto de un envío (kg) — los binders pesan poco y varían poco,
// así que usamos un valor fijo en vez de calcularlo pieza a pieza. Ajústalo
// aquí si hace falta (por ejemplo, si los pedidos de varias unidades pesan
// sensiblemente más).
const DEFAULT_WEIGHT_KG = 0.5;

export default async function handler(req, res) {
    const session = getAdminSessionFromRequest(req);
    if (!session) {
        return res.status(401).json({ success: false, error: 'No autorizado' });
    }

    const ODOO_URL = process.env.ODOO_URL;
    const ODOO_DB = process.env.ODOO_DB;
    const ODOO_LOGIN = process.env.ODOO_LOGIN;
    const ODOO_API_KEY = process.env.ODOO_API_KEY;

    // --- GET con ?downloadLabel=... : proxy autenticado del PDF de la etiqueta ---
    if (req.method === 'GET' && req.query.downloadLabel) {
        try {
            const pdfBuffer = await downloadSendcloudLabel(decodeURIComponent(req.query.downloadLabel));
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename="etiqueta-envio.pdf"');
            return res.status(200).send(pdfBuffer);
        } catch (err) {
            return res.status(500).json({ success: false, error: 'No se pudo descargar la etiqueta', detail: err.message });
        }
    }

    // --- GET con ?listShippingMethods=1 : consulta puntual para saber el ID a
    // poner en SENDCLOUD_SHIPPING_METHOD_ID (quítalo cuando ya lo tengas configurado) ---
    if (req.method === 'GET' && req.query.listShippingMethods) {
        try {
            const methods = await listSendcloudShippingMethods();
            return res.status(200).json({ success: true, methods });
        } catch (err) {
            return res.status(500).json({ success: false, error: 'No se pudo consultar Sendcloud', detail: err.message });
        }
    }

    // --- POST: acciones sobre pedidos/envíos ---
    if (req.method === 'POST') {
        const { pickingId, orderId, trackingNumber, action } = req.body || {};

        try {
            // "ready" / "deliver" — avanzar el estado de una transferencia en Odoo
            if (action === 'ready' || action === 'deliver') {
                if (!pickingId) {
                    return res.status(400).json({ success: false, error: 'Datos inválidos' });
                }
                const uid = await callOdoo(ODOO_URL, 'common', 'authenticate', [ODOO_DB, ODOO_LOGIN, ODOO_API_KEY, {}]);
                if (!uid) return res.status(500).json({ success: false, error: 'No se pudo autenticar con Odoo' });

                const method = action === 'ready' ? 'action_assign' : 'button_validate';
                await callOdoo(ODOO_URL, 'object', 'execute_kw', [
                    ODOO_DB, uid, ODOO_API_KEY,
                    'stock.picking', method,
                    [[pickingId]]
                ]);
                return res.status(200).json({ success: true });
            }

            // "create-label" — crea el envío + etiqueta en Sendcloud y guarda el
            // número de seguimiento en la transferencia de Odoo correspondiente
            if (action === 'create-label') {
                if (!orderId) {
                    return res.status(400).json({ success: false, error: 'Falta el pedido' });
                }

                const uid = await callOdoo(ODOO_URL, 'common', 'authenticate', [ODOO_DB, ODOO_LOGIN, ODOO_API_KEY, {}]);
                if (!uid) return res.status(500).json({ success: false, error: 'No se pudo autenticar con Odoo' });

                const orderData = await callOdoo(ODOO_URL, 'object', 'execute_kw', [
                    ODOO_DB, uid, ODOO_API_KEY,
                    'sale.order', 'read',
                    [[orderId]],
                    { fields: ['name', 'partner_id', 'partner_shipping_id'] }
                ]);
                if (!orderData.length) {
                    return res.status(404).json({ success: false, error: 'Pedido no encontrado' });
                }
                const order = orderData[0];
                const shippingPartnerId = Array.isArray(order.partner_shipping_id) && order.partner_shipping_id[0]
                    ? order.partner_shipping_id[0]
                    : (Array.isArray(order.partner_id) ? order.partner_id[0] : order.partner_id);

                const partnerData = await callOdoo(ODOO_URL, 'object', 'execute_kw', [
                    ODOO_DB, uid, ODOO_API_KEY,
                    'res.partner', 'read',
                    [[shippingPartnerId]],
                    { fields: ['name', 'street', 'street2', 'city', 'zip', 'country_id', 'phone', 'mobile', 'email'] }
                ]);
                if (!partnerData.length) {
                    return res.status(404).json({ success: false, error: 'No se encontró la dirección del cliente' });
                }
                const partner = partnerData[0];

                if (!partner.street || !partner.city || !partner.zip || !partner.country_id) {
                    return res.status(400).json({ success: false, error: 'Al cliente le falta dirección, ciudad, código postal o país en Odoo — complétalo antes de crear la etiqueta.' });
                }

                const countryId = Array.isArray(partner.country_id) ? partner.country_id[0] : partner.country_id;
                const countryData = await callOdoo(ODOO_URL, 'object', 'execute_kw', [
                    ODOO_DB, uid, ODOO_API_KEY,
                    'res.country', 'read',
                    [[countryId]],
                    { fields: ['code'] }
                ]);
                const countryCode = countryData.length ? countryData[0].code : 'ES';

                let parcel;
                try {
                    parcel = await createSendcloudParcel({
                        name: partner.name,
                        address: partner.street,
                        address2: partner.street2,
                        city: partner.city,
                        postalCode: partner.zip,
                        countryCode,
                        telephone: partner.phone || partner.mobile,
                        email: partner.email,
                        orderNumber: order.name,
                        weightKg: DEFAULT_WEIGHT_KG
                    });
                } catch (sendcloudErr) {
                    return res.status(502).json({ success: false, error: `Sendcloud rechazó el envío: ${sendcloudErr.message}` });
                }

                // Guardamos el número de seguimiento en la transferencia de salida de Odoo,
                // para que quede también visible allí y podamos recuperarlo más adelante.
                const pickings = await callOdoo(ODOO_URL, 'object', 'execute_kw', [
                    ODOO_DB, uid, ODOO_API_KEY,
                    'stock.picking', 'search_read',
                    [[['sale_id', '=', orderId], ['picking_type_id.code', '=', 'outgoing']]],
                    { fields: ['id'], order: 'id desc', limit: 1 }
                ]);
                if (pickings.length > 0) {
                    await callOdoo(ODOO_URL, 'object', 'execute_kw', [
                        ODOO_DB, uid, ODOO_API_KEY,
                        'stock.picking', 'write',
                        [[pickings[0].id], { carrier_tracking_ref: parcel.tracking_number }]
                    ]);
                }

                const labelUrl = parcel.label?.normal_printer?.[0] || parcel.label?.label_printer || null;

                return res.status(200).json({
                    success: true,
                    trackingNumber: parcel.tracking_number,
                    trackingUrl: parcel.tracking_url,
                    labelUrl
                });
            }

            // "check-tracking" — consulta el estado REAL del envío en Sendcloud
            if (action === 'check-tracking') {
                if (!trackingNumber) {
                    return res.status(400).json({ success: false, error: 'Falta el número de seguimiento' });
                }
                try {
                    const parcel = await getSendcloudParcelByTrackingNumber(trackingNumber);
                    if (!parcel) {
                        return res.status(404).json({ success: false, error: 'No se encontró ese envío en Sendcloud' });
                    }
                    return res.status(200).json({
                        success: true,
                        status: parcel.status?.message || 'Desconocido',
                        trackingUrl: parcel.tracking_url
                    });
                } catch (sendcloudErr) {
                    return res.status(502).json({ success: false, error: `Sendcloud: ${sendcloudErr.message}` });
                }
            }

            return res.status(400).json({ success: false, error: 'Acción no reconocida' });
        } catch (err) {
            return res.status(500).json({ success: false, error: 'No se pudo completar la acción', detail: err.message });
        }
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Método no permitido' });
    }

    // --- GET: listar todos los pedidos ---
    try {
        const uid = await callOdoo(ODOO_URL, 'common', 'authenticate', [ODOO_DB, ODOO_LOGIN, ODOO_API_KEY, {}]);
        if (!uid) {
            return res.status(500).json({ success: false, error: 'No se pudo autenticar con Odoo' });
        }

        const orders = await callOdoo(ODOO_URL, 'object', 'execute_kw', [
            ODOO_DB, uid, ODOO_API_KEY,
            'sale.order', 'search_read',
            [[['state', 'in', ['sale', 'done']]]],
            {
                fields: ['name', 'partner_id', 'date_order', 'amount_total', 'state'],
                order: 'date_order desc',
                limit: 200
            }
        ]);

        const orderIds = orders.map(o => o.id);

        // --- LÍNEAS DE CADA PEDIDO (qué hay que fabricar) ---
        let linesByOrderId = {};
        if (orderIds.length > 0) {
            const lines = await callOdoo(ODOO_URL, 'object', 'execute_kw', [
                ODOO_DB, uid, ODOO_API_KEY,
                'sale.order.line', 'search_read',
                [[['order_id', 'in', orderIds], ['display_type', '=', false]]], // sin líneas de sección/nota, solo productos reales
                { fields: ['order_id', 'name', 'product_uom_qty'] }
            ]);
            lines.forEach(l => {
                const orderId = Array.isArray(l.order_id) ? l.order_id[0] : l.order_id;
                if (!linesByOrderId[orderId]) linesByOrderId[orderId] = [];
                linesByOrderId[orderId].push({ name: l.name, qty: l.product_uom_qty });
            });
        }

        // --- ESTADO REAL DE ENVÍO (stock.picking) DE CADA PEDIDO ---
        let pickingsByOrderId = {};
        if (orderIds.length > 0) {
            try {
                const pickings = await callOdoo(ODOO_URL, 'object', 'execute_kw', [
                    ODOO_DB, uid, ODOO_API_KEY,
                    'stock.picking', 'search_read',
                    [[
                        ['sale_id', 'in', orderIds],
                        ['picking_type_id.code', '=', 'outgoing']
                    ]],
                    { fields: ['id', 'sale_id', 'state', 'carrier_tracking_ref'], order: 'id desc' }
                ]);
                pickings.forEach(p => {
                    const orderId = Array.isArray(p.sale_id) ? p.sale_id[0] : p.sale_id;
                    if (!pickingsByOrderId[orderId]) pickingsByOrderId[orderId] = [];
                    pickingsByOrderId[orderId].push(p);
                });
            } catch (e) {
                // Sin módulo de Inventario o similar: seguimos sin datos de envío
            }
        }

        const fullOrders = orders
            .map(o => {
                const pickings = pickingsByOrderId[o.id] || [];
                // Preferimos la transferencia activa si hay varias (ej. una cancelada y
                // sustituida por otra), y solo mostramos "cancelado" si de verdad todas
                // las transferencias de ese pedido lo están.
                const latestPicking = pickings.find(p => p.state !== 'cancel') || pickings[0];
                return {
                    id: o.id,
                    name: o.name,
                    customer: Array.isArray(o.partner_id) ? o.partner_id[1] : '',
                    date_order: o.date_order,
                    amount_total: o.amount_total,
                    state: o.state,
                    lines: linesByOrderId[o.id] || [],
                    pickingId: latestPicking ? latestPicking.id : null,
                    shippingState: latestPicking ? latestPicking.state : null,
                    trackingNumber: latestPicking ? (latestPicking.carrier_tracking_ref || null) : null
                };
            })
            // Fuera los que tienen el envío cancelado de verdad (todas sus transferencias
            // canceladas, sin ninguna activa) — no se van a recuperar, no aportan nada aquí.
            .filter(o => o.shippingState !== 'cancel');

        return res.status(200).json({ success: true, orders: fullOrders });
    } catch (err) {
        return res.status(500).json({ success: false, error: 'Error al leer los pedidos de Odoo' });
    }
}
