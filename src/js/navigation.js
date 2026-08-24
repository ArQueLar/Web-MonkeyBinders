/* ==========================================================================
   NAVIGATION — menú móvil, buscador rápido y acceso a "Mi Cuenta"
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

    // --- MODAL DE BÚSQUEDA ---
    // "Mi Cuenta" ya no es un modal: vive en su propia página (/cuenta.html), ver más abajo.
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
            window.location.href = '/cuenta.html';
        }

        if (searchBtn) {
            e.preventDefault();
            openModal(`
                <div style="text-align:center; padding: 10px;">
                    <span class="section-tag">BÚSQUEDA RÁPIDA</span>
                    <h2 class="section-title" style="font-size: 20px; margin-bottom: 15px;">¿QUÉ BUSCAS?</h2>
                    <input type="text" id="quick-search-input" placeholder="Busca tu binder..." class="newsletter-input" style="background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); width:100%; padding:12px; font-size:14px;">
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
}
