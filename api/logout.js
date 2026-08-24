// api/logout.js
// Borra la cookie de sesión. No hace falta avisar a Odoo de nada: la sesión
// vive solo en esta cookie firmada, así que basta con invalidarla aquí.

import { clearSessionCookie } from './_lib/auth.js';

export default async function handler(req, res) {
    clearSessionCookie(res);
    return res.status(200).json({ success: true });
}
