// api/admin/products.js
// Gestión de artículos desde el panel de administración, guardados en Odoo
// (product.template). Solo accesible con sesión de administrador.
//
//   GET                       -> lista de artículos (incluye archivados) + categorías y opciones
//   POST { action: 'create' } -> crea un artículo (SIEMPRE como borrador: sin publicar)
//   POST { action: 'update' } -> edita nombre, precio, descripción, categorías, opciones, stock, publicado
//   POST { action: 'add-image', id, image }   -> añade una foto (base64 JPEG/PNG/WEBP)
//   POST { action: 'delete-image', imageId }  -> quita una foto extra
//   POST { action: 'archive' | 'restore', id } -> archiva (oculta, recuperable) o restaura
//
// No se borra nada de forma definitiva: "borrar" = archivar, así nunca se pierden pedidos
// ni historial ligados a un artículo.

import { getAdminSessionFromRequest, callOdoo } from '../_lib/auth.js';

const SERVICE_TEMPLATE_ID = 45; // "envío personalizado": no se archiva desde aquí
const ATTRIBUTE_NAME = 'Opciones adicionales';
const XL_VALUE = 'XL Master Set';
const DEFAULT_TAX_RATE = 21;
const MAX_IMAGE_B64 = 3_500_000;

class InputError extends Error {}

