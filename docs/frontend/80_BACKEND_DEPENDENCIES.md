# Dependencias Frontend del Backend

Version: 1.2.0
Estado: Activo
Ultima actualizacion: 2026-03-10

## 1. Proposito

Centralizar bloqueos reales de frontend que dependen de contrato o runtime backend, evitando supuestos y retrabajo.

## 2. Reglas

- Toda dependencia abierta debe mapearse a contrato OpenAPI faltante o capacidad runtime faltante.
- No se habilita desarrollo especulativo de API en frontend.
- Si la API ya existe en OpenAPI y runtime, no debe seguir como bloqueo backend.

## 3. Backlog de dependencias (vigentes)

| ID | Dependencia | Estado | Impacto frontend | Prioridad | Contrato esperado |
|---|---|---|---|---|---|
| BE-FE-003 | Memberships list/update/remove | Abierta | Bloquea pantalla de gestion de miembros | Alta | `GET/PATCH/DELETE /api/v1/tenant/memberships*` |
| BE-FE-004 | Gestion publica de roles/permisos | Abierta | Bloquea UI de administracion RBAC avanzada | Media | Endpoints tenant-scoped de roles/permissions |
| BE-FE-005 | Endpoint docs OpenAPI runtime | Abierta | Dificulta exploracion manual para QA/Front | Baja | `/api/v1/docs` o equivalente |
| BE-FE-006 | Auditoria platform expuesta | Abierta | Bloquea vista de auditoria platform-scoped | Media | Ruta montada + OpenAPI para platform audit |

## 4. Dependencias cerradas (backend disponible)

| ID | Dependencia | Estado | Evidencia backend |
|---|---|---|---|
| BE-FE-001 | Forgot password | Cerrada (backend disponible) | `POST /api/v1/auth/forgot-password` en OpenAPI |
| BE-FE-002 | Reset password | Cerrada (backend disponible) | `POST /api/v1/auth/reset-password` en OpenAPI |
| BE-FE-007 | Change password autenticado | Cerrada (backend disponible) | `POST /api/v1/auth/change-password` en OpenAPI/runtime |

## 5. Detalle de vigentes

### 5.1 BE-FE-003 Memberships CRUD

- Necesidad UX: listar miembros, cambiar rol, remover miembro.
- Entregable backend minimo:
  - endpoints tenant-scoped con `X-Tenant-Id`
  - reglas RBAC explicitas
  - payload paginado para listados

### 5.2 BE-FE-004 Roles/permissions management

- Necesidad UX: administracion RBAC avanzada para tenants.
- Entregable backend minimo:
  - endpoints de consulta y mutacion para roles/permisos custom
  - guardas por permiso administrativo
  - contratos OpenAPI completos

### 5.3 BE-FE-005 OpenAPI runtime docs

- Necesidad UX/QA: exploracion interactiva en ambientes integrados.
- Entregable backend minimo:
  - endpoint de documentacion runtime o guia oficial equivalente de acceso rapido

### 5.4 BE-FE-006 Platform audit endpoint

- Necesidad UX: auditoria platform-scoped.
- Situacion actual:
  - existe ruta tenant audit publica (`GET /api/v1/audit`)
  - no existe exposicion formal de auditoria platform en router principal/OpenAPI
- Entregable backend minimo:
  - ruta montada en router raiz
  - referencia OpenAPI
  - permisos platform documentados

## 6. Flujo de cierre de dependencia

1. Backend publica contrato OpenAPI.
2. Backend implementa runtime y tests.
3. Frontend actualiza:
   - `10_IMPLEMENTATION_GUIDE_V2.md`
   - `20_ACCESS_MATRIX.md`
   - `70_E2E_CRITICAL_FLOWS.md` (si aplica)
4. Dependencia pasa a cerrada con evidencia de PR.

