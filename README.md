# Acopio Panamá

[![CI/CD](https://github.com/demogar/acopiospanama/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/demogar/acopiospanama/actions/workflows/ci-cd.yml)
[![CodeQL](https://github.com/demogar/acopiospanama/actions/workflows/codeql.yml/badge.svg)](https://github.com/demogar/acopiospanama/actions/workflows/codeql.yml)
[![Última versión](https://img.shields.io/github/v/release/demogar/acopiospanama?label=versi%C3%B3n&color=2563eb)](https://github.com/demogar/acopiospanama/releases)
[![Licencia MIT](https://img.shields.io/badge/licencia-MIT-green.svg)](LICENSE)

**Dónde llevar donaciones y qué necesitan hoy.** Directorio nacional y abierto de centros de acopio,
puntos de distribución, comedores y albergues en Panamá, creado tras el terremoto del 9 de octubre de 2026.

Lo mantiene la comunidad:

- **Cualquiera publica un centro** con su correo (sin contraseñas) y queda como responsable.
- **Cualquiera confirma** «estuve aquí y sigue funcionando» o **reporta** un problema.
- **Reglas automáticas** deciden qué se muestra. Nadie tiene que estar pendiente:
  - un centro sin confirmar en 72 h pasa a «sin confirmar», y a los 14 días deja de mostrarse;
  - con reportes de 2 personas se marca «verifica antes de ir»;
  - con 3 reportes graves (que pide dinero, que es falso o que cerró) se oculta, salvo que lo confirmen más personas de las que lo reportan;
  - las fichas **no pueden pedir dinero**: se bloquea al guardar;
  - quienes responden por un centro reciben un recordatorio de un toque para confirmar que sigue abierto.
- La moderación humana es solo el último recurso.

Cada ficha incluye el tipo de centro, quién lo organiza, la ubicación exacta (con botones de Google Maps y Waze),
el horario por día con «abierto ahora», el contacto (solo si esa persona lo acepta) y qué aceptan, qué es urgente
y qué ya no reciben.

> Si hay una emergencia, llama al **911**. Este directorio no reemplaza a SINAPROC ni a las autoridades.

## Contribuir

Es código abierto (MIT) y construido en público. Cualquier ayuda suma: código, diseño, textos, pruebas en
teléfonos reales y difusión. Lee [CONTRIBUTING.md](CONTRIBUTING.md). Cada PR corre la CI completa, y al
fusionarse en `main` se despliega solo.

## Stack

| Parte            | Tecnología                                                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| API (`apps/api`) | NestJS 11, Kysely + PostgreSQL 16, migraciones SQL, `otplib`, `nodemailer`                                                       |
| Web (`apps/web`) | Next.js 16 (App Router), React 19, Tailwind v4, [`@demogar/mola-ui`](https://demogar.github.io/molaui/), Leaflet + OpenStreetMap |
| Infra            | Docker, GitHub Actions → GHCR → VPS (Docker Compose + Caddy), respaldos cifrados con `age`                                       |

## Correr en local

Requisitos: Node 24 (`.nvmrc`; con nvm: `nvm use`) y PostgreSQL 16.

```bash
npm ci
createuser -P acopio            # contraseña: acopio
createdb -O acopio acopio && createdb -O acopio acopio_test
cp apps/api/.env.example apps/api/.env.development   # ajusta DATABASE_URL si cambiaste el usuario
npm run build -w apps/api
(cd apps/api && set -a && . ./.env.development && set +a && npm run seed && npm start)   # API en :3011
npm run dev -w apps/web                                                                     # web en :3010
```

Abre http://localhost:3010. Para entrar, el código aparece en http://localhost:3010/api/dev/outbox, porque en
desarrollo no se envían correos. Los datos de demostración son ficticios. Para las pruebas:
`TEST_DATABASE_URL=postgresql://acopio:acopio@127.0.0.1:5432/acopio_test npm test`.

Antes de abrir un PR, desde la raíz:

```bash
npm run lint          # ESLint (API y web)
npm run format        # Prettier; `npm run format:check` solo comprueba
npm run typecheck     # TypeScript en las dos apps
npm test              # pruebas de la API contra PostgreSQL
```

## Versiones y publicaciones

- Los títulos de los PR siguen [Conventional Commits](https://www.conventionalcommits.org/es/) (`feat:`, `fix:`,
  `docs:`…) y se convierten en el mensaje del commit al fusionar con _squash_. La CI lo comprueba.
- [release-please](https://github.com/googleapis/release-please) mantiene un PR de publicación con el
  [CHANGELOG](https://github.com/demogar/acopiospanama/blob/main/CHANGELOG.md) y la versión ([SemVer](https://semver.org/lang/es/)). Al fusionarlo se crea la etiqueta
  `vX.Y.Z`, la publicación en GitHub y las imágenes `ghcr.io/demogar/acopiospanama-{api,web,backup}:vX.Y.Z`.
- Cada despliegue expone su versión en `/api/health` (`1.2.3+abc1234`).

## Documentación

- [Cómo funciona por dentro](docs/ARQUITECTURA.md): reglas automáticas, privacidad y seguridad.
- [Centros cargados desde fuentes públicas](data/centros/README.md): cómo se importan los anuncios de prensa y redes.
- [Despliegue y CI/CD](docs/DESPLIEGUE.md) · [Registro de cambios](https://github.com/demogar/acopiospanama/blob/main/CHANGELOG.md)
- [Seguridad](SECURITY.md) · [Código de conducta](CODE_OF_CONDUCT.md)
