/* ==========================================================================
   FORMULARIO "MONKEY CLUB" DEL PIE — envía el email a la tienda (api/register,
   acción newsletter). Funciona igual en todas las páginas que tengan el pie.
   ========================================================================== */

import { showToast } from './toast.js';

export function initNewsletter() {
    document.querySelectorAll('.newsletter-form').forEach(form => {
        const input = form.querySelector('input[type="email"]');
        const button = form.querySelector('button[type="submit"]');
        if (!input || !button) return;

        input.setAttribute('aria-label', 'Tu email');
        input.autocomplete = 'email';

        // Campo trampa para bots (invisible para personas)
        const trap = document.createElement('input');
        trap.type = 'text';
        trap.name = 'website';
        trap.tabIndex = -1;
        trap.autocomplete = 'off';
        trap.setAttribute('aria-hidden', 'true');
        trap.style.cssText = 'position:absolute; left:-9999px; width:1px; height:1px; opacity:0;';
        form.appendChild(trap);

        // Aviso de privacidad y estado
        const note = document.createElement('p');
        note.className = 'newsletter-note';
        note.innerHTML = 'Al suscribirte aceptas nuestra <a href="/politica-privacidad.html">Política de Privacidad</a>.';
        form.insertAdjacentElement('afterend', note);

        form.addEventListener('submit', async e => {
            e.preventDefault();
            const email = input.value.trim();
            if (!email) return;
            const label = button.textContent;
            button.disabled = true;
            button.textContent = '...';
            try {
                const r = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'newsletter', email, website: trap.value })
                });
                const data = await r.json().catch(() => ({}));
                if (r.ok && data.success) {
                    input.value = '';
                    showToast('✓ ¡Gracias por unirte al Monkey Club!');
                } else {
                    showToast(data.error || 'No se pudo completar la suscripción. Inténtalo de nuevo.');
                }
            } catch (err) {
                showToast('Error de conexión. Inténtalo de nuevo más tarde.');
            } finally {
                button.disabled = false;
                button.textContent = label;
            }
        });
    });
}
