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
import { createSendcloudParcel, getSendcloudParcelByTrackingNumber, downloadSendcloudLabel, listSendcloudShippingMethods, searchSendcloudServicePoints } from '../_lib/sendcloud.js';

// Peso por defecto de un envío (kg) — se puede cambiar desde el propio panel al
// crear la etiqueta; este valor solo se usa si por lo que sea no llega ninguno.
const DEFAULT_WEIGHT_KG = 1;

// Tramos de peso -> ID de Sendcloud, para cada servicio de Correos que usáis.
// Cada tramo cubre "hasta este peso (kg) inclusive". Sacado directamente de
// vuestros métodos de envío dados de alta en Sendcloud.
const CORREOS_DOMICILIO_BANDS = [
    { max: 1, id: 2189 }, { max: 2, id: 2190 }, { max: 3, id: 2191 },
    { max: 4, id: 2192 }, { max: 5, id: 2193 }, { max: 10, id: 2194 },
    { max: 15, id: 2195 }, { max: 20, id: 2196 }, { max: 30, id: 2197 }
];
const CORREOS_RECOGIDA_BANDS = [
    { max: 1, id: 2207 }, { max: 2, id: 2208 }, { max: 3, id: 2209 },
    { max: 4, id: 2210 }, { max: 5, id: 2211 }, { max: 10, id: 2212 },
    { max: 15, id: 2213 }, { max: 20, id: 2214 }, { max: 30, id: 2215 }
];
const CORREOS_INTERNACIONAL_BANDS = [
    { max: 0.25, id: 4069 }, { max: 0.5, id: 4070 }, { max: 1, id: 4071 },
    { max: 1.5, id: 4072 }, { max: 2, id: 4073 }, { max: 3, id: 4074 },
    { max: 4, id: 4075 }, { max: 5, id: 4076 }, { max: 6, id: 4077 },
    { max: 7, id: 4078 }, { max: 8, id: 4079 }, { max: 9, id: 4080 },
    { max: 10, id: 4081 }, { max: 11, id: 4082 }, { max: 12, id: 4083 },
    { max: 13, id: 4084 }, { max: 14, id: 4085 }, { max: 15, id: 4086 },
    { max: 16, id: 4087 }, { max: 17, id: 4088 }, { max: 18, id: 4089 },
    { max: 19, id: 4090 }, { max: 20, id: 4091 }, { max: 21, id: 4092 },
    { max: 22, id: 4093 }, { max: 23, id: 4094 }, { max: 24, id: 4095 },
    { max: 25, id: 4096 }, { max: 26, id: 4097 }, { max: 27, id: 4098 },
    { max: 28, id: 4099 }, { max: 29, id: 4100 }, { max: 30, id: 4101 }
];

// Cada opción de envío del panel: o bien "bands" (tramos de peso -> ID) o un
// "fixedId" fijo (para carriers como UPS, donde el ID no varía con el peso —
// Sendcloud sigue calculando la tarifa con el peso real que se envía aparte).
const SHIPPING_SERVICES = {
    test_unstamped_letter: { label: '🧪 SOLO PRUEBAS — Unstamped Letter (gratis, sin transportista real)', fixedId: 8, needsServicePoint: false },
    correos_domicilio: { label: 'Correos — Entrega a domicilio (nacional)', bands: CORREOS_DOMICILIO_BANDS, needsServicePoint: false },
    correos_recogida: { label: 'Correos — Recogida en punto (nacional)', bands: CORREOS_RECOGIDA_BANDS, needsServicePoint: true },
    correos_internacional: { label: 'Correos — Internacional', bands: CORREOS_INTERNACIONAL_BANDS, needsServicePoint: false },
    ups_standard_12_14: { label: 'UPS Standard (paquetes de 12-14kg)', fixedId: 5481, needsServicePoint: false },
    ups_standard: { label: 'UPS® Standard', fixedId: 28996, needsServicePoint: false }
};

