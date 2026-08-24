// api/admin/orders.js
// Trae TODOS los pedidos confirmados (de cualquier cliente), con sus líneas
// (para saber qué hay que fabricar) y su estado real de envío. Solo accesible
// con sesión de administrador.

import { getAdminSessionFromRequest, callOdoo } from '../_lib/auth.js';

export default async function handler(req, res) {
    const session = getAdminSessionFromRequest(req);
    if (!session) {
        return res.status(401).json({ success: false, error: 'No autorizado' });
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
                    { fields: ['id', 'sale_id', 'state'], order: 'id desc' }
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

        const fullOrders = orders.map(o => {
            const pickings = pickingsByOrderId[o.id] || [];
            const latestPicking = pickings[0];
            return {
                id: o.id,
                name: o.name,
                customer: Array.isArray(o.partner_id) ? o.partner_id[1] : '',
                date_order: o.date_order,
                amount_total: o.amount_total,
                state: o.state,
                lines: linesByOrderId[o.id] || [],
                pickingId: latestPicking ? latestPicking.id : null,
                shippingState: latestPicking ? latestPicking.state : null
            };
        });

        return res.status(200).json({ success: true, orders: fullOrders });
    } catch (err) {
        return res.status(500).json({ success: false, error: 'Error al leer los pedidos de Odoo' });
    }
}
