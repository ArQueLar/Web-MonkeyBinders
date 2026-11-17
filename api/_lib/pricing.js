// api/_lib/pricing.js
// Recalcula en el SERVIDOR el precio y el nombre de cada artículo del carrito
// a partir de Odoo. El navegador solo nos dice QUÉ producto, tamaño y cantidad
// quiere; los importes que mande se ignoran. Misma lógica de precios que
// api/get-products.js (list_price + IVA real del producto, +15 € por 4x3 XL).

import { callOdoo } from './auth.js';

const DEFAULT_TAX_RATE = 21;
const XL_SURCHARGE = 15;
const MAX_LINES = 30;
const MAX_QTY_PER_LINE = 50;
const ITEM_ID_RE = /^odoo-(\d+)-(3x3|4x3xl)-(.{0,80})$/;

export class CartValidationError extends Error {}

export async function priceCartFromOdoo(rawItems) {
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
        throw new CartValidationError('El carrito está vacío');
    }
    if (rawItems.length > MAX_LINES) {
        throw new CartValidationError('Demasiados artículos en el carrito');
    }

    // 1) Validación de forma (sin tocar Odoo todavía)
    const parsed = rawItems.map(it => {
        const m = ITEM_ID_RE.exec(String((it && it.id) ?? ''));
        const qty = Number(it && it.quantity);
        if (!m) throw new CartValidationError('Artículo no válido en el carrito');
        if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) {
            throw new CartValidationError('Cantidad no válida en el carrito');
        }
        const engraving = m[3] === 'sinopcion' ? null : m[3];
        return { id: String(it.id), templateId: Number(m[1]), size: m[2], engraving, quantity: qty };
    });

    const ODOO_URL = process.env.ODOO_URL;
    const ODOO_DB = process.env.ODOO_DB;
    const ODOO_LOGIN = process.env.ODOO_LOGIN;
    const ODOO_API_KEY = process.env.ODOO_API_KEY;
    const uid = await callOdoo(ODOO_URL, 'common', 'authenticate', [ODOO_DB, ODOO_LOGIN, ODOO_API_KEY, {}]);
    if (!uid) throw new Error('No se pudo autenticar con Odoo');
    const exec = (model, method, args, kwargs = {}) =>
        callOdoo(ODOO_URL, 'object', 'execute_kw', [ODOO_DB, uid, ODOO_API_KEY, model, method, args, kwargs]);

    // 2) Productos (solo publicados y vendibles)
    const templateIds = [...new Set(parsed.map(p => p.templateId))];
    const templates = await exec('product.template', 'search_read',
        [[['id', 'in', templateIds], ['sale_ok', '=', true], ['website_published', '=', true]]],
        { fields: ['id', 'name', 'list_price', 'taxes_id', 'attribute_line_ids'] });
    const tmplById = new Map(templates.map(t => [t.id, t]));
    if (templateIds.some(id => !tmplById.has(id))) {
        throw new CartValidationError('Hay un producto que ya no está disponible');
    }

    // 3) Impuestos y atributos
    const taxIds = [...new Set(templates.flatMap(t => t.taxes_id || []))];
    const lineIds = [...new Set(templates.flatMap(t => t.attribute_line_ids || []))];
    const [taxes, lines] = await Promise.all([
        taxIds.length ? exec('account.tax', 'read', [taxIds], { fields: ['amount', 'amount_type'] }) : [],
        lineIds.length ? exec('product.template.attribute.line', 'read', [lineIds], { fields: ['product_tmpl_id', 'value_ids'] }) : []
    ]);
    const valueIds = [...new Set(lines.flatMap(l => l.value_ids || []))];
    const values = valueIds.length ? await exec('product.attribute.value', 'read', [valueIds], { fields: ['name'] }) : [];

    const taxRate = {};
    taxes.forEach(t => { if (t.amount_type === 'percent') taxRate[t.id] = t.amount; });
    const valueName = {};
    values.forEach(v => { valueName[v.id] = v.name; });
    const attrsByTemplate = {};
    lines.forEach(l => {
        const tid = Array.isArray(l.product_tmpl_id) ? l.product_tmpl_id[0] : l.product_tmpl_id;
        (attrsByTemplate[tid] ||= []).push(...(l.value_ids || []).map(id => valueName[id]).filter(Boolean));
    });

    // 4) Precio y nombre definitivos de cada línea
    return parsed.map(p => {
        const t = tmplById.get(p.templateId);
        const attrs = attrsByTemplate[p.templateId] || [];
        const hasXL = attrs.includes('XL Master Set');
        if (p.size === '4x3xl' && !hasXL) {
            throw new CartValidationError('Tamaño no disponible para este producto');
        }
        const rates = (t.taxes_id || []).map(id => taxRate[id]).filter(r => typeof r === 'number');
        const rate = rates.length ? rates.reduce((s, r) => s + r, 0) : DEFAULT_TAX_RATE;
        let unit = Math.round(t.list_price * (1 + rate / 100) * 100) / 100;
        if (p.size === '4x3xl') unit = Math.round((unit + XL_SURCHARGE) * 100) / 100;

        // El grabado es solo informativo: se acepta únicamente si es una opción real del producto
        const engraving = p.engraving && attrs.includes(p.engraving) && p.engraving !== 'XL Master Set' ? p.engraving : null;
        const sizeLabel = hasXL && p.size === '4x3xl' ? '4x3 XL' : '3x3';
        return {
            id: p.id,
            name: `${t.name} (${sizeLabel}${engraving ? `, ${engraving}` : ''})`,
            price: unit,
            quantity: p.quantity
        };
    });
}
