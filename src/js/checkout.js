/* ==========================================================================
   CHECKOUT — checkout.html: resumen del carrito, dirección de envío,
   elección de método de envío (con mapa de puntos de recogida) y pago.
   ========================================================================== */

import { getImgPath } from './utils.js';
import { checkSession } from './auth.js';
import { showToast } from './toast.js';

const FREE_SHIPPING_THRESHOLD = 200; // debe coincidir con api/_lib/shipping-pricing.js

function getCart() {
    try {
        const raw = localStorage.getItem('monkey_binders_cart');
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

export async function initCheckout() {
    const container = document.getElementById('checkout-page-content');
    if (!container) return;

    const cart = getCart();
    if (cart.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:60px 0;">
                <p style="color:var(--text-muted); margin-bottom:20px;">Tu carrito está vacío.</p>
                <a href="/tienda/tienda.html" class="btn-primary" style="display:inline-flex; padding:12px 24px;">IR A LA TIENDA</a>
            </div>
        `;
        return;
    }

    const session = await checkSession();

    renderCheckout(container, cart, session);
}

function renderCheckout(container, cart, session) {
    const subtotal = cart.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
    const user = session.loggedIn ? session.user : null;

    container.innerHTML = `
        <h1 class="section-title" style="font-size:26px; margin-bottom:24px;">FINALIZAR COMPRA</h1>

        <div style="display:grid; grid-template-columns: 1.3fr 1fr; gap:40px; align-items:start;" class="checkout-grid">
            <div>
                <h2 style="font-size:16px; margin-bottom:14px;">TUS DATOS</h2>
                <form id="checkout-form" style="display:flex; flex-direction:column; gap:12px; margin-bottom:32px;">
                    <input type="text" name="name" placeholder="Nombre completo" class="form-input" value="${user?.name || ''}" required>
                    <input type="email" name="email" placeholder="Correo electrónico" class="form-input" value="${user?.email || ''}" required>
                    <input type="tel" name="phone" placeholder="Teléfono" class="form-input" required>

                    <h2 style="font-size:16px; margin:18px 0 4px;">DIRECCIÓN DE ENVÍO</h2>
                    <input type="text" name="street" placeholder="Calle y número" class="form-input" required>
                    <div style="display:flex; gap:10px;">
                        <input type="text" name="city" placeholder="Ciudad" class="form-input" required style="flex:2;">
                        <input type="text" name="postalCode" placeholder="Código postal" class="form-input" required style="flex:1;" id="checkout-postal-code">
                    </div>
                    <select name="country" class="form-input" id="checkout-country">
                        <option value="ES" selected>España</option>
                        <option value="PT">Portugal</option>
                        <option value="FR">Francia</option>
                        <option value="DE">Alemania</option>
                        <option value="IT">Italia</option>
                    </select>

                    <h2 style="font-size:16px; margin:18px 0 4px;">MÉTODO DE ENVÍO</h2>
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        <label style="display:flex; align-items:center; gap:10px; border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:12px 14px; cursor:pointer;">
                            <input type="radio" name="deliveryMethod" value="home" checked class="checkout-delivery-radio">
                            <span>🏠 Entrega a domicilio</span>
                        </label>
                        <label style="display:flex; align-items:center; gap:10px; border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:12px 14px; cursor:pointer;">
                            <input type="radio" name="deliveryMethod" value="pickup" class="checkout-delivery-radio">
                            <span>📮 Recogida en punto de Correos</span>
                        </label>
                    </div>
                    <div id="checkout-pickup-picker" style="display:none; margin-top:6px;"></div>

                    <label style="display:flex; align-items:flex-start; gap:8px; font-size:12px; color:var(--text-muted); cursor:pointer; margin-top:14px;">
                        <input type="checkbox" name="acceptTerms" required style="margin-top:2px; flex-shrink:0;">
                        <span>He leído y acepto los <a href="/terminos-condiciones.html" target="_blank" style="color:var(--accent-jungle);">Términos y Condiciones</a> y la <a href="/politica-privacidad.html" target="_blank" style="color:var(--accent-jungle);">Política de Privacidad</a>.</span>
                    </label>
                </form>
            </div>

            <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:24px;">
                <h2 style="font-size:16px; margin-bottom:16px;">RESUMEN DEL PEDIDO</h2>
                <div id="checkout-cart-items">
                    ${cart.map(i => `
                        <div style="display:flex; gap:10px; align-items:center; padding:8px 0; border-bottom:1px solid var(--border-color);">
                            <img src="${getImgPath(i.product.frontImg)}" style="width:44px; height:44px; object-fit:contain;">
                            <div style="flex:1;">
                                <div style="font-size:12.5px; font-weight:700;">${i.product.name}</div>
                                <div style="font-size:11px; color:var(--text-muted);">Cantidad: ${i.quantity}</div>
                            </div>
                            <div style="font-size:12.5px; font-weight:800; color:var(--accent-jungle);">${(i.product.price * i.quantity).toFixed(2)} €</div>
                        </div>
                    `).join('')}
                </div>

                <div style="margin-top:16px; padding-top:14px; border-top:1px solid var(--border-color); font-size:13px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                        <span>Subtotal</span><span>${subtotal.toFixed(2)} €</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                        <span>Envío</span><span id="checkout-shipping-display">${subtotal >= FREE_SHIPPING_THRESHOLD ? 'Gratis' : 'se calcula al elegir'}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:16px; font-weight:800; color:var(--accent-jungle); margin-top:10px;">
                        <span>Total</span><span id="checkout-total-display">${subtotal.toFixed(2)} €</span>
                    </div>
                </div>

                <button class="btn-primary" id="checkout-pay-btn" style="width:100%; justify-content:center; padding:14px; margin-top:20px;">
                    IR A PAGAR
                </button>
                <div id="checkout-error" class="form-status-error" style="display:none; margin-top:10px; font-size:12.5px;"></div>
            </div>
        </div>
    `;
    let selectedServicePointId = null;

    function updateShippingEstimate() {
        // Estimación visual en el navegador (el importe real y definitivo lo calcula
        // siempre el servidor en /api/create-payment, esto es solo para que el
        // cliente vea algo mientras rellena el formulario).
        const shippingDisplay = document.getElementById('checkout-shipping-display');
        const totalDisplay = document.getElementById('checkout-total-display');
        if (subtotal >= FREE_SHIPPING_THRESHOLD) {
            shippingDisplay.textContent = 'Gratis';
            totalDisplay.textContent = `${subtotal.toFixed(2)} €`;
        } else {
            shippingDisplay.textContent = 'entre 4,50 € y 6,00 € aprox.';
            totalDisplay.textContent = `${subtotal.toFixed(2)} € + envío`;
        }
    }
    updateShippingEstimate();

    // --- Elegir método de envío: si es recogida, buscamos puntos cercanos ---
    const pickupPicker = document.getElementById('checkout-pickup-picker');
    document.querySelectorAll('.checkout-delivery-radio').forEach(radio => {
        radio.addEventListener('change', async () => {
            selectedServicePointId = null;
            if (radio.value !== 'pickup' || !radio.checked) {
                pickupPicker.style.display = 'none';
                pickupPicker.innerHTML = '';
                return;
            }

            const postalCode = document.getElementById('checkout-postal-code').value.trim();
            const country = document.getElementById('checkout-country').value;
            if (!postalCode) {
                pickupPicker.style.display = 'block';
                pickupPicker.innerHTML = `<p style="font-size:12px; color:var(--accent-error);">Escribe primero tu código postal arriba.</p>`;
                return;
            }

            pickupPicker.style.display = 'block';
            pickupPicker.innerHTML = `<p style="font-size:12px; color:var(--text-muted);">Buscando puntos de recogida cercanos...</p>`;

            try {
                const r = await fetch(`/api/create-payment?searchServicePoints=1&postalCode=${encodeURIComponent(postalCode)}&country=${country}`);
                const result = await r.json();

                if (!result.success || result.points.length === 0) {
                    pickupPicker.innerHTML = `<p style="font-size:12px; color:var(--text-muted);">No se encontró ningún punto de recogida cerca de ese código postal.</p>`;
                    return;
                }

                pickupPicker.innerHTML = `
                    <select class="form-input" id="checkout-service-point-select">
                        ${result.points.map(p => `<option value="${p.id}">${p.name} — ${p.street} ${p.houseNumber || ''}, ${p.city}</option>`).join('')}
                    </select>
                `;
                selectedServicePointId = Number(result.points[0].id);
                document.getElementById('checkout-service-point-select').addEventListener('change', (e) => {
                    selectedServicePointId = Number(e.target.value);
                });
            } catch (err) {
                pickupPicker.innerHTML = `<p style="font-size:12px; color:var(--accent-error);">No se pudieron buscar puntos de recogida. Inténtalo de nuevo.</p>`;
            }
        });
    });

    // --- Pagar ---
    document.getElementById('checkout-pay-btn').addEventListener('click', async () => {
        const form = document.getElementById('checkout-form');
        if (!form.reportValidity()) return;

        const deliveryMethod = form.querySelector('input[name="deliveryMethod"]:checked').value;
        if (deliveryMethod === 'pickup' && !selectedServicePointId) {
            showCheckoutError('Elige un punto de recogida antes de continuar.');
            return;
        }

        const formData = new FormData(form);
        const payBtn = document.getElementById('checkout-pay-btn');
        payBtn.disabled = true;
        payBtn.textContent = 'PREPARANDO PAGO...';

        try {
            const r = await fetch('/api/create-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: cart.map(i => ({ id: i.product.id, name: i.product.name, price: i.product.price, quantity: i.quantity })),
                    customerEmail: formData.get('email'),
                    customerName: formData.get('name'),
                    deliveryMethod,
                    servicePointId: selectedServicePointId,
                    shippingAddress: {
                        street: formData.get('street'),
                        city: formData.get('city'),
                        postalCode: formData.get('postalCode'),
                        country: formData.get('country'),
                        phone: formData.get('phone')
                    }
                })
            });
            const result = await r.json();

            if (!result.success) {
                showCheckoutError(result.error || 'No se pudo iniciar el pago');
                payBtn.disabled = false;
                payBtn.textContent = 'IR A PAGAR';
                return;
            }

            const redirectForm = document.createElement('form');
            redirectForm.method = 'POST';
            redirectForm.action = result.redsysUrl;
            Object.entries(result.formFields).forEach(([key, value]) => {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = key;
                input.value = value;
                redirectForm.appendChild(input);
            });
            document.body.appendChild(redirectForm);
            redirectForm.submit();
        } catch (err) {
            showCheckoutError('Error de conexión al preparar el pago');
            payBtn.disabled = false;
            payBtn.textContent = 'IR A PAGAR';
        }
    });

    function showCheckoutError(message) {
        const errorEl = document.getElementById('checkout-error');
        errorEl.textContent = message;
        errorEl.style.display = 'block';
    }
}
