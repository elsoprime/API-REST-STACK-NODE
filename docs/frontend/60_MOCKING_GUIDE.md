# Guia de Mocking Frontend

Version: 1.1.0
Estado: Activo
Ultima actualizacion: 2026-03-10

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
    audit.handlers.ts
    inventory.handlers.ts
    crm.handlers.ts
    hr.handlers.ts
  fixtures/
    users.fixture.ts
    tenants.fixture.ts
    inventory.fixture.ts
    crm.fixture.ts
    hr.fixture.ts
  scenarios/
    auth.scenario.ts
    tenant.scenario.ts
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

### 5.2 Tenant

- Lista de tenants vacia y con multiples tenants
- Switch tenant exitoso (`/api/v1/tenant/switch`)
- Switch tenant con `TENANT_SCOPE_MISMATCH`
- Crear invitacion exitoso y `TENANT_OWNER_REQUIRED`
- Aceptar invitacion por token (`/api/v1/tenant/invitations/accept`)

### 5.3 Inventory

- Listado con paginacion
- Create/update/delete exitosos
- Conflicto de stock (`INV_STOCK_CONFLICT`)

### 5.4 CRM

- Lectura permitida
- Accion denegada por permiso (`RBAC_PERMISSION_DENIED`)
- Transicion de etapa invalida (`CRM_OPPORTUNITY_STAGE_TRANSITION_INVALID`)

### 5.5 HR

- Lectura empleados permitida
- Compensacion denegada (`RBAC_PERMISSION_DENIED`)
- Jerarquia ciclica (`HR_EMPLOYEE_HIERARCHY_CYCLE`)

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

## 7. Ejemplo de handlers MSW (Auth)

```ts
import { http, HttpResponse } from 'msw';

export const authHandlers = [
  http.post('/api/v1/auth/forgot-password', async () => {
    return HttpResponse.json(
      {
        success: true,
        data: { accepted: true },
        traceId: 'mock-auth-forgot-password-accepted'
      },
      { status: 202 }
    );
  }),

  http.post('/api/v1/auth/reset-password', async ({ request }) => {
    const body = (await request.json()) as { token?: string };

    if (body.token === 'invalid-token') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'AUTH_PASSWORD_RESET_INVALID',
            message: 'Invalid password reset token'
          },
          traceId: 'mock-auth-reset-password-invalid'
        },
        { status: 400 }
      );
    }

    return HttpResponse.json(
      {
        success: true,
        data: {
          reset: true,
          revokedSessionIds: ['65f0000000000000000000aa']
        },
        traceId: 'mock-auth-reset-password-ok'
      },
      { status: 200 }
    );
  }),

  http.post('/api/v1/auth/change-password', async ({ request }) => {
    const body = (await request.json()) as { currentPassword?: string; newPassword?: string };

    if (body.currentPassword !== 'current-password') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'AUTH_PASSWORD_CHANGE_CURRENT_INVALID',
            message: 'Current password is invalid'
          },
          traceId: 'mock-auth-change-password-current-invalid'
        },
        { status: 401 }
      );
    }

    if (body.newPassword === 'current-password') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'AUTH_PASSWORD_CHANGE_REUSED',
            message: 'New password must be different from current password'
          },
          traceId: 'mock-auth-change-password-reused'
        },
        { status: 409 }
      );
    }

    return HttpResponse.json(
      {
        success: true,
        data: {
          changed: true,
          revokedSessionIds: ['65f0000000000000000000ab']
        },
        traceId: 'mock-auth-change-password-ok'
      },
      { status: 200 }
    );
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
