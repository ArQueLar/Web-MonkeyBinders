// api/admin/session.js
// Gestiona la sesión de administrador en UN SOLO endpoint (mismo motivo que
// api/session.js: el límite de 12 funciones del plan gratuito de Vercel):
//   GET    -> comprueba si hay sesión de admin activa (antes admin/me.js)
//   POST   -> login, body: { email, password } (antes admin/login.js)
//   DELETE -> logout (antes admin/logout.js)
//
// Solo deja entrar (POST) a usuarios de Odoo con permiso de Administración →
// "Ajustes" (base.group_system), sean quienes sean.

import { isBlocked, hit, clear, clientIp, tooMany } from '../_lib/ratelimit.js';
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
        const body = req.body || {};
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : '';
        const password = typeof body.password === 'string' ? body.password.slice(0, 200) : '';
        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Falta email o contraseña' });
        }

        // Más estricto que el de clientes: 5 fallos por email o 10 por IP cada 15 minutos
        const WINDOW = 15 * 60 * 1000;
        const ipKey = `admin-ip:${clientIp(req)}`;
        const mailKey = `admin-mail:${email}`;
        const blocked = isBlocked(mailKey, 5).blocked ? isBlocked(mailKey, 5) : isBlocked(ipKey, 10);
        if (blocked.blocked) return tooMany(res, blocked.retryAfterSec);

        const ODOO_URL = process.env.ODOO_URL;
        const ODOO_DB = process.env.ODOO_DB;

        if (!ODOO_URL || !ODOO_DB || !process.env.JWT_SECRET) {
            return res.status(500).json({ success: false, error: 'Faltan variables de entorno en Vercel' });
        }

        try {
            const uid = await callOdoo(ODOO_URL, 'common', 'authenticate', [ODOO_DB, email, password, {}]);
            if (!uid) {
                hit(mailKey, WINDOW);
                hit(ipKey, WINDOW);
                return res.status(401).json({ success: false, error: 'Email o contraseña incorrectos' });
            }

            const isAdmin = await callOdoo(ODOO_URL, 'object', 'execute_kw', [
                ODOO_DB, uid, password,
                'res.users', 'has_group',
                [[uid], 'base.group_system'] // [uid] = "sobre qué registro se ejecuta", luego el argumento real de has_group
            ]);

            if (!isAdmin) {
                hit(mailKey, WINDOW);
                hit(ipKey, WINDOW);
                return res.status(401).json({ success: false, error: 'Email o contraseña incorrectos' });
            }

            clear(mailKey);
            const token = signSession({ role: 'admin', uid, email });
            setAdminSessionCookie(res, token);

            return res.status(200).json({ success: true });
        } catch (err) {
            return res.status(500).json({ success: false, error: 'Error al conectar con Odoo' });
        }
    }

    return res.status(405).json({ success: false, error: 'Método no permitido' });
}