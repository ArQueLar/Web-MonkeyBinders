/* ==========================================================================
   MONKEY BINDERS - E-Commerce, Filtros, Detalle, Paralaje, Menú Móvil y Modales
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

    function getImgPath(path) {
        if (/^https?:\/\//i.test(path)) return path; // URLs absolutas (ej. imágenes de Odoo) se dejan tal cual
        const isSubfolder = window.location.pathname.includes('tienda.html') || window.location.pathname.includes('producto.html');
        return isSubfolder ? `../${path}` : path;
    }

    // --- MODO OSCURO & CAMBIO DINÁMICO DE LOGO ---
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const themeIcon = document.getElementById('theme-icon');
    const headerLogoImg = document.getElementById('header-logo-img');

    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);

        if (themeIcon) {
            const basePath = getImgPath('assets/Cosas Web/svg/');
            themeIcon.src = theme === 'dark' ? basePath + 'sol.svg' : basePath + 'luna.svg';
        }

        if (headerLogoImg) {
            const isSub = window.location.pathname.includes('tienda.html') || window.location.pathname.includes('producto.html');
            const logoPath = isSub ? '../assets/Cosas Web/Logo/' : 'assets/Cosas Web/Logo/';
            headerLogoImg.src = theme === 'dark' ? logoPath + 'LogoBlanco.png' : logoPath + 'Logo.png';
        }
    }

    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            setTheme(currentTheme === 'dark' ? 'light' : 'dark');
        });
    }

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
            openModal(`
                <div style="text-align:center; padding: 10px;">
                    <span class="section-tag">ACCESO A CLIENTES</span>
                    <h2 class="section-title" style="font-size: 22px; margin-bottom: 20px;">MI CUENTA MONKEY BINDERS</h2>
                    <form onsubmit="event.preventDefault(); alert('¡Sesión iniciada correctamente!'); document.getElementById('modal-overlay').classList.remove('active');" style="display:flex; flex-direction:column; gap:12px; max-width:320px; margin:0 auto;">
                        <input type="email" placeholder="Correo electrónico" class="newsletter-input" required style="background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">
                        <input type="password" placeholder="Contraseña" class="newsletter-input" required style="background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">
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
                    const isSub = window.location.pathname.includes('tienda.html') || window.location.pathname.includes('producto.html');
                    const basePath = isSub ? 'producto.html' : 'tienda/producto.html';
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
            const bgOffset = mouseXPercent * 40; 
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
    let products = [
    //    {
    //        id: 'charizard-9p',
    //        name: 'Binder Phantasmal Flames',
    //        category: 'ediciones',
    //        tcg: 'pokemon',
    //        expansion: 'megaevolutions',
    //        grabadocolor: false,
    //        price: 49.58,
    //        price12p: 54.58,
    //        rating: 5.0,
    //        reviewsCount: 142,
    //        badge: 'MÁS VENDIDO',
    //        frontImg: 'assets/Cosas Web/Fotos Binders/PNG/Charizard/front.png',
    //        backImg: 'assets/Cosas Web/Fotos Binders/PNG/Charizard/back.png',
    //        description: 'Despierta la furia del fuego y las sombras con este binder personalizado de Vault X, con Mega Charizard X en la portada y Mega Gengar en la contraportada. Grabado con láser sobre un binder Vault X de alta resistencia.',
    //        featured: true
    //    },
    //    {
    //        id: 'greninja-12p',
    //        name: 'Binder Chaos Rising',
    //        category: 'ediciones',
    //        tcg: 'pokemon',
    //        expansion: 'megaevolutions',
    //        grabadocolor: false,
    //        price: 49.58,
    //        price12p: 54.58,
    //        rating: 4.9,
    //        reviewsCount: 88,
    //        badge: 'NUEVO DROP',
    //        frontImg: 'assets/Cosas Web/Fotos Binders/PNG/Greninja/front.png',
    //        backImg: 'assets/Cosas Web/Fotos Binders/PNG/Greninja/back.png',
    //        description: 'Desata el torbellino de la batalla con Mega-Greninja dominando la portada en una demostración de poder puro y sigilo. En la contraportada, Mega-Floette vigila cada carta.'
    //    },
    //    {
    //        id: 'mew-9p',
    //        name: 'Binder MEW 151',
    //        category: 'ediciones',
    //        tcg: 'pokemon',
    //        expansion: 'scarletviolet',
    //        grabadocolor: false,
    //        price: 49.58,
    //        price12p: 54.58,
    //        rating: 4.9,
    //        reviewsCount: 76,
    //        badge: 'EDICIÓN ESPECIAL',
    //        frontImg: 'assets/Cosas Web/Fotos Binders/PNG/Mew/front.png',
    //        backImg: 'assets/Cosas Web/Fotos Binders/PNG/Mew/back.png',
    //        description: 'Un homenaje a la primera generación que lo empezó todo. Con Mew como protagonista en el centro y las siluetas de los 151 originales.'
    //    },
    //    {
    //        id: 'lugia-hooh-12p',
    //        name: 'Binder Lugia vs Ho-oh',
    //        category: 'dsgn',
    //        tcg: 'pokemon',
    //        expansion: 'legends',
    //        grabadocolor: false,
    //        price: 49.58,
    //        price12p: 54.58,
    //        rating: 5.0,
    //        reviewsCount: 195,
    //        badge: 'EDICIÓN LIMITADA',
    //        frontImg: 'assets/Cosas Web/Fotos Binders/PNG/LugiaHoOh/front.png',
    //        backImg: 'assets/Cosas Web/Fotos Binders/PNG/LugiaHoOh/back.png',
    //        description: 'Desata el poder ancestral del cielo y la tormenta con Lugia y Ho-Oh dominando la portada en un duelo eterno.'
    //    },
    //    {
    //        id: 'psyduck-9p',
    //        name: 'Binder Psyduck',
    //        category: 'dsgn',
    //        tcg: 'pokemon',
    //        expansion: '151',
    //        grabadocolor: false,
    //        price: 45.45,
    //        price12p: 50.45,
    //        rating: 5.0,
    //        reviewsCount: 64,
    //        badge: 'POPULAR',
    //        frontImg: 'assets/Cosas Web/Fotos Binders/PNG/Psyduck/front.png',
    //        backImg: 'assets/Cosas Web/Fotos Binders/PNG/Psyduck/back.png',
    //        description: 'Da un toque de humor y estilo a tu colección con este binder personalizado con grabado láser de Psyduck.'
    //    },
    //    {
    //        id: 'lucario-12p',
    //        name: 'Binder Lucario Megaevolutions',
    //        category: 'ediciones',
    //        tcg: 'pokemon',
    //        expansion: 'megaevolutions',
    //        grabadocolor: false,
    //        price: 49.58,
    //        price12p: 54.58,
    //        rating: 4.9,
    //        reviewsCount: 110,
    //        badge: 'MEJOR VALORADO',
    //        frontImg: 'assets/Cosas Web/Fotos Binders/PNG/Lucario/front.png',
    //        backImg: 'assets/Cosas Web/Fotos Binders/PNG/Lucario/back.png',
    //        description: 'Mega Lucario en la portada y Mega Venusaur en la contraportada. Una pieza poderosa para verdaderos coleccionistas.',
    //        featured: true
    //    },
    //    {
    //        id: 'pitch-black-12p',
    //        name: 'Binder Pitch Black',
    //        category: 'ediciones',
    //        tcg: 'pokemon',
    //        expansion: 'megaevolutions',
    //        grabadocolor: false,
    //        price: 49.58,
    //        price12p: 54.58,
    //        rating: 4.9,
    //        reviewsCount: 320,
    //        badge: 'NUEVO DROP',
    //        frontImg: 'assets/Cosas Web/Fotos Binders/PNG/Pitch Black/front.png',
    //        backImg: 'assets/Cosas Web/Fotos Binders/PNG/Pitch Black/back.png',
    //        description: 'Lleva tu colección al lado más oscuro con este binder personalizado de la colección Pitch Black, protagonizado por Mega Darkrai.',
    //        featured: true
    //    },
    //    {
    //        id: 'kanto-151-9p',
    //        name: 'Binder MEW 151 Color',
    //        category: 'ediciones',
    //        tcg: 'pokemon',
    //        expansion: 'scarletviolet',
    //        grabadocolor: true,
    //        price: 53.72,
    //        price12p: 58.72,
    //        rating: 5.0,
    //        reviewsCount: 215,
    //        badge: 'SET 151 - A COLOR',
    //        frontImg: 'assets/Cosas Web/ Fotos Binders Color/151/front2.png',
    //        backImg: 'assets/Cosas Web/ Fotos Binders Color/151/back2.png',
    //        description: 'Edición exclusiva con grabado láser ultravioleta a todo color sobre la cubierta del binder.',
    //        featured: true
    //    },
    //    {
    //        id: 'mtg-spiderman-12p',
    //        name: 'Binder Spiderman Magic',
    //        category: 'ediciones',
    //        tcg: 'magic',
    //        expansion: 'marvel',
    //        grabadocolor: false,
    //        price: 49.58,
    //        price12p: 54.58,
    //        rating: 4.9,
    //        reviewsCount: 45,
    //        badge: 'MAGIC MTG',
    //        frontImg: 'assets/Cosas Web/Fotos Binders/PNG/Spiderman/front.png',
    //        backImg: 'assets/Cosas Web/Fotos Binders/PNG/Spiderman/back.png',
    //        description: 'Diseño exclusivo grabado a láser para los jugadores y coleccionistas de Magic The Gathering.'
    //    }
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
            <a href="${targetUrl}" class="product-image-wrap">
                ${p.badge ? `<span class="product-badge">${p.badge}</span>` : ''}
                <img src="${frontImgPath}" alt="${p.name}" class="${p.backImg !== p.frontImg ? 'img-front' : 'img-front-only'}">
                ${p.backImg !== p.frontImg ? `<img src="${backImgPath}" alt="${p.name} Trasero" class="img-back">` : ''}
            </a>
            <div class="product-details">
                <div class="product-category">${categoryLabel}</div>
                <h3 class="product-title"><a href="${targetUrl}">${p.name}</a></h3>
                ${p.rating != null ? `
                <div class="product-rating">
                    ★★★★★ <span>${p.rating}</span>
                    <span class="rating-count">(${p.reviewsCount} reseñas)</span>
                </div>` : ''}
                <div class="product-footer">
                    <div class="product-price">
                        <span class="current-price">${p.price.toFixed(2)} €</span>
                    </div>
                    <a href="${targetUrl}" class="add-cart-btn">Ver Opciones</a>
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

    // --- CARGA DE PRODUCTOS DESDE ODOO ---
    // Se añaden a los productos ya definidos arriba y se vuelve a pintar el catálogo
    // (o la ficha de producto, si estábamos esperando uno con id "odoo-...").
    // Si /api/get-products no existe todavía (no está desplegado) o falla, la web sigue
    // funcionando con normalidad solo con los productos hardcodeados.
    if (productGrid || featuredProductGrid || productDetailView) {
        fetch('../api/getproducts.js')
            .then(r => r.json())
            .then(data => {
                if (!data.success || !Array.isArray(data.products) || data.products.length === 0) return;

                products = products.concat(data.products);

                if (productGrid) applyFilters();
                if (featuredProductGrid) {
                    const featuredProducts = products.filter(p => p.featured === true);
                    featuredProductGrid.innerHTML = featuredProducts.map(createProductCardHTML).join('');
                }
                if (productDetailView) {
                    const urlParams = new URLSearchParams(window.location.search);
                    const productId = urlParams.get('id') || products[0].id;
                    const currentProduct = products.find(p => p.id === productId) || products[0];
                    renderProductDetail(currentProduct);
                }
            })
            .catch(() => {
                // Silencioso: si Odoo no está conectado todavía, la tienda sigue funcionando igual.
            });
    }

    // --- EVENTOS DE FILTROS EN TIENDA.HTML ---
    const tcgBtns = document.querySelectorAll('#tcg-filter-btns .swatch-btn');
    tcgBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tcgBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filterState.tcg = btn.dataset.tcg;
            applyFilters();
            updateFiltersCountBadge();
        });
    });

    const finishBtns = document.querySelectorAll('#finish-filter-btns .swatch-btn');
    finishBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            finishBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filterState.finish = btn.dataset.finish;
            applyFilters();
            updateFiltersCountBadge();
        });
    });

    const expansionBtns = document.querySelectorAll('#expansion-filter-btns .swatch-btn');
    expansionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            expansionBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filterState.expansion = btn.dataset.expansion;
            applyFilters();
            updateFiltersCountBadge();
        });
    });

    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filterState.tabCategory = btn.dataset.filter;
            applyFilters();
        });
    });

    // --- PANEL LATERAL DE FILTROS (TIENDA.HTML) ---
    const filtersTriggerBtn = document.getElementById('filters-trigger-btn');
    const closeFiltersBtn = document.getElementById('close-filters-btn');
    const filtersDrawerOverlay = document.getElementById('filters-drawer-overlay');
    const applyFiltersBtn = document.getElementById('apply-filters-btn');
    const resetFiltersBtn = document.getElementById('reset-filters-btn');
    const filtersCountBadge = document.getElementById('filters-count-badge');

    function toggleFiltersDrawer(open) {
        if (open) filtersDrawerOverlay?.classList.add('active');
        else filtersDrawerOverlay?.classList.remove('active');
    }

    if (filtersTriggerBtn) filtersTriggerBtn.addEventListener('click', () => toggleFiltersDrawer(true));
    if (closeFiltersBtn) closeFiltersBtn.addEventListener('click', () => toggleFiltersDrawer(false));
    if (applyFiltersBtn) applyFiltersBtn.addEventListener('click', () => toggleFiltersDrawer(false));
    if (filtersDrawerOverlay) {
        filtersDrawerOverlay.addEventListener('click', (e) => {
            if (e.target === filtersDrawerOverlay) toggleFiltersDrawer(false);
        });
    }

    function updateFiltersCountBadge() {
        if (!filtersCountBadge) return;
        let count = 0;
        if (filterState.tcg !== 'all') count++;
        if (filterState.finish !== 'all') count++;
        if (filterState.expansion !== 'all') count++;
        filtersCountBadge.textContent = count;
        filtersCountBadge.style.display = count > 0 ? 'inline-flex' : 'none';
    }

    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            filterState.tcg = 'all';
            filterState.finish = 'all';
            filterState.expansion = 'all';

            tcgBtns.forEach(b => b.classList.toggle('active', b.dataset.tcg === 'all'));
            finishBtns.forEach(b => b.classList.toggle('active', b.dataset.finish === 'all'));
            expansionBtns.forEach(b => b.classList.toggle('active', b.dataset.expansion === 'all'));

            applyFilters();
            updateFiltersCountBadge();
        });
    }

    updateFiltersCountBadge();

    // --- LÓGICA DE DETALLE DE PRODUCTO (PRODUCTO.HTML) ---
    const productDetailView = document.getElementById('product-detail-view');
    if (productDetailView) {
        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('id') || products[0].id;
        let currentProduct = products.find(p => p.id === productId);

        // Si el ID es de Odoo y todavía no ha llegado (carga asíncrona), esperamos antes de renderizar
        if (!currentProduct && productId.startsWith('odoo-')) {
            productDetailView.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 60px 0; color: var(--text-muted);">Cargando producto...</div>`;
        } else {
            if (!currentProduct) currentProduct = products[0];
            renderProductDetail(currentProduct);
        }
    }

    function renderProductDetail(currentProduct) {
        const productDetailView = document.getElementById('product-detail-view');
        if (!productDetailView) return;

        let selectedSize = '9p';
        let currentPrice = currentProduct.price;

        function renderDetailView() {
            productDetailView.innerHTML = `
                <div style="grid-column: 1 / -1; margin-bottom: -10px;">
                    <a href="tienda.html" class="btn-secondary" style="display:inline-flex; align-items:center; gap:6px; padding:6px 14px; font-size:11px;">
                        ← Volver a la Tienda
                    </a>
                </div>
                <div class="product-gallery">
                    <img src="${getImgPath(currentProduct.frontImg)}" id="main-product-img" class="product-main-img" alt="${currentProduct.name}">
                    <div class="gallery-thumbs">
                        <img src="${getImgPath(currentProduct.frontImg)}" class="thumb-img active" onclick="changeDetailImg(this, '${getImgPath(currentProduct.frontImg)}')">
                        <img src="${getImgPath(currentProduct.backImg)}" class="thumb-img" onclick="changeDetailImg(this, '${getImgPath(currentProduct.backImg)}')">
                    </div>
                </div>

                <div class="product-info-panel">
                    ${currentProduct.badge ? `<span class="hero-badge">${currentProduct.badge}</span>` : ''}
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

    window.changeDetailImg = function (thumb, src) {
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

    window.updateQty = function (productId, delta) {
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

    // --- FORMULARIO DE PERSONALIZACIÓN (envío vía Web3Forms + imagen vía nuestra función /api/upload-image) ---
    const customizerForm = document.getElementById('customizer-form');
    if (customizerForm) {
        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
        const DEFAULT_UPLOAD_LABEL = '📎 Haz clic para subir una imagen (JPG, PNG · máx. 10MB)';
        const imageInput = document.getElementById('customizer-image-input');
        const fileUploadBox = document.getElementById('file-upload-box');
        const fileUploadLabel = document.getElementById('file-upload-label');
        const fileErrorText = document.getElementById('file-error-text');

        if (imageInput) {
            imageInput.addEventListener('change', () => {
                const file = imageInput.files[0];
                fileErrorText.style.display = 'none';

                if (!file) {
                    fileUploadBox.classList.remove('has-file');
                    fileUploadLabel.textContent = DEFAULT_UPLOAD_LABEL;
                    return;
                }

                if (file.size > MAX_FILE_SIZE) {
                    fileErrorText.textContent = 'La imagen supera los 10MB. Elige un archivo más ligero.';
                    fileErrorText.style.display = 'block';
                    imageInput.value = '';
                    fileUploadBox.classList.remove('has-file');
                    fileUploadLabel.textContent = DEFAULT_UPLOAD_LABEL;
                    return;
                }

                fileUploadBox.classList.add('has-file');
                fileUploadLabel.textContent = `✓ ${file.name}`;
            });
        }

        // Selector de color con muestras (swatches)
        const colorSwatchBtns = document.querySelectorAll('#color-swatch-grid .color-swatch-btn');
        const colorBinderInput = document.getElementById('color-binder-value');
        const colorErrorText = document.getElementById('color-error-text');
        colorSwatchBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                colorSwatchBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (colorBinderInput) colorBinderInput.value = btn.dataset.color;
                if (colorErrorText) colorErrorText.style.display = 'none';
            });
        });

        // Sube la imagen a través de nuestra función serverless (/api/upload-image),
        // que es quien habla con ImgBB. La clave de ImgBB nunca llega al navegador.
        async function uploadImage(file) {
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
                reader.readAsDataURL(file);
            });

            const response = await fetch('/api/upload-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: base64 })
            });
            const result = await response.json();
            if (!result.success) throw new Error('Error al subir la imagen');
            return result.url;
        }

        customizerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('customizer-submit-btn');
            const statusEl = document.getElementById('customizer-form-status');
            const accessKey = customizerForm.querySelector('input[name="access_key"]').value;
            const file = imageInput ? imageInput.files[0] : null;

            if (!accessKey || accessKey === 'TU_ACCESS_KEY_DE_WEB3FORMS') {
                statusEl.textContent = 'Falta configurar la clave de Web3Forms en el formulario.';
                statusEl.className = 'form-status-error';
                return;
            }

            if (colorBinderInput && !colorBinderInput.value) {
                if (colorErrorText) {
                    colorErrorText.textContent = 'Elige un color para el binder.';
                    colorErrorText.style.display = 'block';
                }
                document.getElementById('color-swatch-grid')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }

            submitBtn.disabled = true;
            statusEl.textContent = '';
            statusEl.className = '';

            try {
                const formData = new FormData(customizerForm);
                formData.delete('attachment'); // No enviamos el archivo binario a Web3Forms (requiere plan de pago)

                if (file) {
                    submitBtn.textContent = 'SUBIENDO IMAGEN...';
                    const imageUrl = await uploadImage(file);
                    formData.append('Imagen del diseño', imageUrl);
                } else {
                    formData.append('Imagen del diseño', 'No se adjuntó ninguna imagen');
                }

                submitBtn.textContent = 'ENVIANDO...';
                const response = await fetch('https://api.web3forms.com/submit', {
                    method: 'POST',
                    headers: { 'Accept': 'application/json' },
                    body: formData
                });
                const result = await response.json();

                if (result.success) {
                    statusEl.textContent = '✓ ¡Solicitud enviada! Te contactaremos pronto por email.';
                    statusEl.className = 'form-status-success';
                    showToast('✓ ¡Solicitud de personalización enviada!');
                    customizerForm.reset();
                    if (fileUploadBox) fileUploadBox.classList.remove('has-file');
                    if (fileUploadLabel) fileUploadLabel.textContent = DEFAULT_UPLOAD_LABEL;
                    colorSwatchBtns.forEach(b => b.classList.remove('active'));
                    if (colorBinderInput) colorBinderInput.value = '';
                } else {
                    statusEl.textContent = 'Hubo un problema al enviar. Inténtalo de nuevo.';
                    statusEl.className = 'form-status-error';
                }
            } catch (err) {
                statusEl.textContent = err.message === 'Error al subir la imagen'
                    ? 'No se pudo subir la imagen. Inténtalo de nuevo o continúa sin adjuntarla.'
                    : 'Error de conexión. Inténtalo de nuevo más tarde.';
                statusEl.className = 'form-status-error';
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'ENVIAR SOLICITUD';
            }
        });
    }

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