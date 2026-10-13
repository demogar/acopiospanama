<div align="center">

<a href="https://acopiospanama.com"><img src="docs/assets/logo.svg" alt="" width="88" height="88"></a>

# Acopios Panamá

**Dónde llevar donaciones y qué necesitan hoy.**

Directorio nacional y abierto de centros de acopio, puntos de distribución, comedores y albergues en Panamá,
creado por la comunidad tras el terremoto del 9 de octubre de 2026.

[**acopiospanama.com**](https://acopiospanama.com) ·
[Cómo funciona](https://acopiospanama.com/como-funciona) ·
[Contribuir](CONTRIBUTING.md) ·
[Registro de cambios](https://github.com/demogar/acopiospanama/blob/main/CHANGELOG.md)

[![CI/CD](https://github.com/demogar/acopiospanama/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/demogar/acopiospanama/actions/workflows/ci-cd.yml)
[![CodeQL](https://github.com/demogar/acopiospanama/actions/workflows/codeql.yml/badge.svg)](https://github.com/demogar/acopiospanama/actions/workflows/codeql.yml)
[![Última versión](https://img.shields.io/github/v/release/demogar/acopiospanama?label=versi%C3%B3n&color=c8102e)](https://github.com/demogar/acopiospanama/releases)
[![Licencia MIT](https://img.shields.io/badge/licencia-MIT-14161a.svg)](LICENSE)
[![Datos CC BY 4.0](https://img.shields.io/badge/datos-CC%20BY%204.0-14161a.svg)](https://creativecommons.org/licenses/by/4.0/deed.es)

</div>

> [!IMPORTANT]
> Si hay una emergencia, llama al **911**. Este directorio no reemplaza a SINAPROC ni a las autoridades.

> [!TIP]
> **Helping from abroad?** You can donate online to the
> [Panamanian Red Cross](https://cruzroja.org.pa/donar/).

<p align="center">
  <a href="https://acopiospanama.com"><img src="docs/assets/captura.png" alt="Portada de Acopios Panamá: filtros por provincia, lista de centros con lo que necesitan y mapa con los centros urgentes resaltados" width="900"></a>
</p>

## Qué hace

Cada ficha dice **qué tipo de centro es, quién lo organiza, dónde está** (con botones de Google Maps y Waze),
**cuándo abre** (horario por día, «abierto ahora» y fechas si es temporal), cómo contactar (solo si esa persona
lo acepta) y **qué aceptan, qué es urgente y qué ya no reciben**.

El directorio se puede filtrar por provincia, tipo de lugar, texto, «abierto ahora» y cercanía, en lista o en
mapa. Está pensado para teléfonos con mala señal: carga poco, el mapa es opcional y todo funciona sin él.

## Cómo se mantiene

Lo mantiene la comunidad, con reglas automáticas en lugar de moderadores pendientes:

| Quién             | Qué puede hacer                                                                  |
| ----------------- | -------------------------------------------------------------------------------- |
| Cualquier persona | **Publicar un centro** con su correo (sin contraseñas) y quedar como responsable |
| Quien visita      | **Confirmar** «estuve aquí y sigue funcionando» o **reportar** un problema       |
| Las reglas        | Decidir qué se muestra, sin que nadie tenga que estar pendiente                  |
| Moderación humana | Solo el último recurso                                                           |

- Lo publicado se da por bueno: un centro sigue en la lista hasta que lo cierren o lo reporten.
- Con reportes de 2 personas se marca «verifica antes de ir».
- Con 3 reportes graves (que pide dinero, que es falso, que las donaciones no llegan a los afectados o que
  cerró) se oculta, salvo que lo confirmen más personas de las que lo reportan.
- Las fichas **no pueden pedir dinero**: se bloquea al guardar.

La web recuerda en la portada, en cada ficha y en «Cómo funciona» que hay gente aprovechándose de la emergencia:
usa canales verificados, entrega en mano, nunca dinero, y reporta lo que no cuadre.

## Stack

| Parte            | Tecnología                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| API (`apps/api`) | NestJS 11, Kysely + PostgreSQL 16, migraciones SQL, `otplib`, `nodemailer`                                                     |
| Web (`apps/web`) | Next.js 16 (App Router), React 19, Tailwind v4, [`@demogar/mola-ui`](https://demogar.github.io/molaui/), Leaflet + Stadia Maps |
| Infra            | Docker, GitHub Actions → GHCR → VPS (Docker Compose + Caddy), respaldos cifrados con `age`                                     |

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
desarrollo no se envían correos. Los datos de demostración son ficticios.

### Antes de abrir un PR

```bash
npm run lint          # ESLint (API y web)
npm run format        # Prettier; `npm run format:check` solo comprueba
npm run typecheck     # TypeScript en las dos apps
npm test              # pruebas de la API contra PostgreSQL
```

Las pruebas usan su propia base: `TEST_DATABASE_URL=postgresql://acopio:acopio@127.0.0.1:5432/acopio_test npm test`.

## Versiones y publicaciones

- Los títulos de los PR siguen [Conventional Commits](https://www.conventionalcommits.org/es/) (`feat:`, `fix:`,
  `docs:`…) y se convierten en el mensaje del commit al fusionar con _squash_. La CI lo comprueba.
- [release-please](https://github.com/googleapis/release-please) mantiene un PR de publicación con el
  [CHANGELOG](https://github.com/demogar/acopiospanama/blob/main/CHANGELOG.md) y la versión
  ([SemVer](https://semver.org/lang/es/)). Al fusionarlo se crea la etiqueta `vX.Y.Z`, la publicación en GitHub
  y las imágenes `ghcr.io/demogar/acopiospanama-{api,web,backup}:vX.Y.Z`.
- Cada despliegue expone su versión en `/api/health` (`1.2.3+abc1234`).

## Documentación

| Documento                                             | Contenido                                           |
| ----------------------------------------------------- | --------------------------------------------------- |
| [Arquitectura](docs/ARQUITECTURA.md)                  | Reglas automáticas, privacidad y seguridad          |
| [Centros de fuentes públicas](data/centros/README.md) | Cómo se importan los anuncios de prensa y redes     |
| [Despliegue y CI/CD](docs/DESPLIEGUE.md)              | Servidor, variables, respaldos y proveedor del mapa |
| [Seguridad](SECURITY.md)                              | Cómo reportar una vulnerabilidad                    |
| [Código de conducta](CODE_OF_CONDUCT.md)              | Cómo nos tratamos                                   |

## Contribuir

Es código abierto y construido en público. Cualquier ayuda suma: código, diseño, textos, pruebas en teléfonos
reales y difusión. Lee [CONTRIBUTING.md](CONTRIBUTING.md). Cada PR corre la CI completa, y al fusionarse en
`main` se despliega solo.

## Licencia

El código está bajo licencia [MIT](LICENSE). Los datos del directorio son abiertos bajo
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.es).

<sub>Iniciativa comunitaria e independiente. No es un sitio del Gobierno ni del SINAPROC: la información la
publican y confirman las propias personas y organizaciones.</sub>
