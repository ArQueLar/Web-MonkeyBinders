// api/session.js
// Gestiona toda la sesión de cliente en UN SOLO endpoint (el plan gratuito de
// Vercel limita a 12 funciones serverless por despliegue, así que agrupamos
// por método HTTP en vez de tener un archivo por acción):
//   GET    -> comprueba si hay sesión activa (antes era api/me.js)
//   POST   -> inicia sesión, body: { email, password } (antes era api/login.js)
//   DELETE -> cierra sesión (antes era api/logout.js)

import { callOdoo, signSession, setSessionCookie, clearSessionCookie, getSessionFromRequest, setAdminSessionCookie } from './_lib/auth.js';

export default async function handler(req, res) {
    if (req.method === 'GET') {
        const session = getSessionFromRequest(req);
        if (!session) {
            return res.status(200).json({ success: true, loggedIn: false });
        }
        return res.status(200).json({ success: true, loggedIn: true, user: { name: session.name, email: session.email, isAdmin: session.isAdmin === true } });
    }

    if (req.method === 'DELETE') {
        clearSessionCookie(res);
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
            // Odoo verifica el email/contraseña exactamente igual que si el cliente
            // entrara por su propio portal — no reimplementamos ninguna lógica de contraseñas.
            const uid = await callOdoo(ODOO_URL, 'common', 'authenticate', [ODOO_DB, email, password, {}]);
            if (!uid) {
                return res.status(401).json({ success: false, error: 'Email o contraseña incorrectos' });
            }

            const userData = await callOdoo(ODOO_URL, 'object', 'execute_kw', [
                ODOO_DB, uid, password,
                'res.users', 'read',
                [[uid]],
                { fields: ['name', 'email', 'partner_id'] }
            ]);

            const user = userData[0];
            const partnerId = Array.isArray(user.partner_id) ? user.partner_id[0] : user.partner_id;

            // Comprobamos si esta cuenta es también Administrador de Odoo. Si lo es,
            // dejamos ya abierta la sesión de admin de regalo (cookie aparte), para
            // que pueda entrar al panel sin volver a escribir la contraseña.
            let isAdmin = false;
            try {
                isAdmin = await callOdoo(ODOO_URL, 'object', 'execute_kw', [
                    ODOO_DB, uid, password,
                    'res.users', 'has_group',
                    [[uid], 'base.group_system'] // [uid] = "sobre qué registro se ejecuta", luego el argumento real de has_group
                ]);
            } catch (e) {
                isAdmin = false; // si falla la comprobación, simplemente no se le ofrece el acceso admin
            }

            if (isAdmin) {
                const adminToken = signSession({ role: 'admin', uid, email: user.email || email });
                setAdminSessionCookie(res, adminToken);
            }

            const token = signSession({ uid, email: user.email || email, name: user.name, partnerId, isAdmin });
            setSessionCookie(res, token);

            return res.status(200).json({ success: true, user: { name: user.name, email: user.email || email, isAdmin } });
        } catch (err) {
            return res.status(500).json({ success: false, error: 'Error al conectar con Odoo' });
        }
    }

    return res.status(405).json({ success: false, error: 'Método no permitido' });
}