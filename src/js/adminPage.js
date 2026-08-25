/* ==========================================================================
   ADMIN PAGE — admin.html: login exclusivo, cola de producción ("qué hay
   que fabricar") y listado completo de pedidos con su estado de envío.
   ========================================================================== */

import { showToast } from './toast.js';

const SHIPPING_STATE_INFO = {
    draft: { label: 'Sin preparar', color: 'var(--text-muted)' },
    waiting: { label: 'En preparación', color: '#e8a33d' },
    confirmed: { label: 'En preparación', color: '#e8a33d' },
    assigned: { label: 'Listo para enviar', color: '#3d8bd6' },
    done: { label: 'Entregado', color: 'var(--accent-jungle)' },
    cancel: { label: 'Envío cancelado', color: 'var(--accent-error)' }
};

export async function initAdminPage() {
    const container = document.getElementById('admin-page-content');
    if (!container) return;

    container.innerHTML = `<div style="text-align:center; padding:60px 0; color:var(--text-muted);">Comprobando sesión...</div>`;

    let session;
    try {
        const r = await fetch('/api/admin/session');
        session = await r.json();
    } catch (e) {
        session = { loggedIn: false };
    }

    if (session.loggedIn) {
        renderDashboard(container);
    } else {
        renderAdminLogin(container);
    }
}

function renderAdminLogin(container) {
    container.innerHTML = `
        <div style="text-align:center; padding:10px; max-width:340px; margin:0 auto;">
            <span class="section-tag">SOLO PERSONAL</span>
            <h2 class="section-title" style="font-size:22px; margin-bottom:20px;">PANEL DE ADMINISTRACIÓN</h2>
            <form id="admin-login-form" style="display:flex; flex-direction:column; gap:12px;">
                <input type="email" name="email" placeholder="Email de Odoo" class="form-input" required>
                <input type="password" name="password" placeholder="Contraseña" class="form-input" required>
                <button type="submit" class="btn-primary" id="admin-login-btn" style="width:100%; justify-content:center; padding:12px;">ENTRAR</button>
                <div id="admin-login-error" class="form-status-error" style="display:none; font-size:12.5px;"></div>
            </form>
        </div>
    `;

    document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('admin-login-btn');
        const errorEl = document.getElementById('admin-login-error');
        const formData = new FormData(e.target);

        btn.disabled = true;
        btn.textContent = 'ENTRANDO...';
        errorEl.style.display = 'none';

        try {
            const r = await fetch('/api/admin/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.fromEntries(formData.entries()))
            });
            const result = await r.json();

            if (result.success) {
                renderDashboard(container);
            } else {
                errorEl.textContent = result.error || 'Error al iniciar sesión.';
                errorEl.style.display = 'block';
                btn.disabled = false;
                btn.textContent = 'ENTRAR';
            }
        } catch (err) {
            errorEl.textContent = 'Error de conexión.';
            errorEl.style.display = 'block';
            btn.disabled = false;
            btn.textContent = 'ENTRAR';
        }
    });
}

