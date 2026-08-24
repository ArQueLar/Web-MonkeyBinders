// api/login.js
// Verifica email + contraseña directamente contra Odoo (usando LAS CREDENCIALES
// DEL PROPIO CLIENTE, no las del usuario de integración) y, si son correctas,
// abre sesión guardando una cookie firmada. La contraseña nunca se guarda en
// ningún sitio nuestro — Odoo es quien la valida.

import { callOdoo, signSession, setSessionCookie } from '../lib/auth.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Método no permitido' });
    }

    const { email, password } = req.body || {};
    if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Falta email o contraseña' });
    }

    const ODOO_URL = process.env.ODOO_URL;
    const ODOO_DB = process.env.ODOO_DB;

    if (!ODOO_URL || !ODOO_DB || !process.env.JWT_SECRET) {
        return res.status(500).json({ success: false, error: 'Faltan variables de entorno en Vercel' });
    }

    try {
        // Odoo verifica el email/contraseña exactamente igual que si el cliente
        // entrara por su propio portal — no reimplementamos ninguna lógica de contraseñas.
        const uid = await callOdoo(ODOO_URL, 'common', 'authenticate', [ODOO_DB, email, password, {}]);

        if (!uid) {
            return res.status(401).json({ success: false, error: 'Email o contraseña incorrectos' });
        }

        // Con el usuario ya autenticado, leemos sus datos básicos usando SUS PROPIAS credenciales
        const userData = await callOdoo(ODOO_URL, 'object', 'execute_kw', [
            ODOO_DB, uid, password,
            'res.users', 'read',
            [[uid]],
            { fields: ['name', 'email', 'partner_id'] }
        ]);

        const user = userData[0];
        const partnerId = Array.isArray(user.partner_id) ? user.partner_id[0] : user.partner_id;

        const token = signSession({ uid, email: user.email || email, name: user.name, partnerId });
        setSessionCookie(res, token);

        return res.status(200).json({ success: true, user: { name: user.name, email: user.email || email } });
    } catch (err) {
        return res.status(500).json({ success: false, error: 'Error al conectar con Odoo' });
    }
}
