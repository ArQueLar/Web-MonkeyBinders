/* ==========================================================================
   PRODUCTS — catálogo, filtros, tarjetas de producto y carga desde Odoo
   ========================================================================== */

import { loadHues, colorSortKey, COLOR_NAME_TO_HUE } from './colorSort.js';
import { getImgPath } from './utils.js';

export let products = [
        // {
        //     id: 'charizard-9p',
        //     name: 'Binder Phantasmal Flames',
        //     category: 'ediciones',
        //     tcg: 'pokemon',
        //     expansion: 'megaevolutions',
        //     grabadocolor: false,
        //     price: 49.58,
        //     price12p: 54.58,
        //     rating: 5.0,
        //     reviewsCount: 142,
        //     badge: 'MÁS VENDIDO',
        //     frontImg: 'assets/Cosas Web/Fotos Binders/PNG/Charizard/front.png',
        //     backImg: 'assets/Cosas Web/Fotos Binders/PNG/Charizard/back.png',
        //     description: 'Despierta la furia del fuego y las sombras con este binder personalizado de Vault X, con Mega Charizard X en la portada y Mega Gengar en la contraportada. Grabado con láser sobre un binder Vault X de alta resistencia.',
        //     featured: true
        // },
        // {
        //     id: 'greninja-12p',
        //     name: 'Binder Chaos Rising',
        //     category: 'ediciones',
        //     tcg: 'pokemon',
        //     expansion: 'megaevolutions',
        //     grabadocolor: false,
        //     price: 49.58,
        //     price12p: 54.58,
        //     rating: 4.9,
        //     reviewsCount: 88,
        //     badge: 'NUEVO DROP',
        //     frontImg: 'assets/Cosas Web/Fotos Binders/PNG/Greninja/front.png',
        //     backImg: 'assets/Cosas Web/Fotos Binders/PNG/Greninja/back.png',
        //     description: 'Desata el torbellino de la batalla con Mega-Greninja dominando la portada en una demostración de poder puro y sigilo. En la contraportada, Mega-Floette vigila cada carta.'
        // },
        // {
        //     id: 'mew-9p',
        //     name: 'Binder MEW 151',
        //     category: 'ediciones',
        //     tcg: 'pokemon',
        //     expansion: 'scarletviolet',
        //     grabadocolor: false,
        //     price: 49.58,
        //     price12p: 54.58,
        //     rating: 4.9,
        //     reviewsCount: 76,
        //     badge: 'EDICIÓN ESPECIAL',
        //     frontImg: 'assets/Cosas Web/Fotos Binders/PNG/Mew/front.png',
        //     backImg: 'assets/Cosas Web/Fotos Binders/PNG/Mew/back.png',
        //     description: 'Un homenaje a la primera generación que lo empezó todo. Con Mew como protagonista en el centro y las siluetas de los 151 originales.'
        // },
        // {
        //     id: 'lugia-hooh-12p',
        //     name: 'Binder Lugia vs Ho-oh',
        //     category: 'dsgn',
        //     tcg: 'pokemon',
        //     expansion: 'legends',
        //     grabadocolor: false,
        //     price: 49.58,
        //     price12p: 54.58,
        //     rating: 5.0,
        //     reviewsCount: 195,
        //     badge: 'EDICIÓN LIMITADA',
        //     frontImg: 'assets/Cosas Web/Fotos Binders/PNG/LugiaHoOh/front.png',
        //     backImg: 'assets/Cosas Web/Fotos Binders/PNG/LugiaHoOh/back.png',
        //     description: 'Desata el poder ancestral del cielo y la tormenta con Lugia y Ho-Oh dominando la portada en un duelo eterno.'
        // },
        // {
        //     id: 'psyduck-9p',
        //     name: 'Binder Psyduck',
        //     category: 'dsgn',
        //     tcg: 'pokemon',
        //     expansion: '151',
        //     grabadocolor: false,
        //     price: 45.45,
        //     price12p: 50.45,
        //     rating: 5.0,
        //     reviewsCount: 64,
        //     badge: 'POPULAR',
        //     frontImg: 'assets/Cosas Web/Fotos Binders/PNG/Psyduck/front.png',
        //     backImg: 'assets/Cosas Web/Fotos Binders/PNG/Psyduck/back.png',
        //     description: 'Da un toque de humor y estilo a tu colección con este binder personalizado con grabado láser de Psyduck.'
        // },
        // {
        //     id: 'lucario-12p',
        //     name: 'Binder Lucario Megaevolutions',
        //     category: 'ediciones',
        //     tcg: 'pokemon',
        //     expansion: 'megaevolutions',
        //     grabadocolor: false,
        //     price: 49.58,
        //     price12p: 54.58,
        //     rating: 4.9,
        //     reviewsCount: 110,
        //     badge: 'MEJOR VALORADO',
        //     frontImg: 'assets/Cosas Web/Fotos Binders/PNG/Lucario/front.png',
        //     backImg: 'assets/Cosas Web/Fotos Binders/PNG/Lucario/back.png',
        //     description: 'Mega Lucario en la portada y Mega Venusaur en la contraportada. Una pieza poderosa para verdaderos coleccionistas.',
        //     featured: true
        // },
        // {
        //     id: 'pitch-black-12p',
        //     name: 'Binder Pitch Black',
        //     category: 'ediciones',
        //     tcg: 'pokemon',
        //     expansion: 'megaevolutions',
        //     grabadocolor: false,
        //     price: 49.58,
        //     price12p: 54.58,
        //     rating: 4.9,
        //     reviewsCount: 320,
        //     badge: 'NUEVO DROP',
        //     frontImg: 'assets/Cosas Web/Fotos Binders/PNG/Pitch Black/front.png',
        //     backImg: 'assets/Cosas Web/Fotos Binders/PNG/Pitch Black/back.png',
        //     description: 'Lleva tu colección al lado más oscuro con este binder personalizado de la colección Pitch Black, protagonizado por Mega Darkrai.',
        //     featured: true
        // },
        // {
        //     id: 'kanto-151-9p',
        //     name: 'Binder MEW 151 Color',
        //     category: 'ediciones',
        //     tcg: 'pokemon',
        //     expansion: 'scarletviolet',
        //     grabadocolor: true,
        //     price: 53.72,
        //     price12p: 58.72,
        //     rating: 5.0,
        //     reviewsCount: 215,
        //     badge: 'SET 151 - A COLOR',
        //     frontImg: 'assets/Cosas Web/ Fotos Binders Color/151/front2.png',
        //     backImg: 'assets/Cosas Web/ Fotos Binders Color/151/back2.png',
        //     description: 'Edición exclusiva con grabado láser ultravioleta a todo color sobre la cubierta del binder.',
        //     featured: true
        // },
        // {
        //     id: 'mtg-spiderman-12p',
        //     name: 'Binder Spiderman Magic',
        //     category: 'ediciones',
        //     tcg: 'magic',
        //     expansion: 'marvel',
        //     grabadocolor: false,
        //     price: 49.58,
        //     price12p: 54.58,
        //     rating: 4.9,
        //     reviewsCount: 45,
        //     badge: 'MAGIC MTG',
        //     frontImg: 'assets/Cosas Web/Fotos Binders/PNG/Spiderman/front.png',
        //     backImg: 'assets/Cosas Web/Fotos Binders/PNG/Spiderman/back.png',
        //     description: 'Diseño exclusivo grabado a láser para los jugadores y coleccionistas de Magic The Gathering.'
        // }
    ];

