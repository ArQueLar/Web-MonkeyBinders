// api/admin/update-shipping.js
// Avanza el estado de una transferencia de envío (stock.picking) en Odoo.
// "ready"   -> intenta reservar/preparar la mercancía (action_assign)
// "deliver" -> valida la transferencia como entregada (button_validate)
//
// AVISO: en Odoo, "button_validate" a veces abre un asistente (por ejemplo si
// hay que confirmar una entrega parcial/backorder) en vez de completarse en un
// solo paso. Si tu flujo de Inventario usa esos asistentes, puede que haya que
// ajustar esto tras la primera prueba real.

import { getAdminSessionFromRequest, callOdoo } from '../_lib/auth.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Método no permitido' });
    }

    const session = getAdminSessionFromRequest(req);
    if (!session) {
        return res.status(401).json({ success: false, error: 'No autorizado' });
    }

    const { pickingId, action } = req.body || {};
    if (!pickingId || !['ready', 'deliver'].includes(action)) {
        return res.status(400).json({ success: false, error: 'Datos inválidos' });
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

        const method = action === 'ready' ? 'action_assign' : 'button_validate';

        await callOdoo(ODOO_URL, 'object', 'execute_kw', [
            ODOO_DB, uid, ODOO_API_KEY,
            'stock.picking', method,
            [[pickingId]]
        ]);

        return res.status(200).json({ success: true });
    } catch (err) {
        return res.status(500).json({ success: false, error: 'No se pudo actualizar el envío en Odoo', detail: err.message });
    }
}
