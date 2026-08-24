// api/orders.js
// Devuelve los pedidos de venta del cliente que tiene la sesión activa,
// usando el usuario de integración de solo-lectura (el mismo de get-products.js),
// filtrando siempre por el partnerId que llevaba la cookie de sesión — un
// cliente nunca puede pedir los pedidos de otro, porque el partnerId no lo
// controla el navegador, viene firmado dentro de la cookie.

import { getSessionFromRequest, callOdoo } from '../lib/auth.js';

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
            [[['partner_id', '=', session.partnerId]]],
            {
                fields: ['name', 'date_order', 'amount_total', 'state'],
                order: 'date_order desc',
                limit: 50
            }
        ]);

        return res.status(200).json({ success: true, orders });
    } catch (err) {
        return res.status(500).json({ success: false, error: 'Error al leer los pedidos de Odoo' });
    }
}
