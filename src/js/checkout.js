/* ==========================================================================
   CHECKOUT — checkout.html, en 3 pasos: 1) Información y facturación,
   2) Envío (domicilio o punto de recogida con mapa), 3) Revisión y pago.
   ========================================================================== */

import { getImgPath, escapeHtml } from './utils.js';
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

const COUNTRIES = [['ES', 'España'], ['PT', 'Portugal'], ['FR', 'Francia'], ['DE', 'Alemania'], ['IT', 'Italia']];
const countryOptions = (selected = 'ES') => COUNTRIES.map(([c, n]) => `<option value="${c}" ${c === selected ? 'selected' : ''}>${n}</option>`).join('');
const countryName = code => (COUNTRIES.find(([c]) => c === code) || [code, code])[1];

const STEPS = [
    { n: 1, label: 'Información' },
    { n: 2, label: 'Envío' },
    { n: 3, label: 'Pago' }
];

function renderCheckout(container, cart, session) {
    const subtotal = cart.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
    const user = session.loggedIn ? session.user : null;
    let currentStep = 1;
    let selectedServicePoint = null; // { id, name, street, house_number, city, postNumber }

    const box = 'border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:12px 14px;';
    const radioBox = `display:flex; align-items:center; gap:10px; ${box} cursor:pointer;`;

    container.innerHTML = `
        <h1 class="section-title" style="font-size:26px; margin-bottom:20px;">FINALIZAR COMPRA</h1>

        <div id="co-stepper" style="display:flex; align-items:center; gap:8px; margin-bottom:28px; flex-wrap:wrap;"></div>

        <div style="display:grid; grid-template-columns: 1.3fr 1fr; gap:40px; align-items:start;" class="checkout-grid">
            <div>
                <!-- PASO 1: INFORMACIÓN Y FACTURACIÓN -->
                <section class="co-step" data-step="1" style="display:flex; flex-direction:column; gap:12px;">
                    <h2 style="font-size:16px; margin-bottom:2px;">1. INFORMACIÓN Y FACTURACIÓN</h2>
                    <input type="text" id="co-name" placeholder="Nombre completo" autocomplete="name" class="form-input" value="${escapeHtml(user?.name || '')}" required maxlength="120">
                    <input type="email" id="co-email" placeholder="Correo electrónico" autocomplete="email" class="form-input" value="${escapeHtml(user?.email || '')}" required maxlength="254">
                    <input type="tel" id="co-phone" placeholder="Teléfono" autocomplete="tel" class="form-input" required maxlength="30">

                    <h3 style="font-size:13px; margin:14px 0 0; color:var(--text-secondary);">DIRECCIÓN DE FACTURACIÓN</h3>
                    <input type="text" id="co-b-street" placeholder="Calle y número" autocomplete="address-line1" class="form-input" required maxlength="150">
                    <input type="text" id="co-b-street2" placeholder="Piso, puerta, escalera… (opcional)" autocomplete="address-line2" class="form-input" maxlength="80">
                    <div style="display:flex; gap:10px;">
                        <input type="text" id="co-b-postal" placeholder="Código postal" autocomplete="postal-code" class="form-input" required style="flex:1;" maxlength="10">
                        <input type="text" id="co-b-city" placeholder="Ciudad" autocomplete="address-level2" class="form-input" required style="flex:2;" maxlength="100">
                    </div>
                    <select id="co-b-country" class="form-input" autocomplete="country">${countryOptions()}</select>

                    <button type="button" class="btn-primary" data-next="2" style="width:100%; justify-content:center; padding:14px; margin-top:10px;">CONTINUAR AL ENVÍO →</button>
                </section>

                <!-- PASO 2: ENVÍO -->
                <section class="co-step" data-step="2" style="display:none; flex-direction:column; gap:12px;">
                    <h2 style="font-size:16px; margin-bottom:2px;">2. MÉTODO DE ENVÍO</h2>
                    <label style="${radioBox}">
                        <input type="radio" name="co-delivery" value="home" checked>
                        <span>🏠 Entrega a domicilio</span>
                    </label>
                    <label style="${radioBox}">
                        <input type="radio" name="co-delivery" value="pickup">
                        <span>📮 Recogida en punto de Correos</span>
                    </label>

                    <div id="co-home-box" style="display:flex; flex-direction:column; gap:12px; margin-top:4px;">
                        <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                            <input type="checkbox" id="co-same" checked>
                            <span>Enviar a la dirección de facturación</span>
                        </label>
                        <div id="co-ship-fields" style="display:none; flex-direction:column; gap:12px;">
                            <input type="text" id="co-s-street" placeholder="Calle y número" class="form-input" maxlength="150">
                            <input type="text" id="co-s-street2" placeholder="Piso, puerta, escalera… (opcional)" class="form-input" maxlength="80">
                            <div style="display:flex; gap:10px;">
                                <input type="text" id="co-s-postal" placeholder="Código postal" class="form-input" style="flex:1;" maxlength="10">
                                <input type="text" id="co-s-city" placeholder="Ciudad" class="form-input" style="flex:2;" maxlength="100">
                            </div>
                            <select id="co-s-country" class="form-input">${countryOptions()}</select>
                        </div>
                    </div>

                    <div id="co-pickup-box" style="display:none; flex-direction:column; gap:12px; margin-top:4px;">
                        <div style="display:flex; gap:10px;">
                            <input type="text" id="co-p-postal" placeholder="Código postal de búsqueda" class="form-input" style="flex:1;" maxlength="10">
                            <select id="co-p-country" class="form-input" style="flex:1;">${countryOptions()}</select>
                        </div>
                        <button type="button" class="btn-secondary" id="open-spp-btn" style="width:100%; justify-content:center; padding:10px;">📍 Elegir punto de recogida</button>
                        <div id="spp-selected-info" style="font-size:12.5px; color:var(--text-secondary);"></div>
                    </div>

                    <div style="display:flex; gap:10px; margin-top:10px;">
                        <button type="button" class="btn-secondary" data-next="1" style="padding:14px 18px;">← ATRÁS</button>
                        <button type="button" class="btn-primary" data-next="3" style="flex:1; justify-content:center; padding:14px;">CONTINUAR AL PAGO →</button>
                    </div>
                </section>

                <!-- PASO 3: REVISIÓN Y PAGO -->
                <section class="co-step" data-step="3" style="display:none; flex-direction:column; gap:12px;">
                    <h2 style="font-size:16px; margin-bottom:2px;">3. REVISIÓN Y PAGO</h2>
                    <div id="co-review" style="display:flex; flex-direction:column; gap:10px;"></div>

                    <label style="display:flex; align-items:flex-start; gap:8px; font-size:12px; color:var(--text-muted); cursor:pointer; margin-top:6px;">
                        <input type="checkbox" id="co-terms" style="margin-top:2px; flex-shrink:0;">
                        <span>He leído y acepto los <a href="/terminos-condiciones.html" target="_blank" style="color:var(--accent-jungle);">Términos y Condiciones</a> y la <a href="/politica-privacidad.html" target="_blank" style="color:var(--accent-jungle);">Política de Privacidad</a>.</span>
                    </label>

                    <div style="display:flex; gap:10px; margin-top:6px;">
                        <button type="button" class="btn-secondary" data-next="2" style="padding:14px 18px;">← ATRÁS</button>
                        <button type="button" class="btn-primary" id="checkout-pay-btn" style="flex:1; justify-content:center; padding:14px;">PAGAR CON TARJETA</button>
                    </div>
                    <div id="checkout-error" class="form-status-error" style="display:none; font-size:12.5px;"></div>
                </section>
            </div>

            <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:24px;">
                <h2 style="font-size:16px; margin-bottom:16px;">RESUMEN DEL PEDIDO</h2>
                <div id="checkout-cart-items">
                    ${cart.map(i => `
                        <div style="display:flex; gap:10px; align-items:center; padding:8px 0; border-bottom:1px solid var(--border-color);">
                            <img src="${getImgPath(i.product.frontImg)}" style="width:44px; height:44px; object-fit:contain;">
                            <div style="flex:1;">
                                <div style="font-size:12.5px; font-weight:700;">${escapeHtml(i.product.name)}</div>
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
                        <span>Envío</span><span id="checkout-shipping-display"></span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:16px; font-weight:800; color:var(--accent-jungle); margin-top:10px;">
                        <span>Total</span><span id="checkout-total-display"></span>
                    </div>
                </div>
            </div>
        </div>
    `;

    const $ = id => document.getElementById(id);
    const val = id => ($(id)?.value || '').trim();
    const deliveryMethod = () => document.querySelector('input[name="co-delivery"]:checked').value;
    const sameAddress = () => $('co-same').checked;
    // Calle + datos opcionales (piso, puerta...) en una sola línea de dirección
    const street = (id) => [val(id), val(`${id}2`)].filter(Boolean).join(', ');

    // --- Indicador de pasos (clicar un paso ya completado permite volver a él) ---
    function renderStepper() {
        $('co-stepper').innerHTML = STEPS.map((st, idx) => {
            const done = st.n < currentStep;
            const active = st.n === currentStep;
            const color = active || done ? 'var(--accent-jungle)' : 'var(--text-muted)';
            return `
                ${idx > 0 ? `<div style="flex:1; min-width:16px; height:2px; background:${done || active ? 'var(--accent-jungle)' : 'var(--border-color)'};"></div>` : ''}
                <button type="button" ${done ? `data-goto="${st.n}"` : 'disabled'} style="display:flex; align-items:center; gap:8px; background:none; border:none; padding:0; cursor:${done ? 'pointer' : 'default'}; color:${color}; font-weight:${active ? 800 : 600}; font-size:13px;">
                    <span style="width:26px; height:26px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:12px; font-weight:800; border:2px solid ${color}; ${done || active ? `background:${active ? 'transparent' : 'var(--accent-jungle)'};` : ''} ${done ? 'color:#fff;' : ''}">${done ? '✓' : st.n}</span>
                    <span>${st.label}</span>
                </button>`;
        }).join('');
        $('co-stepper').querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => goToStep(Number(b.dataset.goto))));
    }

    function showStep(n, scroll = true) {
        currentStep = n;
        document.querySelectorAll('.co-step').forEach(sec => {
            sec.style.display = Number(sec.dataset.step) === n ? 'flex' : 'none';
        });
        renderStepper();
        if (n === 3) renderReview();
        $('checkout-error').style.display = 'none';
        if (scroll) container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Valida solo los campos visibles/requeridos del paso actual
    function validateStep(n) {
        const section = document.querySelector(`.co-step[data-step="${n}"]`);
        for (const field of section.querySelectorAll('input, select')) {
            if (field.offsetParent === null) continue; // oculto
            if (!field.reportValidity()) return false;
        }
        if (n === 1 && !/^[A-Za-z0-9 -]{3,10}$/.test(val('co-b-postal'))) {
            $('co-b-postal').setCustomValidity('Código postal no válido');
            $('co-b-postal').reportValidity();
            $('co-b-postal').addEventListener('input', () => $('co-b-postal').setCustomValidity(''), { once: true });
            return false;
        }
        if (n === 2) {
            if (deliveryMethod() === 'pickup') {
                if (!/^[A-Za-z0-9 -]{3,10}$/.test(val('co-p-postal'))) {
                    $('co-p-postal').setCustomValidity('Introduce el código postal donde quieres recoger');
                    $('co-p-postal').reportValidity();
                    $('co-p-postal').addEventListener('input', () => $('co-p-postal').setCustomValidity(''), { once: true });
                    return false;
                }
                if (!selectedServicePoint) {
                    showToast('⚠ Elige un punto de recogida para continuar');
                    return false;
                }
            } else if (!sameAddress() && !/^[A-Za-z0-9 -]{3,10}$/.test(val('co-s-postal'))) {
                $('co-s-postal').setCustomValidity('Código postal no válido');
                $('co-s-postal').reportValidity();
                $('co-s-postal').addEventListener('input', () => $('co-s-postal').setCustomValidity(''), { once: true });
                return false;
            }
        }
        return true;
    }

    function goToStep(n) {
        // Avanzar exige que los pasos anteriores sean válidos; retroceder siempre se puede
        if (n > currentStep) {
            for (let s = currentStep; s < n; s++) if (!validateStep(s)) return;
        }
        showStep(n);
    }

    document.querySelectorAll('[data-next]').forEach(btn => {
        btn.addEventListener('click', () => goToStep(Number(btn.dataset.next)));
    });

    // Intro en un campo = pasar al siguiente paso (como en Amazon)
    document.querySelectorAll('.co-step input:not([type="checkbox"]):not([type="radio"])').forEach(inp => {
        inp.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (currentStep < 3) goToStep(currentStep + 1);
            }
        });
    });

    // --- Dirección de envío efectiva (según el método elegido) ---
    function shippingAddress() {
        if (deliveryMethod() === 'pickup') {
            return { street: street('co-b-street'), city: val('co-b-city'), postalCode: val('co-p-postal'), country: val('co-p-country') || 'ES', phone: val('co-phone') };
        }
        if (sameAddress()) {
            return { street: street('co-b-street'), city: val('co-b-city'), postalCode: val('co-b-postal'), country: val('co-b-country'), phone: val('co-phone') };
        }
        return { street: street('co-s-street'), city: val('co-s-city'), postalCode: val('co-s-postal'), country: val('co-s-country'), phone: val('co-phone') };
    }

    // --- Estimación visual del envío (el importe real lo calcula el servidor) ---
    function updateShippingEstimate() {
        const shippingDisplay = $('checkout-shipping-display');
        const totalDisplay = $('checkout-total-display');
        if (subtotal >= FREE_SHIPPING_THRESHOLD) {
            shippingDisplay.textContent = 'Gratis';
            totalDisplay.textContent = `${subtotal.toFixed(2)} €`;
        } else {
            shippingDisplay.textContent = 'entre 4,50 € y 6,00 € aprox.';
            totalDisplay.textContent = `${subtotal.toFixed(2)} € + envío`;
        }
    }
    updateShippingEstimate();

    // --- Paso 2: alternar domicilio / recogida / dirección distinta ---
    function refreshDeliveryUI() {
        const pickup = deliveryMethod() === 'pickup';
        $('co-home-box').style.display = pickup ? 'none' : 'flex';
        $('co-pickup-box').style.display = pickup ? 'flex' : 'none';
        const sameBox = !pickup && !sameAddress();
        $('co-ship-fields').style.display = sameBox ? 'flex' : 'none';
        ['co-s-street', 'co-s-postal', 'co-s-city'].forEach(id => { $(id).required = sameBox; });
        $('co-p-postal').required = pickup;
        if (pickup && !val('co-p-postal')) {
            $('co-p-postal').value = val('co-b-postal');
            $('co-p-country').value = val('co-b-country');
        }
    }
    document.querySelectorAll('input[name="co-delivery"]').forEach(r => r.addEventListener('change', () => {
        selectedServicePoint = null;
        $('spp-selected-info').textContent = '';
        refreshDeliveryUI();
    }));
    $('co-same').addEventListener('change', refreshDeliveryUI);
    refreshDeliveryUI();

    // --- Selector visual de puntos de recogida de Sendcloud ---
    function openServicePointPicker() {
        if (typeof sendcloud === 'undefined') {
            showToast('⚠ No se pudo cargar el selector de puntos de recogida');
            return;
        }
        const postalCode = val('co-p-postal') || '28001';
        const country = (val('co-p-country') || 'ES').toLowerCase();

        sendcloud.servicePoints.open({
            apiKey: import.meta.env.VITE_SENDCLOUD_PUBLIC_KEY,
            country,
            postalCode,
            language: 'es-es',
            carriers: 'correos'
        }, (servicePoint, postNumber) => {
            selectedServicePoint = { ...servicePoint, postNumber };
            const infoEl = $('spp-selected-info');
            if (infoEl) {
                infoEl.innerHTML = `✓ <strong>${escapeHtml(servicePoint.name)}</strong> — ${escapeHtml(servicePoint.street)} ${escapeHtml(servicePoint.house_number || '')}, ${escapeHtml(servicePoint.city)}`;
            }
        }, (errors) => {
            console.error('Selector de puntos de recogida:', errors);
        });
    }
    $('open-spp-btn').addEventListener('click', openServicePointPicker);

    // Si cambia el código postal de búsqueda, hay que volver a elegir punto
    $('co-p-postal').addEventListener('change', () => {
        if (deliveryMethod() === 'pickup') {
            selectedServicePoint = null;
            $('spp-selected-info').textContent = '';
            openServicePointPicker();
        }
    });

    // --- Paso 3: resumen de lo introducido ---
    function renderReview() {
        const ship = shippingAddress();
        const shipText = deliveryMethod() === 'pickup' && selectedServicePoint
            ? `📮 Punto de Correos: <strong>${escapeHtml(selectedServicePoint.name)}</strong><br>${escapeHtml(selectedServicePoint.street)} ${escapeHtml(selectedServicePoint.house_number || '')}, ${escapeHtml(selectedServicePoint.city)}`
            : `🏠 ${escapeHtml(ship.street)}<br>${escapeHtml(ship.postalCode)} ${escapeHtml(ship.city)}, ${escapeHtml(countryName(ship.country))}`;
        const row = (title, html, step) => `
            <div style="${box} display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
                <div style="font-size:13px; line-height:1.55;"><div style="font-size:11px; font-weight:800; color:var(--text-muted); margin-bottom:3px;">${title}</div>${html}</div>
                <button type="button" data-goto-step="${step}" style="background:none; border:none; color:var(--accent-jungle); font-weight:700; font-size:12px; cursor:pointer; flex-shrink:0;">Cambiar</button>
            </div>`;
        $('co-review').innerHTML =
            row('CONTACTO', `${escapeHtml(val('co-name'))}<br>${escapeHtml(val('co-email'))} · ${escapeHtml(val('co-phone'))}`, 1) +
            row('FACTURACIÓN', `${escapeHtml(street('co-b-street'))}<br>${escapeHtml(val('co-b-postal'))} ${escapeHtml(val('co-b-city'))}, ${escapeHtml(countryName(val('co-b-country')))}`, 1) +
            row('ENVÍO', shipText, 2);
        $('co-review').querySelectorAll('[data-goto-step]').forEach(b => b.addEventListener('click', () => showStep(Number(b.dataset.gotoStep))));
    }

    // --- Pagar ---
    $('checkout-pay-btn').addEventListener('click', async () => {
        if (!validateStep(1)) { showStep(1); return; }
        if (!validateStep(2)) { showStep(2); return; }
        if (!$('co-terms').checked) {
            showCheckoutError('Debes aceptar los Términos y Condiciones y la Política de Privacidad para continuar.');
            return;
        }

        const payBtn = $('checkout-pay-btn');
        payBtn.disabled = true;
        payBtn.textContent = 'PREPARANDO PAGO...';

        try {
            const r = await fetch('/api/create-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: cart.map(i => ({ id: i.product.id, name: i.product.name, price: i.product.price, quantity: i.quantity })),
                    customerEmail: val('co-email'),
                    customerName: val('co-name'),
                    deliveryMethod: deliveryMethod(),
                    servicePointId: selectedServicePoint?.id,
                    servicePointPostNumber: selectedServicePoint?.postNumber,
                    shippingAddress: shippingAddress()
                })
            });
            const result = await r.json();

            if (!result.success) {
                showCheckoutError(result.error || 'No se pudo iniciar el pago');
                payBtn.disabled = false;
                payBtn.textContent = 'PAGAR CON TARJETA';
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
            payBtn.textContent = 'PAGAR CON TARJETA';
        }
    });

    function showCheckoutError(message) {
        const errorEl = $('checkout-error');
        errorEl.textContent = message;
        errorEl.style.display = 'block';
    }

    showStep(1, false);
}
