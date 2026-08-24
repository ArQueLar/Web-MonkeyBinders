/* ==========================================================================
   AUTH — utilidades de sesión compartidas: comprobar si hay sesión activa,
   y un formulario de login/registro reutilizable (con barra de fortaleza de
   contraseña) que se puede pintar dentro de cualquier contenedor.
   ========================================================================== */

export async function checkSession() {
    try {
        const r = await fetch('/api/me');
        return await r.json();
    } catch (e) {
        return { loggedIn: false };
    }
}

// Reglas de contraseña segura: mínimo 8 caracteres, mayúscula, minúscula, número y símbolo.
export function checkPasswordRules(password) {
    return {
        length: password.length >= 8,
        lower: /[a-z]/.test(password),
        upper: /[A-Z]/.test(password),
        number: /[0-9]/.test(password),
        symbol: /[^A-Za-z0-9]/.test(password)
    };
}

export function isPasswordStrongEnough(password) {
    return Object.values(checkPasswordRules(password)).every(Boolean);
}

// Actualiza la barra visual 0-100% + etiqueta. Busca #password-strength-bar y
// #password-strength-label en el DOM (solo debe haber una de estas visible a la vez).
export function updatePasswordStrengthUI(password) {
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

// Pinta un formulario de login/registro dentro de `container` (cualquier elemento DOM).
// Llama a onSuccess(user) cuando el login/registro termina bien.
export function renderAuthForm(container, mode, onSuccess) {
    const isLogin = mode === 'login';
    container.innerHTML = `
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
    `;

    container.querySelector('#auth-switch-link').addEventListener('click', (e) => {
        e.preventDefault();
        renderAuthForm(container, isLogin ? 'register' : 'login', onSuccess);
    });

    const passwordInput = container.querySelector('#auth-password-input');
    if (!isLogin && passwordInput) {
        passwordInput.addEventListener('input', (e) => updatePasswordStrengthUI(e.target.value));
    }

    container.querySelector('#auth-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = container.querySelector('#auth-submit-btn');
        const errorEl = container.querySelector('#auth-error');
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
                onSuccess(result.user);
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
