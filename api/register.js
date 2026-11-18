// api/register.js
// Crea un nuevo Usuario de Portal real en Odoo. Reutiliza el MISMO usuario de
// integración que get-products.js (ODOO_LOGIN / ODOO_API_KEY) — no uno separado,
// porque la suscripción de Odoo solo permite un usuario interno. Por eso, a ese
// usuario hay que darle permiso de Administración ("Ajustes") en Odoo, para que
// pueda crear usuarios además de solo leer productos.

import { callOdoo, signSession, verifySession, setSessionCookie } from './_lib/auth.js';
import { isBlocked, hit, clientIp, tooMany } from './_lib/ratelimit.js';
import { sendVerificationEmail, sendNewsletterSignupEmail, sendCustomizationRequestEmail } from './_lib/email.js';

// Si REQUIRE_EMAIL_VERIFICATION=true en Vercel, la cuenta se crea desactivada y solo
// se activa al pulsar el enlace que llega por email. Requiere que el envío por Resend
// funcione con clientes reales (dominio verificado en RESEND_FROM_EMAIL).
const VERIFY_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export default async function handler(req, res) {
    if (req.method === 'GET' && req.query.verify) {
        return handleVerify(req, res);
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Método no permitido' });
    }

    // Formulario del pie (Monkey Club): no crea cuenta, solo avisa a la tienda por email
    if (req.body && req.body.action === 'newsletter') {
        return handleNewsletter(req, res);
    }
    if (req.body && req.body.action === 'customization') {
        return handleCustomization(req, res);
    }

    // Límite de registros: 10 por hora y por IP
    const regKey = `register-ip:${clientIp(req)}`;
    const regBlock = isBlocked(regKey, 10);
    if (regBlock.blocked) return tooMany(res, regBlock.retryAfterSec);
    hit(regKey, 60 * 60 * 1000);

    const body = req.body || {};
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!name || !email || !password) {
        return res.status(400).json({ success: false, error: 'Faltan datos (nombre, email o contraseña)' });
    }
    if (!/^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(email) || password.length > 200) {
        return res.status(400).json({ success: false, error: 'Email o contraseña no válidos' });
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
            { fields: ['id', 'active'], context: { active_test: false } }
        ]);
        const requireVerification = process.env.REQUIRE_EMAIL_VERIFICATION === 'true' && Boolean(process.env.SITE_URL);
        const pending = existing.find(u => u.active === false);
        if (existing.length > 0 && !(requireVerification && pending)) {
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

        // Cuenta pendiente de verificar que se vuelve a registrar: actualizamos nombre y
        // contraseña con los últimos datos enviados y reenviamos el enlace.
        if (requireVerification && pending) {
            await callOdoo(ODOO_URL, 'object', 'execute_kw', [
                ODOO_DB, uid, ODOO_API_KEY,
                'res.users', 'write',
                [[pending.id], { name, password }],
                { context: { active_test: false } }
            ]);
            await sendLink(pending.id);
            return res.status(200).json({ success: true, pendingVerification: true });
        }

        async function sendLink(userId) {
            const token = signSession({ purpose: 'verify', uid: userId, email });
            const link = `${process.env.SITE_URL}/api/register?verify=${encodeURIComponent(token)}`;
            const result = await sendVerificationEmail({ to: email, name, link });
            if (!result.success) throw new Error(`No se pudo enviar el email de verificación: ${result.error}`);
        }

        // Creamos el usuario de portal
        const newUserId = await callOdoo(ODOO_URL, 'object', 'execute_kw', [
            ODOO_DB, uid, ODOO_API_KEY,
            'res.users', 'create',
            [{
                name,
                login: email,
                email,
                password,
                active: !requireVerification,
                group_ids: [[6, 0, [portalGroupId]]] // en Odoo 19 se llama "group_ids" (antes "groups_id")
            }]
        ]);

        if (requireVerification) {
            await sendLink(newUserId);
            return res.status(200).json({ success: true, pendingVerification: true });
        }

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
        console.error('register:', err.message);
        return res.status(500).json({ success: false, error: 'No se pudo crear la cuenta. Inténtalo de nuevo más tarde.' });
    }
}


