# API-REST-STACK-NODE

SaaS Core Engine V3 construido con Node.js + TypeScript + MongoDB para arquitectura multitenant shared schema.

## Estado

- Etapa 10 (HR): cerrada con pruebas y documentacion.
- Etapa 11 (hardening y go-live): cerrada con smoke suite, restore drill y runbook operativo.

## Stack

- Node.js 20+
- TypeScript strict
- Express
- MongoDB 7 replica set
- Mongoose 8
- Vitest
- ESLint
- OpenAPI (swagger-cli validate)

## Principios de arquitectura

- Multitenancy por `tenantId` en modelo shared schema.
- Rutas de negocio bajo `/api/v1/*`.
- Contrato tenant-scoped con header `X-Tenant-Id`.
- Auth browser-first con cookies HttpOnly + CSRF.
- Auth headless con Bearer access token.
- RBAC con roles de sistema y custom.
- Contrato de errores estandar:
  - `{ success: false, error: { code, message, details? }, traceId }`

## Requisitos locales

- Node.js 20 o superior
- npm
- Docker Desktop (para restore drill real con Mongo local)

## Inicio rapido

1. Instalar dependencias:

```bash
npm install
```

2. Crear archivo de entorno local desde plantilla:

```bash
cp .env.example .env.dev
```

En Windows PowerShell:

```powershell
Copy-Item .env.example .env.dev
```

3. Levantar API en desarrollo:

```bash
npm run dev
```

## Comandos clave

- Calidad y contrato:
  - `npm run build`
  - `npm run lint`
  - `npm run openapi:validate`
- Tests:
  - `npm run test`
  - `npm run test:unit`
  - `npm run test:integration`
  - `npm run test:e2e`
  - `npm run test:smoke`
  - `npm run test:restore`
- Go-live check:
  - `npm run go-live:check`

## Restore drill Mongo real (Etapa 11)

1. Levantar Mongo local:

```bash
npm run mongo:restore:up
```

2. Ejecutar drill real:

```bash
npm run test:restore:mongodb:enabled
```

3. Bajar entorno:

```bash
npm run mongo:restore:down
```

Guia operativa:
- [docs/operaciones/MONGO_LOCAL_RESTORE_DRILL.md](docs/operaciones/MONGO_LOCAL_RESTORE_DRILL.md)

## Documentacion principal

- [docs/PLAN_MAESTRO.md](docs/PLAN_MAESTRO.md)
- [docs/arquitectura/CONTRATOS_TRANSVERSALES.md](docs/arquitectura/CONTRATOS_TRANSVERSALES.md)
- [docs/checklists/CRITERIOS_DE_CIERRE.md](docs/checklists/CRITERIOS_DE_CIERRE.md)
- [docs/operaciones/RUNBOOK_GO_LIVE.md](docs/operaciones/RUNBOOK_GO_LIVE.md)
- [docs/cierres/ETAPA_11_CIERRE.md](docs/cierres/ETAPA_11_CIERRE.md)
- [docs/checklists/ETAPA_11_PR_CHECKLIST.md](docs/checklists/ETAPA_11_PR_CHECKLIST.md)

## CI/CD

- Validacion general: `.github/workflows/ci.yml`
- Go-live staging/release-candidate:
  - `.github/workflows/staging-release-candidate-go-live.yml`
