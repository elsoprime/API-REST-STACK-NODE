# Estructura Repo Objetivo

```text
API-REST-STACK-NODE/
â”œâ”€â”€ package.json
â”œâ”€â”€ tsconfig.json
â”œâ”€â”€ tsconfig.build.json
â”œâ”€â”€ vitest.config.ts
â”œâ”€â”€ .env.example
â”œâ”€â”€ .gitignore
â”œâ”€â”€ openapi/
â”‚   â”œâ”€â”€ openapi.yaml
â”‚   â”œâ”€â”€ components/
â”‚   â”‚   â”œâ”€â”€ schemas/
â”‚   â”‚   â”œâ”€â”€ responses/
â”‚   â”‚   â”œâ”€â”€ parameters/
â”‚   â”‚   â””â”€â”€ securitySchemes/
â”‚   â””â”€â”€ paths/
â”‚       â”œâ”€â”€ health.yaml
â”‚       â”œâ”€â”€ auth/
â”‚       â”œâ”€â”€ platform/
â”‚       â”œâ”€â”€ tenant/
â”‚       â””â”€â”€ modules/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ app/
â”‚   â”‚   â”œâ”€â”€ index.ts
â”‚   â”‚   â”œâ”€â”€ server.ts
â”‚   â”‚   â””â”€â”€ router.ts
â”‚   â”œâ”€â”€ config/
â”‚   â”‚   â”œâ”€â”€ env.ts
â”‚   â”‚   â””â”€â”€ app.ts
â”‚   â”œâ”€â”€ constants/
â”‚   â”œâ”€â”€ core/
â”‚   â”‚   â”œâ”€â”€ platform/
â”‚   â”‚   â”œâ”€â”€ tenant/
â”‚   â”‚   â”œâ”€â”€ security/
â”‚   â”‚   â””â”€â”€ shared/
â”‚   â”œâ”€â”€ modules/
â”‚   â”‚   â”œâ”€â”€ inventory/
â”‚   â”‚   â”œâ”€â”€ crm/
â”‚   â”‚   â””â”€â”€ hr/
â”‚   â””â”€â”€ infrastructure/
â”‚       â”œâ”€â”€ database/
â”‚       â”œâ”€â”€ errors/
â”‚       â”œâ”€â”€ logger/
â”‚       â”œâ”€â”€ middleware/
â”‚       â”œâ”€â”€ openapi/
â”‚       â””â”€â”€ security/
â”œâ”€â”€ tests/
â”‚   â”œâ”€â”€ unit/
â”‚   â”œâ”€â”€ integration/
â”‚   â”œâ”€â”€ e2e/
â”‚   â””â”€â”€ support/
â”œâ”€â”€ docker/
â”‚   â””â”€â”€ mongodb-replicaset/
â””â”€â”€ docs/
    â”œâ”€â”€ PLAN_MAESTRO.md
    â”œâ”€â”€ arquitectura/
    â”œâ”€â”€ anexos/
    â”œâ”€â”€ adrs/
    â”œâ”€â”€ checklists/
    â”œâ”€â”€ cierres/
    â””â”€â”€ stages/
```

## Reglas

- `openapi/` existe desde Etapa -1
- `tests/` existe desde Etapa -1
- `docker/` o equivalente de entorno reproducible existe desde Etapa -1
- `docs/_deprecated/DOCUMENTACION_COMPLETA_SAAS_V3.md` no es fuente de verdad; se mantiene solo como artefacto derivado

## Responsabilidades

- `src/core`: capacidades base del motor SaaS
- `src/modules`: modulos de negocio
- `src/infrastructure`: adaptadores tecnicos
- `tests/support`: factories, seeds, helpers, bootstraps

## Estructura OpenAPI

- `health.yaml` documenta solo `/health`
- `paths/auth/*` documenta `/api/v1/auth/*`
- `paths/platform/*` documenta `/api/v1/platform/*`
- `paths/tenant/*` documenta `/api/v1/tenant/*`
- `paths/modules/*` documenta modulos tenant-scoped

