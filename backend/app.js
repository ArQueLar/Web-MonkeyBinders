/* ==========================================================================
   MONKEY BINDERS - E-Commerce, Filtros, Detalle, Paralaje, Menú Móvil y Modales
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

    function getImgPath(path) {
        const isSubfolder = window.location.pathname.includes('tienda.html') || window.location.pathname.includes('producto.html');
        return isSubfolder ? `../${path}` : path;
    }

    // --- DELEGACIÓN GLOBAL DE EVENTOS PARA EL MENÚ MÓVIL (COMPATIBLE CON TOUCH/MÓVIL) ---
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
            openModal(`
                <div style="text-align:center; padding: 10px;">
                    <span class="section-tag">ACCESO A CLIENTES</span>
                    <h2 class="section-title" style="font-size: 22px; margin-bottom: 20px;">MI CUENTA MONKEY BINDERS</h2>
                    <form onsubmit="event.preventDefault(); alert('¡Sesión iniciada correctamente!'); document.getElementById('modal-overlay').classList.remove('active');" style="display:flex; flex-direction:column; gap:12px; max-width:320px; margin:0 auto;">
                        <input type="email" placeholder="Correo electrónico" class="newsletter-input" required style="background:#f4f4f5; color:#111; border:1px solid #ccc;">
                        <input type="password" placeholder="Contraseña" class="newsletter-input" required style="background:#f4f4f5; color:#111; border:1px solid #ccc;">
                        <button type="submit" class="btn-primary" style="width:100%; justify-content:center; padding:12px;">INICIAR SESIÓN</button>
                    </form>
                    <p style="font-size:12px; color:var(--text-muted); margin-top:15px;">¿No tienes cuenta? <a href="#" style="color:var(--accent-jungle); font-weight:700;">Regístrate aquí</a></p>
                </div>
            `);
        }

        if (searchBtn) {
            e.preventDefault();
            openModal(`
                <div style="text-align:center; padding: 10px;">
                    <span class="section-tag">BÚSQUEDA RÁPIDA</span>
                    <h2 class="section-title" style="font-size: 20px; margin-bottom: 15px;">ENCONTRAR BINDER</h2>
                    <input type="text" id="quick-search-input" placeholder="Escribe Charizard, Mew, 12P..." class="newsletter-input" style="background:#f4f4f5; color:#111; border:1px solid #ccc; width:100%; padding:12px; font-size:14px;">
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
                    const isSub = window.location.pathname.includes('tienda.html') || window.location.pathname.includes('producto.html');
                    const basePath = isSub ? 'producto.html' : 'tienda/producto.html';
                    results.innerHTML = matches.map(m => `
                        <a href="${basePath}?id=${m.id}" style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid #eee; text-decoration:none;">
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

    // --- ROTACIÓN AUTOMÁTICA DE IMÁGENES EN "SOBRE NOSOTROS" ---
    function initAboutSlider() {
        const sliderImages = document.querySelectorAll('.about-image-card .slider-img');
        if (sliderImages.length < 2) return;

        let currentIndex = 0;

        setInterval(() => {
            sliderImages[currentIndex].classList.remove('active');
            currentIndex = (currentIndex + 1) % sliderImages.length;
            sliderImages[currentIndex].classList.add('active');
        }, 3500);
    }

    initAboutSlider();

    // --- EFECTO PARALAJE EN EL HERO DE INICIO ---
    window.addEventListener('scroll', () => {
        const heroBg = document.querySelector('.hero-background-art');
        if (heroBg) {
            const scrollValue = window.scrollY;
            heroBg.style.transform = `translateY(${scrollValue * 0.25}px)`;
        }
    });

    // --- EFECTO PARALAJE HORIZONTAL CON EL MOUSE PARA EL BANNER DE LA TIENDA ---
    const storeBanner = document.querySelector('.store-hero-banner');

    if (storeBanner) {
        let mouseXPercent = 0;
        let animationFrameId = null;

        function updateParallax() {
            const bgOffset = mouseXPercent * 40; // Desplazamiento exclusivo de la imagen de fondo
            storeBanner.style.backgroundPosition = `calc(50% + ${bgOffset}px) center`;
            animationFrameId = null;
        }

        storeBanner.addEventListener('mousemove', (e) => {
            const rect = storeBanner.getBoundingClientRect();
            const x = e.clientX - rect.left;
            mouseXPercent = (x / rect.width) - 0.5;

            if (!animationFrameId) {
                animationFrameId = requestAnimationFrame(updateParallax);
            }
        });

        storeBanner.addEventListener('mouseleave', () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            storeBanner.style.transition = 'background-position 0.5s ease';
            storeBanner.style.backgroundPosition = 'center center';
            setTimeout(() => {
                storeBanner.style.transition = '';
            }, 500);
        });
    }

    // --- BASE DE DATOS DE PRODUCTOS MONKEY BINDERS ---
    const products = [
        {
            id: 'charizard-9p',
            name: 'Binder Phantasmal Flames',
            category: 'ediciones',
            tcg: 'pokemon',
            expansion: 'phantasmal',
            grabadocolor: false,
            price: 49.58,
            price12p: 54.58,
            rating: 5.0,
            reviewsCount: 142,
            badge: 'MÁS VENDIDO',
            frontImg: 'assets/Cosas Web/Fotos Binders/PNG/Charizard/front.png',
            backImg: 'assets/Cosas Web/Fotos Binders/PNG/Charizard/back.png',
            description: 'Despierta la furia del fuego y las sombras con este binder personalizado de Vault X, con Mega Charizard X en la portada y Mega Gengar en la contraportada. Grabado con láser sobre un binder Vault X de alta resistencia.',
            featured: true
        },
        {
            id: 'greninja-12p',
            name: 'Binder Chaos Rising',
            category: 'ediciones',
            tcg: 'pokemon',
            expansion: 'chaos',
            grabadocolor: false,
            price: 49.58,
            price12p: 54.58,
            rating: 4.9,
            reviewsCount: 88,
            badge: 'NUEVO DROP',
            frontImg: 'assets/Cosas Web/Fotos Binders/PNG/Greninja/front.png',
            backImg: 'assets/Cosas Web/Fotos Binders/PNG/Greninja/back.png',
            description: 'Desata el torbellino de la batalla con Mega-Greninja dominando la portada en una demostración de poder puro y sigilo. En la contraportada, Mega-Floette vigila cada carta.'
        },
        {
            id: 'mew-9p',
            name: 'Binder MEW 151',
            category: 'ediciones',
            tcg: 'pokemon',
            expansion: '151',
            grabadocolor: false,
            price: 49.58,
            price12p: 54.58,
            rating: 4.9,
            reviewsCount: 76,
            badge: 'EDICIÓN ESPECIAL',
            frontImg: 'assets/Cosas Web/Fotos Binders/PNG/Mew/front.png',
            backImg: 'assets/Cosas Web/Fotos Binders/PNG/Mew/back.png',
            description: 'Un homenaje a la primera generación que lo empezó todo. Con Mew como protagonista en el centro y las siluetas de los 151 originales.'
        },
        {
            id: 'lugia-hooh-12p',
            name: 'Binder Lugia vs Ho-oh',
            category: 'dsgn',
            tcg: 'pokemon',
            expansion: 'legends',
            grabadocolor: false,
            price: 49.58,
            price12p: 54.58,
            rating: 5.0,
            reviewsCount: 195,
            badge: 'EDICIÓN LIMITADA',
            frontImg: 'assets/Cosas Web/Fotos Binders/PNG/LugiaHoOh/front.png',
            backImg: 'assets/Cosas Web/Fotos Binders/PNG/LugiaHoOh/back.png',
            description: 'Desata el poder ancestral del cielo y la tormenta con Lugia y Ho-Oh dominando la portada en un duelo eterno.'
        },
        {
            id: 'psyduck-9p',
            name: 'Binder Psyduck',
            category: 'dsgn',
            tcg: 'pokemon',
            expansion: '151',
            grabadocolor: false,
            price: 45.45,
            price12p: 50.45,
            rating: 5.0,
            reviewsCount: 64,
            badge: 'POPULAR',
            frontImg: 'assets/Cosas Web/Fotos Binders/PNG/Psyduck/front.png',
            backImg: 'assets/Cosas Web/Fotos Binders/PNG/Psyduck/back.png',
            description: 'Da un toque de humor y estilo a tu colección con este binder personalizado con grabado láser de Psyduck.'
        },
        {
            id: 'lucario-12p',
            name: 'Binder Lucario Megaevolutions',
            category: 'ediciones',
            tcg: 'pokemon',
            expansion: 'chaos',
            grabadocolor: false,
            price: 49.58,
            price12p: 54.58,
            rating: 4.9,
            reviewsCount: 110,
            badge: 'MEJOR VALORADO',
            frontImg: 'assets/Cosas Web/Fotos Binders/PNG/Lucario/front.png',
            backImg: 'assets/Cosas Web/Fotos Binders/PNG/Lucario/back.png',
            description: 'Mega Lucario en la portada y Mega Venusaur en la contraportada. Una pieza poderosa para verdaderos coleccionistas.',
            featured: true
        },
        {
            id: 'pitch-black-12p',
            name: 'Binder Pitch Black',
            category: 'ediciones',
            tcg: 'pokemon',
            expansion: 'pitch-black',
            grabadocolor: false,
            price: 49.58,
            price12p: 54.58,
            rating: 4.9,
            reviewsCount: 320,
            badge: 'NUEVO DROP',
            frontImg: 'assets/Cosas Web/Fotos Binders/PNG/Pitch Black/front.png',
            backImg: 'assets/Cosas Web/Fotos Binders/PNG/Pitch Black/back.png',
            description: 'Lleva tu colección al lado más oscuro con este binder personalizado de la colección Pitch Black, protagonizado por Mega Darkrai.',
            featured: true
        },
        {
            id: 'kanto-151-9p',
            name: 'Binder MEW 151 Color',
            category: 'ediciones',
            tcg: 'pokemon',
            expansion: '151',
            grabadocolor: true,
            price: 53.72,
            price12p: 58.72,
            rating: 5.0,
            reviewsCount: 215,
            badge: 'SET 151 - A COLOR',
            frontImg: 'assets/Cosas Web/ Fotos Binders Color/151/front2.png',
            backImg: 'assets/Cosas Web/ Fotos Binders Color/151/back2.png',
            description: 'Edición exclusiva con grabado láser ultravioleta a todo color sobre la cubierta del binder.',
            featured: true
        },
        {
            id: 'mtg-spiderman-12p',
            name: 'Binder Spiderman Magic',
            category: 'ediciones',
            tcg: 'magic',
            expansion: 'marvel',
            grabadocolor: false,
            price: 49.58,
            price12p: 54.58,
            rating: 4.9,
            reviewsCount: 45,
            badge: 'MAGIC MTG',
            frontImg: 'assets/Cosas Web/Fotos Binders/PNG/Spiderman/front.png',
            backImg: 'assets/Cosas Web/Fotos Binders/PNG/Spiderman/back.png',
            description: 'Diseño exclusivo grabado a láser para los jugadores y coleccionistas de Magic The Gathering.'
        }
    ];

    // --- ESTADO GLOBAL DE FILTROS ---
    const filterState = {
        tcg: 'all',
        finish: 'all',
        expansion: 'all',
        tabCategory: 'all'
    };

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

    // --- RENDERIZADO DEL CATÁLOGO (TIENDA.HTML) ---
    const productGrid = document.getElementById('product-grid');
    const featuredProductGrid = document.getElementById('featured-product-grid');

    function createProductCardHTML(p) {
        const categoryLabel = p.grabadocolor ? 'GRABADO LÁSER A COLOR' : 'GRABADO LÁSER';
        const frontImgPath = getImgPath(p.frontImg);
        const backImgPath = getImgPath(p.backImg);
        
        const targetUrl = window.location.pathname.includes('tienda/') ? `producto.html?id=${p.id}` : `tienda/producto.html?id=${p.id}`;
        
        return `
        <div class="product-card" data-id="${p.id}">
            <a href="${targetUrl}" target="_blank" class="product-image-wrap">
                <span class="product-badge">${p.badge}</span>
                <img src="${frontImgPath}" alt="${p.name}" class="${p.backImg !== p.frontImg ? 'img-front' : 'img-front-only'}">
                ${p.backImg !== p.frontImg ? `<img src="${backImgPath}" alt="${p.name} Trasero" class="img-back">` : ''}
            </a>
            <div class="product-details">
                <div class="product-category">${categoryLabel}</div>
                <h3 class="product-title"><a href="${targetUrl}" target="_blank">${p.name}</a></h3>
                <div class="product-rating">
                    ★★★★★ <span>${p.rating}</span>
                    <span class="rating-count">(${p.reviewsCount} reseñas)</span>
                </div>
                <div class="product-footer">
                    <div class="product-price">
                        <span class="current-price">${p.price.toFixed(2)} €</span>
                    </div>
                    <a href="${targetUrl}" target="_blank" class="add-cart-btn">Ver Opciones</a>
                </div>
            </div>
        </div>
        `;
    }

    function applyFilters() {
        if (!productGrid) return;

        const filtered = products.filter(p => {
            const matchTCG = (filterState.tcg === 'all') || (p.tcg === filterState.tcg);
            let matchFinish = true;
            if (filterState.finish === 'color') matchFinish = p.grabadocolor === true;
            if (filterState.finish === 'monocromo') matchFinish = p.grabadocolor === false;

            const matchExpansion = (filterState.expansion === 'all') || (p.expansion === filterState.expansion);

            let matchTab = true;
            if (filterState.tabCategory !== 'all') {
                if (filterState.tabCategory === 'ediciones' || filterState.tabCategory === 'dsgn') {
                    matchTab = p.category === filterState.tabCategory;
                }
            }

            return matchTCG && matchFinish && matchExpansion && matchTab;
        });

        if (filtered.length === 0) {
            productGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">No se encontraron binders con los filtros seleccionados.</div>`;
        } else {
            productGrid.innerHTML = filtered.map(createProductCardHTML).join('');
        }
    }

    if (productGrid) applyFilters();

    if (featuredProductGrid) {
        const featuredProducts = products.filter(p => p.featured === true);
        featuredProductGrid.innerHTML = featuredProducts.map(createProductCardHTML).join('');
    }

    // --- EVENTOS DE FILTROS EN TIENDA.HTML ---
    const tcgBtns = document.querySelectorAll('#tcg-filter-btns .swatch-btn');
    tcgBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tcgBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filterState.tcg = btn.dataset.tcg;
            applyFilters();
        });
    });

    const finishBtns = document.querySelectorAll('#finish-filter-btns .swatch-btn');
    finishBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            finishBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filterState.finish = btn.dataset.finish;
            applyFilters();
        });
    });

    const expansionSelect = document.getElementById('expansion-select');
    if (expansionSelect) {
        expansionSelect.addEventListener('change', (e) => {
            filterState.expansion = e.target.value;
            applyFilters();
        });
    }

    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filterState.tabCategory = btn.dataset.filter;
            applyFilters();
        });
    });

    // --- LÓGICA DE DETALLE DE PRODUCTO (PRODUCTO.HTML) ---
    const productDetailView = document.getElementById('product-detail-view');
    if (productDetailView) {
        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('id') || products[0].id;
        const currentProduct = products.find(p => p.id === productId) || products[0];

        let selectedSize = '9p';
        let currentPrice = currentProduct.price;

        function renderDetailView() {
            productDetailView.innerHTML = `
                <div class="product-gallery">
                    <img src="${getImgPath(currentProduct.frontImg)}" id="main-product-img" class="product-main-img" alt="${currentProduct.name}">
                    <div class="gallery-thumbs">
                        <img src="${getImgPath(currentProduct.frontImg)}" class="thumb-img active" onclick="changeDetailImg(this, '${getImgPath(currentProduct.frontImg)}')">
                        <img src="${getImgPath(currentProduct.backImg)}" class="thumb-img" onclick="changeDetailImg(this, '${getImgPath(currentProduct.backImg)}')">
                    </div>
                </div>

                <div class="product-info-panel">
                    <span class="hero-badge">${currentProduct.badge}</span>
                    <h1 style="font-size: 32px; margin: 10px 0;">${currentProduct.name}</h1>
                    <div style="font-size: 28px; font-weight: 800; color: var(--accent-jungle);" id="detail-price">${currentPrice.toFixed(2)} €</div>
                    <p style="margin: 20px 0; color: var(--text-secondary); line-height: 1.6;">${currentProduct.description}</p>

                    <div class="selector-group">
                        <label class="filter-label">TAMAÑO Y CAPACIDAD:</label>
                        <div class="size-options">
                            <button class="size-btn ${selectedSize === '9p' ? 'active' : ''}" id="btn-size-9p">9 Bolsillos (360 Cartas)</button>
                            <button class="size-btn ${selectedSize === '12p' ? 'active' : ''}" id="btn-size-12p">12 Bolsillos (480 Cartas)</button>
                        </div>
                    </div>

                    <div class="selector-group">
                        <label class="filter-label">CANTIDAD:</label>
                        <div class="qty-picker">
                            <button class="qty-btn" id="qty-minus">-</button>
                            <input type="number" id="detail-qty" value="1" min="1" readonly>
                            <button class="qty-btn" id="qty-plus">+</button>
                        </div>
                    </div>

                    <button class="btn-primary" id="btn-add-detail" style="width: 100%; margin-top: 20px; padding: 16px;">
                        🛒 AÑADIR AL CARRITO
                    </button>
                </div>
            `;

            const btn9p = document.getElementById('btn-size-9p');
            const btn12p = document.getElementById('btn-size-12p');
            const priceEl = document.getElementById('detail-price');
            const qtyInput = document.getElementById('detail-qty');

            btn9p.addEventListener('click', () => {
                selectedSize = '9p';
                currentPrice = currentProduct.price;
                btn9p.classList.add('active');
                btn12p.classList.remove('active');
                priceEl.textContent = `${currentPrice.toFixed(2)} €`;
            });

            btn12p.addEventListener('click', () => {
                selectedSize = '12p';
                currentPrice = currentProduct.price12p || (currentProduct.price + 5);
                btn12p.classList.add('active');
                btn9p.classList.remove('active');
                priceEl.textContent = `${currentPrice.toFixed(2)} €`;
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
                const customProduct = {
                    ...currentProduct,
                    name: `${currentProduct.name} (${selectedSize === '9p' ? '9 Bolsillos' : '12 Bolsillos'})`,
                    price: currentPrice,
                    id: `${currentProduct.id}-${selectedSize}`
                };
                addToCartCustom(customProduct, qty);
            });
        }

        renderDetailView();
    }

    window.changeDetailImg = function(thumb, src) {
        document.querySelectorAll('.thumb-img').forEach(t => t.classList.remove('active'));
        thumb.classList.add('active');
        document.getElementById('main-product-img').src = src;
    };

    function addToCartCustom(product, quantity) {
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

    // --- CARRITO DESLIZABLE (SLIDING CART DRAWER) ---
    const cartToggleBtn = document.getElementById('cart-toggle-btn');
    const closeCartBtn = document.getElementById('close-cart-btn');
    const cartDrawerOverlay = document.getElementById('cart-drawer-overlay');
    const cartItemsList = document.getElementById('cart-items-list');
    const cartCountBadge = document.getElementById('cart-count-badge');
    const cartSubtotalEl = document.getElementById('cart-subtotal');

    function toggleCartDrawer(open) {
        if (open) cartDrawerOverlay?.classList.add('active');
        else cartDrawerOverlay?.classList.remove('active');
    }

    if (cartToggleBtn) cartToggleBtn.addEventListener('click', () => toggleCartDrawer(true));
    if (closeCartBtn) closeCartBtn.addEventListener('click', () => toggleCartDrawer(false));
    if (cartDrawerOverlay) {
        cartDrawerOverlay.addEventListener('click', (e) => {
            if (e.target === cartDrawerOverlay) toggleCartDrawer(false);
        });
    }

    window.updateQty = function(productId, delta) {
        const itemIndex = cart.findIndex(item => item.product.id === productId);
        if (itemIndex > -1) {
            cart[itemIndex].quantity += delta;
            if (cart[itemIndex].quantity <= 0) cart.splice(itemIndex, 1);
        }
        saveCart();
        updateCartUI();
    };

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

    updateCartUI();

    function showToast(message) {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = message;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
});