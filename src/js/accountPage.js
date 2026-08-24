/* ==========================================================================
   ACCOUNT PAGE — cuenta.html: perfil editable, cambio de contraseña y
   pedidos, todo integrado en la página (no en un modal).
   ========================================================================== */

import { checkSession, renderAuthForm, isPasswordStrongEnough, updatePasswordStrengthUI } from './auth.js';
import { showToast } from './toast.js';

const ORDER_STATE_LABELS = {
    draft: 'Presupuesto',
    sent: 'Presupuesto enviado',
    sale: 'Confirmado',
    done: 'Completado',
    cancel: 'Cancelado'
};

export async function initAccountPage() {
    const container = document.getElementById('account-page-content');
    if (!container) return;

    container.innerHTML = `<div style="text-align:center; padding: 60px 0; color: var(--text-muted);">Comprobando sesión...</div>`;

    const session = await checkSession();

    if (session.loggedIn) {
        renderDashboard(container, session.user);
    } else {
        renderAuthForm(container, 'login', (user) => renderDashboard(container, user));
    }
}

function renderDashboard(container, user) {
    container.innerHTML = `
        <div class="account-layout">
            <aside class="account-sidebar">
                <div class="account-avatar">${user.name.charAt(0).toUpperCase()}</div>
                <div class="account-name">${user.name}</div>
                <div class="account-email">${user.email}</div>
                <nav class="account-nav">
                    <button class="account-nav-btn active" data-tab="profile">MI PERFIL</button>
                    <button class="account-nav-btn" data-tab="orders">MIS PEDIDOS</button>
                    <button class="account-nav-btn" id="account-logout-btn">CERRAR SESIÓN</button>
                </nav>
            </aside>
            <div class="account-main">
                <div id="account-tab-profile" class="account-tab"></div>
                <div id="account-tab-orders" class="account-tab" style="display:none;"></div>
            </div>
        </div>
    `;

    renderProfileTab(user);
    renderOrdersTab();

    const tabBtns = container.querySelectorAll('.account-nav-btn[data-tab]');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            container.querySelectorAll('.account-tab').forEach(t => t.style.display = 'none');
            document.getElementById(`account-tab-${btn.dataset.tab}`).style.display = 'block';
        });
    });

    document.getElementById('account-logout-btn').addEventListener('click', async () => {
        await fetch('/api/logout', { method: 'POST' });
        window.location.reload();
    });
}

