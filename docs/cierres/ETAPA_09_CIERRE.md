# Cierre Etapa 9

Fecha: 2026-03-08  
Estado: Cierre formal aprobado

## 1. Alcance previsto

La Etapa 9 incorpora `CRM` como modulo tenant-scoped sobre el core validado en Etapa 8.

Incluye:

- `contacts` con create/list/get/update/delete (soft delete)
- `organizations` con create/list/get/update/delete (soft delete + regla de in-use)
- `opportunities` con create/list/get/update/delete + cambio de etapa
- `activities` con create/list y validacion de referencias CRM
- `counters` desnormalizados por tenant con reconciliacion al leer
- deduplicacion de contactos y organizaciones via campos normalizados + indices unicos parciales
- enum operativo y transiciones controladas para `Opportunity.stage`
- auditoria tenant-scoped en mutaciones del modulo
- aislamiento tenant por `X-Tenant-Id` + `resolveTenantContext`

## 2. Evidencia de codigo

Archivos principales:

- [crm.types.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/src/modules/crm/types/crm.types.ts)
- [crm-contact.model.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/src/modules/crm/models/crm-contact.model.ts)
- [crm-organization.model.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/src/modules/crm/models/crm-organization.model.ts)
- [crm-opportunity.model.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/src/modules/crm/models/crm-opportunity.model.ts)
- [crm-activity.model.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/src/modules/crm/models/crm-activity.model.ts)
- [crm-counter.model.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/src/modules/crm/models/crm-counter.model.ts)
- [crm-dedup.service.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/src/modules/crm/services/crm-dedup.service.ts)
- [crm.service.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/src/modules/crm/services/crm.service.ts)
- [crm.controller.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/src/modules/crm/controllers/crm.controller.ts)
- [crm.routes.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/src/modules/crm/routes/crm.routes.ts)
- [modules.routes.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/src/modules/routes/modules.routes.ts)
- [system-rbac.catalog.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/src/core/platform/rbac/catalog/system-rbac.catalog.ts)
- [crm.yaml](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/openapi/components/schemas/crm.yaml)
- [openapi.yaml](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/openapi/openapi.yaml)

## 3. Evidencia automatizada

Comandos verificados:

- `npm run build`
- `npx vitest run tests/integration/crm tests/unit/modules/crm`

Cobertura funcional minima:

- contrato HTTP y guards RBAC del modulo: [crm.routes.test.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/tests/integration/crm/crm.routes.test.ts)
- aislamiento tenant ante mismatch de scope: [crm.isolation.test.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/tests/integration/crm/crm.isolation.test.ts)
- mapeo de errores estables y transicion de etapa: [crm.service.test.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/tests/unit/modules/crm/crm.service.test.ts)

## 4. Evidencia de contrato

- se publica `GET /api/v1/modules/crm/contacts`
- se publica `POST /api/v1/modules/crm/contacts`
- se publica `GET /api/v1/modules/crm/contacts/{contactId}`
- se publica `PATCH /api/v1/modules/crm/contacts/{contactId}`
- se publica `DELETE /api/v1/modules/crm/contacts/{contactId}`
- se publica `GET /api/v1/modules/crm/organizations`
- se publica `POST /api/v1/modules/crm/organizations`
- se publica `GET /api/v1/modules/crm/organizations/{organizationId}`
- se publica `PATCH /api/v1/modules/crm/organizations/{organizationId}`
- se publica `DELETE /api/v1/modules/crm/organizations/{organizationId}`
- se publica `GET /api/v1/modules/crm/opportunities`
- se publica `POST /api/v1/modules/crm/opportunities`
- se publica `GET /api/v1/modules/crm/opportunities/{opportunityId}`
- se publica `PATCH /api/v1/modules/crm/opportunities/{opportunityId}`
- se publica `DELETE /api/v1/modules/crm/opportunities/{opportunityId}`
- se publica `PATCH /api/v1/modules/crm/opportunities/{opportunityId}/stage`
- se publica `GET /api/v1/modules/crm/activities`
- se publica `POST /api/v1/modules/crm/activities`
- se publica `GET /api/v1/modules/crm/counters`
- todas las rutas requieren autenticacion valida y `X-Tenant-Id`
- mutaciones cookie-auth exponen `X-CSRF-Token` en contrato
- el acceso del modulo exige `tenant:modules:crm:use`
- respuestas exitosas usan `buildSuccess()` o `buildPaginatedSuccess()`
- errores usan el envelope global con codigos estables (`CRM_*`, `RBAC_*`, `GEN_*`)

## 5. Veredicto

La Etapa 9 queda formalmente cerrada.

## 6. Reapertura tecnica y re-cierre

Fecha: 2026-03-10  
Estado: Re-cierre tecnico aplicado

### 6.1 Motivo

Se detecto deuda tecnica contractual en hardening tenant-scoped y evidencia CSRF/OpenAPI de mutaciones CRM.

### 6.2 Fix realizado

- `crm.service` aplica fail-closed por mismatch entre `input.tenantId` y `context.tenant.tenantId` en mutaciones con `TENANT_SCOPE_MISMATCH` (`400`).
- se agrego cobertura unitaria para mismatch de tenant context en operaciones mutables CRM.
- se agrego cobertura de integracion CSRF para `POST /api/v1/modules/crm/contacts` en modo cookie-auth (caso rechazo y caso aceptado).
- OpenAPI CRM de mutaciones explicita la condicion de `X-CSRF-Token` para cookie-auth vs Bearer.

### 6.3 Evidencia automatizada del re-cierre

- `npm run docs:cierres:validate` ✅
- `npm run openapi:validate` ✅
- `npm run build` ✅
- `npm run lint` ✅
- `npm run test` ✅ (`98` archivos en verde, `1` skipped por feature flag de restore drill)