// --- ESTADO GLOBAL DE FILTROS ---
export const filterState = {
    tcg: 'all',
    finish: 'all',
    expansion: 'all',
    tabCategory: 'all',
    sort: 'featured'
};

// Tonos dominantes por producto (se calculan una vez, solo si alguien ordena por color)
let hueById = {};
let huesLoading = false;
let huesLoadedFor = 0;
const numericId = p => Number(String(p.id).replace(/\D/g, '')) || 0;

function ensureHues() {
    const physical = products.filter(p => !p.services && p.frontImg);
    if (huesLoading || huesLoadedFor === physical.length) return;
    huesLoading = true;
    loadHues(physical).then(map => {
        hueById = map;
        huesLoadedFor = physical.length;
        huesLoading = false;
        if (filterState.sort === 'color') applyFilters();
    });
}

function sortProducts(list) {
    const arr = list.slice();
    switch (filterState.sort) {
        case 'newest':     // el id de Odoo crece con cada producto nuevo
            return arr.sort((a, b) => numericId(b) - numericId(a));
        case 'price-asc':
            return arr.sort((a, b) => a.price - b.price || a.name.localeCompare(b.name, 'es'));
        case 'price-desc':
            return arr.sort((a, b) => b.price - a.price || a.name.localeCompare(b.name, 'es'));
        case 'name':
            return arr.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base', numeric: true }));
        case 'color': {
            ensureHues();
            // Un color fijado a mano en Odoo (categoría "Color Rojo"...) manda sobre el automático
            const hue = p => {
                const manual = p.colorOverride && COLOR_NAME_TO_HUE[p.colorOverride];
                if (typeof manual === 'number') return manual;
                return typeof hueById[p.id] === 'number' ? hueById[p.id] : -1;
            };
            return arr.sort((a, b) =>
                colorSortKey(hue(a)) - colorSortKey(hue(b)) ||
                a.name.localeCompare(b.name, 'es', { sensitivity: 'base', numeric: true }));
        }
        default:           // los "más vendidos" primero, sin tocar el orden entre el resto
            return arr.sort((a, b) => (b.badge === 'MÁS VENDIDO' ? 1 : 0) - (a.badge === 'MÁS VENDIDO' ? 1 : 0));
    }
}

// Referencias DOM cacheadas al llamar a initCatalog()
let productGrid = null;
let featuredProductGrid = null;

