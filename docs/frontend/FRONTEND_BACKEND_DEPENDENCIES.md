# Dependencias Frontend del Backend

Version: 1.0.0  
Estado: Activo  
Ultima actualizacion: 2026-03-08

## 1. Proposito

Centralizar bloqueos de frontend que requieren contrato o implementacion backend, evitando supuestos y retrabajo.

## 2. Reglas

- Toda dependencia debe mapearse a endpoint OpenAPI faltante o capacidad runtime faltante.
- No se habilita desarrollo especulativo de API en frontend.
- Cada dependencia debe tener estado y responsable backend.

## 3. Backlog de dependencias

| ID | Dependencia | Estado | Impacto frontend | Prioridad | Contrato esperado |
|---|---|---|---|---|---|
| BE-FE-001 | Forgot password | Abierta | Bloquea flujo de recuperacion de cuenta | Alta | `POST /api/v1/auth/forgot-password` |
| BE-FE-002 | Reset password | Abierta | Bloquea cierre del flujo de recuperacion | Alta | `POST /api/v1/auth/reset-password` |
| BE-FE-003 | Memberships list/update/remove | Abierta | Bloquea pantalla completa de gestion de miembros | Alta | `GET/PATCH/DELETE /api/v1/tenant/memberships*` |
| BE-FE-004 | Gestion publica de roles/permisos | Abierta | Bloquea UI de administracion RBAC avanzada | Media | Endpoints tenant-scoped de roles/permissions |
| BE-FE-005 | Endpoint docs OpenAPI runtime | Abierta | Dificulta exploracion manual para QA/Front | Baja | `/api/v1/docs` o equivalente |
| BE-FE-006 | Auditoria platform expuesta | Abierta | Bloquea vista de auditoria platform-scoped | Media | Ruta montada y documentada para platform audit |

## 4. Detalle por dependencia

### 4.1 BE-FE-001 Forgot password

- Necesidad UX: iniciar recuperacion con email.
- Entregable backend minimo:
  - endpoint OpenAPI documentado
  - envelope estandar de exito/error
  - rate limiting y codigos de error de dominio

### 4.2 BE-FE-002 Reset password

- Necesidad UX: aplicar nueva password con token.
- Entregable backend minimo:
  - endpoint OpenAPI documentado
  - validacion token expirado/invalido
  - codigos de error estables para UX

### 4.3 BE-FE-003 Memberships CRUD

- Necesidad UX: listar miembros, cambiar rol, remover miembro.
- Entregable backend minimo:
  - endpoints tenant-scoped con `X-Tenant-Id`
  - reglas RBAC explicitas
  - payload paginado para listados

### 4.4 BE-FE-004 Roles/permissions management

- Necesidad UX: administracion RBAC avanzada para tenants.
- Entregable backend minimo:
  - endpoints de consulta y mutacion para roles/permisos custom
  - guardas por permiso administrativo
  - contratos OpenAPI completos

### 4.5 BE-FE-005 OpenAPI runtime docs

- Necesidad UX/QA: exploracion interactiva en ambientes integrados.
- Entregable backend minimo:
  - endpoint de documentacion runtime o guia oficial equivalente

### 4.6 BE-FE-006 Platform audit endpoint

- Necesidad UX: auditoria platform-scoped.
- Situacion actual:
  - ruta existe en codigo (`platform-audit.routes`) pero no montada/documentada para consumo frontend.
- Entregable backend minimo:
  - ruta montada en router raiz
  - referencia OpenAPI
  - permisos platform documentados

## 5. Flujo de cierre de dependencia

1. Backend publica contrato en OpenAPI.
2. Backend implementa runtime y tests.
3. Frontend actualiza:
   - `FRONTEND_INTEGRATION_PLAN_V1.md`
   - `FRONTEND_ACCESS_MATRIX.md`
   - `FRONTEND_E2E_CRITICAL_FLOWS.md` (si aplica)
4. Dependencia cambia a estado cerrada con evidencia de PR.
