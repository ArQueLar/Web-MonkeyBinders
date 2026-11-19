// shared/shipping.js
// Cálculo del envío con la OFERTA DE CORREOS 2026 (fecha 03/06/2026, precios SIN IVA).
// Lo usan tanto el servidor (api/create-payment.js, que es quien manda) como el
// checkout (estimación en pantalla), para que el cliente vea el mismo importe que
// luego se le cobra.
//
// Fórmula al cliente:  (tarifa Correos + 0,85 € de margen) × 1,21 (IVA)
// Servicio por defecto: Paq Estándar (domicilio, u oficina/Citypaq si elige recogida).
// Internacional (FR, DE, IT): Paq Light Internacional (≤ 2 kg, buzón).

export const FREE_SHIPPING_THRESHOLD = 200;   // € de subtotal a partir del cual el envío es gratis
export const SHIPPING_MARGIN = 0.85;          // € de margen sobre la tarifa de Correos
export const SHIPPING_VAT = 1.21;

// Orden de columnas de las tablas: Zona 1, 2, 3, 3+, 4/4+, 5/5+, 6, 7
const ZONE_INDEX = { z1: 0, z2: 1, z3: 2, z3p: 3, z4: 4, z5: 5, z6: 6, z7: 7 };

// Paq Estándar – Domicilio. [hasta kg, [zonas…]]
const ESTANDAR_DOMICILIO = {
    tiers: [
        [1,  [3.86, 4.06, 4.40, 4.40, 5.69, 10.14, 4.46, 6.63]],
        [2,  [4.08, 4.26, 4.63, 4.81, 6.52, 11.13, 5.36, 6.96]],
        [3,  [4.35, 4.54, 5.02, 5.24, 7.83, 12.88, 5.73, 7.43]],
        [4,  [4.59, 4.74, 5.37, 5.64, 8.47, 14.02, 5.98, 7.75]],
        [5,  [4.73, 4.88, 5.56, 5.86, 9.14, 15.11, 6.14, 7.98]],
        [10, [6.20, 6.24, 6.99, 7.39, 12.41, 21.19, 7.89, 10.24]],
        [15, [7.94, 8.05, 8.93, 9.52, 16.20, 32.19, 10.10, 13.14]]
    ],
    extraPerKg: [0.31, 0.33, 0.41, 0.40, 1.17, 2.77, 0.40, 0.51]
};

// Paq Estándar – Oficina y Citypaq (no existe Zona 7: Portugal solo a domicilio)
const ESTANDAR_OFICINA = {
    tiers: [
        [1,  [3.37, 3.85, 3.96, 3.96, 4.64, 8.98, 3.96, null]],
        [2,  [3.56, 4.05, 4.15, 4.15, 5.31, 9.87, 4.15, null]],
        [3,  [3.79, 4.30, 4.44, 4.44, 6.38, 11.41, 4.44, null]],
        [4,  [3.99, 4.49, 4.63, 4.63, 6.90, 12.41, 4.63, null]],
        [5,  [4.12, 4.63, 4.76, 4.76, 7.45, 13.38, 4.76, null]],
        [10, [5.39, 5.92, 6.12, 6.12, 10.11, 18.76, 6.12, null]],
        [15, [6.92, 7.63, 7.82, 7.82, 13.19, 28.51, 7.82, null]]
    ],
    extraPerKg: [0.28, 0.29, 0.36, 0.36, 1.05, 2.48, 0.36, null]
};

// Paq Light Internacional, Zona EU1 (Francia, Alemania, Italia…): [hasta gramos, precio]
const LIGHT_EU1 = [[250, 11.47], [750, 12.76], [1000, 14.18], [1500, 16.85], [2000, 19.59]];
const LIGHT_MAX_KG = 2;
const LIGHT_MAX_SIDE_CM = 60;
const LIGHT_MAX_SUM_CM = 90;
const MAX_REAL_KG = 40;
const MAX_PARCEL_KG = 40;

// Peso y medidas reales de los envíos (tabla "Envíos" del cliente).
// 3x3 = "9 bolsillos" por hoja · 4x3 XL = "12 bolsillos" por hoja. Hasta 3 unidades por bulto.
const PACKS = {
    '3x3':   { 1: { kg: 1,   dims: [40, 30, 4] },  2: { kg: 2,   dims: [40, 30, 4] },  3: { kg: 3, dims: [45, 35, 10] } },
    '4x3xl': { 1: { kg: 1.3, dims: [45, 35, 10] }, 2: { kg: 2.6, dims: [45, 35, 10] }, 3: { kg: 4, dims: [45, 35, 10] } }
};
const PORTADECK = { kg: 0.5, dims: [25, 15, 15] };

const round2 = n => Math.round(n * 100) / 100;
const round3 = n => Math.round(n * 1000) / 1000;
const volumetricKg = dims => (dims[0] * dims[1] * dims[2]) / 6000;