export function createProductCardHTML(p) {
    const categoryLabel = p.services
        ? 'SERVICIO'
        : p.grabadocolor
            ? 'GRABADO LÁSER A COLOR'
            : 'GRABADO LÁSER';
    const frontImgPath = getImgPath(p.frontImg);
    const backImgPath = getImgPath(p.backImg);

    const targetUrl = `/tienda/producto.html?id=${p.id}`; // ruta absoluta: la tarjeta funciona igual se pinte donde se pinte

    // Los servicios (ej. envío personalizado) no llevan stock — solo los productos físicos.
    const isOutOfStock = !p.services && typeof p.stock === 'number' && p.stock <= 0;

    return `
    <div class="product-card" data-id="${p.id}">
        <a href="${targetUrl}" class="product-image-wrap">
            ${isOutOfStock ? `<span class="product-badge" style="background:var(--accent-error);">AGOTADO</span>` : (p.badge ? `<span class="product-badge">${p.badge}</span>` : '')}
            <img src="${frontImgPath}" alt="${p.name}" class="${p.backImg !== p.frontImg ? 'img-front' : 'img-front-only'}" loading="lazy" decoding="async" style="${isOutOfStock ? 'opacity:0.5;' : ''}">
            ${p.backImg !== p.frontImg ? `<img src="${backImgPath}" alt="${p.name} Trasero" class="img-back" loading="lazy" decoding="async" style="${isOutOfStock ? 'opacity:0.5;' : ''}">` : ''}
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
                <a href="${targetUrl}" class="add-cart-btn" style="${isOutOfStock ? 'background:var(--text-muted); border-color:var(--text-muted);' : ''}">${isOutOfStock ? 'Agotado' : 'Ver Opciones'}</a>
            </div>
        </div>
    </div>
    `;
}

export function applyFilters() {
    if (!productGrid) return;

    const filtered = products.filter(p => {
        if (p.id === 'odoo-45') return false; // el envío personalizado tiene su propia sección aparte

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

    const sorted = sortProducts(filtered);

    if (filtered.length === 0) {
        productGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">No se encontraron binders con los filtros seleccionados.</div>`;
    } else {
        productGrid.innerHTML = sorted.map(createProductCardHTML).join('');
    }
}

// Pinta la tarjeta del envío personalizado en su propia sección, separada del catálogo
export function renderEnvioPersonalizado() {
    const section = document.getElementById('envio-personalizado-section');
    const container = document.getElementById('envio-personalizado-container');
    if (!section || !container) return;

    const envioProduct = products.find(p => p.id === 'odoo-45');
    if (!envioProduct) {
        section.style.display = 'none';
        return;
    }
    container.innerHTML = createProductCardHTML(envioProduct);
    section.style.display = '';
}

// Pide los productos a Odoo y los añade a los ya existentes. Devuelve true si se
// añadió algo nuevo, false si no había nada o si falló (Odoo no conectado todavía).
// Cuánto tiempo confiamos en la copia guardada en este navegador antes de volver a
// preguntar (en milisegundos). Es independiente de la caché del servidor: esta hace
// que moverte entre páginas dentro de la misma visita sea instantáneo, sin ni
// siquiera esperar una respuesta de red.
const SESSION_CACHE_KEY = 'mb_odoo_products_cache';
const SESSION_CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutos

function readSessionCache() {
    try {
        const raw = sessionStorage.getItem(SESSION_CACHE_KEY);
        if (!raw) return null;
        const cached = JSON.parse(raw);
        if (Date.now() - cached.savedAt > SESSION_CACHE_MAX_AGE_MS) return null;
        return cached.products;
    } catch (e) {
        return null;
    }
}

function writeSessionCache(odooProducts) {
    try {
        sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), products: odooProducts }));
    } catch (e) {
        // Si sessionStorage no está disponible o está lleno, simplemente no cacheamos en el navegador
    }
}

export async function fetchOdooProducts() {
    const cached = readSessionCache();
    if (cached) {
        products = products.concat(cached);
        return true;
    }

    try {
        const r = await fetch('/api/get-products');
        const data = await r.json();
        if (data.success && Array.isArray(data.products) && data.products.length > 0) {
            products = products.concat(data.products);
            writeSessionCache(data.products);
            return true;
        }
    } catch (e) {
        // Silencioso: si Odoo no está conectado todavía, la tienda sigue funcionando igual.
    }
    return false;
}

export function initCatalog() {
    productGrid = document.getElementById('product-grid');
    featuredProductGrid = document.getElementById('featured-product-grid');

    if (productGrid) applyFilters();
    renderEnvioPersonalizado();

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

    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            filterState.sort = sortSelect.value;
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

    // --- CARGA DE PRODUCTOS DESDE ODOO ---
    // Se añaden a los productos ya definidos arriba y se vuelve a pintar el catálogo.
    // Si /api/get-products no existe todavía (no está desplegado) o falla, la web sigue
    // funcionando con normalidad solo con los productos hardcodeados.
    if (productGrid || featuredProductGrid) {
        fetchOdooProducts().then(updated => {
            if (!updated) return;

            if (productGrid) applyFilters();
            renderEnvioPersonalizado();
            if (featuredProductGrid) {
                const featuredProducts = products.filter(p => p.featured === true);
                featuredProductGrid.innerHTML = featuredProducts.map(createProductCardHTML).join('');
            }
        });
    }
}