// Busca en la tabla de tramos el ID que corresponde a un peso dado (coge el
// primer tramo cuyo máximo sea >= al peso; si se pasa de todos, usa el más alto).
function resolveShippingMethodId(serviceKey, weightKg) {
    const service = SHIPPING_SERVICES[serviceKey];
    if (!service) return null;
    if (service.fixedId) return service.fixedId;
    const band = service.bands.find(b => weightKg <= b.max) || service.bands[service.bands.length - 1];
    return band.id;
}

// Peso por unidad (kg) según el tamaño del binder. Los nombres de línea de
// pedido llevan el tamaño elegido entre paréntesis (ej. "Binder X (4x3 XL, ...)"),
// tal y como los construye la web al añadir al carrito.
// Ojo con el orden: "4x3 xl" se comprueba ANTES que "4x3" a secas, porque
// "4x3 xl" también contiene la cadena "4x3".
const WEIGHT_BY_SIZE_KG = [
    { match: '4x3 xl', weight: 1.5 },
    { match: '4x3', weight: 1.3 },
    { match: '3x3', weight: 1 }
];

// Calcula un peso total SUGERIDO para el pedido a partir de sus líneas,
// detectando el tamaño en el nombre de cada una y multiplicando por su
// cantidad. Es solo una sugerencia editable — si no reconoce ningún tamaño
// en una línea, asume 1kg (el tamaño "normal" más habitual) para esa línea.
function calculateSuggestedWeight(lines) {
    if (!lines || lines.length === 0) return DEFAULT_WEIGHT_KG;

    const total = lines.reduce((sum, line) => {
        const nameLower = (line.name || '').toLowerCase();
        const sizeEntry = WEIGHT_BY_SIZE_KG.find(s => nameLower.includes(s.match));
        const unitWeight = sizeEntry ? sizeEntry.weight : 1;
        return sum + unitWeight * (line.qty || 1);
    }, 0);

    // Redondeamos a 1 decimal para evitar restos de coma flotante feos (ej. 3.9000000001)
    return Math.round(total * 10) / 10;
}

