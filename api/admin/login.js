// api/admin/login.js
// Login del panel de administración. Deja entrar a CUALQUIER usuario de Odoo
// que tenga permiso de Administración → "Ajustes" (base.group_system) — no a
// una cuenta concreta. Así, si en el futuro das ese permiso a otra persona en
// Odoo, entra sin tener que tocar nada aquí.

import { callOdoo, signSession, setAdminSessionCookie } from '../_lib/auth.js';

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
        // Verificamos las credenciales con las SUYAS PROPIAS, igual que en login.js normal
        const uid = await callOdoo(ODOO_URL, 'common', 'authenticate', [ODOO_DB, email, password, {}]);
        if (!uid) {
            return res.status(401).json({ success: false, error: 'Email o contraseña incorrectos' });
        }

        // Comprobamos que sea Administrador de verdad (permiso "Ajustes"), no solo que
        // tenga una cuenta válida — cualquier usuario de portal también podría autenticarse.
        const isAdmin = await callOdoo(ODOO_URL, 'object', 'execute_kw', [
            ODOO_DB, uid, password,
            'res.users', 'has_group',
            ['base.group_system']
        ]);

        if (!isAdmin) {
            // Mismo mensaje que credenciales incorrectas: no confirmamos a nadie
            // que su cuenta existe pero le falta el permiso.
            return res.status(401).json({ success: false, error: 'Email o contraseña incorrectos' });
        }

        const token = signSession({ role: 'admin', uid, email });
        setAdminSessionCookie(res, token);

        return res.status(200).json({ success: true });
    } catch (err) {
        return res.status(500).json({ success: false, error: 'Error al conectar con Odoo' });
    }
}