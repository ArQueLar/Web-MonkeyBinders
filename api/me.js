// api/me.js
// Comprueba si la cookie de sesión es válida. No toca Odoo para nada — la
// cookie ya lleva firmados el nombre/email/partnerId, así que esto es
// instantáneo y no gasta ninguna llamada a Odoo en cada carga de página.

import { getSessionFromRequest } from '../lib/auth.js';

export default async function handler(req, res) {
    const session = getSessionFromRequest(req);

    if (!session) {
        return res.status(200).json({ success: true, loggedIn: false });
    }

    return res.status(200).json({
        success: true,
        loggedIn: true,
        user: { name: session.name, email: session.email }
    });
}
