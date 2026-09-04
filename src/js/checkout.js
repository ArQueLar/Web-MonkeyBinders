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
    let selectedServicePoint = null; // { id, name, street, house_number, city, postNumber }

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

    // --- Elegir método de envío: si es recogida, se abre el selector visual de Sendcloud ---
    const pickupPicker = document.getElementById('checkout-pickup-picker');
    const postalCodeField = document.getElementById('checkout-postal-code');
    const countryField = document.getElementById('checkout-country');

    function renderPickupPickerButton() {
        pickupPicker.style.display = 'block';
        pickupPicker.innerHTML = `
            <button type="button" class="btn-secondary" id="open-spp-btn" style="width:100%; justify-content:center; padding:10px;">📍 Elegir punto de recogida</button>
            <div id="spp-selected-info" style="font-size:12.5px; color:var(--text-secondary); margin-top:8px;"></div>
        `;
        document.getElementById('open-spp-btn').addEventListener('click', openServicePointPicker);
    }

    function openServicePointPicker() {
        if (typeof sendcloud === 'undefined') {
            showToast('⚠ No se pudo cargar el selector de puntos de recogida');
            return;
        }

        // Si el cliente no ha escrito código postal todavía, mostramos Madrid por
        // defecto para que el mapa no salga vacío — en cuanto lo rellene, se
        // reabre solo con la ubicación correcta (ver el listener de más abajo).
        const postalCode = postalCodeField.value.trim() || '28001';
        const country = (countryField.value || 'ES').toLowerCase();

        sendcloud.servicePoints.open({
            apiKey: import.meta.env.VITE_SENDCLOUD_PUBLIC_KEY,
            country,
            postalCode,
            language: 'es-es',
            carriers: 'correos'
        }, (servicePoint, postNumber) => {
            selectedServicePoint = { ...servicePoint, postNumber };
            const infoEl = document.getElementById('spp-selected-info');
            if (infoEl) {
                infoEl.innerHTML = `✓ <strong>${servicePoint.name}</strong> — ${servicePoint.street} ${servicePoint.house_number || ''}, ${servicePoint.city}`;
            }
        }, (errors) => {
            console.error('Selector de puntos de recogida:', errors);
        });
    }

    document.querySelectorAll('.checkout-delivery-radio').forEach(radio => {
        radio.addEventListener('change', () => {
            selectedServicePoint = null;
            if (radio.value !== 'pickup' || !radio.checked) {
                pickupPicker.style.display = 'none';
                pickupPicker.innerHTML = '';
                return;
            }
            renderPickupPickerButton();
        });
    });

    // Si el cliente ya había elegido "recogida en punto" y cambia el código
    // postal, reabrimos el selector automáticamente con la ubicación nueva —
    // no hace falta volver a tocar la opción de envío.
    postalCodeField.addEventListener('change', () => {
        const pickupRadio = document.querySelector('.checkout-delivery-radio[value="pickup"]');
        if (pickupRadio?.checked) {
            selectedServicePoint = null;
            openServicePointPicker();
        }
    });

    // --- Pagar ---
    document.getElementById('checkout-pay-btn').addEventListener('click', async () => {
        const form = document.getElementById('checkout-form');
        if (!form.reportValidity()) return;

        const deliveryMethod = form.querySelector('input[name="deliveryMethod"]:checked').value;
        if (deliveryMethod === 'pickup' && !selectedServicePoint) {
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
                    servicePointId: selectedServicePoint?.id,
                    servicePointPostNumber: selectedServicePoint?.postNumber,
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