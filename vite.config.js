import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'url'
import path from 'path'
import { tkcApiPlugin } from './vite-plugin-tkc.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  // tkcApiPlugin sirve /api/tkc/inventario en dev y preview: el login de TKC
  // necesita cookies + CSRF, imposible desde el navegador.
  plugins: [
    react(),
    // React Compiler: memoiza automáticamente, así que hace innecesarios los
    // useMemo/useCallback escritos a mano.
    //
    // Va como plugin propio y NO dentro de react({ babel: ... }): esa vía no
    // aplica el compiler y el build sale idéntico sin avisar de nada. Bajo
    // rolldown, Babel lo aporta @rolldown/plugin-babel, y reactCompilerPreset
    // es el helper que expone @vitejs/plugin-react 6 ya con el filtro puesto.
    //
    // El compiler solo transforma lo que puede probar que respeta las Rules of
    // React; el resto lo deja intacto en vez de romperlo. Por eso los hooks
    // condicionales de src/pages/AdminUsuarios.jsx no rompen el build: ese
    // componente se queda sin optimizar (los denuncia `bun run lint`).
    babel({ presets: [reactCompilerPreset()] }),
    tkcApiPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy':        'strict-origin-when-cross-origin',
    },
  },
  test: {
    globals:      true,
    environment:  'jsdom',
    setupFiles:   './src/test/setup.js',
    css:          false,
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});