// Convierte las líneas del carrito en bultos {kg, dims}.
// Cada línea necesita: quantity y id ("odoo-<n>-3x3|4x3xl-…") y/o name.
function buildParcels(items) {
    const parcels = [];
    let lines = 0;
    for (const it of items || []) {
        const qty = Math.max(1, Math.floor(Number(it.quantity) || 1));
        const name = String(it.name || '').toLowerCase();
        lines++;
        if (name.includes('portadeck')) {
            for (let i = 0; i < qty; i++) parcels.push({ ...PORTADECK });
            continue;
        }
        const sizeKey = /-4x3xl-/.test(String(it.id || '')) || name.includes('4x3 xl') ? '4x3xl' : '3x3';
        let left = qty;
        while (left > 0) {
            const n = Math.min(3, left);
            parcels.push({ ...PACKS[sizeKey][n] });
            left -= n;
        }
    }
    return { parcels, lines };
}

function zoneFor(country, postalCode) {
    const cp = String(postalCode || '').replace(/\D/g, '');
    if (country === 'PT') {
        if (cp.length < 4 || cp[0] === '9') return null; // Azores y Madeira: no incluidos
        return 'z7';
    }
    if (country !== 'ES') return null;
    if (cp.length !== 5) return null;
    const prov = cp.slice(0, 2);
    if (prov === '28') return 'z1';                                   // Madrid (origen: Coslada)
    if (['05', '40', '19', '16', '45'].includes(prov)) return 'z2';   // limítrofes: Ávila, Segovia, Guadalajara, Cuenca, Toledo
    if (['07', '51', '52'].includes(prov)) return 'z4';               // Baleares, Ceuta, Melilla
    if (['35', '38'].includes(prov)) return 'z5';                     // Canarias
    return 'z3';                                                      // resto de la Península
}

function tableCost(table, zone, kg) {
    const idx = ZONE_INDEX[zone];
    const tier = table.tiers.find(([max]) => kg <= max);
    if (tier) return tier[1][idx];
    const last = table.tiers[table.tiers.length - 1];
    return last[1][idx] + Math.ceil(kg - last[0]) * table.extraPerKg[idx];
}

const fail = error => ({ available: false, cost: null, error });

// items: [{ id, name, quantity }] · subtotal: € de los artículos (sin envío)
// country: 'ES' | 'PT' | 'FR' | 'DE' | 'IT' · delivery: 'home' | 'pickup'
export function computeShipping({ items, subtotal, country = 'ES', postalCode = '', delivery = 'home' }) {
    const { parcels, lines } = buildParcels(items);
    if (parcels.length === 0) return fail('El carrito está vacío');

    const realKg = round3(parcels.reduce((s, p) => s + p.kg, 0));
    const billableKg = round3(parcels.reduce((s, p) => s + Math.max(p.kg, volumetricKg(p.dims)), 0));
    if (realKg > MAX_REAL_KG || parcels.some(p => p.kg > MAX_PARCEL_KG)) {
        return fail('El pedido supera el peso máximo de envío. Contacta con nosotros.');
    }

    let tariff;
    let service;
    let zone = null;

    if (country === 'ES' || country === 'PT') {
        zone = zoneFor(country, postalCode);
        if (!zone) return fail('Introduce un código postal válido para calcular el envío.');
        if (delivery === 'pickup') {
            if (country !== 'ES') return fail('La recogida en oficina solo está disponible en España.');
            service = 'Paq Estándar Oficina/Citypaq';
            tariff = tableCost(ESTANDAR_OFICINA, zone, billableKg);
        } else {
            service = 'Paq Estándar Domicilio';
            tariff = tableCost(ESTANDAR_DOMICILIO, zone, billableKg);
        }
    } else if (['FR', 'DE', 'IT'].includes(country)) {
        if (delivery === 'pickup') return fail('La recogida en oficina solo está disponible en España.');
        // Paq Light Internacional: un solo bulto, ≤ 2 kg y ≤ 60 cm por lado / 90 cm entre las tres medidas
        const p = parcels[0];
        const sorted = p ? [...p.dims] : [];
        const fits = parcels.length === 1 && lines === 1 && realKg <= LIGHT_MAX_KG &&
            Math.max(...sorted) <= LIGHT_MAX_SIDE_CM && sorted.reduce((a, b) => a + b, 0) <= LIGHT_MAX_SUM_CM;
        if (!fits) return fail('Para este pedido el envío internacional no se calcula automáticamente. Escríbenos y te lo presupuestamos.');
        service = 'Paq Light Internacional';
        const grams = realKg * 1000;
        tariff = LIGHT_EU1.find(([max]) => grams <= max)[1];
    } else {
        return fail('Destino no disponible.');
    }

    const full = round2((tariff + SHIPPING_MARGIN) * SHIPPING_VAT);
    const free = Number(subtotal) >= FREE_SHIPPING_THRESHOLD;
    return { available: true, cost: free ? 0 : full, fullCost: full, free, billableKg, realKg, zone, service, tariff };
}
