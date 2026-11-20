/* ==========================================================================
   EFFECTS — rotación de imágenes "Sobre Nosotros" y efectos de paralaje
   ========================================================================== */

export function initEffects() {
    // --- ROTACIÓN AUTOMÁTICA DE IMÁGENES EN "SOBRE NOSOTROS" ---
    // Las fotos pueden sustituirse después de cargar la página (aboutSlider.js),
    // así que en cada paso se leen las que haya en ese momento.
    const sliderSelector = '.about-image-card .slider-img';
    if (document.querySelectorAll(sliderSelector).length >= 2) {
        setInterval(() => {
            const imgs = Array.from(document.querySelectorAll(sliderSelector));
            if (imgs.length < 2) return;
            let current = imgs.findIndex(i => i.classList.contains('active'));
            if (current < 0) current = 0;
            imgs[current].classList.remove('active');
            imgs[(current + 1) % imgs.length].classList.add('active');
        }, 3500);
    }

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
}