// Lee la dirección de envío de un pedido (la de envío si existe, si no la del
// propio cliente) junto con el código ISO-2 de su país. La usan tanto
// "create-label" como "search-service-points".
async function getOrderShippingAddress(ODOO_URL, ODOO_DB, uid, ODOO_API_KEY, orderId) {
    const orderData = await callOdoo(ODOO_URL, 'object', 'execute_kw', [
        ODOO_DB, uid, ODOO_API_KEY,
        'sale.order', 'read',
        [[orderId]],
        { fields: ['partner_id', 'partner_shipping_id'] }
    ]);
    if (!orderData.length) return { partner: null, countryCode: null };

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
    if (!partnerData.length) return { partner: null, countryCode: null };

    const partner = partnerData[0];
    let countryCode = 'ES';
    if (partner.country_id) {
        const countryId = Array.isArray(partner.country_id) ? partner.country_id[0] : partner.country_id;
        const countryData = await callOdoo(ODOO_URL, 'object', 'execute_kw', [
            ODOO_DB, uid, ODOO_API_KEY,
            'res.country', 'read',
            [[countryId]],
            { fields: ['code'] }
        ]);
        if (countryData.length) countryCode = countryData[0].code;
    }

    return { partner, countryCode };
}

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

    // --- GET con ?shippingServices=1 : lista las opciones de envío para el
    // desplegable del panel (nombre + si necesita elegir punto de recogida) ---
    if (req.method === 'GET' && req.query.shippingServices) {
        const services = Object.entries(SHIPPING_SERVICES).map(([key, s]) => ({
            key,
            label: s.label,
            needsServicePoint: s.needsServicePoint
        }));
        return res.status(200).json({ success: true, services });
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

            // "search-service-points" — busca puntos de recogida cercanos a la
            // dirección del cliente (para la opción "Recogida en punto")
            if (action === 'search-service-points') {
                if (!orderId) {
                    return res.status(400).json({ success: false, error: 'Falta el pedido' });
                }

                const uid = await callOdoo(ODOO_URL, 'common', 'authenticate', [ODOO_DB, ODOO_LOGIN, ODOO_API_KEY, {}]);
                if (!uid) return res.status(500).json({ success: false, error: 'No se pudo autenticar con Odoo' });

                const { partner, countryCode } = await getOrderShippingAddress(ODOO_URL, ODOO_DB, uid, ODOO_API_KEY, orderId);
                if (!partner) {
                    return res.status(400).json({ success: false, error: 'No se pudo leer la dirección del cliente' });
                }

                try {
                    const points = await searchSendcloudServicePoints(countryCode, partner.zip);
                    return res.status(200).json({ success: true, points });
                } catch (sendcloudErr) {
                    return res.status(502).json({ success: false, error: `Sendcloud: ${sendcloudErr.message}` });
                }
            }

            // "create-label" — crea el envío + etiqueta en Sendcloud y guarda el
            // número de seguimiento en la transferencia de Odoo correspondiente.
            // body: { orderId, serviceKey, weightKg, servicePointId? }
            // serviceKey es una de las claves de SHIPPING_SERVICES (arriba). Si ese
            // servicio necesita punto de recogida, servicePointId es obligatorio
            // (viene de haber llamado antes a "search-service-points").
            if (action === 'create-label') {
                if (!orderId) {
                    return res.status(400).json({ success: false, error: 'Falta el pedido' });
                }
                const serviceKey = req.body.serviceKey;
                const service = SHIPPING_SERVICES[serviceKey];
                if (!service) {
                    return res.status(400).json({ success: false, error: 'Servicio de envío no reconocido' });
                }
                const weightKg = Number(req.body.weightKg) > 0 ? Number(req.body.weightKg) : DEFAULT_WEIGHT_KG;
                if (service.needsServicePoint && !req.body.servicePointId) {
                    return res.status(400).json({ success: false, error: 'Falta elegir el punto de recogida' });
                }

                const uid = await callOdoo(ODOO_URL, 'common', 'authenticate', [ODOO_DB, ODOO_LOGIN, ODOO_API_KEY, {}]);
                if (!uid) return res.status(500).json({ success: false, error: 'No se pudo autenticar con Odoo' });

                const orderData = await callOdoo(ODOO_URL, 'object', 'execute_kw', [
                    ODOO_DB, uid, ODOO_API_KEY,
                    'sale.order', 'read',
                    [[orderId]],
                    { fields: ['name'] }
                ]);
                if (!orderData.length) {
                    return res.status(404).json({ success: false, error: 'Pedido no encontrado' });
                }
                const orderName = orderData[0].name;

                const { partner, countryCode } = await getOrderShippingAddress(ODOO_URL, ODOO_DB, uid, ODOO_API_KEY, orderId);
                if (!partner) {
                    return res.status(400).json({ success: false, error: 'No se pudo leer la dirección del cliente' });
                }
                if (!partner.street || !partner.city || !partner.zip || !partner.country_id) {
                    return res.status(400).json({ success: false, error: 'Al cliente le falta dirección, ciudad, código postal o país en Odoo — complétalo antes de crear la etiqueta.' });
                }

                const shippingMethodId = resolveShippingMethodId(serviceKey, weightKg);

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
                        orderNumber: orderName,
                        weightKg,
                        shippingMethodId,
                        toServicePoint: service.needsServicePoint ? Number(req.body.servicePointId) : undefined
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
                const lines = linesByOrderId[o.id] || [];
                return {
                    id: o.id,
                    name: o.name,
                    customer: Array.isArray(o.partner_id) ? o.partner_id[1] : '',
                    date_order: o.date_order,
                    amount_total: o.amount_total,
                    state: o.state,
                    lines,
                    suggestedWeightKg: calculateSuggestedWeight(lines),
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