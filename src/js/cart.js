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
