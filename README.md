# Monkey Binders — Web

## Estructura del proyecto

```
├── index.html              → Página de inicio
├── tienda/
│   ├── tienda.html         → Catálogo de la tienda
│   └── producto.html       → Ficha de producto
├── src/
│   ├── css/styles.css      → Todos los estilos
│   └── js/app.js           → Toda la lógica del sitio (carrito, filtros, Odoo, etc.)
├── public/
│   └── assets/Cosas Web/   → Imágenes, logos, SVGs (cópialos aquí tal cual los tenías)
├── api/                    → Funciones serverless de Vercel (SIN CAMBIOS, igual que antes)
│   ├── get-products.js
│   ├── upload-image.js
│   └── check-config.js
├── vite.config.js
└── package.json
```

## Cómo trabajar en local

```bash
npm install       # solo la primera vez, instala Vite
npm run dev       # abre un servidor con recarga automática en http://localhost:5173
```

Nota: en local, `/api/...` no funcionará con `npm run dev` normal (Vite no ejecuta funciones
serverless). Para probar Odoo/ImgBB en local necesitas la CLI de Vercel:

```bash
npm install -g vercel
vercel dev
```

## Cómo publicar (build)

```bash
npm run build     # genera la carpeta dist/ con todo optimizado y minificado
```

Si despliegas en **Vercel**, no hace falta que ejecutes `npm run build` tú mismo — Vercel
detecta que es un proyecto Vite automáticamente y lo hace en cada despliegue. Solo asegúrate
de que en la configuración del proyecto (Settings → General) el *Framework Preset* sea
**Vite**.

## Qué cambió respecto a la versión estática anterior

- Los assets ahora se referencian con rutas absolutas (`/assets/...`) en vez de relativas
  (`../assets/...`) — funcionan igual sin importar desde qué página se carguen.
- Las llamadas a la API se hacen a `/api/get-products` y `/api/upload-image` (antes eran
  rutas relativas `../api/...`, que funcionaban por casualidad de la estructura de carpetas).
- El resto de la lógica (carrito, filtros, formulario de personalización, ficha de producto,
  Odoo...) es exactamente la misma, solo movida de sitio.

## Próximo paso (opcional)

`src/js/app.js` sigue siendo un único archivo grande. Cuando quieras, se puede dividir en
módulos más pequeños (carrito, catálogo, formulario, tema...) para que sea aún más fácil de
mantener — decísmelo cuando quieras dar ese paso.
