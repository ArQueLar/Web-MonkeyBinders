// api/admin/session.js
// Gestiona la sesión de administrador en UN SOLO endpoint (mismo motivo que
// api/session.js: el límite de 12 funciones del plan gratuito de Vercel):
//   GET    -> comprueba si hay sesión de admin activa (antes admin/me.js)
//   POST   -> login, body: { email, password } (antes admin/login.js)
//   DELETE -> logout (antes admin/logout.js)
//
// Solo deja entrar (POST) a usuarios de Odoo con permiso de Administración →
// "Ajustes" (base.group_system), sean quienes sean.

import { callOdoo, signSession, setAdminSessionCookie, clearAdminSessionCookie, getAdminSessionFromRequest } from '../_lib/auth.js';

export default async function handler(req, res) {
    if (req.method === 'GET') {
        const session = getAdminSessionFromRequest(req);
        return res.status(200).json({ success: true, loggedIn: Boolean(session) });
    }

    if (req.method === 'DELETE') {
        clearAdminSessionCookie(res);
        return res.status(200).json({ success: true });
    }

    if (req.method === 'POST') {
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
            const uid = await callOdoo(ODOO_URL, 'common', 'authenticate', [ODOO_DB, email, password, {}]);
            if (!uid) {
                return res.status(401).json({ success: false, error: 'Email o contraseña incorrectos' });
            }

            const isAdmin = await callOdoo(ODOO_URL, 'object', 'execute_kw', [
                ODOO_DB, uid, password,
                'res.users', 'has_group',
                [[uid], 'base.group_system'] // [uid] = "sobre qué registro se ejecuta", luego el argumento real de has_group
            ]);

            if (!isAdmin) {
                return res.status(401).json({ success: false, error: 'Email o contraseña incorrectos' });
            }

            const token = signSession({ role: 'admin', uid, email });
            setAdminSessionCookie(res, token);

            return res.status(200).json({ success: true });
        } catch (err) {
            return res.status(500).json({ success: false, error: 'Error al conectar con Odoo' });
        }
    }

    return res.status(405).json({ success: false, error: 'Método no permitido' });
}