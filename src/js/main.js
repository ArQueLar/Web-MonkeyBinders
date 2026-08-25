/* ==========================================================================
   MAIN — punto de entrada. Cada módulo se auto-protege comprobando si sus
   elementos existen en la página actual, así que es seguro llamarlos todos
   aquí sin importar si estamos en index.html, tienda.html o producto.html.
   ========================================================================== */

import { initTheme } from './theme.js';
import { initNavigation } from './navigation.js';
import { initEffects } from './effects.js';
import { initCart } from './cart.js';
import { initCatalog } from './products.js';
import { initProductDetail } from './productDetail.js';
import { initCustomizerForm } from './customizerForm.js';
import { initAccountPage } from './accountPage.js';
import { initAdminPage } from './adminPage.js';
import { initCheckout } from './checkout.js';

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initNavigation();
    initEffects();
    initCart();            // antes del catálogo/detalle: ambos pueden añadir productos al carrito
    initCatalog();         // tienda.html + home (destacados) — dispara su propia carga de Odoo
    initProductDetail();   // producto.html — dispara su propia carga de Odoo si hace falta
    initCustomizerForm();  // formulario de personalización de tienda.html
    initAccountPage();     // cuenta.html — perfil, contraseña y pedidos
    initAdminPage();       // admin.html — panel de administración (solo personal)
    initCheckout();        // checkout.html — dirección, envío y pago
});
