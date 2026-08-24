// lib/auth.js
// Utilidades compartidas por las funciones de autenticación (api/login.js,
// api/register.js, api/me.js, api/logout.js, api/orders.js).
// Vive fuera de la carpeta api/ a propósito: Vercel convierte en endpoint
// público cualquier archivo dentro de api/, y esto es solo código interno.

import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET;
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 días
const COOKIE_NAME = 'mb_session';

function base64url(input) {
    return Buffer.from(input).toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(input) {
    input = input.replace(/-/g, '+').replace(/_/g, '/');
    while (input.length % 4) input += '=';
    return Buffer.from(input, 'base64').toString('utf8');
}

function sign(body) {
    return crypto.createHmac('sha256', JWT_SECRET).update(body).digest('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Crea un token de sesión firmado (formato similar a un JWT, sin dependencias externas)
export function signSession(payload) {
    const body = base64url(JSON.stringify({ ...payload, iat: Date.now() }));
    return `${body}.${sign(body)}`;
}

// Verifica el token y devuelve el payload si es válido, o null si no lo es / ha caducado
export function verifySession(token) {
    if (!token || !token.includes('.')) return null;
    const [body, signature] = token.split('.');
    if (sign(body) !== signature) return null; // firma no coincide: manipulado o corrupto
    try {
        const payload = JSON.parse(base64urlDecode(body));
        if (Date.now() - payload.iat > SESSION_MAX_AGE_MS) return null; // caducado
        return payload;
    } catch {
        return null;
    }
}

export function getCookie(req, name) {
    const cookies = req.headers.cookie || '';
    const match = cookies.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
}

export function getSessionFromRequest(req) {
    return verifySession(getCookie(req, COOKIE_NAME));
}

export function setSessionCookie(res, token) {
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_MS / 1000}`);
}

export function clearSessionCookie(res) {
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
}

// Llamada genérica a Odoo por JSON-RPC (misma idea que en get-products.js)
export async function callOdoo(odooUrl, service, method, args) {
    const response = await fetch(`${odooUrl}/jsonrpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { service, method, args }, id: Date.now() })
    });
    const data = await response.json();
    if (data.error) throw new Error(JSON.stringify(data.error));
    return data.result;
}
