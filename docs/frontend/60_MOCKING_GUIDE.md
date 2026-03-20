# Guia de Mocking Frontend

Version: 1.3.0
Estado: Activo
Ultima actualizacion: 2026-03-20

## 1. Proposito

Permitir desarrollo frontend desacoplado del backend mediante mocks consistentes con OpenAPI y contratos runtime.

## 2. Herramienta recomendada

- `msw` (Mock Service Worker)

Motivo:

- Intercepta requests reales en navegador y test runner.
- Facilita escenarios por dominio y por estado (success/error).

## 3. Regla de oro

- No mockear endpoints que no existen en `openapi/openapi.yaml`.

## 4. Estructura recomendada

```text
src/mocks/
  handlers/
    auth.handlers.ts
    tenant.handlers.ts
    settings.handlers.ts
    billing.handlers.ts
    audit.handlers.ts
    inventory.handlers.ts
    crm.handlers.ts
    hr.handlers.ts
  fixtures/
    users.fixture.ts
    tenants.fixture.ts
    billing.fixture.ts
    inventory.fixture.ts
    crm.fixture.ts
    hr.fixture.ts
  scenarios/
    auth.scenario.ts
    tenant.scenario.ts
    billing.scenario.ts
    inventory.scenario.ts
  browser.ts
  server.ts
```

## 5. Escenarios minimos obligatorios

### 5.1 Auth

- `POST /api/v1/auth/register`: `202` aceptado generico
- `POST /api/v1/auth/login/browser`: exito
- `POST /api/v1/auth/login/browser`: `AUTH_INVALID_CREDENTIALS`
- `POST /api/v1/auth/login/browser`: `AUTH_TWO_FACTOR_REQUIRED`
- `POST /api/v1/auth/resend-verification`: `202` aceptado generico
- `POST /api/v1/auth/forgot-password`: `202` aceptado generico
- `POST /api/v1/auth/reset-password`: exito
- `POST /api/v1/auth/reset-password`: `AUTH_PASSWORD_RESET_INVALID`
- `POST /api/v1/auth/change-password`: exito
- `POST /api/v1/auth/change-password`: `AUTH_PASSWORD_CHANGE_CURRENT_INVALID`
- `POST /api/v1/auth/change-password`: `AUTH_PASSWORD_CHANGE_REUSED`
- `POST /api/v1/auth/refresh/browser`: exito
- `POST /api/v1/auth/refresh/browser`: `AUTH_INVALID_REFRESH_TOKEN`
- `POST /api/v1/auth/logout`: exito

### 5.2 Tenant y Members

- Lista de tenants vacia y con multiples tenants
- Switch tenant exitoso (`/api/v1/tenant/switch`)
- Switch tenant con `TENANT_SCOPE_MISMATCH`
- `GET /api/v1/tenant/memberships`: listado paginado con filtros `search`, `roleKey`, `status`
- `PATCH /api/v1/tenant/memberships/{membershipId}`: exito y `TENANT_MEMBERSHIP_OWNER_PROTECTED`
- `DELETE /api/v1/tenant/memberships/{membershipId}`: exito y `TENANT_MEMBERSHIP_OWNER_PROTECTED`
- Crear invitacion exitoso y `TENANT_OWNER_REQUIRED`
- Aceptar invitacion por token (`/api/v1/tenant/invitations/accept`)
- Transferir ownership exitoso (`/api/v1/tenant/transfer-ownership`)

### 5.3 Platform Settings y Security

- `GET /api/v1/platform/settings`: singleton con `security` ampliado
- `PATCH /api/v1/platform/settings`: exito parcial sobre `security`
- `PATCH /api/v1/platform/settings`: error de validacion en `passwordPolicy` o `sessionPolicy`

### 5.4 Inventory

- Listado con paginacion
- Create/update/delete exitosos
- Conflicto de stock (`INV_STOCK_CONFLICT`)

### 5.5 CRM

- Lectura permitida
- Accion denegada por permiso (`RBAC_PERMISSION_DENIED`)
- Transicion de etapa invalida (`CRM_OPPORTUNITY_STAGE_TRANSITION_INVALID`)

### 5.6 HR

- Lectura empleados permitida
- Compensacion denegada (`RBAC_PERMISSION_DENIED`)
- Jerarquia ciclica (`HR_EMPLOYEE_HIERARCHY_CYCLE`)

### 5.7 Billing y Provisioning

- `GET /api/v1/billing/plans`: catalogo de planes.
- `POST /api/v1/billing/checkout/session`: exito (`201`) y error de validacion/permisos.
- `PATCH /api/v1/tenant/subscription`: asignacion/cambio de plan.
- `DELETE /api/v1/tenant/subscription`: cancelacion y limpieza de modulos.
- `POST /api/v1/billing/webhooks/provider`: webhook dev con firma valida sobre `${timestamp}.${rawBody}`, firma invalida y timestamp vencido.

## 6. Contrato de envelope en mocks

Exito:

```json
{
  "success": true,
  "data": {},
  "traceId": "mock-trace-id"
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "GEN_VALIDATION_ERROR",
    "message": "Validation error",
    "details": {
      "field": ["detail"]
    }
  },
  "traceId": "mock-trace-id"
}
```

## 7. Ejemplo de handlers MSW (Members)

```ts
import { http, HttpResponse } from 'msw';

export const tenantHandlers = [
  http.get('/api/v1/tenant/memberships', () => {
    return HttpResponse.json({
      success: true,
      data: {
        items: [
          {
            membershipId: 'membership_01',
            userId: 'user_01',
            fullName: 'Esteban Soto',
            email: 'esteban.soto@dev.cl',
            roleKey: 'tenant:owner',
            status: 'active',
            joinedAt: '2026-03-10T06:08:18.767Z',
            createdAt: '2026-03-10T06:08:18.767Z',
            isEffectiveOwner: true
          }
        ],
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1
      },
      traceId: 'mock-tenant-memberships-list'
    });
  }),

  http.patch('/api/v1/tenant/memberships/:membershipId', ({ params }) => {
    if (params.membershipId === 'membership_owner') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'TENANT_MEMBERSHIP_OWNER_PROTECTED',
            message: 'Effective owner membership cannot be modified'
          },
          traceId: 'mock-tenant-memberships-owner-protected'
        },
        { status: 409 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: {
        membershipId: String(params.membershipId),
        updated: true
      },
      traceId: 'mock-tenant-memberships-update'
    });
  })
];
```

## 8. Sincronizacion con OpenAPI

Checklist por PR backend:

1. Detectar cambios en `openapi/paths/*` y `openapi/components/*`.
2. Actualizar handlers impactados.
3. Agregar o ajustar fixtures de dominio.
4. Ajustar tests frontend que dependan de esos escenarios.

## 9. Buenas practicas

- Mantener fixtures por tenant y por rol.
- Evitar random no deterministico en tests.
- Incluir `traceId` fijo por escenario para trazabilidad en logs.
- Usar escenarios reutilizables en vez de handlers duplicados.
- Para rutas token-bound (`tenant/switch`, `invitations/accept`), no forzar `X-Tenant-Id` en mocks.
- Para `platform/settings`, mantener un singleton consistente entre `/app/settings/platform` y `/app/settings/security`.
