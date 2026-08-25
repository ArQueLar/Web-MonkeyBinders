// api/orders.js
// Devuelve los pedidos de venta del cliente que tiene la sesión activa,
// usando el usuario de integración de solo-lectura (el mismo de get-products.js),
// filtrando siempre por el partnerId que llevaba la cookie de sesión — un
// cliente nunca puede pedir los pedidos de otro, porque el partnerId no lo
// controla el navegador, viene firmado dentro de la cookie.

import { getSessionFromRequest, callOdoo } from './_lib/auth.js';

export default async function handler(req, res) {
    const session = getSessionFromRequest(req);
    if (!session) {
        return res.status(401).json({ success: false, error: 'No has iniciado sesión' });
    }

    const ODOO_URL = process.env.ODOO_URL;
    const ODOO_DB = process.env.ODOO_DB;
    const ODOO_LOGIN = process.env.ODOO_LOGIN;
    const ODOO_API_KEY = process.env.ODOO_API_KEY;

    try {
        const uid = await callOdoo(ODOO_URL, 'common', 'authenticate', [ODOO_DB, ODOO_LOGIN, ODOO_API_KEY, {}]);
        if (!uid) {
            return res.status(500).json({ success: false, error: 'No se pudo autenticar con Odoo' });
        }

        const orders = await callOdoo(ODOO_URL, 'object', 'execute_kw', [
            ODOO_DB, uid, ODOO_API_KEY,
            'sale.order', 'search_read',
            [[
                ['partner_id', '=', session.partnerId],
                ['state', 'in', ['sale', 'done']] // solo pedidos confirmados de verdad, no presupuestos/borradores sin confirmar
            ]],
            {
                fields: ['name', 'date_order', 'amount_total', 'state'],
                order: 'date_order desc',
                limit: 50
            }
        ]);

        // --- ESTADO REAL DE ENVÍO (stock.picking) ---
        // El estado de "sale.order" solo dice si el pedido está confirmado, no si ya se
        // ha preparado/enviado/entregado — eso vive en las transferencias de Inventario,
        // relacionadas con cada pedido mediante el campo "sale_id".
        const orderIds = orders.map(o => o.id);
        let pickingsByOrderId = {};

        if (orderIds.length > 0) {
            try {
                const pickings = await callOdoo(ODOO_URL, 'object', 'execute_kw', [
                    ODOO_DB, uid, ODOO_API_KEY,
                    'stock.picking', 'search_read',
                    [[
                        ['sale_id', 'in', orderIds],
                        ['picking_type_id.code', '=', 'outgoing'] // solo envíos AL cliente, no recepciones/devoluciones
                    ]],
                    { fields: ['sale_id', 'state', 'date_done', 'scheduled_date'], order: 'id desc' }
                ]);
                pickings.forEach(p => {
                    const orderId = Array.isArray(p.sale_id) ? p.sale_id[0] : p.sale_id;
                    if (!pickingsByOrderId[orderId]) pickingsByOrderId[orderId] = [];
                    pickingsByOrderId[orderId].push(p);
                });
            } catch (e) {
                // Si el módulo de Inventario no está instalado o algo falla aquí, seguimos
                // sin datos de envío en vez de romper la lista de pedidos entera.
            }
        }

        const ordersWithShipping = orders.map(o => {
            const pickings = pickingsByOrderId[o.id] || [];
            // Si hay varias transferencias para el mismo pedido (ej. una cancelada y
            // sustituida por otra, típico de entregas parciales), preferimos la última
            // que NO esté cancelada — solo mostramos "cancelado" si de verdad todas lo están.
            const latestPicking = pickings.find(p => p.state !== 'cancel') || pickings[0];
            return {
                ...o,
                shippingState: latestPicking ? latestPicking.state : null,
                shippingDate: latestPicking ? (latestPicking.date_done || latestPicking.scheduled_date) : null
            };
        });

        return res.status(200).json({ success: true, orders: ordersWithShipping });
    } catch (err) {
        return res.status(500).json({ success: false, error: 'Error al leer los pedidos de Odoo' });
    }
}