function renderProfileTab(user) {
    const tab = document.getElementById('account-tab-profile');
    tab.innerHTML = `
        <h2 class="section-title" style="font-size:20px; margin-bottom:20px;">MI PERFIL</h2>

        <form id="profile-form" style="max-width:400px; display:flex; flex-direction:column; gap:12px;">
            <div class="option-group-title">NOMBRE</div>
            <input type="text" name="name" class="form-input" value="${user.name}" required>
            <div class="option-group-title">CORREO ELECTRÓNICO</div>
            <input type="email" class="form-input" value="${user.email}" disabled style="opacity:0.6;">
            <button type="submit" class="btn-primary" id="profile-save-btn" style="width:fit-content; padding:10px 20px; margin-top:6px;">GUARDAR CAMBIOS</button>
            <div id="profile-status" style="font-size:12.5px; display:none;"></div>
        </form>

        <h3 style="font-size:16px; margin:32px 0 14px;">CAMBIAR CONTRASEÑA</h3>
        <form id="password-form" style="max-width:400px; display:flex; flex-direction:column; gap:12px;">
            <input type="password" name="currentPassword" placeholder="Contraseña actual" class="form-input" required>
            <input type="password" name="newPassword" id="new-password-input" placeholder="Nueva contraseña" class="form-input" required minlength="8">
            <div style="text-align:left; margin-top:-6px;">
                <div style="height:5px; background:var(--border-color); border-radius:4px; overflow:hidden;">
                    <div id="password-strength-bar" style="height:100%; width:0%; transition: width 0.25s ease, background 0.25s ease;"></div>
                </div>
                <div id="password-strength-label" style="font-size:11px; margin-top:4px; min-height:14px;"></div>
                <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">Mínimo 8 caracteres, mayúscula, minúscula, número y símbolo.</div>
            </div>
            <button type="submit" class="btn-secondary" id="password-save-btn" style="width:fit-content; padding:10px 20px;">CAMBIAR CONTRASEÑA</button>
            <div id="password-change-status" style="font-size:12.5px; display:none;"></div>
        </form>
    `;

    // --- Guardar nombre ---
    document.getElementById('profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('profile-save-btn');
        const statusEl = document.getElementById('profile-status');
        const formData = new FormData(e.target);

        btn.disabled = true;
        btn.textContent = 'GUARDANDO...';
        statusEl.style.display = 'none';

        try {
            const r = await fetch('/api/update-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: formData.get('name') })
            });
            const result = await r.json();

            if (result.success) {
                showToast('✓ Perfil actualizado');
                document.querySelector('.account-name').textContent = result.user.name;
            } else {
                statusEl.textContent = result.error || 'No se pudo guardar el cambio.';
                statusEl.className = 'form-status-error';
                statusEl.style.display = 'block';
            }
        } catch (err) {
            statusEl.textContent = 'Error de conexión. Inténtalo de nuevo más tarde.';
            statusEl.className = 'form-status-error';
            statusEl.style.display = 'block';
        } finally {
            btn.disabled = false;
            btn.textContent = 'GUARDAR CAMBIOS';
        }
    });

    // --- Barra de fortaleza en la nueva contraseña ---
    document.getElementById('new-password-input').addEventListener('input', (e) => updatePasswordStrengthUI(e.target.value));

    // --- Cambiar contraseña ---
    document.getElementById('password-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('password-save-btn');
        const statusEl = document.getElementById('password-change-status');
        const formData = new FormData(e.target);
        const newPassword = formData.get('newPassword');

        if (!isPasswordStrongEnough(newPassword)) {
            statusEl.textContent = 'La nueva contraseña debe tener al menos 8 caracteres, con mayúscula, minúscula, número y símbolo.';
            statusEl.className = 'form-status-error';
            statusEl.style.display = 'block';
            return;
        }

        btn.disabled = true;
        btn.textContent = 'CAMBIANDO...';
        statusEl.style.display = 'none';

        try {
            const r = await fetch('/api/update-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentPassword: formData.get('currentPassword'),
                    newPassword
                })
            });
            const result = await r.json();

            if (result.success) {
                showToast('✓ Contraseña actualizada');
                e.target.reset();
                updatePasswordStrengthUI('');
            } else {
                statusEl.textContent = result.error || 'No se pudo cambiar la contraseña.';
                statusEl.className = 'form-status-error';
                statusEl.style.display = 'block';
            }
        } catch (err) {
            statusEl.textContent = 'Error de conexión. Inténtalo de nuevo más tarde.';
            statusEl.className = 'form-status-error';
            statusEl.style.display = 'block';
        } finally {
            btn.disabled = false;
            btn.textContent = 'CAMBIAR CONTRASEÑA';
        }
    });
}

async function renderOrdersTab() {
    const tab = document.getElementById('account-tab-orders');
    tab.innerHTML = `
        <h2 class="section-title" style="font-size:20px; margin-bottom:20px;">MIS PEDIDOS</h2>
        <div id="orders-list"><p style="text-align:center; color:var(--text-muted); font-size:13px; padding:30px 0;">Cargando pedidos...</p></div>
    `;

    const ordersList = document.getElementById('orders-list');
    try {
        const r = await fetch('/api/orders');
        const data = await r.json();

        if (!data.success) {
            ordersList.innerHTML = `<p style="text-align:center; color:var(--text-muted); font-size:13px; padding:20px 0;">No se pudieron cargar los pedidos.</p>`;
            return;
        }

        if (data.orders.length === 0) {
            ordersList.innerHTML = `<p style="text-align:center; color:var(--text-muted); font-size:13px; padding:20px 0;">Todavía no tienes ningún pedido.</p>`;
            return;
        }

        ordersList.innerHTML = data.orders.map(o => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:14px 0; border-bottom:1px solid var(--border-color);">
                <div>
                    <div style="font-size:14px; font-weight:700; color:var(--text-primary);">${o.name}</div>
                    <div style="font-size:12px; color:var(--text-muted);">${new Date(o.date_order).toLocaleDateString('es-ES')} · ${ORDER_STATE_LABELS[o.state] || o.state}</div>
                </div>
                <div style="font-size:15px; font-weight:800; color:var(--accent-jungle);">${o.amount_total.toFixed(2)} €</div>
            </div>
        `).join('');
    } catch (err) {
        ordersList.innerHTML = `<p style="text-align:center; color:var(--text-muted); font-size:13px; padding:20px 0;">No se pudieron cargar los pedidos.</p>`;
    }
}
