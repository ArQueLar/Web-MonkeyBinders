// api/_lib/email.js
// Envío de emails transaccionales (confirmación de pedido) usando Resend
// (https://resend.com). Web3Forms —que ya usamos para el formulario de
// personalización— no vale para esto: está pensado para "alguien te escribe
// a ti", no para "tú le mandas un email de confirmación a un cliente
// concreto". Resend tiene un plan gratuito de sobra (3.000 emails/mes) y una
// API muy simple, sin necesidad de librerías (una sola llamada fetch).

function buildOrderConfirmationHtml({ customerName, orderName, items, subtotal, shippingCost, total }) {
    const itemsRows = items.map(i => `
        <tr>
            <td style="padding:10px 0; border-bottom:1px solid #eee; color:#333;">${i.name} × ${i.quantity}</td>
            <td style="padding:10px 0; border-bottom:1px solid #eee; text-align:right; color:#333;">${(i.price * i.quantity).toFixed(2)} €</td>
        </tr>
    `).join('');

    return `
    <div style="font-family: -apple-system, Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #333;">
        <h1 style="color: #2f5233; font-size: 22px;">¡Gracias por tu compra, ${customerName}!</h1>
        <p>Hemos recibido tu pedido <strong>${orderName}</strong> y ya lo estamos preparando. Te avisaremos en cuanto salga hacia tu dirección.</p>

        <table style="width:100%; border-collapse:collapse; margin: 24px 0;">
            ${itemsRows}
        </table>

        <table style="width:100%; font-size:14px;">
            <tr><td>Subtotal</td><td style="text-align:right;">${subtotal.toFixed(2)} €</td></tr>
            <tr><td>Envío</td><td style="text-align:right;">${shippingCost.toFixed(2)} €</td></tr>
            <tr><td style="font-weight:bold; font-size:17px; padding-top:8px;">Total</td><td style="text-align:right; font-weight:bold; font-size:17px; padding-top:8px; color:#2f5233;">${total.toFixed(2)} €</td></tr>
        </table>

        <p style="margin-top:32px; color:#888; font-size:12px; border-top:1px solid #eee; padding-top:16px;">
            Monkey Binders · monkeybinders@gmail.com<br>
            Si tienes cualquier duda sobre tu pedido, responde directamente a este email.
        </p>
    </div>
    `;
}

// No lanza excepción si falla — un email que no se envía nunca debe tumbar la
// creación del pedido, que es lo importante de verdad. Solo se registra el
// error en los logs de Vercel para poder revisarlo si hiciera falta.
export async function sendOrderConfirmationEmail({ to, customerName, orderName, items, subtotal, shippingCost, total }) {
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
        console.error('Falta RESEND_API_KEY — no se pudo enviar el email de confirmación del pedido', orderName);
        return;
    }

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: process.env.RESEND_FROM_EMAIL || 'Monkey Binders <onboarding@resend.dev>',
                to: [to],
                reply_to: 'monkeybinders@gmail.com',
                subject: `Confirmación de tu pedido ${orderName} — Monkey Binders`,
                html: buildOrderConfirmationHtml({ customerName, orderName, items, subtotal, shippingCost, total })
            })
        });

        if (!response.ok) {
            const data = await response.json().catch(() => null);
            console.error('Resend rechazó el email de confirmación:', data);
        }
    } catch (err) {
        console.error('Error de conexión al enviar el email de confirmación:', err.message);
    }
}
