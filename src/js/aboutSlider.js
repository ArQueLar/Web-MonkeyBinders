/* ==========================================================================
   "SOBRE MONKEY BINDERS" — las fotos que van rotando salen al azar de todo el
   catálogo (con color, normales...), distintas en cada visita. Si falla la
   carga, se quedan las fotos fijas del HTML.
   ========================================================================== */

import { escapeHtml, safeUrl } from './utils.js';
import { loadProducts } from './heroCarousel.js';

const MAX_PHOTOS = 8;

function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export async function initAboutSlider() {
    const box = document.getElementById('about-image-slider');
    if (!box) return;

    const products = await loadProducts();
    const pool = products.filter(p => p && p.name && p.frontImg && !p.services && /^https?:\/\//i.test(String(p.frontImg)));
    if (pool.length < 3) return;
    const picks = shuffle(pool).slice(0, MAX_PHOTOS);

    // Se espera a que la primera foto esté cargada para cambiar sin parpadeo
    const first = new Image();
    first.onload = () => {
        box.innerHTML = picks.map((p, i) => `
            <img src="${escapeHtml(safeUrl(p.frontImg))}" alt="${escapeHtml(p.name)}"
                 class="slider-img${i === 0 ? ' active' : ''}" ${i === 0 ? '' : 'loading="lazy"'} decoding="async">
        `).join('');
    };
    first.src = safeUrl(picks[0].frontImg);
}