// GET /api/register?verify=TOKEN — activa la cuenta, abre sesión y manda a "Mi cuenta"
async function handleVerify(req, res) {
    const payload = verifySession(String(req.query.verify));
    if (!payload || payload.purpose !== 'verify' || Date.now() - payload.iat > VERIFY_MAX_AGE_MS) {
        res.setHeader('Location', '/cuenta.html?verificacion=caducada');
        return res.status(302).end();
    }
    const ODOO_URL = process.env.ODOO_URL;
    const ODOO_DB = process.env.ODOO_DB;
    const ODOO_LOGIN = process.env.ODOO_LOGIN;
    const ODOO_API_KEY = process.env.ODOO_API_KEY;
    try {
        const uid = await callOdoo(ODOO_URL, 'common', 'authenticate', [ODOO_DB, ODOO_LOGIN, ODOO_API_KEY, {}]);
        const ctx = { context: { active_test: false } };
        const users = await callOdoo(ODOO_URL, 'object', 'execute_kw', [
            ODOO_DB, uid, ODOO_API_KEY, 'res.users', 'read', [[payload.uid]],
            { fields: ['name', 'login', 'partner_id'], ...ctx }
        ]);
        if (!users.length || users[0].login !== payload.email) throw new Error('Usuario no coincide');
        await callOdoo(ODOO_URL, 'object', 'execute_kw', [
            ODOO_DB, uid, ODOO_API_KEY, 'res.users', 'write', [[payload.uid], { active: true }], ctx
        ]);
        const partnerId = Array.isArray(users[0].partner_id) ? users[0].partner_id[0] : users[0].partner_id;
        setSessionCookie(res, signSession({ uid: payload.uid, email: payload.email, name: users[0].name, partnerId }));
        res.setHeader('Location', '/cuenta.html?verificacion=ok');
        return res.status(302).end();
    } catch (err) {
        console.error('verify:', err.message);
        res.setHeader('Location', '/cuenta.html?verificacion=error');
        return res.status(302).end();
    }
}


// POST /api/register {action:'newsletter', email, website}
async function handleNewsletter(req, res) {
    const key = `newsletter-ip:${clientIp(req)}`;
    const block = isBlocked(key, 5);
    if (block.blocked) return tooMany(res, block.retryAfterSec);
    hit(key, 60 * 60 * 1000);

    const body = req.body || {};
    // Honeypot anti-spam: un humano no rellena este campo oculto
    if (typeof body.website === 'string' && body.website.trim() !== '') {
        return res.status(200).json({ success: true });
    }
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : '';
    if (!/^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(email)) {
        return res.status(400).json({ success: false, error: 'Introduce un email válido' });
    }
    const result = await sendNewsletterSignupEmail({ email });
    if (!result.success) {
        return res.status(500).json({ success: false, error: 'No se pudo completar la suscripción. Inténtalo de nuevo más tarde.' });
    }
    return res.status(200).json({ success: true });
}


async function handleCustomization(req, res) {
    const key = `customization-ip:${clientIp(req)}`;
    const block = isBlocked(key, 5);
    if (block.blocked) return tooMany(res, block.retryAfterSec);
    hit(key, 60 * 60 * 1000);

    const body = req.body || {};
    if (typeof body.website === 'string' && body.website.trim() !== '') {
        return res.status(200).json({ success: true });
    }
    const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
    const name = str(body.name, 120);
    const email = str(body.email, 254).toLowerCase();
    const description = str(body.description, 3000);
    const size = str(body.size, 60);
    const color = str(body.color, 60);
    const imageUrl = str(body.imageUrl, 500);
    if (!name || !description || !size || !color) {
        return res.status(400).json({ success: false, error: 'Faltan datos del formulario' });
    }
    if (!/^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(email)) {
        return res.status(400).json({ success: false, error: 'Introduce un email válido' });
    }
    const result = await sendCustomizationRequestEmail({ name, email, description, size, color, imageUrl });
    if (!result.success) {
        return res.status(500).json({ success: false, error: 'No se pudo enviar la solicitud. Inténtalo de nuevo más tarde.' });
    }
    return res.status(200).json({ success: true });
}
