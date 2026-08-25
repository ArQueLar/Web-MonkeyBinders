// api/_lib/redsys.js
// Firma y verificación de peticiones a Redsys (TPV Virtual), método HMAC SHA-256
// por Redirección. Vive en _lib/ para no convertirse en endpoint público.
//
// Algoritmo (estándar de Redsys, documentado en su "Guía de migración a HMAC SHA256"):
//   1. Ds_MerchantParameters = Base64(JSON de los parámetros del pago)
//   2. Clave derivada = 3DES-CBC(Ds_Merchant_Order rellenado a múltiplo de 8 bytes
//      con ceros, usando la clave secreta del comercio como clave y un IV de 8 ceros)
//   3. Firma = Base64(HMAC-SHA256(Ds_MerchantParameters, clave derivada))

import crypto from 'crypto';

const SANDBOX_URL = 'https://sis-t.redsys.es:25443/sis/realizarPago';
const PRODUCTION_URL = 'https://sis.redsys.es/sis/realizarPago';

export function getRedsysUrl() {
    return process.env.REDSYS_ENV === 'production' ? PRODUCTION_URL : SANDBOX_URL;
}

// Deriva la clave específica de un pedido a partir de la clave secreta del
// comercio (en Base64, tal como la da el banco) y el número de pedido.
function deriveOrderKey(secretKeyBase64, order) {
    const key = Buffer.from(secretKeyBase64, 'base64'); // debe dar 24 bytes (192 bits) para 3DES
    const iv = Buffer.alloc(8, 0); // Redsys usa un IV de 8 bytes a cero

    let orderBuf = Buffer.from(order, 'utf8');
    const remainder = orderBuf.length % 8;
    if (remainder !== 0) {
        orderBuf = Buffer.concat([orderBuf, Buffer.alloc(8 - remainder, 0)]);
    }

    const cipher = crypto.createCipheriv('des-ede3-cbc', key, iv);
    cipher.setAutoPadding(false);
    return Buffer.concat([cipher.update(orderBuf), cipher.final()]);
}

// Construye el Ds_MerchantParameters (Base64 del JSON) a partir de un objeto
// con los campos Ds_Merchant_* que quieras enviar.
export function buildMerchantParameters(params) {
    return Buffer.from(JSON.stringify(params), 'utf8').toString('base64');
}

// Firma unos Ds_MerchantParameters ya construidos, para el pedido indicado.
export function signParameters(secretKeyBase64, order, merchantParametersBase64) {
    const derivedKey = deriveOrderKey(secretKeyBase64, order);
    const hmac = crypto.createHmac('sha256', derivedKey);
    hmac.update(merchantParametersBase64);
    return hmac.digest('base64');
}

// Redsys manda la firma de las notificaciones en Base64 "web-safe" (con - y _
// en vez de + y /) — hay que pasarla a Base64 normal antes de compararla.
function webSafeToStandardBase64(value) {
    return value.replace(/-/g, '+').replace(/_/g, '/');
}

// Verifica la firma de una notificación recibida de Redsys. Devuelve el objeto
// de parámetros ya decodificado si la firma es válida, o null si no lo es
// (firma incorrecta = notificación falsa o corrupta, NO HAY QUE FIARSE DE ELLA).
export function verifyNotification(secretKeyBase64, merchantParametersBase64, receivedSignatureBase64) {
    let params;
    try {
        params = JSON.parse(Buffer.from(merchantParametersBase64, 'base64').toString('utf8'));
    } catch (e) {
        return null;
    }

    const order = params.Ds_Order || params.Ds_Merchant_Order;
    if (!order) return null;

    const expectedSignature = signParameters(secretKeyBase64, order, merchantParametersBase64);
    const receivedStandard = webSafeToStandardBase64(receivedSignatureBase64);

    const expectedBuf = Buffer.from(expectedSignature, 'base64');
    const receivedBuf = Buffer.from(receivedStandard, 'base64');

    // Comparación en tiempo constante — evita que un atacante pueda deducir la
    // firma correcta midiendo cuánto tarda la comparación (timing attack).
    const isValid = expectedBuf.length === receivedBuf.length && crypto.timingSafeEqual(expectedBuf, receivedBuf);

    return isValid ? params : null;
}

// Los códigos de respuesta 0000-0099 significan "operación autorizada".
// Cualquier otro código es una denegación o un error — nunca falses positivo.
export function isPaymentAuthorized(dsResponseCode) {
    const code = parseInt(dsResponseCode, 10);
    return Number.isInteger(code) && code >= 0 && code <= 99;
}
