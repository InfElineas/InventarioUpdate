import globals from "globals";
import pluginJs from "@eslint/js";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginUnusedImports from "eslint-plugin-unused-imports";

export default [
  // Nada que linar en el build ni en los assets.
  { ignores: ["dist/**", "coverage/**", "node_modules/**"] },

  {
    files: [
      "src/components/**/*.{js,mjs,cjs,jsx}",
      "src/pages/**/*.{js,mjs,cjs,jsx}",
      "src/lib/**/*.{js,mjs,cjs,jsx}",
      "src/hooks/**/*.{js,mjs,cjs,jsx}",
      "src/Layout.jsx",
    ],
    // Codigo generado por shadcn: se actualiza regenerandolo, no editandolo.
    ignores: ["src/components/ui/**/*"],

    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    // Version fijada a proposito, NO "detect": con "detect",
    // eslint-plugin-react 7.37.5 revienta en ESLint 10 dentro de
    // detectReactVersion ("contextOrFilename.getFilename is not a function",
    // su util/version.js usa una API de contexto que ESLint 10 cambio).
    // Fijarla evita esa ruta de codigo por completo. Al subir React hay que
    // actualizar este numero a mano.
    settings: { react: { version: "19.2" } },
    plugins: {
      react: pluginReact,
      "react-hooks": pluginReactHooks,
      "unused-imports": pluginUnusedImports,
    },

    // Antes esto eran dos spreads (...pluginJs.configs.recommended y
    // ...pluginReact.configs.flat.recommended) colocados ANTES de la clave
    // `rules`, que los pisaba entera: las dos recommended no llegaban a
    // aplicarse nunca. Ahora se mezclan explicitamente, que es lo que se
    // pretendia.
    rules: {
      ...pluginJs.configs.recommended.rules,
      ...pluginReact.configs.flat.recommended.rules,

      "no-unused-vars": "off",
      // El proyecto usa `catch {}` a proposito para tragarse fallos de
      // localStorage y JSON.parse, que no deben tumbar la UI. Son 9 sitios y
      // todos son intencionados, asi que se permite el catch vacio en vez de
      // ensuciarlos con un comentario cada uno.
      "no-empty": ["error", { allowEmptyCatch: true }],
      // Solo estetica: se queja de las comillas en texto JSX
      // (The page "{pageName}" could not be found). Escaparlas empeora la
      // legibilidad de la prosa sin ganar nada.
      "react/no-unescaped-entities": "off",
      "react/jsx-uses-vars": "error",
      "react/jsx-uses-react": "error",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      "react/no-unknown-property": ["error", { ignore: ["toast-close"] }],

      "react-hooks/rules-of-hooks": "error",
      // Estaba sin activar, y sin embargo hay ficheros con
      // `eslint-disable react-hooks/exhaustive-deps`: esos disables producian
      // "Definition for rule not found" en cada `bun run lint`.
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];
