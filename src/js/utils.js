/* ==========================================================================
   UTILS — funciones compartidas por el resto de módulos
   ========================================================================== */

// Con Vite todo se sirve en rutas absolutas desde la raíz del sitio, así que ya no
// hace falta calcular "¿estoy en una subcarpeta?" para las imágenes — siempre "/ruta".
export function getImgPath(path) {
    if (/^https?:\/\//i.test(path)) return path; // URLs absolutas (ej. imágenes de Odoo) se dejan tal cual
    return path.startsWith('/') ? path : `/${path}`;
}


// Escapa texto antes de meterlo en un innerHTML — imprescindible con datos que
// puede haber escrito un cliente (nombre, dirección...) o que vienen de otros sistemas.
export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Solo deja pasar enlaces http(s); cualquier otra cosa (javascript:, data:...) se descarta.
export function safeUrl(value) {
    try {
        const url = new URL(String(value));
        return (url.protocol === 'https:' || url.protocol === 'http:') ? url.toString() : '';
    } catch {
        return '';
    }
}
