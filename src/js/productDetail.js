/* ==========================================================================
   PRODUCT DETAIL — ficha de producto (producto.html): galería, tamaño,
   opciones de grabado, "también te puede interesar" y añadir al carrito
   ========================================================================== */

import { getImgPath } from './utils.js';
import { products, createProductCardHTML, fetchOdooProducts } from './products.js';
import { addToCartCustom } from './cart.js';

// --- CONFIGURACIÓN EDITABLE: AVISO DE BINDERS "XL MASTER SET" ---
// Este texto se muestra cuando alguien elige la opción "4x3 XL" en un binder que
// tenga el atributo "XL Master Set" en Odoo. Cámbialo aquí cuando quieras, sin
// tocar nada más del código.
const XL_MASTER_SET_WARNING = 'Los binders XL Master Set son bajo pedido y pueden tardar más en fabricarse. Te contactaremos para confirmar el plazo exacto antes de procesar tu pedido.';

export async function initProductDetail() {
    const productDetailView = document.getElementById('product-detail-view');
    if (!productDetailView) return;

    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id') || products[0].id;
    let currentProduct = products.find(p => p.id === productId);

    // Si el ID es de Odoo y todavía no ha llegado (carga asíncrona), esperamos a que
    // termine de cargar antes de renderizar, en vez de mostrar el producto equivocado.
    if (!currentProduct && productId.startsWith('odoo-')) {
        productDetailView.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 60px 0; color: var(--text-muted);">Cargando producto...</div>`;
        await fetchOdooProducts();
        currentProduct = products.find(p => p.id === productId) || products[0];
        renderProductDetail(currentProduct);
    } else {
        if (!currentProduct) currentProduct = products[0];
        renderProductDetail(currentProduct);
    }
}

