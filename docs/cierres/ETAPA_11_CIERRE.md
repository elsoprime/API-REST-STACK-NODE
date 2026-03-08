# Cierre Etapa 11

Fecha: 2026-03-08  
Estado: Cerrada (hardening y go-live readiness)

## 1. Alcance previsto

La Etapa 11 consolida hardening operativo y readiness de go-live sobre el core SaaS:

- preflight de readiness para `production`
- health operativo con senal de readiness global
- smoke suite de staging para rutas y flujos criticos
- restore drill automatizado minimo
- runbook de go-live agnostico a infraestructura

## 2. Evidencia de codigo

- [runtime.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/src/app/runtime.ts)
- [health.routes.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/src/core/shared/routes/health.routes.ts)
- [env.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/src/config/env.ts)
- [go-live-readiness.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/src/infrastructure/operations/go-live-readiness.ts)
- [auth-delivery.registry.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/src/infrastructure/security/auth-delivery.registry.ts)
- [tenant-invitation.registry.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/src/infrastructure/tenant/tenant-invitation.registry.ts)
- [webhook-delivery.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/src/infrastructure/security/webhook-delivery.ts)
- [restore.mongodb-drill.test.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/tests/integration/go-live/restore.mongodb-drill.test.ts)
- [package.json](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/package.json)

## 3. Evidencia automatizada

Suites agregadas:

- [smoke.staging.test.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/tests/e2e/go-live/smoke.staging.test.ts)
- [restore.drill.test.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/tests/e2e/go-live/restore.drill.test.ts)
- [go-live-readiness.test.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/tests/unit/infrastructure/operations/go-live-readiness.test.ts)
- [webhook-delivery.test.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/tests/unit/infrastructure/security/webhook-delivery.test.ts)
- [auth-delivery.registry.test.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/tests/unit/infrastructure/security/auth-delivery.registry.test.ts)
- [tenant-invitation.registry.test.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/tests/unit/infrastructure/tenant/tenant-invitation.registry.test.ts)
- [production-readiness-guards.test.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/tests/integration/go-live/production-readiness-guards.test.ts)
- [restore.mongodb-drill.test.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/tests/integration/go-live/restore.mongodb-drill.test.ts)

Comandos contractuales de etapa:

- `npm run build`
- `npm run lint`
- `npm run openapi:validate`
- `npm run test`
- `npm run test:smoke`
- `npm run test:restore`
- `ENABLE_MONGODB_RESTORE_DRILL=true npm run test:restore:mongodb`
- `npm run go-live:check`

## 4. Evidencia de contrato

- `/health` mantiene `status`, `timestamp`, `version`, `db`, `traceId` y agrega readiness operativo:
  - `ready`
  - `checks.database`
  - `checks.productionDeliveryAdapters`
- en `production` la readiness exige configuracion real de delivery aunque el flag legacy este desactivado
- OpenAPI actualizado para health en:
  - [success.yaml](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/openapi/components/schemas/success.yaml)
  - [health.yaml](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/openapi/paths/health.yaml)

## 5. Evidencia operacional

- runbook publicado: [RUNBOOK_GO_LIVE.md](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/docs/operaciones/RUNBOOK_GO_LIVE.md)
- smoke suite staging publicada: [SMOKE_SUITE_STAGING.md](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/docs/operaciones/SMOKE_SUITE_STAGING.md)
- guia local del drill Mongo: [MONGO_LOCAL_RESTORE_DRILL.md](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/docs/operaciones/MONGO_LOCAL_RESTORE_DRILL.md)

### 5.1 Evidencia real del restore drill Mongo

Ejecuciones reales reportadas en local el 2026-03-08:

1. `npm run mongo:restore:up` -> contenedores `mongo-restore` y `mongo-restore-init-replica` en estado saludable/creado.
2. `npm run test:restore:mongodb:enabled` a las 17:32 -> falla por diferencia en `_id` al comparar artifact vs restaurado.
3. Ajuste aplicado en [restore.mongodb-drill.test.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/tests/integration/go-live/restore.mongodb-drill.test.ts): clonado de registros antes de `insertMany` durante restore.
4. `npm run test:restore:mongodb:enabled` a las 17:34 -> `1 passed (1)` en verde.

### 5.2 Evidencia release candidate en GitHub Actions

Gate remoto ejecutado el 2026-03-08 sobre branch `release-candidate/etapa-11`:

- workflow: `staging-release-candidate-go-live`
- run: `https://github.com/elsoprime/API-REST-STACK-NODE/actions/runs/22830132265`
- job: `smoke-and-restore`
- resultado: `failure` por causa externa de cuenta
- mensaje oficial de anotacion: `The job was not started because your account is locked due to a billing issue.`

Detalle consolidado en:

- [ETAPA_11_EVIDENCIA_RELEASE.md](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/docs/cierres/ETAPA_11_EVIDENCIA_RELEASE.md)
- [ETAPA_11_GO_NO_GO.md](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/docs/checklists/ETAPA_11_GO_NO_GO.md)

## 6. Veredicto

Etapa 11 queda cerrada a nivel de hardening y readiness con evidencia automatizada y operativa.

La salida efectiva a produccion requiere ejecutar el runbook sobre infraestructura real, mantener `production` con adaptadores de delivery configurados y desbloquear el gate remoto de GitHub Actions para pasar a `GO`.
