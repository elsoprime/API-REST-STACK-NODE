# Estructura Repo Objetivo

```text
API-REST-STACK-NODE/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── vitest.config.ts
├── .env.example
├── .gitignore
├── openapi/
│   ├── openapi.yaml
│   ├── components/
│   │   ├── schemas/
│   │   ├── responses/
│   │   ├── parameters/
│   │   └── securitySchemes/
│   └── paths/
│       ├── health.yaml
│       ├── auth/
│       ├── platform/
│       ├── tenant/
│       └── modules/
├── src/
│   ├── app/
│   │   ├── index.ts
│   │   ├── server.ts
│   │   └── router.ts
│   ├── config/
│   │   ├── env.ts
│   │   └── app.ts
│   ├── constants/
│   ├── core/
│   │   ├── platform/
│   │   ├── tenant/
│   │   ├── security/
│   │   └── shared/
│   ├── modules/
│   │   ├── inventory/
│   │   ├── crm/
│   │   └── hr/
│   └── infrastructure/
│       ├── database/
│       ├── errors/
│       ├── logger/
│       ├── middleware/
│       ├── openapi/
│       └── security/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── support/
├── docker/
│   └── mongodb-replicaset/
└── docs/
    ├── PLAN_MAESTRO.md
    ├── arquitectura/
    ├── anexos/
    ├── adrs/
    ├── checklists/
    ├── cierres/
    └── stages/
```

## Reglas

- `openapi/` existe desde Etapa -1
- `tests/` existe desde Etapa -1
- `docker/` o equivalente de entorno reproducible existe desde Etapa -1
- `docs/DOCUMENTACION_COMPLETA_SAAS_V3.md` no es fuente de verdad; si se mantiene, es un artefacto derivado

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
