# Dependencias Frontend del Backend

Version: 1.5.0
Estado: Activo
Ultima actualizacion: 2026-03-20

## 1. Proposito

Centralizar bloqueos reales de frontend que dependen de contrato o runtime backend, evitando supuestos y retrabajo.

## 2. Reglas

- Toda dependencia abierta debe mapearse a contrato OpenAPI faltante o capacidad runtime faltante.
- No se habilita desarrollo especulativo de API en frontend.
- Si la API ya existe en OpenAPI y runtime, no debe seguir como bloqueo backend.

## 3. Backlog de dependencias (vigentes)

| ID | Dependencia | Estado | Impacto frontend | Prioridad | Contrato esperado |
|---|---|---|---|---|---|
| BE-FE-004 | Gestion publica de roles/permisos | Abierta | Bloquea UI de administracion RBAC avanzada | Media | Endpoints tenant-scoped de roles/permissions |
| BE-FE-005 | Endpoint docs OpenAPI runtime | Abierta | Dificulta exploracion manual para QA/Front | Baja | `/api/v1/docs` o equivalente |
| BE-FE-006 | Auditoria platform expuesta | Abierta | Bloquea vista de auditoria platform-scoped | Media | Ruta montada + OpenAPI para platform audit |

## 4. Dependencias cerradas (backend disponible)

| ID | Dependencia | Estado | Evidencia backend |
|---|---|---|---|
| BE-FE-001 | Forgot password | Cerrada (backend disponible) | `POST /api/v1/auth/forgot-password` en OpenAPI |
| BE-FE-002 | Reset password | Cerrada (backend disponible) | `POST /api/v1/auth/reset-password` en OpenAPI |
| BE-FE-003 | Memberships list/update/remove | Cerrada (backend disponible) | `GET/PATCH/DELETE /api/v1/tenant/memberships*` en OpenAPI/runtime con tests |
| BE-FE-007 | Change password autenticado | Cerrada (backend disponible) | `POST /api/v1/auth/change-password` en OpenAPI/runtime |
| BE-FE-008 | Tenant settings effective bootstrap de platform settings | Cerrada (backend disponible) | Bootstrap explicito en startup + `GET /api/v1/tenant/settings/effective` estable en runtime |
| BE-FE-009 | Billing plans catalog | Cerrada (backend disponible) | `GET /api/v1/billing/plans` en OpenAPI/runtime |
| BE-FE-010 | Checkout session tenant-scoped | Cerrada (backend disponible) | `POST /api/v1/billing/checkout/session` en OpenAPI/runtime |
| BE-FE-011 | Billing webhook provider | Cerrada (backend disponible) | `POST /api/v1/billing/webhooks/provider` en OpenAPI/runtime |
| BE-FE-012 | Tenant subscription assign/cancel | Cerrada (backend disponible) | `PATCH/DELETE /api/v1/tenant/subscription` en OpenAPI/runtime |
| BE-FE-013 | Platform settings security ampliado | Cerrada (backend disponible) | `GET/PATCH /api/v1/platform/settings` expone `security` ampliado con validaciones y tests |

## 5. Detalle de vigentes

### 5.1 BE-FE-004 Roles/permissions management

- Necesidad UX: administracion RBAC avanzada para tenants.
- Entregable backend minimo:
  - endpoints de consulta y mutacion para roles/permisos custom
  - guardas por permiso administrativo
  - contratos OpenAPI completos

### 5.2 BE-FE-005 OpenAPI runtime docs

- Necesidad UX/QA: exploracion interactiva en ambientes integrados.
- Entregable backend minimo:
  - endpoint de documentacion runtime o guia oficial equivalente de acceso rapido

### 5.3 BE-FE-006 Platform audit endpoint

- Necesidad UX: auditoria platform-scoped para usuarios internos con permisos globales, separada de la auditoria tenant-scoped actual.
- Usuarios objetivo:
  - `platform admin`
  - operador interno o rol equivalente con `platform:audit:read`
- Situacion actual:
  - existe ruta tenant audit publica (`GET /api/v1/audit`)
  - no existe exposicion formal de auditoria platform en router principal/OpenAPI
- Contrato minimo recomendado para destrabar FE y QA:
  - `GET /api/v1/platform/audit`
  - filtros basicos: `page`, `limit`, `action` o `eventKey`, `actorUserId`, `from`, `to`
  - respuesta paginada consistente: `items`, `page`, `limit`, `total`, `totalPages`
  - item minimo util para tabla: `auditId`, `occurredAt`, `actorUserId`, `actorEmail` o `actorDisplayName`, `action`, `targetType`, `targetId`, `status`, `traceId` cuando aplique
- Entregable backend minimo:
  - ruta montada en router raiz
  - referencia OpenAPI
  - permisos platform documentados
- Resultado esperado en frontend:
  - vista platform-scoped con tabla, filtros, paginacion y estados `401/403/empty/error`
  - sin mezclar datos tenant con eventos globales del sistema
- Evolucion posterior no incluida en este minimo:
  - detalle por evento
  - metadata enriquecida, `before/after`, exportacion o correlacion avanzada

## 6. Dependencias cerradas recientemente

### 6.1 BE-FE-003 Memberships CRUD

Backend ya entrega:

- `GET /api/v1/tenant/memberships`
- `PATCH /api/v1/tenant/memberships/{membershipId}`
- `DELETE /api/v1/tenant/memberships/{membershipId}`
- reglas RBAC explicitas (`tenant:memberships:read/update/delete`)
- payload paginado para listados y proteccion del owner efectivo

### 6.2 BE-FE-013 Platform settings security ampliado

Backend ya entrega en `platform/settings.security`:

- `requireTwoFactorForPrivilegedUsers`
- `passwordPolicy`
- `sessionPolicy`
- `riskControls`
- compatibilidad con `PATCH` parcial

## 7. Flujo de cierre de dependencia

1. Backend publica contrato OpenAPI.
2. Backend implementa runtime y tests.
3. Frontend actualiza:
   - `10_IMPLEMENTATION_GUIDE_V2.md`
   - `20_ACCESS_MATRIX.md`
   - `70_E2E_CRITICAL_FLOWS.md` (si aplica)
4. Dependencia pasa a cerrada con evidencia de PR.
