/* ==========================================================================
   ORDENAR POR COLOR — calcula el color dominante de la portada de cada binder
   (sobre la propia imagen, en el navegador) y los agrupa por familia de color.
   No hay que rellenar nada en Odoo: un binder nuevo se clasifica solo.
   El resultado se guarda en localStorage una semana para no recalcular.
   ========================================================================== */

const CACHE_KEY = 'mb_color_hues_v1';
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const SIZE = 48;          // se analiza la imagen reducida a 48x48 px
const BINS = 36;          // 36 tramos de 10° en la rueda de color
const NEUTRAL = -1;       // negro / blanco / gris: sin color dominante

// Familias en el orden en que se muestran (arcoíris) y su rango de tono (grados)
const FAMILIES = [
    { key: 'rojo',     test: h => h >= 345 || h < 15 },
    { key: 'naranja',  test: h => h >= 15 && h < 45 },
    { key: 'amarillo', test: h => h >= 45 && h < 70 },
    { key: 'verde',    test: h => h >= 70 && h < 170 },
    { key: 'azul',     test: h => h >= 170 && h < 255 },
    { key: 'morado',   test: h => h >= 255 && h < 300 },
    { key: 'rosa',     test: h => h >= 300 && h < 345 }
];

export function familyIndex(hue) {
    if (typeof hue !== 'number' || hue === NEUTRAL) return FAMILIES.length; // neutros al final
    const i = FAMILIES.findIndex(f => f.test(hue));
    return i < 0 ? FAMILIES.length : i;
}

function readCache() {
    try {
        const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        if (raw && Date.now() - raw.savedAt < CACHE_MAX_AGE_MS && raw.hues) return raw.hues;
    } catch (e) { /* sin localStorage: se recalcula */ }
    return {};
}

function writeCache(hues) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), hues }));
    } catch (e) { /* lleno o bloqueado: no pasa nada */ }
}

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    if (d === 0) return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1));
    let h;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
    return [h, s, l];
}

// Devuelve el tono dominante (0-359), NEUTRAL, o null si no se pudo analizar la imagen.
function analyze(url) {
    return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const c = document.createElement('canvas');
                c.width = c.height = SIZE;
                const ctx = c.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(img, 0, 0, SIZE, SIZE);
                const px = ctx.getImageData(0, 0, SIZE, SIZE).data;
                const bins = new Array(BINS).fill(0);
                let opaque = 0, colored = 0;
                for (let i = 0; i < px.length; i += 4) {
                    if (px[i + 3] < 128) continue;
                    opaque++;
                    const [h, s, l] = rgbToHsl(px[i], px[i + 1], px[i + 2]);
                    if (s < 0.28 || l < 0.12 || l > 0.9) continue; // gris, negro o blanco: sin color
                    const w = s * (1 - Math.abs(2 * l - 1));
                    bins[Math.floor(h / (360 / BINS)) % BINS] += w;
                    colored += w;
                }
                if (!opaque || colored / opaque < 0.06) return resolve(NEUTRAL);
                // Se suaviza con los tramos vecinos y se coge el más fuerte
                let best = 0, bestVal = -1;
                for (let b = 0; b < BINS; b++) {
                    const v = bins[(b + BINS - 1) % BINS] + bins[b] * 2 + bins[(b + 1) % BINS];
                    if (v > bestVal) { bestVal = v; best = b; }
                }
                resolve(Math.round((best + 0.5) * (360 / BINS)) % 360);
            } catch (e) {
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
        img.src = url;
    });
}

// list: [{ id, frontImg }] → { [id]: tono | -1 }  (los que fallan simplemente no aparecen)
export async function loadHues(list) {
    const cache = readCache();
    const result = {};
    const todo = [];
    list.forEach(p => {
        if (!p || !p.frontImg) return;
        const cached = cache[p.frontImg];
        if (typeof cached === 'number') result[p.id] = cached;
        else todo.push(p);
    });
    if (todo.length) {
        const hues = await Promise.all(todo.map(p => analyze(p.frontImg)));
        todo.forEach((p, i) => {
            if (typeof hues[i] === 'number') {
                result[p.id] = hues[i];
                cache[p.frontImg] = hues[i];
            }
        });
        writeCache(cache);
    }
    return result;
}
