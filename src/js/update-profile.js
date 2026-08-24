// api/update-profile.js
// Permite al cliente logueado cambiar su nombre y, opcionalmente, su
// contraseña. El uid del usuario a modificar sale SIEMPRE de la cookie de
// sesión firmada (nunca del cuerpo de la petición), así que un cliente jamás
// puede editar la cuenta de otro. El cambio de contraseña exige reintroducir
// la contraseña actual, verificada de verdad contra Odoo.

import { getSessionFromRequest, callOdoo, signSession, setSessionCookie } from './_lib/auth.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Método no permitido' });
    }

    const session = getSessionFromRequest(req);
    if (!session) {
        return res.status(401).json({ success: false, error: 'No has iniciado sesión' });
    }

    const { name, currentPassword, newPassword } = req.body || {};

    const ODOO_URL = process.env.ODOO_URL;
    const ODOO_DB = process.env.ODOO_DB;
    const ODOO_LOGIN = process.env.ODOO_LOGIN;
    const ODOO_API_KEY = process.env.ODOO_API_KEY;

    try {
        const uid = await callOdoo(ODOO_URL, 'common', 'authenticate', [ODOO_DB, ODOO_LOGIN, ODOO_API_KEY, {}]);
        if (!uid) {
            return res.status(500).json({ success: false, error: 'No se pudo autenticar con Odoo' });
        }

        // --- Cambiar el nombre ---
        if (name) {
            await callOdoo(ODOO_URL, 'object', 'execute_kw', [
                ODOO_DB, uid, ODOO_API_KEY,
                'res.users', 'write',
                [[session.uid], { name }]
            ]);
        }

        // --- Cambiar la contraseña ---
        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({ success: false, error: 'Introduce tu contraseña actual para cambiarla' });
            }

            const passwordRules = {
                length: newPassword.length >= 8,
                lower: /[a-z]/.test(newPassword),
                upper: /[A-Z]/.test(newPassword),
                number: /[0-9]/.test(newPassword),
                symbol: /[^A-Za-z0-9]/.test(newPassword)
            };
            if (!Object.values(passwordRules).every(Boolean)) {
                return res.status(400).json({ success: false, error: 'La nueva contraseña debe tener al menos 8 caracteres, con mayúscula, minúscula, número y símbolo.' });
            }

            // Verificamos la contraseña actual autenticándonos DE VERDAD con ella,
            // exactamente igual que en login.js — así confirmamos que es el propio
            // cliente quien está pidiendo el cambio, no alguien con la sesión robada.
            const verifyUid = await callOdoo(ODOO_URL, 'common', 'authenticate', [ODOO_DB, session.email, currentPassword, {}]);
            if (!verifyUid) {
                return res.status(401).json({ success: false, error: 'La contraseña actual no es correcta' });
            }

            await callOdoo(ODOO_URL, 'object', 'execute_kw', [
                ODOO_DB, uid, ODOO_API_KEY,
                'res.users', 'write',
                [[session.uid], { password: newPassword }]
            ]);
        }

        // Renovamos la cookie de sesión (por si cambió el nombre)
        const updatedName = name || session.name;
        const token = signSession({ uid: session.uid, email: session.email, name: updatedName, partnerId: session.partnerId });
        setSessionCookie(res, token);

        return res.status(200).json({ success: true, user: { name: updatedName, email: session.email } });
    } catch (err) {
        return res.status(500).json({ success: false, error: 'Error al actualizar el perfil en Odoo', detail: err.message });
    }
}
