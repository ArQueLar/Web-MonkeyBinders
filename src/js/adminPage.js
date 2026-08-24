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
                <button class="btn-secondary" id="admin-logout-btn" style="padding:8px 16px; font-size:12px; color:var(--accent-error);">CERRAR SESIÓN</button>
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
    document.getElementById('admin-logout-btn').addEventListener('click', async () => {
        await fetch('/api/admin/session', { method: 'DELETE' });
        window.location.reload();
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
            ${o.pickingId ? `
            <div style="display:flex; gap:8px; margin-top:12px;">
                ${o.shippingState !== 'assigned' && o.shippingState !== 'done' ? `<button class="btn-secondary admin-ship-btn" data-picking="${o.pickingId}" data-action="ready" style="padding:6px 14px; font-size:11px;">MARCAR LISTO</button>` : ''}
                ${o.shippingState !== 'done' ? `<button class="btn-primary admin-ship-btn" data-picking="${o.pickingId}" data-action="deliver" style="padding:6px 14px; font-size:11px;">MARCAR ENTREGADO</button>` : ''}
            </div>
            ` : `<div style="font-size:11px; color:var(--text-muted); margin-top:10px;">Este pedido no tiene todavía una transferencia de envío en Odoo.</div>`}
        </div>
        `;
    }).join('');

    tab.querySelectorAll('.admin-ship-btn').forEach(btn => {
        btn.addEventListener('click', () => updateShipping(btn.dataset.picking, btn.dataset.action));
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
                    <tr style="border-bottom:1px solid var(--border-color);">
                        <td style="padding:10px 8px; font-weight:700;">${o.name}</td>
                        <td style="padding:10px 8px;">${o.customer}</td>
                        <td style="padding:10px 8px; color:var(--text-muted);">${new Date(o.date_order).toLocaleDateString('es-ES')}</td>
                        <td style="padding:10px 8px; color:${shippingInfo.color}; font-weight:700;">${shippingInfo.label}</td>
                        <td style="padding:10px 8px; text-align:right; font-weight:800; color:var(--accent-jungle);">${o.amount_total.toFixed(2)} €</td>
                    </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
        </div>
    `;
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