function renderDashboard(container) {
    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:12px;">
            <h2 class="section-title" style="font-size:22px; margin:0;">PANEL DE ADMINISTRACIÓN</h2>
            <div style="display:flex; gap:10px;">
                <button class="btn-secondary admin-tab-btn active" data-tab="production" style="padding:8px 16px; font-size:12px;">PRODUCCIÓN</button>
                <button class="btn-secondary admin-tab-btn" data-tab="orders" style="padding:8px 16px; font-size:12px;">TODOS LOS PEDIDOS</button>
                <a href="/cuenta.html" class="btn-secondary" id="admin-exit-btn" style="padding:8px 16px; font-size:12px; text-decoration:none; display:inline-flex; align-items:center;">SALIR</a>
                <button id="admin-logout-btn" style="padding:10px 22px; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; border-radius:var(--radius-sm); background-color:var(--bg-card); color:var(--accent-error); border:2px solid var(--accent-error); cursor:pointer; transition:all var(--transition-fast);">CERRAR SESIÓN</button>
            </div>
        </div>
        <div id="admin-tab-production" class="account-tab"></div>
        <div id="admin-tab-orders" class="account-tab" style="display:none;"></div>
    `;

    const tabBtns = container.querySelectorAll('.admin-tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            container.querySelectorAll('.account-tab').forEach(t => t.style.display = 'none');
            document.getElementById(`admin-tab-${btn.dataset.tab}`).style.display = 'block';
        });
    });

    // "SALIR" solo te lleva de vuelta a tu cuenta normal, sin cerrar la sesión de admin
    // (así puedes volver al panel directamente sin tener que iniciar sesión otra vez).

    // "CERRAR SESIÓN" sí cierra la sesión de admin de verdad.
    const logoutBtn = document.getElementById('admin-logout-btn');
    logoutBtn.addEventListener('click', async () => {
        await fetch('/api/admin/session', { method: 'DELETE' });
        window.location.reload();
    });
    logoutBtn.addEventListener('mouseenter', () => {
        logoutBtn.style.backgroundColor = 'var(--accent-error)';
        logoutBtn.style.color = '#ffffff';
    });
    logoutBtn.addEventListener('mouseleave', () => {
        logoutBtn.style.backgroundColor = 'var(--bg-card)';
        logoutBtn.style.color = 'var(--accent-error)';
    });

    loadOrders();
}

async function loadOrders() {
    const prodTab = document.getElementById('admin-tab-production');
    const ordersTab = document.getElementById('admin-tab-orders');
    prodTab.innerHTML = `<p style="text-align:center; color:var(--text-muted); padding:30px 0;">Cargando...</p>`;
    ordersTab.innerHTML = `<p style="text-align:center; color:var(--text-muted); padding:30px 0;">Cargando...</p>`;

    try {
        const r = await fetch('/api/admin/orders');
        const data = await r.json();

        if (!data.success) {
            const msg = `<p style="text-align:center; color:var(--text-muted); padding:20px 0;">No se pudieron cargar los pedidos.</p>`;
            prodTab.innerHTML = msg;
            ordersTab.innerHTML = msg;
            return;
        }

        renderProductionTab(prodTab, data.orders);
        renderOrdersTab(ordersTab, data.orders);
    } catch (err) {
        const msg = `<p style="text-align:center; color:var(--text-muted); padding:20px 0;">No se pudieron cargar los pedidos.</p>`;
        prodTab.innerHTML = msg;
        ordersTab.innerHTML = msg;
    }
}

function renderProductionTab(tab, orders) {
    // "Qué hay que hacer": pedidos confirmados cuyo envío todavía no está entregado
    const pending = orders.filter(o => o.shippingState !== 'done');

    if (pending.length === 0) {
        tab.innerHTML = `<p style="text-align:center; color:var(--text-muted); padding:40px 0;">🎉 No hay nada pendiente de preparar ahora mismo.</p>`;
        return;
    }

    tab.innerHTML = pending.map(o => {
        const shippingInfo = o.shippingState
            ? SHIPPING_STATE_INFO[o.shippingState]
            : { label: 'Sin transferencia todavía', color: 'var(--text-muted)' };

        return `
        <div style="border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:16px; margin-bottom:14px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
                <div>
                    <div style="font-weight:800; font-size:14px;">${o.name} — ${o.customer}</div>
                    <div style="font-size:12px; color:var(--text-muted);">${new Date(o.date_order).toLocaleDateString('es-ES')}</div>
                </div>
                <div style="display:flex; align-items:center; gap:5px; font-size:12px; font-weight:700; color:${shippingInfo.color};">
                    <span style="width:7px; height:7px; border-radius:50%; background:${shippingInfo.color}; display:inline-block;"></span>
                    ${shippingInfo.label}
                </div>
            </div>
            <ul style="margin:10px 0 0 0; padding-left:18px; font-size:13px; color:var(--text-secondary);">
                ${o.lines.map(l => `<li>${l.qty} × ${l.name}</li>`).join('')}
            </ul>

            ${o.trackingNumber ? `
            <div style="margin-top:10px; font-size:12px; color:var(--text-secondary);">
                📦 Seguimiento Sendcloud: <strong>${o.trackingNumber}</strong>
            </div>
            ` : ''}

            <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap;">
                ${o.pickingId ? `
                    ${o.shippingState !== 'assigned' && o.shippingState !== 'done' ? `<button class="btn-secondary admin-ship-btn" data-picking="${o.pickingId}" data-action="ready" style="padding:6px 14px; font-size:11px;">MARCAR LISTO</button>` : ''}
                    ${o.shippingState !== 'done' ? `<button class="btn-primary admin-ship-btn" data-picking="${o.pickingId}" data-action="deliver" style="padding:6px 14px; font-size:11px;">MARCAR ENTREGADO</button>` : ''}
                ` : `<div style="font-size:11px; color:var(--text-muted);">Este pedido no tiene todavía una transferencia de envío en Odoo.</div>`}

                ${!o.trackingNumber ? `<button class="btn-secondary admin-open-label-btn" data-order="${o.id}" data-suggested-weight="${o.suggestedWeightKg}" style="padding:6px 14px; font-size:11px;">📦 CREAR ETIQUETA DE ENVÍO</button>` : ''}
                ${o.trackingNumber ? `<button class="btn-secondary admin-track-btn" data-tracking="${o.trackingNumber}" style="padding:6px 14px; font-size:11px;">🔎 VER ESTADO REAL</button>` : ''}
            </div>
            <div class="admin-label-form" data-order="${o.id}" style="margin-top:10px; display:none;"></div>
            <div class="admin-track-result" data-order="${o.id}" style="margin-top:8px; font-size:12px; display:none;"></div>
        </div>
        `;
    }).join('');

    tab.querySelectorAll('.admin-ship-btn').forEach(btn => {
        btn.addEventListener('click', () => updateShipping(btn.dataset.picking, btn.dataset.action));
    });
    tab.querySelectorAll('.admin-open-label-btn').forEach(btn => {
        btn.addEventListener('click', () => openLabelForm(btn));
    });
    tab.querySelectorAll('.admin-track-btn').forEach(btn => {
        btn.addEventListener('click', () => checkTracking(btn));
    });
}

function renderOrdersTab(tab, orders) {
    if (orders.length === 0) {
        tab.innerHTML = `<p style="text-align:center; color:var(--text-muted); padding:40px 0;">No hay pedidos confirmados todavía.</p>`;
        return;
    }

    tab.innerHTML = `
        <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:13px; min-width:600px;">
            <thead>
                <tr style="text-align:left; border-bottom:2px solid var(--border-color);">
                    <th style="padding:10px 8px;"></th>
                    <th style="padding:10px 8px;">Pedido</th>
                    <th style="padding:10px 8px;">Cliente</th>
                    <th style="padding:10px 8px;">Fecha</th>
                    <th style="padding:10px 8px;">Envío</th>
                    <th style="padding:10px 8px; text-align:right;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${orders.map(o => {
                    const shippingInfo = o.shippingState ? SHIPPING_STATE_INFO[o.shippingState] : { label: '—', color: 'var(--text-muted)' };
                    return `
                    <tr class="order-row-toggle" data-order="${o.id}" style="border-bottom:1px solid var(--border-color); cursor:pointer;">
                        <td style="padding:10px 8px; color:var(--text-muted); width:20px;" class="order-row-arrow">▸</td>
                        <td style="padding:10px 8px; font-weight:700;">${o.name}</td>
                        <td style="padding:10px 8px;">${o.customer}</td>
                        <td style="padding:10px 8px; color:var(--text-muted);">${new Date(o.date_order).toLocaleDateString('es-ES')}</td>
                        <td style="padding:10px 8px; color:${shippingInfo.color}; font-weight:700;">${shippingInfo.label}</td>
                        <td style="padding:10px 8px; text-align:right; font-weight:800; color:var(--accent-jungle);">${o.amount_total.toFixed(2)} €</td>
                    </tr>
                    <tr class="order-row-detail" data-order="${o.id}" style="display:none; background:var(--bg-surface);">
                        <td></td>
                        <td colspan="5" style="padding:10px 8px 16px 8px;">
                            <ul style="margin:0; padding-left:18px; color:var(--text-secondary);">
                                ${o.lines.map(l => `<li>${l.qty} × ${l.name}</li>`).join('')}
                            </ul>
                        </td>
                    </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
        </div>
    `;

    tab.querySelectorAll('.order-row-toggle').forEach(row => {
        row.addEventListener('click', () => {
            const orderId = row.dataset.order;
            const detailRow = tab.querySelector(`.order-row-detail[data-order="${orderId}"]`);
            const arrow = row.querySelector('.order-row-arrow');
            const isOpen = detailRow.style.display !== 'none';
            detailRow.style.display = isOpen ? 'none' : 'table-row';
            arrow.textContent = isOpen ? '▸' : '▾';
        });
    });
}

