import { defineConfig } from 'vite';
import { resolve } from 'path';

// Monkey Binders es una web multi-página (no una SPA): cada archivo .html es una
// "entrada" independiente que Vite construye por separado. Mantenemos la misma
// estructura de carpetas que ya tenías (index.html en la raíz, tienda.html y
// producto.html dentro de /tienda) para no tener que tocar ningún enlace interno.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        tienda: resolve(__dirname, 'tienda/tienda.html'),
        producto: resolve(__dirname, 'tienda/producto.html'),
        cuenta: resolve(__dirname, 'cuenta.html'),
        admin: resolve(__dirname, 'admin.html'),
        pagoExito: resolve(__dirname, 'pago-exito.html'),
        pagoError: resolve(__dirname, 'pago-error.html'),
        checkout: resolve(__dirname, 'checkout.html'),
        avisoLegal: resolve(__dirname, 'aviso-legal.html'),
        terminosCondiciones: resolve(__dirname, 'terminos-condiciones.html'),
        politicaPrivacidad: resolve(__dirname, 'politica-privacidad.html'),
        politicaDevoluciones: resolve(__dirname, 'politica-devoluciones.html')
      }
    }
  },
  // La carpeta api/ (funciones serverless de Vercel) vive fuera de esto: Vite no la
  // toca para nada, y Vercel la sirve tal cual, igual que hacía con el sitio estático.
  server: {
    port: 5173,
    watch: {
      // No vigilamos los assets estáticos (imágenes/svg): no cambian mientras programas
      // y vigilarlos causa errores EBUSY en Windows si la carpeta está sincronizada con
      // OneDrive o el antivirus los está escaneando.
      ignored: ['**/public/assets/**']
    }
  }
});
