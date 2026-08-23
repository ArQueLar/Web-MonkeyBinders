/* ==========================================================================
   EFFECTS — rotación de imágenes "Sobre Nosotros" y efectos de paralaje
   ========================================================================== */

export function initEffects() {
    // --- ROTACIÓN AUTOMÁTICA DE IMÁGENES EN "SOBRE NOSOTROS" ---
    const sliderImages = document.querySelectorAll('.about-image-card .slider-img');
    if (sliderImages.length >= 2) {
        let currentIndex = 0;
        setInterval(() => {
            sliderImages[currentIndex].classList.remove('active');
            currentIndex = (currentIndex + 1) % sliderImages.length;
            sliderImages[currentIndex].classList.add('active');
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
