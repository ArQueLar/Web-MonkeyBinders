/* ==========================================================================
   NAVIGATION — menú móvil, modal de cuenta y buscador rápido
   ========================================================================== */

import { getImgPath } from './utils.js';
import { products } from './products.js';

export function initNavigation() {
    // --- DELEGACIÓN GLOBAL DE EVENTOS PARA EL MENÚ MÓVIL ---
    function handleMobileNavToggle(e) {
        const targetBtn = e.target.closest('#mobile-menu-toggle-btn');
        const closeBtn = e.target.closest('#close-mobile-nav-btn');
        const overlay = document.getElementById('mobile-nav-overlay');

        if (targetBtn) {
            e.preventDefault();
            overlay?.classList.add('active');
        } else if (closeBtn || e.target === overlay || e.target.closest('.mobile-nav-list a')) {
            overlay?.classList.remove('active');
        }
    }

    document.addEventListener('click', handleMobileNavToggle);
    document.addEventListener('touchstart', (e) => {
        if (e.target.closest('#mobile-menu-toggle-btn') || e.target.closest('#close-mobile-nav-btn')) {
            handleMobileNavToggle(e);
        }
    }, { passive: true });

    // --- MODAL DE CUENTA Y BUSCADOR ---
    const modalOverlay = document.getElementById('modal-overlay');
    const modalBody = document.getElementById('modal-body');
    const closeModalBtn = document.getElementById('close-modal-btn');

    function openModal(contentHtml) {
        if (modalBody && modalOverlay) {
            modalBody.innerHTML = contentHtml;
            modalOverlay.classList.add('active');
        }
    }

    function closeModal() {
        modalOverlay?.classList.remove('active');
    }

    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeModal();
        });
    }

    // Delegación para Cuenta y Búsqueda
    document.addEventListener('click', (e) => {
        const accountBtn = e.target.closest('#account-toggle-btn');
        const searchBtn = e.target.closest('#search-toggle-btn');

        if (accountBtn) {
            e.preventDefault();
            openAccountModal();
        }

        if (searchBtn) {
            e.preventDefault();
            openModal(`
                <div style="text-align:center; padding: 10px;">
                    <span class="section-tag">BÚSQUEDA RÁPIDA</span>
                    <h2 class="section-title" style="font-size: 20px; margin-bottom: 15px;">ENCONTRAR BINDER</h2>
                    <input type="text" id="quick-search-input" placeholder="Escribe Charizard, Mew, 12P..." class="newsletter-input" style="background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); width:100%; padding:12px; font-size:14px;">
                    <div id="quick-search-results" style="margin-top:15px; text-align:left; max-height:200px; overflow-y:auto;"></div>
                </div>
            `);

            const input = document.getElementById('quick-search-input');
            const results = document.getElementById('quick-search-results');

            input?.focus();
            input?.addEventListener('input', (event) => {
                const query = event.target.value.toLowerCase().trim();
                if (!query) {
                    results.innerHTML = '';
                    return;
                }
                const matches = products.filter(p => p.name.toLowerCase().includes(query) || p.description.toLowerCase().includes(query));
                if (matches.length === 0) {
                    results.innerHTML = `<p style="font-size:12px; color:var(--text-muted); text-align:center;">Sin resultados para "${query}"</p>`;
                } else {
                    const basePath = '/tienda/producto.html'; // ruta absoluta: funciona igual sin importar desde qué página busques
                    results.innerHTML = matches.map(m => `
                        <a href="${basePath}?id=${m.id}" style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--border-color); text-decoration:none;">
                            <img src="${getImgPath(m.frontImg)}" style="width:36px; height:36px; object-fit:contain;">
                            <div>
                                <div style="font-size:13px; font-weight:700; color:var(--text-primary);">${m.name}</div>
                                <div style="font-size:11px; color:var(--accent-jungle); font-weight:800;">${m.price.toFixed(2)} €</div>
                            </div>
                        </a>
                    `).join('');
                }
            });
        }
    });

    // --- CUENTA DE CLIENTE (login / registro / sesión con Odoo) ---

    const ORDER_STATE_LABELS = {
        draft: 'Presupuesto',
        sent: 'Presupuesto enviado',
        sale: 'Confirmado',
        done: 'Completado',
        cancel: 'Cancelado'
    };

    async function openAccountModal() {
        openModal(`<div style="text-align:center; padding: 30px 0; color: var(--text-muted);">Comprobando sesión...</div>`);

        let sessionData;
        try {
            const r = await fetch('/api/me');
            sessionData = await r.json();
        } catch (e) {
            sessionData = { loggedIn: false };
        }

        if (sessionData.loggedIn) {
            renderLoggedInView(sessionData.user);
        } else {
            renderAuthView('login');
        }
    }

    // Reglas de contraseña segura: mínimo 8 caracteres, mayúscula, minúscula, número y símbolo.
    function checkPasswordRules(password) {
        return {
            length: password.length >= 8,
            lower: /[a-z]/.test(password),
            upper: /[A-Z]/.test(password),
            number: /[0-9]/.test(password),
            symbol: /[^A-Za-z0-9]/.test(password)
        };
    }

    function isPasswordStrongEnough(password) {
        const rules = checkPasswordRules(password);
        return Object.values(rules).every(Boolean);
    }

    // Barra visual 0-100% + etiqueta, según cuántas reglas cumple (no hace falta que sea perfecta para verse "fuerte")
    function updatePasswordStrengthUI(password) {
        const bar = document.getElementById('password-strength-bar');
        const label = document.getElementById('password-strength-label');
        if (!bar || !label) return;

        const rules = checkPasswordRules(password);
        const score = Object.values(rules).filter(Boolean).length; // 0-5

        let percent, color, text;
        if (password.length === 0) {
            percent = 0; color = 'var(--border-color)'; text = '';
        } else if (score <= 2) {
            percent = 25; color = 'var(--accent-error)'; text = 'Débil';
        } else if (score <= 3) {
            percent = 50; color = '#e8a33d'; text = 'Media';
        } else if (score === 4) {
            percent = 75; color = '#2ecc71'; text = 'Fuerte';
        } else {
            percent = 100; color = 'var(--accent-jungle)'; text = 'Muy fuerte';
        }

        bar.style.width = `${percent}%`;
        bar.style.background = color;
        label.textContent = text;
        label.style.color = color;
    }

    function renderAuthView(mode) {
        const isLogin = mode === 'login';
        openModal(`
            <div style="text-align:center; padding: 10px;">
                <span class="section-tag">ACCESO A CLIENTES</span>
                <h2 class="section-title" style="font-size: 22px; margin-bottom: 20px;">${isLogin ? 'INICIAR SESIÓN' : 'CREAR CUENTA'}</h2>
                <form id="auth-form" style="display:flex; flex-direction:column; gap:12px; max-width:320px; margin:0 auto;">
                    ${!isLogin ? `<input type="text" name="name" placeholder="Nombre completo" class="form-input" required>` : ''}
                    <input type="email" name="email" placeholder="Correo electrónico" class="form-input" required>
                    <input type="password" name="password" id="auth-password-input" placeholder="Contraseña" class="form-input" required ${!isLogin ? 'minlength="8"' : ''}>
                    ${!isLogin ? `
                    <div style="text-align:left; margin-top:-6px;">
                        <div style="height:5px; background:var(--border-color); border-radius:4px; overflow:hidden;">
                            <div id="password-strength-bar" style="height:100%; width:0%; transition: width 0.25s ease, background 0.25s ease;"></div>
                        </div>
                        <div id="password-strength-label" style="font-size:11px; margin-top:4px; min-height:14px;"></div>
                        <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">Mínimo 8 caracteres, mayúscula, minúscula, número y símbolo.</div>
                    </div>
                    ` : ''}
                    <button type="submit" class="btn-primary" id="auth-submit-btn" style="width:100%; justify-content:center; padding:12px;">
                        ${isLogin ? 'INICIAR SESIÓN' : 'CREAR CUENTA'}
                    </button>
                    <div id="auth-error" class="form-status-error" style="display:none; font-size:12.5px;"></div>
                </form>
                <p style="font-size:12px; color:var(--text-muted); margin-top:15px;">
                    ${isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
                    <a href="#" id="auth-switch-link" style="color:var(--accent-jungle); font-weight:700;">${isLogin ? 'Regístrate aquí' : 'Inicia sesión'}</a>
                </p>
            </div>
        `);

        document.getElementById('auth-switch-link').addEventListener('click', (e) => {
            e.preventDefault();
            renderAuthView(isLogin ? 'register' : 'login');
        });

        const passwordInput = document.getElementById('auth-password-input');
        if (!isLogin && passwordInput) {
            passwordInput.addEventListener('input', (e) => updatePasswordStrengthUI(e.target.value));
        }

        document.getElementById('auth-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('auth-submit-btn');
            const errorEl = document.getElementById('auth-error');
            const formData = new FormData(e.target);
            const payload = Object.fromEntries(formData.entries());

            if (!isLogin && !isPasswordStrongEnough(payload.password)) {
                errorEl.textContent = 'La contraseña debe tener al menos 8 caracteres, con mayúscula, minúscula, número y símbolo.';
                errorEl.style.display = 'block';
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = isLogin ? 'ENTRANDO...' : 'CREANDO CUENTA...';
            errorEl.style.display = 'none';

            try {
                const response = await fetch(isLogin ? '/api/login' : '/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await response.json();

                if (result.success) {
                    renderLoggedInView(result.user);
                } else {
                    errorEl.textContent = result.error || 'Ha ocurrido un error. Inténtalo de nuevo.';
                    errorEl.style.display = 'block';
                    submitBtn.disabled = false;
                    submitBtn.textContent = isLogin ? 'INICIAR SESIÓN' : 'CREAR CUENTA';
                }
            } catch (err) {
                errorEl.textContent = 'Error de conexión. Inténtalo de nuevo más tarde.';
                errorEl.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.textContent = isLogin ? 'INICIAR SESIÓN' : 'CREAR CUENTA';
            }
        });
    }

    function renderLoggedInView(user) {
        openModal(`
            <div style="text-align:center; padding: 10px;">
                <span class="section-tag">MI CUENTA</span>
                <h2 class="section-title" style="font-size: 22px; margin-bottom: 6px;">¡Hola, ${user.name}!</h2>
                <p style="font-size:12px; color:var(--text-muted); margin-bottom:20px;">${user.email}</p>

                <div style="text-align:left; margin-bottom:20px;">
                    <div class="filter-label" style="margin-bottom:10px;">MIS PEDIDOS</div>
                    <div id="orders-list" style="max-height:240px; overflow-y:auto;">
                        <p style="text-align:center; color:var(--text-muted); font-size:12px; padding:20px 0;">Cargando pedidos...</p>
                    </div>
                </div>

                <button id="logout-btn" class="btn-secondary" style="width:100%; justify-content:center; padding:10px;">CERRAR SESIÓN</button>
            </div>
        `);

        loadOrders();

        document.getElementById('logout-btn').addEventListener('click', async () => {
            await fetch('/api/logout', { method: 'POST' });
            renderAuthView('login');
        });
    }

    async function loadOrders() {
        const ordersList = document.getElementById('orders-list');
        try {
            const r = await fetch('/api/orders');
            const data = await r.json();

            if (!data.success) {
                ordersList.innerHTML = `<p style="text-align:center; color:var(--text-muted); font-size:12px; padding:10px 0;">No se pudieron cargar los pedidos.</p>`;
                return;
            }

            if (data.orders.length === 0) {
                ordersList.innerHTML = `<p style="text-align:center; color:var(--text-muted); font-size:12px; padding:10px 0;">Todavía no tienes ningún pedido.</p>`;
                return;
            }

            ordersList.innerHTML = data.orders.map(o => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border-color);">
                    <div>
                        <div style="font-size:13px; font-weight:700; color:var(--text-primary);">${o.name}</div>
                        <div style="font-size:11px; color:var(--text-muted);">${new Date(o.date_order).toLocaleDateString('es-ES')} · ${ORDER_STATE_LABELS[o.state] || o.state}</div>
                    </div>
                    <div style="font-size:13px; font-weight:800; color:var(--accent-jungle);">${o.amount_total.toFixed(2)} €</div>
                </div>
            `).join('');
        } catch (err) {
            ordersList.innerHTML = `<p style="text-align:center; color:var(--text-muted); font-size:12px; padding:10px 0;">No se pudieron cargar los pedidos.</p>`;
        }
    }
}