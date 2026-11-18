// api/get-products.js
// Función serverless de Vercel. Corre en el servidor, nunca en el navegador.
// Habla con Odoo por JSON-RPC usando una API Key guardada en variables de entorno,
// y devuelve los productos ya traducidos al formato que usa la web (mismo shape
// que el array "products" hardcodeado en app.js).

// Caché en memoria de la instancia: mientras la función siga "caliente", las visitas
// reciben el catálogo al instante sin volver a preguntarle a Odoo (5 min). Va además de
// la caché del borde de Vercel (cabecera Cache-Control de más abajo).
const MEMORY_TTL_MS = 5 * 60 * 1000;
let memoryCache = { at: 0, body: null };

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Método no permitido' });
    }

    if (memoryCache.body && Date.now() - memoryCache.at < MEMORY_TTL_MS) {
        res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=7200');
        res.setHeader('X-Catalog-Cache', 'memory');
        return res.status(200).json(memoryCache.body);
    }

    const ODOO_URL = process.env.ODOO_URL;       // ej: https://midominio.odoo.com (sin barra al final)
    const ODOO_DB = process.env.ODOO_DB;         // ej: midominio
    const ODOO_LOGIN = process.env.ODOO_LOGIN;   // email del usuario de integración
    const ODOO_API_KEY = process.env.ODOO_API_KEY;

    if (!ODOO_URL || !ODOO_DB || !ODOO_LOGIN || !ODOO_API_KEY) {
        return res.status(500).json({ success: false, error: 'Faltan variables de entorno de Odoo en Vercel' });
    }

    async function callOdoo(service, method, args) {
        const response = await fetch(`${ODOO_URL}/jsonrpc`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { service, method, args }, id: Date.now() })
        });
        const data = await response.json();
        if (data.error) throw new Error(JSON.stringify(data.error));
        return data.result;
    }

    // Traduce el nombre de una categoría web de Odoo a los valores que ya usa el filtro de la tienda
    const EXPANSION_MAP = {
        'Scarlet and Violet': 'scarletviolet',
        'Megaevolution': 'megaevolutions',
        'Sword & Shield': 'swordshield'
    };

    try {
        const uid = await callOdoo('common', 'authenticate', [ODOO_DB, ODOO_LOGIN, ODOO_API_KEY, {}]);
        if (!uid) {
            return res.status(401).json({ success: false, error: 'No se pudo autenticar con Odoo. Revisa DB, login y API Key.' });
        }

        // RONDA 1: categorías, productos y ventas — ninguno depende de los otros dos,
        // solo del uid ya obtenido, así que van los 3 a la vez en vez de uno detrás de otro.
        const [categories, rawProducts, salesGrouped] = await Promise.all([
            callOdoo('object', 'execute_kw', [
                ODOO_DB, uid, ODOO_API_KEY,
                'product.public.category', 'search_read',
                [[]],
                { fields: ['id', 'name'] }
            ]),
            callOdoo('object', 'execute_kw', [
                ODOO_DB, uid, ODOO_API_KEY,
                'product.template', 'search_read',
                [[['sale_ok', '=', true], ['website_published', '=', true]]],
                {
                    fields: [
                        'id', 'name', 'list_price', 'description_sale', 'description_ecommerce',
                        'public_categ_ids', 'product_template_image_ids', 'attribute_line_ids', 'taxes_id',
                        'create_date', 'qty_available'
                    ],
                    limit: 200
                }
            ]),
            callOdoo('object', 'execute_kw', [
                ODOO_DB, uid, ODOO_API_KEY,
                'sale.order.line', 'read_group',
                [[['state', 'in', ['sale', 'done']]], ['product_uom_qty'], ['product_id']]
            ]).catch(() => []) // si esto falla, seguimos sin marcar "más vendidos" en vez de romper todo
        ]);

        const categNameById = {};
        categories.forEach(c => { categNameById[c.id] = c.name; });

        const allLineIds = [...new Set(rawProducts.flatMap(p => p.attribute_line_ids || []))];
        const allTaxIds = [...new Set(rawProducts.flatMap(p => p.taxes_id || []))];
        const variantIds = [...new Set(salesGrouped
            .map(g => Array.isArray(g.product_id) ? g.product_id[0] : g.product_id)
            .filter(Boolean))];

        // RONDA 2: líneas de atributos, impuestos y variantes vendidas — cada uno depende
        // de datos de la ronda 1, pero NO depende de los otros dos de esta misma ronda,
        // así que también van los 3 a la vez.
        const [attributeLines, taxes, variants] = await Promise.all([
            allLineIds.length > 0 ? callOdoo('object', 'execute_kw', [
                ODOO_DB, uid, ODOO_API_KEY,
                'product.template.attribute.line', 'read',
                [allLineIds],
                { fields: ['product_tmpl_id', 'value_ids'] }
            ]) : [],
            allTaxIds.length > 0 ? callOdoo('object', 'execute_kw', [
                ODOO_DB, uid, ODOO_API_KEY,
                'account.tax', 'read',
                [allTaxIds],
                { fields: ['amount', 'amount_type'] }
            ]) : [],
            variantIds.length > 0 ? callOdoo('object', 'execute_kw', [
                ODOO_DB, uid, ODOO_API_KEY,
                'product.product', 'read',
                [variantIds],
                { fields: ['product_tmpl_id'] }
            ]) : []
        ]);

        // Leemos los valores del atributo "Opciones adicionales" de cada producto.
        // "XL Master Set" controla el selector de tamaño 3x3 / 4x3 XL (ver más abajo).
        // El resto de valores ("Normal", "Sin logo de colección", etc.) son solo
        // informativos para el grabado — se muestran como botones aparte, sin tocar el precio.
        let hasXLByProductId = {};
        let engravingOptionsByProductId = {};

        if (attributeLines.length > 0) {
            const allValueIds = [...new Set(attributeLines.flatMap(l => l.value_ids || []))];
            const attributeValues = allValueIds.length > 0 ? await callOdoo('object', 'execute_kw', [
                ODOO_DB, uid, ODOO_API_KEY,
                'product.attribute.value', 'read',
                [allValueIds],
                { fields: ['name'] }
            ]) : [];

            const valueNameById = {};
            attributeValues.forEach(v => { valueNameById[v.id] = v.name; });

            attributeLines.forEach(line => {
                const productId = Array.isArray(line.product_tmpl_id) ? line.product_tmpl_id[0] : line.product_tmpl_id;
                const names = (line.value_ids || []).map(id => valueNameById[id]).filter(Boolean);
                if (names.includes('XL Master Set')) {
                    hasXLByProductId[productId] = true;
                }
                // Todos los valores menos "XL Master Set" (ese ya tiene su propio selector de tamaño)
                const engravingNames = names.filter(n => n !== 'XL Master Set');
                if (engravingNames.length > 0) {
                    engravingOptionsByProductId[productId] = engravingNames;
                }
            });
        }

        // Leemos el % de IVA de cada impuesto usado en los productos, para calcular el
        // precio final CON IVA incluido (list_price de Odoo viene siempre SIN IVA).
        const DEFAULT_TAX_RATE = 21; // IVA general en España, solo se usa si un producto no tiene impuesto configurado en Odoo
        let taxRateById = {};
        taxes.forEach(t => {
            // Solo sabemos calcular impuestos de tipo "porcentaje" (lo habitual en España). Si algún
            // día usáis un impuesto de tipo fijo/grupo, ese producto usará el IVA por defecto de arriba.
            if (t.amount_type === 'percent') taxRateById[t.id] = t.amount;
        });

        function taxRateForProduct(p) {
            const rates = (p.taxes_id || []).map(id => taxRateById[id]).filter(r => typeof r === 'number');
            if (rates.length === 0) return DEFAULT_TAX_RATE;
            return rates.reduce((sum, r) => sum + r, 0); // suma si tuviera varios impuestos aplicados
        }

        // Traducimos cada producto de Odoo al formato que ya usa la web
        const products = rawProducts.map(p => {
            const categNames = (p.public_categ_ids || []).map(id => categNameById[id]).filter(Boolean);

            let tcg = 'pokemon'; // sin categoría = Pokémon por defecto
            if (categNames.includes('Magic')) tcg = 'magic';
            else if (categNames.includes('Otros')) tcg = 'otros';

            const grabadocolor = categNames.includes('Color');

            let expansion = 'all';
            for (const name of categNames) {
                if (EXPANSION_MAP[name]) { expansion = EXPANSION_MAP[name]; break; }
            }

            // Pestaña del catálogo (TODOS/EXPANSIONES/DISEÑOS): si tiene una era reconocida va a
            // "ediciones", si no, a "diseños". Ajustable si tenéis otro criterio.
            const category = expansion !== 'all' ? 'ediciones' : 'dsgn';

            // Odoo sirve las imágenes publicadas en esta URL sin necesitar autenticación.
            // Usamos "image_512" en vez de "image_1920": de sobra para tarjetas de producto
            // y galería, y pesa una fracción de lo que pesaría la resolución completa.
            // Cogemos TODAS las imágenes extra del producto (no solo la primera), para que
            // la galería de la ficha de producto muestre las 3+ fotos que tenga cada binder.
            const mainImg = `${ODOO_URL}/web/image/product.template/${p.id}/image_512`;
            const extraImgs = (p.product_template_image_ids || [])
                .map(imgId => `${ODOO_URL}/web/image/product.image/${imgId}/image_512`);
            const images = [mainImg, ...extraImgs];
            const frontImg = images[0];
            const backImg = images[1] || images[0]; // se mantiene para la tarjeta de producto (hover front/back)

            // list_price de Odoo es SIN IVA — aplicamos el % real configurado en el producto
            const taxRate = taxRateForProduct(p);
            const priceWithTax = Math.round(p.list_price * (1 + taxRate / 100) * 100) / 100;

            return {
                id: `odoo-${p.id}`,
                name: p.name,
                category,
                tcg,
                expansion,
                grabadocolor,
                price: priceWithTax,
                price12p: priceWithTax, // Odoo no tiene todavía un precio distinto para 12 bolsillos
                rating: null,           // Odoo no tiene valoraciones conectadas todavía
                reviewsCount: 0,
                badge: null,
                frontImg,
                backImg,
                images,
                description: p.description_ecommerce || p.description_sale || '',
                featured: false,
                services: p.id === 45, // el envío personalizado se muestra como "SERVICIO" en su tarjeta, no como grabado
                hasXLMasterSet: hasXLByProductId[p.id] === true,
                engravingOptions: engravingOptionsByProductId[p.id] || [],
                stock: typeof p.qty_available === 'number' ? p.qty_available : null
            };
        });

        // --- NUEVOS + MÁS VENDIDOS (inicio y carrusel del banner) ---
        // NUEVO: productos publicados creados en los últimos NEW_DAYS días (máx. MAX_NEW, los
        // más recientes primero). MÁS VENDIDO: los de más ventas reales en Odoo (máx. BEST_SELLERS_COUNT),
        // sin repetir los que ya son NUEVO. Un producto solo lleva una etiqueta (NUEVO manda).
        // La sección destacada del inicio solo muestra productos con etiqueta (nunca uno sin sello).
        const NEW_DAYS = 30;
        const MAX_NEW = 3;
        const BEST_SELLERS_COUNT = 3;
        const odooDate = d => new Date(String(d || '').replace(' ', 'T') + 'Z').getTime();
        const tmplIdOf = prod => Number(String(prod.id).replace('odoo-', ''));
        const cutoff = Date.now() - NEW_DAYS * 24 * 60 * 60 * 1000;

        const byNewest = rawProducts
            .filter(p => p.id !== 45)
            .sort((x, y) => odooDate(y.create_date) - odooDate(x.create_date));
        const newTmplIds = byNewest
            .filter(p => odooDate(p.create_date) >= cutoff)
            .slice(0, MAX_NEW)
            .map(p => p.id);

        let topSellerTmplIds = [];
        if (variants.length > 0) {
            const tmplIdByVariantId = {};
            variants.forEach(v => {
                tmplIdByVariantId[v.id] = Array.isArray(v.product_tmpl_id) ? v.product_tmpl_id[0] : v.product_tmpl_id;
            });

            const soldQtyByTmplId = {};
            salesGrouped.forEach(g => {
                const variantId = Array.isArray(g.product_id) ? g.product_id[0] : g.product_id;
                const tmplId = tmplIdByVariantId[variantId];
                if (!tmplId) return;
                soldQtyByTmplId[tmplId] = (soldQtyByTmplId[tmplId] || 0) + (g.product_uom_qty || 0);
            });

            topSellerTmplIds = Object.entries(soldQtyByTmplId)
                .filter(([tmplId]) => Number(tmplId) !== 45 && !newTmplIds.includes(Number(tmplId)))
                .sort((a, b) => b[1] - a[1])
                .slice(0, BEST_SELLERS_COUNT)
                .map(([tmplId]) => Number(tmplId));
        }

        products.forEach(prod => {
            const tmplId = tmplIdOf(prod);
            if (newTmplIds.includes(tmplId)) {
                prod.featured = true;
                prod.badge = 'NUEVO';
            } else if (topSellerTmplIds.includes(tmplId)) {
                prod.featured = true;
                prod.badge = 'MÁS VENDIDO';
            }
        });

        // Caché en el borde de Vercel: sirve la misma respuesta hasta 30 min sin volver a
        // preguntarle a Odoo, y sigue sirviendo la versión en caché mientras revalida en
        // segundo plano hasta 2h. El catálogo no cambia cada minuto, así que esto es la
        // optimización que más rendimiento da a coste cero — casi todas las visitas caen
        // dentro de esos 30 min y reciben la respuesta al instante, desde el borde de red
        // más cercano al usuario, sin tocar Odoo para nada.
        res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=7200');

        const body = { success: true, products };
        memoryCache = { at: Date.now(), body };
        return res.status(200).json(body);
    } catch (err) {
        console.error('get-products:', err.message);
        return res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
}