function detectImage(buf) {
    if (buf.length > 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return true;
    if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) return true;
    if (buf.length > 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return true;
    return false;
}

export default async function handler(req, res) {
    if (!getAdminSessionFromRequest(req)) {
        return res.status(401).json({ success: false, error: 'No autorizado' });
    }

    const ODOO_URL = process.env.ODOO_URL;
    const ODOO_DB = process.env.ODOO_DB;
    const ODOO_LOGIN = process.env.ODOO_LOGIN;
    const ODOO_API_KEY = process.env.ODOO_API_KEY;
    if (!ODOO_URL || !ODOO_DB || !ODOO_LOGIN || !ODOO_API_KEY) {
        return res.status(500).json({ success: false, error: 'Faltan variables de entorno de Odoo en Vercel' });
    }

    try {
        const uid = await callOdoo(ODOO_URL, 'common', 'authenticate', [ODOO_DB, ODOO_LOGIN, ODOO_API_KEY, {}]);
        if (!uid) return res.status(500).json({ success: false, error: 'No se pudo autenticar con Odoo' });
        const exec = (model, method, args, kwargs = {}) =>
            callOdoo(ODOO_URL, 'object', 'execute_kw', [ODOO_DB, uid, ODOO_API_KEY, model, method, args, kwargs]);
        const ALL = { context: { active_test: false } };

        // ---------- GET: lista ----------
        if (req.method === 'GET') {
            const [templates, categories] = await Promise.all([
                exec('product.template', 'search_read', [[['sale_ok', 'in', [true, false]]]], {
                    ...ALL,
                    fields: ['id', 'name', 'list_price', 'taxes_id', 'description_ecommerce', 'website_published',
                        'active', 'qty_available', 'public_categ_ids', 'attribute_line_ids', 'product_template_image_ids', 'create_date'],
                    order: 'id desc',
                    limit: 300
                }),
                exec('product.public.category', 'search_read', [[]], { fields: ['id', 'name'] })
            ]);

            const taxIds = [...new Set(templates.flatMap(t => t.taxes_id || []))];
            const lineIds = [...new Set(templates.flatMap(t => t.attribute_line_ids || []))];
            const [taxes, lines] = await Promise.all([
                taxIds.length ? exec('account.tax', 'read', [taxIds], { fields: ['amount', 'amount_type'] }) : [],
                lineIds.length ? exec('product.template.attribute.line', 'read', [lineIds], { fields: ['product_tmpl_id', 'value_ids'] }) : []
            ]);
            const valueIds = [...new Set(lines.flatMap(l => l.value_ids || []))];
            const values = valueIds.length ? await exec('product.attribute.value', 'read', [valueIds], { fields: ['name'] }) : [];
            const taxRate = {}; taxes.forEach(t => { if (t.amount_type === 'percent') taxRate[t.id] = t.amount; });
            const valueName = {}; values.forEach(v => { valueName[v.id] = v.name; });
            const optionsByTemplate = {};
            lines.forEach(l => {
                const tid = Array.isArray(l.product_tmpl_id) ? l.product_tmpl_id[0] : l.product_tmpl_id;
                (optionsByTemplate[tid] ||= []).push(...(l.value_ids || []).map(id => valueName[id]).filter(Boolean));
            });

            const products = templates.map(t => {
                const rates = (t.taxes_id || []).map(id => taxRate[id]).filter(r => typeof r === 'number');
                const rate = rates.length ? rates.reduce((s, r) => s + r, 0) : DEFAULT_TAX_RATE;
                const options = optionsByTemplate[t.id] || [];
                return {
                    id: t.id,
                    name: t.name,
                    priceWithTax: Math.round(t.list_price * (1 + rate / 100) * 100) / 100,
                    taxRate: rate,
                    description: t.description_ecommerce || '',
                    published: Boolean(t.website_published),
                    active: Boolean(t.active),
                    stock: typeof t.qty_available === 'number' ? t.qty_available : 0,
                    categoryIds: t.public_categ_ids || [],
                    hasXL: options.includes(XL_VALUE),
                    engravingOptions: options.filter(o => o !== XL_VALUE),
                    imageUrl: `${ODOO_URL}/web/image/product.template/${t.id}/image_256`,
                    extraImages: (t.product_template_image_ids || []).map(id => ({ id, url: `${ODOO_URL}/web/image/product.image/${id}/image_256` })),
                    isService: t.id === SERVICE_TEMPLATE_ID
                };
            });
            return res.status(200).json({ success: true, products, categories });
        }

        if (req.method !== 'POST') {
            return res.status(405).json({ success: false, error: 'Método no permitido' });
        }

        const body = req.body || {};
        const action = String(body.action || '');

        // ---------- utilidades de validación ----------
        const cleanName = v => {
            const s = typeof v === 'string' ? v.trim() : '';
            if (s.length < 2 || s.length > 120) throw new InputError('El nombre debe tener entre 2 y 120 caracteres');
            return s;
        };
        const cleanPrice = v => {
            const n = Number(v);
            if (!Number.isFinite(n) || n < 0 || n > 10000) throw new InputError('Precio no válido');
            return Math.round(n * 100) / 100;
        };
        const cleanText = v => (typeof v === 'string' ? v.trim().slice(0, 5000) : '');
        const cleanIds = v => (Array.isArray(v) ? v.map(Number).filter(n => Number.isInteger(n) && n > 0).slice(0, 20) : []);
        const cleanOptions = v => (Array.isArray(v) ? [...new Set(v.map(o => String(o).trim().slice(0, 60)).filter(o => o && o !== XL_VALUE))].slice(0, 20) : []);
        const cleanId = v => {
            const n = Number(v);
            if (!Number.isInteger(n) || n < 1) throw new InputError('Artículo no válido');
            return n;
        };

        // list_price de Odoo es SIN IVA y con 2 decimales: buscamos el valor que, al sumarle
        // el IVA y redondear (como hace get-products), da EXACTAMENTE el precio que ha escrito el admin.
        const listPriceFor = (priceWithTax, rate) => {
            const base = priceWithTax / (1 + rate / 100);
            const candidates = [0, -0.01, 0.01, -0.02, 0.02].map(d => Math.round((base + d) * 100) / 100);
            return candidates.find(c => Math.round(c * (1 + rate / 100) * 100) / 100 === priceWithTax) ?? candidates[0];
        };

        async function templateRate(templateId) {
            const [t] = await exec('product.template', 'read', [[templateId]], { ...ALL, fields: ['taxes_id'] });
            const ids = t?.taxes_id || [];
            if (!ids.length) return DEFAULT_TAX_RATE;
            const taxes = await exec('account.tax', 'read', [ids], { fields: ['amount', 'amount_type'] });
            const rates = taxes.filter(x => x.amount_type === 'percent').map(x => x.amount);
            return rates.length ? rates.reduce((s, r) => s + r, 0) : DEFAULT_TAX_RATE;
        }

        // Opciones (XL + grabado): reutiliza el atributo "Opciones adicionales" que ya existe en Odoo
        async function setOptions(templateId, hasXL, engravingOptions) {
            const wanted = [...(hasXL ? [XL_VALUE] : []), ...engravingOptions];
            const attrs = await exec('product.attribute', 'search_read', [[['name', '=', ATTRIBUTE_NAME]]], { fields: ['id'], limit: 1 });
            if (!attrs.length) throw new Error(`No existe el atributo "${ATTRIBUTE_NAME}" en Odoo`);
            const attributeId = attrs[0].id;

            const valueIds = [];
            for (const name of wanted) {
                const found = await exec('product.attribute.value', 'search_read', [[['attribute_id', '=', attributeId], ['name', '=', name]]], { fields: ['id'], limit: 1 });
                valueIds.push(found.length ? found[0].id : await exec('product.attribute.value', 'create', [{ attribute_id: attributeId, name }]));
            }

            const lines = await exec('product.template.attribute.line', 'search_read', [[['product_tmpl_id', '=', templateId], ['attribute_id', '=', attributeId]]], { fields: ['id'] });
            if (lines.length) {
                await exec('product.template.attribute.line', 'write', [[lines[0].id], { value_ids: [[6, 0, valueIds]] }]);
            } else if (valueIds.length) {
                await exec('product.template.attribute.line', 'create', [{ product_tmpl_id: templateId, attribute_id: attributeId, value_ids: [[6, 0, valueIds]] }]);
            }
        }

        // Stock: ajuste de inventario en el almacén principal
        async function setStock(templateId, quantity) {
            const qty = Number(quantity);
            if (!Number.isFinite(qty) || qty < 0 || qty > 100000) throw new InputError('Stock no válido');
            const [t] = await exec('product.template', 'read', [[templateId]], { ...ALL, fields: ['product_variant_id'] });
            const variantId = Array.isArray(t.product_variant_id) ? t.product_variant_id[0] : t.product_variant_id;
            const wh = await exec('stock.warehouse', 'search_read', [[]], { fields: ['lot_stock_id'], limit: 1 });
            if (!variantId || !wh.length) throw new Error('No se encontró el almacén o la variante');
            const locationId = Array.isArray(wh[0].lot_stock_id) ? wh[0].lot_stock_id[0] : wh[0].lot_stock_id;
            const ctx = { context: { inventory_mode: true } };
            const quants = await exec('stock.quant', 'search_read', [[['product_id', '=', variantId], ['location_id', '=', locationId]]], { fields: ['id'], limit: 1 });
            let quantId;
            if (quants.length) {
                quantId = quants[0].id;
                await exec('stock.quant', 'write', [[quantId], { inventory_quantity: qty }], ctx);
            } else {
                quantId = await exec('stock.quant', 'create', [{ product_id: variantId, location_id: locationId, inventory_quantity: qty }], ctx);
            }
            await exec('stock.quant', 'action_apply_inventory', [[quantId]], ctx);
        }

        // ---------- crear ----------
        if (action === 'create') {
            const name = cleanName(body.name);
            const price = cleanPrice(body.price);
            const vals = {
                name,
                description_ecommerce: cleanText(body.description),
                type: 'consu',
                is_storable: true,
                sale_ok: true,
                website_published: false, // SIEMPRE borrador: se publica a mano, tras revisarlo
                public_categ_ids: [[6, 0, cleanIds(body.categoryIds)]]
            };
            const templateId = await exec('product.template', 'create', [vals]);
            const warnings = [];
            try {
                const rate = await templateRate(templateId);
                await exec('product.template', 'write', [[templateId], { list_price: listPriceFor(price, rate) }]);
            } catch (e) { warnings.push('No se pudo fijar el precio: ' + e.message); }
            try { await setOptions(templateId, Boolean(body.hasXL), cleanOptions(body.engravingOptions)); }
            catch (e) { warnings.push('Opciones sin guardar: ' + e.message); }
            if (body.stock !== undefined && body.stock !== '') {
                try { await setStock(templateId, body.stock); }
                catch (e) { warnings.push('Stock sin guardar (ponlo en Odoo): ' + e.message); }
            }
            return res.status(200).json({ success: true, id: templateId, warnings });
        }

        // ---------- editar ----------
        if (action === 'update') {
            const id = cleanId(body.id);
            const vals = {};
            const warnings = [];
            if (body.name !== undefined) vals.name = cleanName(body.name);
            if (body.description !== undefined) vals.description_ecommerce = cleanText(body.description);
            if (body.categoryIds !== undefined) vals.public_categ_ids = [[6, 0, cleanIds(body.categoryIds)]];
            if (body.published !== undefined) vals.website_published = Boolean(body.published);
            if (body.price !== undefined) vals.list_price = listPriceFor(cleanPrice(body.price), await templateRate(id));
            if (Object.keys(vals).length) await exec('product.template', 'write', [[id], vals], ALL);
            if (body.hasXL !== undefined || body.engravingOptions !== undefined) {
                try { await setOptions(id, Boolean(body.hasXL), cleanOptions(body.engravingOptions)); }
                catch (e) { warnings.push('Opciones sin guardar: ' + e.message); }
            }
            if (body.stock !== undefined && body.stock !== '') {
                try { await setStock(id, body.stock); }
                catch (e) { warnings.push('Stock sin guardar: ' + e.message); }
            }
            return res.status(200).json({ success: true, warnings });
        }

        // ---------- archivar / restaurar ----------
        if (action === 'archive' || action === 'restore') {
            const id = cleanId(body.id);
            if (action === 'archive' && id === SERVICE_TEMPLATE_ID) {
                throw new InputError('El envío personalizado no se puede archivar desde aquí');
            }
            await exec('product.template', 'write', [[id], action === 'archive' ? { active: false, website_published: false } : { active: true }], ALL);
            return res.status(200).json({ success: true });
        }

        // ---------- fotos ----------
        if (action === 'add-image') {
            const id = cleanId(body.id);
            const image = typeof body.image === 'string' ? body.image.replace(/^data:image\/[a-zA-Z+.-]+;base64,/, '') : '';
            if (!image || image.length > MAX_IMAGE_B64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(image)) throw new InputError('Imagen no válida o demasiado grande');
            if (!detectImage(Buffer.from(image.slice(0, 64), 'base64'))) throw new InputError('Solo se admiten imágenes JPG, PNG o WEBP');
            const [t] = await exec('product.template', 'read', [[id]], { ...ALL, fields: ['name', 'product_template_image_ids'] });
            let hasMain = true; // ante la duda, la foto va como extra y no pisa la principal
            try { hasMain = (await exec('product.template', 'search_count', [[['id', '=', id], ['image_1920', '!=', false]]], ALL)) > 0; } catch (e) { /* se queda en true */ }
            if (!hasMain) {
                await exec('product.template', 'write', [[id], { image_1920: image }], ALL); // la primera foto es la principal
            } else {
                await exec('product.image', 'create', [{ name: `${t.name} ${(t.product_template_image_ids || []).length + 1}`, image_1920: image, product_tmpl_id: id }]);
            }
            return res.status(200).json({ success: true });
        }

        if (action === 'delete-image') {
            const imageId = cleanId(body.imageId);
            await exec('product.image', 'unlink', [[imageId]]);
            return res.status(200).json({ success: true });
        }

        return res.status(400).json({ success: false, error: 'Acción no reconocida' });
    } catch (err) {
        if (err instanceof InputError) {
            return res.status(400).json({ success: false, error: err.message });
        }
        console.error('admin/products:', err.message);
        return res.status(500).json({ success: false, error: 'Odoo rechazó la operación. Revisa los datos o inténtalo de nuevo.' });
    }
}