function renderProductDetail(currentProduct) {
    const productDetailView = document.getElementById('product-detail-view');
    if (!productDetailView) return;

    const enviopersonalizado = currentProduct.name.toLowerCase() == "envio personalizado" ;
    const isXLMasterSet = currentProduct.hasXLMasterSet === true;
    const engravingOptions = Array.isArray(currentProduct.engravingOptions) ? currentProduct.engravingOptions : [];

    // Binders normales: solo "3x3 (360 bolsillos)", fijo, sin alternativa.
    // Binders "XL Master Set": 3x3 (360 bolsillos) / 4x3 XL (624 bolsillos, +15€ y aviso)
    let selectedSize = '3x3';
    let currentPrice = currentProduct.price;
    // Opción de grabado seleccionada (solo informativa, no afecta al precio). Por defecto, la primera.
    let selectedEngravingOption = engravingOptions[0] || null;

    function renderDetailView() {
        // Galería completa si el producto la trae (ej. Odoo con 3+ fotos); si no, front/back de siempre.
        const galleryImages = Array.isArray(currentProduct.images) && currentProduct.images.length > 0
            ? currentProduct.images
            : [currentProduct.frontImg, currentProduct.backImg];

        const cantidadHTML = enviopersonalizado ? "" : `
        <div class="selector-group">
                    <label class="filter-label">CANTIDAD:</label>
                    <div class="qty-picker">
                        <button class="qty-btn" id="qty-minus">-</button>
                        <input type="number" id="detail-qty" value="1" min="1" readonly>
                        <button class="qty-btn" id="qty-plus">+</button>
                    </div>
                </div>`

        const sizeOptionsHTML = enviopersonalizado ? "" : isXLMasterSet ? `

        <div class="selector-group">
                    <label class="filter-label">TAMAÑO Y CAPACIDAD:</label>
                    <div class="size-options">
                        <button class="size-btn ${selectedSize === '3x3' ? 'active' : ''}" id="btn-size-3x3">3x3 (360 Bolsillos)</button>
                        <button class="size-btn ${selectedSize === '4x3xl' ? 'active' : ''}" id="btn-size-4x3xl">4x3 XL (624 Bolsillos)</button>
                    </div>
                    <div id="xl-warning-box" style="display:${selectedSize === '4x3xl' ? 'block' : 'none'}; margin-top:10px; padding:10px 14px; border-radius:var(--radius-sm); background:var(--accent-error-bg); color:var(--accent-error); font-size:12.5px; line-height:1.5;">
                        ${XL_MASTER_SET_WARNING}
                    </div>
                </div>
            
        ` : `
        <div class="selector-group">
            <label class="filter-label">TAMAÑO Y CAPACIDAD:</label>
                <div class="size-options">
                    <button class="size-btn active" id="btn-size-3x3-fixed" disabled style="cursor:default;">3x3 (360 Bolsillos)</button>
                </div>
            </div>
        `;

        const engravingOptionsHTML = engravingOptions.length > 0 ? `
            <div class="selector-group">
                <label class="filter-label">OPCIONES ADICIONALES:</label>
                <div class="size-options" id="engraving-options-group" style="flex-wrap:wrap;">
                    ${engravingOptions.map(opt => `
                        <button type="button" class="size-btn engraving-option-btn ${opt === selectedEngravingOption ? 'active' : ''}" data-option="${opt}" style="flex:none; padding:8px 14px;">${opt}</button>
                    `).join('')}
                </div>
            </div>
        ` : '';

        productDetailView.innerHTML = `
            <div style="grid-column: 1 / -1; margin-bottom: -10px;">
                <a href="/tienda/tienda.html" class="btn-secondary" style="display:inline-flex; align-items:center; gap:6px; padding:6px 14px; font-size:11px;">
                    ← Volver a la Tienda
                </a>
            </div>
            <div class="product-gallery">
                <img src="${getImgPath(galleryImages[0])}" id="main-product-img" class="product-main-img" alt="${currentProduct.name}">
                <div class="gallery-thumbs">
                    ${galleryImages.map((img, i) => `
                        <img src="${getImgPath(img)}" class="thumb-img ${i === 0 ? 'active' : ''}" onclick="changeDetailImg(this, '${getImgPath(img)}')">
                    `).join('')}
                </div>
            </div>

            <div class="product-info-panel">
                ${currentProduct.badge ? `<span class="hero-badge">${currentProduct.badge}</span>` : ''}
                <h1 style="font-size: 32px; margin: 10px 0;">${currentProduct.name}</h1>
                
                ${sizeOptionsHTML}
                ${engravingOptionsHTML}

                ${cantidadHTML}

                <div style="font-size: 28px; font-weight: 800; color: var(--accent-jungle);" id="detail-price">${currentPrice.toFixed(2)} €</div>

                <button class="btn-primary" id="btn-add-detail" style="width: 100%; margin-top: 20px; padding: 16px;">
                    🛒 AÑADIR AL CARRITO
                </button>
            </div>

            <div style="grid-column: 1 / -1; margin-top: 40px; border-top: 1px solid var(--border-color); padding-top: 30px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
                    <h3 style="font-size: 20px; font-weight: 700; color: var(--text-primary); margin: 0;">DESCRIPCIÓN DEL PRODUCTO</h3>
                </div>
                <div style="font-size: 14px; color: var(--text-secondary); line-height: 1.8;">
                    ${currentProduct.description}
                </div>
            </div>

            <div style="grid-column: 1 / -1; margin-top: 40px; border-top: 1px solid var(--border-color); padding-top: 30px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
                    <h3 style="font-size: 20px; font-weight: 700; color: var(--text-primary); margin: 0;">TAMBIÉN TE PUEDE INTERESAR</h3>
                </div>
                <div class="product-grid" id="related-products-grid"></div>
            </div>
        `;

        const priceEl = document.getElementById('detail-price');
        const qtyInput = document.getElementById('detail-qty');

        // "También te puede interesar" — solo álbumes (nunca el envío personalizado, odoo-45),
        // nunca el producto que se está viendo, y en orden aleatorio en cada visita.
        const relatedGrid = document.getElementById('related-products-grid');
        if (relatedGrid) {
            const candidates = products.filter(p => p.id !== currentProduct.id && p.id !== 'odoo-45');
            const shuffled = [...candidates].sort(() => Math.random() - 0.5);
            relatedGrid.innerHTML = shuffled.slice(0, 4).map(createProductCardHTML).join('');
        }

        if (enviopersonalizado) {
            
        }

        if (isXLMasterSet) {
            const btn3x3 = document.getElementById('btn-size-3x3');
            const btn4x3xl = document.getElementById('btn-size-4x3xl');
            const warningBox = document.getElementById('xl-warning-box');

            btn3x3.addEventListener('click', () => {
                selectedSize = '3x3';
                currentPrice = currentProduct.price;
                btn3x3.classList.add('active');
                btn4x3xl.classList.remove('active');
                warningBox.style.display = 'none';
                priceEl.textContent = `${currentPrice.toFixed(2)} €`;
            });

            btn4x3xl.addEventListener('click', () => {
                selectedSize = '4x3xl';
                currentPrice = currentProduct.price + 15;
                btn4x3xl.classList.add('active');
                btn3x3.classList.remove('active');
                warningBox.style.display = 'block';
                priceEl.textContent = `${currentPrice.toFixed(2)} €`;
            });
        }
        // Si no es XL Master Set, el tamaño es fijo (3x3, 360 Bolsillos) — no hace falta ningún listener.

        // Botones de "Opciones adicionales" (solo informativos, no tocan el precio)
        const engravingBtns = document.querySelectorAll('.engraving-option-btn');
        engravingBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                engravingBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedEngravingOption = btn.dataset.option;
            });
        });

        document.getElementById('qty-minus').addEventListener('click', () => {
            let currentVal = parseInt(qtyInput.value);
            if (currentVal > 1) qtyInput.value = currentVal - 1;
        });

        document.getElementById('qty-plus').addEventListener('click', () => {
            let currentVal = parseInt(qtyInput.value);
            qtyInput.value = currentVal + 1;
        });

        document.getElementById('btn-add-detail').addEventListener('click', () => {
            const qty = parseInt(qtyInput.value);
            const sizeLabel = isXLMasterSet
                ? (selectedSize === '3x3' ? '3x3' : '4x3 XL')
                : '3x3';
            const engravingLabel = selectedEngravingOption ? `, ${selectedEngravingOption}` : '';
            const customProduct = {
                ...currentProduct,
                name: `${currentProduct.name} (${sizeLabel}${engravingLabel})`,
                price: currentPrice,
                id: `${currentProduct.id}-${selectedSize}-${selectedEngravingOption || 'sinopcion'}`
            };
            addToCartCustom(customProduct, qty);
        });
    }

    renderDetailView();
}

window.changeDetailImg = function (thumb, src) {
    document.querySelectorAll('.thumb-img').forEach(t => t.classList.remove('active'));
    thumb.classList.add('active');
    document.getElementById('main-product-img').src = src;
};
