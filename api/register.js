// api/register.js
// Crea un nuevo Usuario de Portal real en Odoo. Reutiliza el MISMO usuario de
// integración que get-products.js (ODOO_LOGIN / ODOO_API_KEY) — no uno separado,
// porque la suscripción de Odoo solo permite un usuario interno. Por eso, a ese
// usuario hay que darle permiso de Administración ("Ajustes") en Odoo, para que
// pueda crear usuarios además de solo leer productos.

import { callOdoo, signSession, setSessionCookie } from './_lib/auth.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Método no permitido' });
    }

    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
        return res.status(400).json({ success: false, error: 'Faltan datos (nombre, email o contraseña)' });
    }

    // Misma regla que en el formulario: mínimo 8 caracteres, mayúscula, minúscula, número y símbolo.
    const passwordRules = {
        length: password.length >= 8,
        lower: /[a-z]/.test(password),
        upper: /[A-Z]/.test(password),
        number: /[0-9]/.test(password),
        symbol: /[^A-Za-z0-9]/.test(password)
    };
    if (!Object.values(passwordRules).every(Boolean)) {
        return res.status(400).json({ success: false, error: 'La contraseña debe tener al menos 8 caracteres, con mayúscula, minúscula, número y símbolo.' });
    }

    const ODOO_URL = process.env.ODOO_URL;
    const ODOO_DB = process.env.ODOO_DB;
    const ODOO_LOGIN = process.env.ODOO_LOGIN;
    const ODOO_API_KEY = process.env.ODOO_API_KEY;

    if (!ODOO_URL || !ODOO_DB || !ODOO_LOGIN || !ODOO_API_KEY || !process.env.JWT_SECRET) {
        return res.status(500).json({ success: false, error: 'Faltan variables de entorno en Vercel' });
    }

    try {
        const uid = await callOdoo(ODOO_URL, 'common', 'authenticate', [ODOO_DB, ODOO_LOGIN, ODOO_API_KEY, {}]);
        if (!uid) {
            return res.status(500).json({ success: false, error: 'No se pudo autenticar con Odoo' });
        }

        // ¿Ya existe una cuenta con este email?
        const existing = await callOdoo(ODOO_URL, 'object', 'execute_kw', [
            ODOO_DB, uid, ODOO_API_KEY,
            'res.users', 'search_read',
            [[['login', '=', email]]],
            { fields: ['id'] }
        ]);
        if (existing.length > 0) {
            return res.status(409).json({ success: false, error: 'Ya existe una cuenta con ese email' });
        }

        // Buscamos el ID real del grupo "Portal" (base.group_portal) en esta base de datos
        const portalGroupRef = await callOdoo(ODOO_URL, 'object', 'execute_kw', [
            ODOO_DB, uid, ODOO_API_KEY,
            'ir.model.data', 'search_read',
            [[['module', '=', 'base'], ['name', '=', 'group_portal']]],
            { fields: ['res_id'] }
        ]);
        if (portalGroupRef.length === 0) {
            return res.status(500).json({ success: false, error: 'No se encontró el grupo "Portal" en Odoo' });
        }
        const portalGroupId = portalGroupRef[0].res_id;

        // Creamos el usuario de portal
        const newUserId = await callOdoo(ODOO_URL, 'object', 'execute_kw', [
            ODOO_DB, uid, ODOO_API_KEY,
            'res.users', 'create',
            [{
                name,
                login: email,
                email,
                password,
                group_ids: [[6, 0, [portalGroupId]]] // en Odoo 19 se llama "group_ids" (antes "groups_id")
            }]
        ]);

        const partnerData = await callOdoo(ODOO_URL, 'object', 'execute_kw', [
            ODOO_DB, uid, ODOO_API_KEY,
            'res.users', 'read',
            [[newUserId]],
            { fields: ['partner_id'] }
        ]);
        const partnerId = Array.isArray(partnerData[0].partner_id) ? partnerData[0].partner_id[0] : partnerData[0].partner_id;

        // Inicia sesión automáticamente justo después de registrarse
        const token = signSession({ uid: newUserId, email, name, partnerId });
        setSessionCookie(res, token);

        return res.status(200).json({ success: true, user: { name, email } });
    } catch (err) {
        return res.status(500).json({ success: false, error: 'Error al crear la cuenta en Odoo', detail: err.message });
    }
}