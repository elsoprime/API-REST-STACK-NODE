# Smoke Suite Staging (Etapa 11)

## 1. Objetivo

Validar en staging los flujos minimos de go-live definidos para el piloto:

- health
- auth completo
- tenant create/invite/accept
- tenant settings basicos
- inventory create/move/check
- audit log en flujos criticos
- aislamiento cross-tenant

## 2. Ejecucion

```bash
npm run test:smoke
```

## 3. Cobertura de suites

- `tests/e2e/go-live/smoke.staging.test.ts`
- `tests/integration/health.test.ts`
- `tests/integration/go-live/production-readiness-guards.test.ts`
- `tests/integration/auth/auth.routes.test.ts`
- `tests/integration/tenant/tenant.routes.test.ts`
- `tests/integration/tenant/invitations.routes.test.ts`
- `tests/integration/tenant-settings/tenant-settings.routes.test.ts`
- `tests/integration/inventory/inventory.routes.test.ts`
- `tests/integration/inventory/inventory.stock-history.test.ts`
- `tests/integration/audit/audit.routes.test.ts`
- `tests/integration/tenant/tenant-isolation.test.ts`

## 4. Criterio de aprobacion

- todas las suites anteriores en verde
- sin respuestas `404` en rutas criticas del release
- contratos de auth/tenant/audit vigentes
- evidencia registrada en `docs/cierres/ETAPA_11_CIERRE.md`

## 5. Alcance por release

- piloto minimo: hasta Inventory
- si CRM/HR van en release: agregar sus suites de integracion en el mismo smoke batch
