# Guia de Mocking Frontend

Version: 1.0.0  
Estado: Activo  
Ultima actualizacion: 2026-03-08

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

- Login browser exitoso (simular Set-Cookie conceptual para flujo UI)
- Login invalido (`AUTH_INVALID_CREDENTIALS`)
- 2FA requerido (`AUTH_TWO_FACTOR_REQUIRED`)
- Refresh exitoso y refresh fallido (`AUTH_INVALID_REFRESH_TOKEN`)
- Logout exitoso

### 5.2 Tenant

- Lista de tenants vacia y con multiples tenants
- Switch tenant exitoso
- Switch tenant con `TENANT_SCOPE_MISMATCH`
- Crear invitacion exitoso y `TENANT_OWNER_REQUIRED`

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

## 7. Ejemplo de handler MSW

```ts
import { http, HttpResponse } from 'msw';

export const authHandlers = [
  http.post('/api/v1/auth/login/browser', async () => {
    return HttpResponse.json(
      {
        success: true,
        data: {
          user: {
            id: '65f000000000000000000001',
            email: 'user@example.com',
            firstName: 'Ana',
            lastName: 'Diaz',
            status: 'active',
            isEmailVerified: true
          },
          session: {
            id: '65f0000000000000000000aa',
            userId: '65f000000000000000000001',
            expiresAt: '2026-12-31T23:59:59.000Z'
          }
        },
        traceId: 'mock-auth-login-ok'
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
- Incluir `traceId` fijo por escenario para trazabilidad en test logs.
- Usar escenarios reutilizables en vez de handlers duplicados.
