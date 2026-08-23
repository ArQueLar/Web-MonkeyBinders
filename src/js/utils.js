/* ==========================================================================
   UTILS — funciones compartidas por el resto de módulos
   ========================================================================== */

// Con Vite todo se sirve en rutas absolutas desde la raíz del sitio, así que ya no
// hace falta calcular "¿estoy en una subcarpeta?" para las imágenes — siempre "/ruta".
export function getImgPath(path) {
    if (/^https?:\/\//i.test(path)) return path; // URLs absolutas (ej. imágenes de Odoo) se dejan tal cual
    return path.startsWith('/') ? path : `/${path}`;
}
