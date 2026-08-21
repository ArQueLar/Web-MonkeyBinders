// api/get-products.js
// Función serverless de Vercel. Corre en el servidor, nunca en el navegador.
// Habla con Odoo por JSON-RPC usando una API Key guardada en variables de entorno,
// y devuelve los productos ya traducidos al formato que usa la web (mismo shape
// que el array "products" hardcodeado en app.js).

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Método no permitido' });
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

        // Pedimos categorías y productos EN PARALELO (ninguno depende del otro, solo del uid ya obtenido)
        const [categories, rawProducts] = await Promise.all([
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
                        'public_categ_ids', 'product_template_image_ids', 'attribute_line_ids'
                    ],
                    limit: 200
                }
            ])
        ]);

        const categNameById = {};
        categories.forEach(c => { categNameById[c.id] = c.name; });

        // Leemos los valores del atributo "Opciones adicionales" de cada producto.
        // "XL Master Set" controla el selector de tamaño 3x3 / 4x3 XL (ver más abajo).
        // El resto de valores ("Normal", "Sin logo de colección", etc.) son solo
        // informativos para el grabado — se muestran como botones aparte, sin tocar el precio.
        const allLineIds = [...new Set(rawProducts.flatMap(p => p.attribute_line_ids || []))];
        let hasXLByProductId = {};
        let engravingOptionsByProductId = {};

        if (allLineIds.length > 0) {
            const attributeLines = await callOdoo('object', 'execute_kw', [
                ODOO_DB, uid, ODOO_API_KEY,
                'product.template.attribute.line', 'read',
                [allLineIds],
                { fields: ['product_tmpl_id', 'value_ids'] }
            ]);

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
            const frontImg = `${ODOO_URL}/web/image/product.template/${p.id}/image_512`;
            const extraImageId = (p.product_template_image_ids || [])[0];
            const backImg = extraImageId
                ? `${ODOO_URL}/web/image/product.image/${extraImageId}/image_512`
                : frontImg;

            return {
                id: `odoo-${p.id}`,
                name: p.name,
                category,
                tcg,
                expansion,
                grabadocolor,
                price: p.list_price,
                price12p: p.list_price, // Odoo no tiene todavía un precio distinto para 12 bolsillos
                rating: null,           // Odoo no tiene valoraciones conectadas todavía
                reviewsCount: 0,
                badge: null,
                frontImg,
                backImg,
                description: p.description_ecommerce || p.description_sale || '',
                featured: false,
                hasXLMasterSet: hasXLByProductId[p.id] === true,
                engravingOptions: engravingOptionsByProductId[p.id] || []
            };
        });

        // Caché en el borde de Vercel: sirve la misma respuesta hasta 5 min sin volver a
        // preguntarle a Odoo, y sigue sirviendo la versión en caché mientras revalida en
        // segundo plano hasta 1h. El catálogo no cambia segundo a segundo, así que esto
        // es la optimización que más rendimiento da a coste cero.
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');

        return res.status(200).json({ success: true, products });
    } catch (err) {
        return res.status(500).json({ success: false, error: 'Error interno del servidor', detail: err.message });
    }
}