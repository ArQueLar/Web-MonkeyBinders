// api/_lib/shipping-pricing.js
// Cálculo del peso de un carrito y del coste de envío a cobrar al cliente.
//
// Los precios de Correos están fijos aquí a mano a propósito: Sendcloud NO
// puede cotizar en tiempo real transportistas con tarifas por zona (como
// Correos en España — lo confirma su propia documentación), así que
// replicamos los tramos que ya conoce el cliente en vez de preguntarle a una
// API que no sabe responder bien para este caso.

// A partir de este subtotal (€, sin IVA aparte — vuestros precios ya lo
// incluyen), el envío es gratis.
const FREE_SHIPPING_THRESHOLD = 200;

// Recargo sobre el coste de envío para cubrir comisiones de la pasarela de
// pago. PROVISIONAL al 1% — con Redsys será menor que con Stripe, pero no
// hay cifra exacta todavía. Cambia este número en cuanto se sepa.
const PAYMENT_FEE_MARKUP = 0.01;

// Tramos de precio de Correos (mismo precio a domicilio que a recogida, de
// momento). Solo hay 2 datos reales confirmados: ~4,50€ normal, hasta 6€ si
// pesa más. Ajusta estos tramos en cuanto se tengan cifras exactas por peso.
const SHIPPING_PRICE_BANDS = [
    { maxKg: 5, price: 4.50 },
    { maxKg: 30, price: 6.00 }
];

// Peso por unidad (kg) según el tamaño del binder — mismo criterio que en el
// panel de administración (api/admin/orders.js). Si cambias esto aquí,
// cámbialo también allí para que no se descuadren.
const WEIGHT_BY_SIZE_KG = [
    { match: '4x3 xl', weight: 1.5 },
    { match: '4x3', weight: 1.3 },
    { match: '3x3', weight: 1 }
];

export function calculateCartWeight(items) {
    if (!items || items.length === 0) return 1;
    const total = items.reduce((sum, item) => {
        const nameLower = (item.name || '').toLowerCase();
        const sizeEntry = WEIGHT_BY_SIZE_KG.find(s => nameLower.includes(s.match));
        const unitWeight = sizeEntry ? sizeEntry.weight : 1;
        return sum + unitWeight * (item.quantity || 1);
    }, 0);
    return Math.round(total * 10) / 10;
}

// subtotal: suma de precio × cantidad de los artículos, SIN el envío.
export function calculateShippingCost(weightKg, subtotal) {
    if (subtotal >= FREE_SHIPPING_THRESHOLD) return 0;
    const band = SHIPPING_PRICE_BANDS.find(b => weightKg <= b.maxKg) || SHIPPING_PRICE_BANDS[SHIPPING_PRICE_BANDS.length - 1];
    const withMarkup = band.price * (1 + PAYMENT_FEE_MARKUP);
    return Math.round(withMarkup * 100) / 100;
}

export function getFreeShippingThreshold() {
    return FREE_SHIPPING_THRESHOLD;
}
