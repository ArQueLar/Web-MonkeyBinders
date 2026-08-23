// api/check-config.js
// Función serverless de Vercel. Solo confirma si cada variable de entorno está
// configurada (true/false) — NUNCA devuelve el valor real de ninguna clave.
// Útil para comprobar rápidamente, tras un deploy, si falta configurar algo en Vercel.

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Método no permitido' });
    }

    return res.status(200).json({
        success: true,
        config: {
            imgbb: {
                IMGBB_API_KEY: Boolean(process.env.IMGBB_API_KEY) && process.env.IMGBB_API_KEY !== 'TU_API_KEY_DE_IMGBB'
            },
            odoo: {
                ODOO_URL: Boolean(process.env.ODOO_URL),
                ODOO_DB: Boolean(process.env.ODOO_DB),
                ODOO_LOGIN: Boolean(process.env.ODOO_LOGIN),
                ODOO_API_KEY: Boolean(process.env.ODOO_API_KEY)
            }
        }
    });
}
