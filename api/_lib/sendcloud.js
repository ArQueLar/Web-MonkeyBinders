// api/_lib/sendcloud.js
// Utilidades para hablar con la API de Sendcloud (crear envíos + etiqueta,
// y consultar el estado real de entrega). Vive en _lib/ a propósito, para no
// convertirse en un endpoint público — solo lo usan otras funciones de api/.

const SENDCLOUD_BASE_URL = 'https://panel.sendcloud.sc/api/v2';

function getAuthHeader() {
    const publicKey = process.env.SENDCLOUD_PUBLIC_KEY;
    const secretKey = process.env.SENDCLOUD_SECRET_KEY;
    const token = Buffer.from(`${publicKey}:${secretKey}`).toString('base64');
    return `Basic ${token}`;
}

async function callSendcloud(path, options = {}) {
    const response = await fetch(`${SENDCLOUD_BASE_URL}${path}`, {
        ...options,
        headers: {
            Authorization: getAuthHeader(),
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
        const message = data?.error?.message || data?.message || `Sendcloud devolvió un error (${response.status})`;
        throw new Error(message);
    }
    return data;
}

// Crea el envío y la etiqueta EN UN SOLO PASO (request_label: true), usando el
// método de envío que hayáis configurado por defecto en Sendcloud.
export async function createSendcloudParcel({ name, address, address2, city, postalCode, countryCode, telephone, email, orderNumber, weightKg }) {
    const shippingMethodId = Number(process.env.SENDCLOUD_SHIPPING_METHOD_ID);

    const body = {
        parcel: {
            name,
            address,
            address_2: address2 || '',
            city,
            postal_code: postalCode,
            country: countryCode,
            telephone: telephone || '',
            email: email || '',
            order_number: orderNumber,
            weight: weightKg.toFixed(3),
            request_label: true,
            shipping_method: shippingMethodId
        }
    };

    const data = await callSendcloud('/parcels', { method: 'POST', body: JSON.stringify(body) });
    return data.parcel;
}

// Consulta el estado REAL del envío (lo que dice el transportista), buscando
// por el número de seguimiento que guardamos en Odoo al crear la etiqueta.
export async function getSendcloudParcelByTrackingNumber(trackingNumber) {
    const data = await callSendcloud(`/parcels?tracking_number=${encodeURIComponent(trackingNumber)}`);
    return (data.parcels && data.parcels[0]) || null;
}

// Solo para consulta puntual: lista los métodos de envío disponibles en la
// cuenta, con su ID numérico — así se puede rellenar SENDCLOUD_SHIPPING_METHOD_ID
// sin tener que rebuscarlo a mano en el panel de Sendcloud.
export async function listSendcloudShippingMethods() {
    const data = await callSendcloud('/shipping_methods');
    return (data.shipping_methods || []).map(m => ({
        id: m.id,
        name: m.name,
        carrier: m.carrier
    }));
}

// Las URLs de las etiquetas de Sendcloud requieren autenticación para
// descargarse — el navegador del admin no puede acceder directamente, así
// que lo hacemos nosotros por detrás y le pasamos el PDF ya descargado.
export async function downloadSendcloudLabel(labelUrl) {
    const response = await fetch(labelUrl, { headers: { Authorization: getAuthHeader() } });
    if (!response.ok) throw new Error('No se pudo descargar la etiqueta de Sendcloud');
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}
