/* ==========================================================================
   CART — estado del carrito, panel deslizable y persistencia en localStorage
   ========================================================================== */

import { getImgPath } from './utils.js';
import { showToast } from './toast.js';

// --- PERSISTENCIA DEL CARRITO ---
let cart = [];
try {
    const savedCart = localStorage.getItem('monkey_binders_cart');
    if (savedCart) cart = JSON.parse(savedCart);
} catch (e) {
    cart = [];
}

function saveCart() {
    try {
        localStorage.setItem('monkey_binders_cart', JSON.stringify(cart));
    } catch (e) {
        console.error('Error guardando el carrito:', e);
    }
}

// Referencias DOM del panel del carrito (se rellenan en initCart)
let cartDrawerOverlay = null;
let cartItemsList = null;
let cartCountBadge = null;
let cartSubtotalEl = null;

function toggleCartDrawer(open) {
    if (open) cartDrawerOverlay?.classList.add('active');
    else cartDrawerOverlay?.classList.remove('active');
}

function updateCartUI() {
    const totalCount = cart.reduce((sum, i) => sum + i.quantity, 0);
    const subtotal = cart.reduce((sum, i) => sum + (i.product.price * i.quantity), 0);

    if (cartCountBadge) cartCountBadge.textContent = totalCount;
    if (cartSubtotalEl) cartSubtotalEl.textContent = `${subtotal.toFixed(2)} €`;

    if (cartItemsList) {
        if (cart.length === 0) {
            cartItemsList.innerHTML = `<p style="text-align:center; padding: 40px 0; color: var(--text-muted);">Tu carrito está vacío.</p>`;
        } else {
            cartItemsList.innerHTML = cart.map(item => `
                <div class="cart-item">
                    <img src="${getImgPath(item.product.frontImg)}" class="cart-item-img">
                    <div class="cart-item-info">
                        <div class="cart-item-name">${item.product.name}</div>
                        <div class="cart-item-price">${item.product.price.toFixed(2)} €</div>
                        <div class="cart-item-qty">
                            <button class="qty-btn" onclick="updateQty('${item.product.id}', -1)">-</button>
                            <span>${item.quantity}</span>
                            <button class="qty-btn" onclick="updateQty('${item.product.id}', 1)">+</button>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    }
}

// Usado por producto.html (ficha de producto) para añadir con talla/opciones ya resueltas
export function addToCartCustom(product, quantity) {
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
        existing.quantity += quantity;
    } else {
        cart.push({ product, quantity });
    }
    saveCart();
    updateCartUI();
    toggleCartDrawer(true);
    showToast(`✓ ¡${product.name} añadido al carrito!`);
}

export function initCart() {
    const cartToggleBtn = document.getElementById('cart-toggle-btn');
    const closeCartBtn = document.getElementById('close-cart-btn');
    const checkoutBtn = document.getElementById('checkout-btn');
    cartDrawerOverlay = document.getElementById('cart-drawer-overlay');
    cartItemsList = document.getElementById('cart-items-list');
    cartCountBadge = document.getElementById('cart-count-badge');
    cartSubtotalEl = document.getElementById('cart-subtotal');

    if (cartToggleBtn) cartToggleBtn.addEventListener('click', () => toggleCartDrawer(true));
    if (closeCartBtn) closeCartBtn.addEventListener('click', () => toggleCartDrawer(false));
    if (cartDrawerOverlay) {
        cartDrawerOverlay.addEventListener('click', (e) => {
            if (e.target === cartDrawerOverlay) toggleCartDrawer(false);
        });
    }
    if (checkoutBtn) checkoutBtn.addEventListener('click', handleCheckout);

    // Usado desde los botones +/- inline del carrito (onclick="updateQty(...)")
    window.updateQty = function (productId, delta) {
        const itemIndex = cart.findIndex(item => item.product.id === productId);
        if (itemIndex > -1) {
            cart[itemIndex].quantity += delta;
            if (cart[itemIndex].quantity <= 0) cart.splice(itemIndex, 1);
        }
        saveCart();
        updateCartUI();
    };

    updateCartUI();
}

// --- CHECKOUT (pago con Redsys) ---
async function handleCheckout() {
    if (cart.length === 0) {
        showToast('⚠ Tu carrito está vacío');
        return;
    }

    const checkoutBtn = document.getElementById('checkout-btn');
    checkoutBtn.disabled = true;
    checkoutBtn.textContent = 'PREPARANDO PAGO...';

    try {
        // Si el cliente ya tiene sesión iniciada, usamos su email/nombre directamente.
        // Si no, se los pedimos con un formulario mínimo antes de continuar.
        let customerEmail, customerName;
        const sessionRes = await fetch('/api/session');
        const session = await sessionRes.json();

        if (session.loggedIn) {
            customerEmail = session.user.email;
            customerName = session.user.name;
        } else {
            const guestInfo = await promptGuestInfo();
            if (!guestInfo) {
                checkoutBtn.disabled = false;
                checkoutBtn.textContent = 'FINALIZAR COMPRA';
                return; // el cliente canceló
            }
            customerEmail = guestInfo.email;
            customerName = guestInfo.name;
        }

        const amount = cart.reduce((sum, i) => sum + (i.product.price * i.quantity), 0);
        const items = cart.map(i => ({
            id: i.product.id,
            name: i.product.name,
            price: i.product.price,
            quantity: i.quantity
        }));

        const r = await fetch('/api/create-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, items, customerEmail, customerName })
        });
        const result = await r.json();

        if (!result.success) {
            showToast(`⚠ ${result.error || 'No se pudo iniciar el pago'}`);
            checkoutBtn.disabled = false;
            checkoutBtn.textContent = 'FINALIZAR COMPRA';
            return;
        }

        // Construimos un formulario invisible y lo autoenviamos — así es como
        // funciona la integración "por Redirección" de Redsys: el navegador
        // del cliente va físicamente a su página de pago.
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = result.redsysUrl;
        Object.entries(result.formFields).forEach(([key, value]) => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = value;
            form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();
    } catch (err) {
        showToast('⚠ Error de conexión al preparar el pago');
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = 'FINALIZAR COMPRA';
    }
}

// Formulario mínimo de nombre + email para quien compra sin haber iniciado sesión.
function promptGuestInfo() {
    return new Promise((resolve) => {
        const modalOverlay = document.getElementById('modal-overlay');
        const modalBody = document.getElementById('modal-body');
        if (!modalOverlay || !modalBody) {
            resolve(null);
            return;
        }

        modalBody.innerHTML = `
            <div style="text-align:center; padding: 10px;">
                <span class="section-tag">ANTES DE PAGAR</span>
                <h2 class="section-title" style="font-size: 20px; margin-bottom: 20px;">TUS DATOS DE CONTACTO</h2>
                <form id="guest-checkout-form" style="display:flex; flex-direction:column; gap:12px; max-width:320px; margin:0 auto;">
                    <input type="text" name="name" placeholder="Nombre completo" class="form-input" required>
                    <input type="email" name="email" placeholder="Correo electrónico" class="form-input" required>
                    <button type="submit" class="btn-primary" style="width:100%; justify-content:center; padding:12px;">CONTINUAR AL PAGO</button>
                </form>
            </div>
        `;
        modalOverlay.classList.add('active');

        const form = document.getElementById('guest-checkout-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            modalOverlay.classList.remove('active');
            resolve({ name: formData.get('name'), email: formData.get('email') });
        });

        // Si cierra el modal sin rellenar, cancelamos el checkout
        const closeModalBtn = document.getElementById('close-modal-btn');
        const handleClose = () => {
            modalOverlay.classList.remove('active');
            resolve(null);
            closeModalBtn?.removeEventListener('click', handleClose);
        };
        closeModalBtn?.addEventListener('click', handleClose, { once: true });
    });
}
