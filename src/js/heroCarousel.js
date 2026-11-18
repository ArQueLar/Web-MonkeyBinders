/* ==========================================================================
   CARRUSEL DEL BANNER DE INICIO
   Primera diapositiva: el banner de siempre. Las siguientes se generan solas
   a partir del catálogo de Odoo: lanzamientos nuevos (badge NUEVO) y más
   vendidos (badge MÁS VENDIDO). Si no hay datos o falla la carga, el banner
   queda exactamente como estaba.
   ========================================================================== */

import { escapeHtml, safeUrl } from './utils.js';

const SESSION_CACHE_KEY = 'mb_odoo_products_cache';
const AUTOPLAY_MS = 6500;
const MAX_NEW = 3;
const MAX_BEST = 2;

async function loadProducts() {
    try {
        const raw = sessionStorage.getItem(SESSION_CACHE_KEY);
        if (raw) {
            const cached = JSON.parse(raw);
            if (Array.isArray(cached.products) && cached.products.length) return cached.products;
        }
    } catch (e) { /* sin sessionStorage: seguimos */ }
    try {
        const r = await fetch('/api/get-products');
        const data = await r.json();
        if (data.success && Array.isArray(data.products)) return data.products;
    } catch (e) { /* silencioso: el banner fijo sigue funcionando */ }
    return [];
}

function formatPrice(n) {
    return Number(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function pickSlides(products) {
    const ok = p => p && p.id && p.name && p.frontImg && !p.services && !(typeof p.stock === 'number' && p.stock <= 0);
    const news = products.filter(p => ok(p) && p.badge === 'NUEVO').slice(0, MAX_NEW);
    const best = products.filter(p => ok(p) && p.badge === 'MÁS VENDIDO').slice(0, MAX_BEST);
    return [
        ...news.map(p => ({ p, label: '🆕 NUEVO LANZAMIENTO' })),
        ...best.map(p => ({ p, label: '🔥 MÁS VENDIDO' }))
    ];
}

function slideHTML({ p, label }) {
    const href = `/tienda/producto.html?id=${encodeURIComponent(p.id)}`;
    return `
        <div class="hero-content hero-slide hero-product-slide" role="group" aria-roledescription="diapositiva" aria-label="${escapeHtml(p.name)}">
            <a class="hero-product-img" href="${href}" tabindex="-1" aria-hidden="true">
                <img src="${escapeHtml(safeUrl(p.frontImg))}" alt="" loading="lazy" decoding="async">
            </a>
            <div class="hero-product-info">
                <div class="hero-badge">${escapeHtml(label)}</div>
                <h2 class="hero-product-title">${escapeHtml(p.name)}</h2>
                <p class="hero-product-price">${formatPrice(p.price)}</p>
                <a href="${href}" class="btn-primary hero-product-cta">
                    <span>VER ESTE BINDER</span><span>→</span>
                </a>
            </div>
        </div>`;
}

export async function initHeroCarousel() {
    const hero = document.querySelector('.hero-section');
    const cover = hero && hero.querySelector('.hero-content');
    if (!cover) return;

    const slidesData = pickSlides(await loadProducts());
    if (slidesData.length === 0) return;

    // Envolvemos el banner existente en el carrusel
    const carousel = document.createElement('div');
    carousel.className = 'hero-carousel';
    carousel.setAttribute('role', 'region');
    carousel.setAttribute('aria-roledescription', 'carrusel');
    carousel.setAttribute('aria-label', 'Novedades y más vendidos');
    const track = document.createElement('div');
    track.className = 'hero-slides';
    cover.parentNode.insertBefore(carousel, cover);
    carousel.appendChild(track);
    track.appendChild(cover);
    cover.classList.add('hero-slide', 'active');
    track.insertAdjacentHTML('beforeend', slidesData.map(slideHTML).join(''));

    const slides = Array.from(track.querySelectorAll('.hero-slide'));
    const nav = document.createElement('div');
    nav.className = 'hero-carousel-nav';
    nav.innerHTML = `
        <button type="button" class="hero-nav-arrow" data-dir="-1" aria-label="Diapositiva anterior">‹</button>
        <div class="hero-dots">${slides.map((_, i) => `<button type="button" class="hero-dot" data-i="${i}" aria-label="Ir a la diapositiva ${i + 1}"></button>`).join('')}</div>
        <button type="button" class="hero-nav-arrow" data-dir="1" aria-label="Diapositiva siguiente">›</button>`;
    carousel.appendChild(nav);
    const dots = Array.from(nav.querySelectorAll('.hero-dot'));

    let index = 0;
    let timer = null;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function show(i) {
        index = (i + slides.length) % slides.length;
        slides.forEach((s, n) => {
            const on = n === index;
            s.classList.toggle('active', on);
            s.setAttribute('aria-hidden', on ? 'false' : 'true');
            s.querySelectorAll('a,button').forEach(el => { el.tabIndex = on ? 0 : -1; });
        });
        // la imagen enlazada es decorativa: nunca debe ser parada de tabulador
        slides.forEach(s => { const a = s.querySelector('.hero-product-img'); if (a) a.tabIndex = -1; });
        dots.forEach((d, n) => {
            d.classList.toggle('active', n === index);
            if (n === index) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
        });
    }

    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function start() {
        if (reduceMotion || timer || document.hidden) return;
        timer = setInterval(() => show(index + 1), AUTOPLAY_MS);
    }

    nav.addEventListener('click', e => {
        const arrow = e.target.closest('.hero-nav-arrow');
        const dot = e.target.closest('.hero-dot');
        if (arrow) show(index + Number(arrow.dataset.dir));
        else if (dot) show(Number(dot.dataset.i));
        else return;
        stop(); start();
    });

    carousel.addEventListener('mouseenter', stop);
    carousel.addEventListener('mouseleave', start);
    carousel.addEventListener('focusin', stop);
    carousel.addEventListener('focusout', start);
    document.addEventListener('visibilitychange', () => { document.hidden ? stop() : start(); });

    // Deslizar con el dedo
    let touchX = null;
    carousel.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; stop(); }, { passive: true });
    carousel.addEventListener('touchend', e => {
        if (touchX !== null) {
            const dx = e.changedTouches[0].clientX - touchX;
            if (Math.abs(dx) > 40) show(index + (dx < 0 ? 1 : -1));
        }
        touchX = null;
        start();
    }, { passive: true });

    carousel.classList.add('ready');
    show(0);
    start();
}
