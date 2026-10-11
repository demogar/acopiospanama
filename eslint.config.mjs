// ESLint 9 (flat config). `npm run lint` desde la raíz revisa las dos apps.
import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  globalIgnores(['**/node_modules/**', '**/dist/**', '**/.next/**', '**/.test-dist/**', '**/next-env.d.ts']),
  {
    // API (NestJS): reglas recomendadas de JS y TypeScript.
    files: ['apps/api/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
  },
  {
    // Web (Next.js): reglas de Next (core-web-vitals) y TypeScript.
    files: ['apps/web/**/*.{ts,tsx,mjs}'],
    extends: [...nextVitals, ...nextTs],
    settings: { next: { rootDir: 'apps/web' } },
    rules: {
      // Reglas del compilador de React (eslint-plugin-react-hooks 6+). Hay usos previos que hay que
      // refactorizar con calma (ver issue «Adaptar efectos a las reglas del compilador de React»);
      // mientras tanto avisan sin romper la CI. No añadas casos nuevos.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
  {
    // Variables que empiezan por «_» se ignoran a propósito (p. ej. en desestructuraciones).
    files: ['apps/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // En las pruebas se permite `any` para fabricar datos y respuestas sin ceremonia.
    files: ['apps/api/test/**/*.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
]);
