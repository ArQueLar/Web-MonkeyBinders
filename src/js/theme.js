/* ==========================================================================
   THEME — modo oscuro / claro y cambio dinámico del logo
   ========================================================================== */

import { getImgPath } from './utils.js';

export function initTheme() {
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const themeIcon = document.getElementById('theme-icon');
    const headerLogoImg = document.getElementById('header-logo-img');

    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);

        if (themeIcon) {
            themeIcon.src = theme === 'dark' ? getImgPath('assets/Cosas Web/svg/sol.svg') : getImgPath('assets/Cosas Web/svg/luna.svg');
        }

        if (headerLogoImg) {
            headerLogoImg.src = theme === 'dark' ? getImgPath('assets/Cosas Web/Logo/LogoBlanco.png') : getImgPath('assets/Cosas Web/Logo/Logo.png');
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
}
