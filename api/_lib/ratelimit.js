// api/_lib/ratelimit.js
// Límite de intentos en memoria. En Vercel cada instancia de la función tiene su
// propia memoria, así que NO es un límite global exacto: frena los ataques
// automáticos típicos (un script probando contraseñas contra una misma instancia)
// pero no sustituye a un almacén compartido (Upstash/Redis) si algún día hace falta
// protección estricta. Sin dependencias ni servicios extra.

const buckets = new Map(); // clave -> { count, resetAt }

function prune(now) {
    if (buckets.size < 5000) return;
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
}

export function clientIp(req) {
    const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    return fwd || req.socket?.remoteAddress || 'unknown';
}

// ¿Está bloqueada esta clave? (no cuenta nada)
export function isBlocked(key, max) {
    const now = Date.now();
    const b = buckets.get(key);
    if (!b || b.resetAt <= now) return { blocked: false };
    return b.count >= max ? { blocked: true, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) } : { blocked: false };
}

// Suma un intento a la clave
export function hit(key, windowMs) {
    const now = Date.now();
    prune(now);
    const b = buckets.get(key);
    if (!b || b.resetAt <= now) buckets.set(key, { count: 1, resetAt: now + windowMs });
    else b.count += 1;
}

export function clear(key) {
    buckets.delete(key);
}

export function tooMany(res, retryAfterSec) {
    res.setHeader('Retry-After', String(retryAfterSec));
    return res.status(429).json({ success: false, error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' });
}