async function updateShipping(pickingId, action) {
    try {
        const r = await fetch('/api/admin/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pickingId: Number(pickingId), action })
        });
        const result = await r.json();
        if (result.success) {
            showToast(action === 'deliver' ? '✓ Marcado como entregado' : '✓ Marcado como listo');
            loadOrders();
        } else {
            showToast(`⚠ ${result.error || 'No se pudo actualizar'}`);
        }
    } catch (err) {
        showToast('⚠ Error de conexión');
    }
}

async function openLabelForm(btn) {
    const orderId = Number(btn.dataset.order);
    const suggestedWeight = Number(btn.dataset.suggestedWeight) || 1;
    const form = document.querySelector(`.admin-label-form[data-order="${orderId}"]`);
    if (!form) return;

    form.style.display = 'block';
    form.innerHTML = `<p style="font-size:12px; color:var(--text-muted);">Cargando opciones de envío...</p>`;

    try {
        const r = await fetch('/api/admin/orders?shippingServices=1');
        const result = await r.json();
        if (!result.success) {
            form.innerHTML = `<p style="font-size:12px; color:var(--accent-error);">⚠ No se pudieron cargar los servicios de envío</p>`;
            return;
        }

        form.innerHTML = `
            <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:flex-end;">
                <div>
                    <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:4px;">SERVICIO DE ENVÍO</label>
                    <select class="form-input label-service-select" style="min-width:260px;">
                        ${result.services.map(s => `<option value="${s.key}">${s.label}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:4px;">PESO (KG)</label>
                    <input type="number" class="form-input label-weight-input" value="${suggestedWeight}" min="0.05" max="30" step="0.05" style="width:90px;">
                </div>
                <button class="btn-primary label-continue-btn" style="padding:8px 16px; font-size:11px;">CONTINUAR</button>
            </div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">Peso calculado según el tamaño de cada línea del pedido — puedes ajustarlo si hace falta.</div>
            <div class="label-pickup-picker" style="margin-top:10px;"></div>
        `;

        form.querySelector('.label-continue-btn').addEventListener('click', () => handleLabelContinue(form, orderId, result.services));
    } catch (err) {
        form.innerHTML = `<p style="font-size:12px; color:var(--accent-error);">⚠ Error de conexión con Sendcloud</p>`;
    }
}

async function handleLabelContinue(form, orderId, services) {
    const serviceKey = form.querySelector('.label-service-select').value;
    const weightKg = Number(form.querySelector('.label-weight-input').value) || 1;
    const service = services.find(s => s.key === serviceKey);
    const pickerBox = form.querySelector('.label-pickup-picker');
    const continueBtn = form.querySelector('.label-continue-btn');

    // Si este servicio no necesita punto de recogida, creamos la etiqueta directamente
    if (!service.needsServicePoint) {
        createLabel({ orderId, serviceKey, weightKg }, continueBtn, form);
        return;
    }

    // Si necesita punto de recogida, primero buscamos los cercanos a la dirección del cliente
    continueBtn.disabled = true;
    pickerBox.innerHTML = `<p style="font-size:12px; color:var(--text-muted);">Buscando puntos de recogida cercanos...</p>`;

    try {
        const r = await fetch('/api/admin/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'search-service-points', orderId })
        });
        const result = await r.json();

        if (!result.success) {
            pickerBox.innerHTML = `<p style="font-size:12px; color:var(--accent-error);">⚠ ${result.error || 'No se pudieron buscar puntos de recogida'}</p>`;
            continueBtn.disabled = false;
            return;
        }
        if (result.points.length === 0) {
            pickerBox.innerHTML = `<p style="font-size:12px; color:var(--text-muted);">No se encontró ningún punto de recogida cerca de esa dirección.</p>`;
            continueBtn.disabled = false;
            return;
        }

        pickerBox.innerHTML = `
            <select class="form-input pickup-select" style="margin-bottom:8px; min-width:280px;">
                ${result.points.map(p => `<option value="${p.id}">${p.name} — ${p.street} ${p.houseNumber || ''}, ${p.city}</option>`).join('')}
            </select>
            <button class="btn-primary pickup-confirm-btn" style="padding:6px 14px; font-size:11px;">CONFIRMAR Y CREAR ETIQUETA</button>
        `;

        pickerBox.querySelector('.pickup-confirm-btn').addEventListener('click', (e) => {
            const servicePointId = Number(pickerBox.querySelector('.pickup-select').value);
            createLabel({ orderId, serviceKey, weightKg, servicePointId }, e.target, form);
        });
    } catch (err) {
        pickerBox.innerHTML = `<p style="font-size:12px; color:var(--accent-error);">⚠ Error de conexión con Sendcloud</p>`;
        continueBtn.disabled = false;
    }
}

async function createLabel({ orderId, serviceKey, weightKg, servicePointId }, btn, form) {
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'CREANDO...';

    try {
        const r = await fetch('/api/admin/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'create-label', orderId, serviceKey, weightKg, servicePointId })
        });
        const result = await r.json();

        if (result.success) {
            showToast(`✓ Etiqueta creada — seguimiento ${result.trackingNumber}`);
            if (result.labelUrl) {
                // Abrimos la etiqueta en una pestaña nueva, pasando por nuestro propio proxy
                // (la URL de Sendcloud necesita autenticación, el navegador no puede acceder sola)
                window.open(`/api/admin/orders?downloadLabel=${encodeURIComponent(result.labelUrl)}`, '_blank');
            }
            loadOrders();
        } else {
            showToast(`⚠ ${result.error || 'No se pudo crear la etiqueta'}`);
            btn.disabled = false;
            btn.textContent = originalText;
        }
    } catch (err) {
        showToast('⚠ Error de conexión con Sendcloud');
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

async function checkTracking(btn) {
    const trackingNumber = btn.dataset.tracking;
    const resultBox = btn.closest('div').parentElement.querySelector('.admin-track-result');

    btn.disabled = true;
    btn.textContent = 'COMPROBANDO...';

    try {
        const r = await fetch('/api/admin/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'check-tracking', trackingNumber })
        });
        const result = await r.json();

        if (resultBox) {
            resultBox.style.display = 'block';
            if (result.success) {
                resultBox.innerHTML = `Estado real del transportista: <strong>${result.status}</strong>` +
                    (result.trackingUrl ? ` — <a href="${result.trackingUrl}" target="_blank" style="color:var(--accent-jungle);">ver seguimiento completo</a>` : '');
            } else {
                resultBox.textContent = `⚠ ${result.error || 'No se pudo consultar Sendcloud'}`;
            }
        }
    } catch (err) {
        if (resultBox) {
            resultBox.style.display = 'block';
            resultBox.textContent = '⚠ Error de conexión con Sendcloud';
        }
    } finally {
        btn.disabled = false;
        btn.textContent = '🔎 VER ESTADO REAL';
    }
}