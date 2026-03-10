# Guia de Implementacion Frontend V2 (API -> Frontend)

Version: 2.0.0
Estado: Activo
Ultima actualizacion: 2026-03-10

## 1. Objetivo

Definir un manual operativo exacto para implementar el Frontend contra `API-REST-STACK-NODE` por fases y etapas, minimizando riesgo de integracion y evitando deuda tecnica.

Esta guia reemplaza como referencia principal a `_deprecated/90_INTEGRATION_PLAN_V1.md`.

## 2. Alcance y fuente de verdad

### 2.1 Alcance

- Incluye integracion FE para Auth, Tenant, Tenant Settings, Platform Settings, Audit, Inventory, CRM y HR.
- Incluye reglas de cliente HTTP, seguridad, errores, cache, testing y cierre.
- No define UX visual detallada ni sistema de diseno.

### 2.2 Prioridad documental

Si hay conflicto, usar este orden:

1. `openapi/openapi.yaml` + `openapi/paths/*`
2. Este documento (`10_IMPLEMENTATION_GUIDE_V2.md`)
3. `20_ACCESS_MATRIX.md`
4. `30_API_CLIENT_STANDARD.md`
5. `40_STATE_AND_CACHE_POLICY.md`
6. `50_ERROR_CATALOG.md`
7. `70_E2E_CRITICAL_FLOWS.md`
8. `90_DOD_CHECKLIST.md`
9. `80_BACKEND_DEPENDENCIES.md`

## 3. Contratos transversales obligatorios

### 3.1 Envelopes HTTP

Exito:

```json
{
  "success": true,
  "data": {},
  "traceId": "..."
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
  "traceId": "..."
}
```

### 3.2 Seguridad y headers

- Browser mode: `credentials: include` en todas las llamadas autenticadas.
- Bearer mode: `Authorization: Bearer <accessToken>`.
- `X-CSRF-Token`:
  - obligatorio para mutaciones cookie-auth.
  - no requerido en Bearer.
- `X-Tenant-Id` obligatorio en rutas tenant-scoped.

### 3.3 Rutas con excepcion tenant header

No enviar `X-Tenant-Id` en estas rutas aunque sean tenant-bound por token/body:

- `POST /api/v1/tenant/switch`
- `POST /api/v1/tenant/invitations/accept`

### 3.4 Reglas duras anti deuda

- Si no existe en OpenAPI, no se implementa.
- No duplicar cliente HTTP por modulo.
- No persistir tokens en `localStorage` o `sessionStorage` en browser mode.
- Todo error de backend debe mapearse por `error.code`.

## 4. Mapa de API por modulo (casos de uso y endpoints)

## 4.1 Health

### Casos de uso

- Principal: verificacion tecnica de disponibilidad.
- Secundario: health check de entorno de despliegue.

### Endpoints

| Metodo | Endpoint | Auth | X-Tenant-Id | X-CSRF-Token | Status |
|---|---|---|---|---|---|
| GET | `/health` | No | No | No | 200,500 |

### Requerimientos FE

- No usar como vista de negocio.
- Solo diagnostico tecnico/ops.

## 4.2 Auth

### Casos de uso principales

- Registro con confirmacion externa de email.
- Login browser y headless.
- Refresh y restauracion de sesion.
- Logout local y global.
- 2FA setup/confirm/disable y recovery codes.
- Recuperacion y cambio de password.

### Casos de uso secundarios

- Reenvio de verificacion.
- Hardening anti enumeracion de cuentas.
- Revocacion de sesiones tras reset/change password.

### Endpoints

| Metodo | Endpoint | Auth | X-Tenant-Id | X-CSRF-Token | Status |
|---|---|---|---|---|---|
| POST | `/api/v1/auth/register` | No | No | No | 202,400 |
| POST | `/api/v1/auth/login/browser` | No | No | No | 200,400,401,403,423 |
| POST | `/api/v1/auth/login/headless` | No | No | No | 200,400,401,403,423 |
| POST | `/api/v1/auth/resend-verification` | No | No | No | 202,400 |
| POST | `/api/v1/auth/forgot-password` | No | No | No | 202,400 |
| POST | `/api/v1/auth/reset-password` | No | No | No | 200,400 |
| POST | `/api/v1/auth/verify-email` | No | No | No | 200,400 |
| POST | `/api/v1/auth/refresh/browser` | Si | No | Condicional | 200,401,403 |
| POST | `/api/v1/auth/refresh/headless` | No | No | No | 200,400,401 |
| POST | `/api/v1/auth/2fa/setup` | Si | No | Condicional | 200,401,403,409 |
| POST | `/api/v1/auth/2fa/confirm` | Si | No | Condicional | 200,401,403,409 |
| POST | `/api/v1/auth/2fa/disable` | Si | No | Condicional | 200,401,403,409 |
| POST | `/api/v1/auth/recovery-codes/regenerate` | Si | No | Condicional | 200,401,403,409 |
| POST | `/api/v1/auth/change-password` | Si | No | Condicional | 200,401,403,409 |
| POST | `/api/v1/auth/logout` | Si | No | Condicional | 200,401,403 |
| POST | `/api/v1/auth/logout-all` | Si | No | Condicional | 200,401,403 |

### Ejemplo de implementacion (browser login)

```ts
const response = await apiClient.request({
  path: '/api/v1/auth/login/browser',
  method: 'POST',
  body: { email, password },
  browserMode: true
});

// expected: response.data.user + response.data.session
```

### Validaciones FE obligatorias

- No asumir que `register`, `resend-verification` ni `forgot-password` revelan estado real de cuenta.
- En `401` browser, reintentar solo una vez via `refresh/browser`.
- En `change-password` o `reset-password`, invalidar sesion local segun `revokedSessionIds`.
- Manejar codigos: `AUTH_EMAIL_VERIFICATION_INVALID`, `AUTH_PASSWORD_RESET_INVALID`, `AUTH_PASSWORD_CHANGE_CURRENT_INVALID`, `AUTH_PASSWORD_CHANGE_REUSED`, `AUTH_TWO_FACTOR_*`.

## 4.3 Tenant

### Casos de uso principales

- Crear tenant inicial.
- Listar tenants del usuario.
- Cambiar tenant activo.
- Gestionar invitaciones.
- Transferir ownership.

### Casos de uso secundarios

- Reenvio implicito de invitacion existente (upsert de invitacion pending).
- Aceptacion de invitacion con token y validaciones de estado.
- Control de limite de miembros por plan.

### Endpoints

| Metodo | Endpoint | Auth | X-Tenant-Id | X-CSRF-Token | Status |
|---|---|---|---|---|---|
| POST | `/api/v1/tenant` | Si | No | Condicional | 201,400,401,409 |
| GET | `/api/v1/tenant/mine` | Si | No | No | 200,401 |
| POST | `/api/v1/tenant/switch` | Si | No | Condicional | 200,400,401,403,404 |
| POST | `/api/v1/tenant/invitations` | Si | Si | Condicional | 201,400,401,403,404,409 |
| POST | `/api/v1/tenant/invitations/accept` | Si | No | Condicional | 200,400,401,403,404,409 |
| POST | `/api/v1/tenant/invitations/revoke` | Si | Si | Condicional | 200,400,401,403,404,409 |
| POST | `/api/v1/tenant/transfer-ownership` | Si | Si | Condicional | 200,400,401,403,404,409 |

### Ejemplo de implementacion (switch tenant)

```ts
await apiClient.request({
  path: '/api/v1/tenant/switch',
  method: 'POST',
  body: { tenantId },
  browserMode: true,
  csrf: true
});

clearTenantScopedCache(oldTenantId);
await bootstrapTenantRuntime(tenantId);
```

### Validaciones FE obligatorias

- No enviar `X-Tenant-Id` en `tenant/switch` ni `invitations/accept`.
- Limpiar cache tenant-scoped al cambiar tenant.
- Tratar `TENANT_OWNER_REQUIRED` y `TENANT_MEMBER_LIMIT_REACHED` como errores de negocio, sin retry automatico.

## 4.4 Tenant Settings

### Casos de uso principales

- Leer singleton de tenant settings.
- Actualizar tenant settings.
- Consumir vista efectiva para runtime (plan/modulos/features).

### Endpoints

| Metodo | Endpoint | Auth | X-Tenant-Id | X-CSRF-Token | Status |
|---|---|---|---|---|---|
| GET | `/api/v1/tenant/settings` | Si | Si | No | 200,400,401,403 |
| PATCH | `/api/v1/tenant/settings` | Si | Si | Condicional | 200,400,401,403 |
| GET | `/api/v1/tenant/settings/effective` | Si | Si | No | 200,400,401,403 |

### Ejemplo de implementacion (update + refetch efectivo)

```ts
await apiClient.request({
  path: '/api/v1/tenant/settings',
  method: 'PATCH',
  tenantId,
  body: payload,
  browserMode: true,
  csrf: true
});

await queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'settings'] });
await queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'settings', 'effective'] });
```

### Validaciones FE obligatorias

- Siempre usar `tenant/settings/effective` para guardas de modulo/plan/features en shell.
- Evitar inferencias locales de permisos por plan sin backend.

## 4.5 Platform Settings

### Casos de uso

- Leer y actualizar singleton platform.

### Endpoints

| Metodo | Endpoint | Auth | X-Tenant-Id | X-CSRF-Token | Status |
|---|---|---|---|---|---|
| GET | `/api/v1/platform/settings` | Si | No | No | 200,401,403 |
| PATCH | `/api/v1/platform/settings` | Si | No | Condicional | 200,400,401,403 |

### Validaciones FE obligatorias

- Pantallas solo para usuarios con permisos `platform:settings:read/update`.

## 4.6 Audit

### Casos de uso

- Listado de auditoria tenant-scoped con filtros y paginacion.

### Endpoints

| Metodo | Endpoint | Auth | X-Tenant-Id | X-CSRF-Token | Status |
|---|---|---|---|---|---|
| GET | `/api/v1/audit` | Si | Si | No | 200,401,403 |

### Validaciones FE obligatorias

- Persistir filtros en URL.
- Mantener `traceId` visible para soporte en errores.

## 4.7 Inventory

### Casos de uso principales

- CRUD categorias.
- CRUD items.
- Registro y consulta de movimientos de stock.
- Alertas de bajo stock.

### Casos de uso secundarios

- Resolucion de conflictos de stock concurrente.

### Endpoints

| Metodo | Endpoint | Auth | X-Tenant-Id | X-CSRF-Token | Status |
|---|---|---|---|---|---|
| GET/POST | `/api/v1/modules/inventory/categories` | Si | Si | Condicional en POST | GET: 200,400,401,403 / POST: 201,400,401,403,409 |
| PATCH/DELETE | `/api/v1/modules/inventory/categories/{categoryId}` | Si | Si | Condicional | 200,400,401,403,404,409 |
| GET/POST | `/api/v1/modules/inventory/items` | Si | Si | Condicional en POST | GET: 200,400,401,403 / POST: 201,400,401,403,404,409 |
| GET/PATCH/DELETE | `/api/v1/modules/inventory/items/{itemId}` | Si | Si | Condicional en PATCH/DELETE | 200,400,401,403,404,409 |
| GET/POST | `/api/v1/modules/inventory/stock-movements` | Si | Si | Condicional en POST | GET: 200,400,401,403 / POST: 201,400,401,403,404,409 |
| GET | `/api/v1/modules/inventory/alerts/low-stock` | Si | Si | No | 200,400,401,403 |

### Ejemplo de implementacion (stock movement)

```ts
await apiClient.request({
  path: '/api/v1/modules/inventory/stock-movements',
  method: 'POST',
  tenantId,
  body: {
    itemId,
    direction: 'out',
    quantity: 5,
    reason: 'sale'
  },
  browserMode: true,
  csrf: true
});
```

### Validaciones FE obligatorias

- En `INV_STOCK_CONFLICT`: rollback de estado optimista y refetch.
- En `INV_STOCK_UNDERFLOW`: bloqueo UX y guia de correccion, sin retry.

## 4.8 CRM

### Casos de uso principales

- CRUD contactos.
- CRUD organizaciones.
- CRUD oportunidades.
- Cambio de etapa de oportunidad.
- Actividades y counters.

### Casos de uso secundarios

- Control de transiciones invalidas de etapa.
- Manejo de referencias invalidas en actividades.

### Endpoints

| Metodo | Endpoint | Auth | X-Tenant-Id | X-CSRF-Token | Status |
|---|---|---|---|---|---|
| GET/POST | `/api/v1/modules/crm/contacts` | Si | Si | Condicional en POST | GET: 200,400,401,403 / POST: 201,400,401,403,404,409 |
| GET/PATCH/DELETE | `/api/v1/modules/crm/contacts/{contactId}` | Si | Si | Condicional en PATCH/DELETE | 200,400,401,403,404,409 |
| GET/POST | `/api/v1/modules/crm/organizations` | Si | Si | Condicional en POST | GET: 200,400,401,403 / POST: 201,400,401,403,409 |
| GET/PATCH/DELETE | `/api/v1/modules/crm/organizations/{organizationId}` | Si | Si | Condicional en PATCH/DELETE | 200,400,401,403,404,409 |
| GET/POST | `/api/v1/modules/crm/opportunities` | Si | Si | Condicional en POST | GET: 200,400,401,403 / POST: 201,400,401,403,404 |
| GET/PATCH/DELETE | `/api/v1/modules/crm/opportunities/{opportunityId}` | Si | Si | Condicional en PATCH/DELETE | 200,400,401,403,404 |
| PATCH | `/api/v1/modules/crm/opportunities/{opportunityId}/stage` | Si | Si | Condicional | 200,400,401,403,404,409 |
| GET/POST | `/api/v1/modules/crm/activities` | Si | Si | Condicional en POST | GET: 200,400,401,403 / POST: 201,400,401,403 |
| GET | `/api/v1/modules/crm/counters` | Si | Si | No | 200,400,401,403 |

### Validaciones FE obligatorias

- Mapear `CRM_OPPORTUNITY_STAGE_TRANSITION_INVALID` a UX accionable (sin retry).
- Refetch de counters tras mutaciones CRM.

## 4.9 HR

### Casos de uso principales

- CRUD empleados.
- Lectura/actualizacion de compensacion por empleado.

### Casos de uso secundarios

- Validacion de jerarquia (manager) y prevencion de ciclos.
- Proteccion de datos sensibles por permiso.

### Endpoints

| Metodo | Endpoint | Auth | X-Tenant-Id | X-CSRF-Token | Status |
|---|---|---|---|---|---|
| GET/POST | `/api/v1/modules/hr/employees` | Si | Si | Condicional en POST | GET: 200,400,401,403 / POST: 201,400,401,403,404,409 |
| GET/PATCH/DELETE | `/api/v1/modules/hr/employees/{employeeId}` | Si | Si | Condicional en PATCH/DELETE | 200,400,401,403,404,409 |
| GET/PATCH | `/api/v1/modules/hr/employees/{employeeId}/compensation` | Si | Si | Condicional en PATCH | 200,400,401,403,404,409 |

### Validaciones FE obligatorias

- Aplicar guardas estrictas para `tenant:hr:compensation:read/update`.
- No registrar payload sensible de compensacion en logs frontend.

## 5. Dependencias entre modulos (impacto de integracion)

| Dependencia | Modulos afectados | Regla |
|---|---|---|
| Sesion autenticada | Todos excepto Health/Auth publico | Sin sesion valida no iniciar flujos de negocio |
| Tenant activo | Tenant Settings, Audit, Inventory, CRM, HR | Sin tenant activo, bloquear rutas tenant-scoped |
| Runtime efectivo (`tenant/settings/effective`) | Shell, guardas de modulos, navegacion | Fuente unica para habilitar/ocultar modulos y features |
| Permisos RBAC efectivos | Tenant, Settings, Audit, Inventory, CRM, HR | Frontend solo sugiere acceso; backend es autoridad |
| Politica de errores por `error.code` | Todos | UX y acciones definidas por codigo, no por texto libre |

## 6. Fases de implementacion frontend

## Fase 1: Sincronizacion inicial

### Objetivo

Alinear el frontend actual con el contrato real de API y eliminar drift documental/tecnico.

### Tareas concretas

1. Actualizar cliente API comun con reglas de headers, CSRF, refresh y traceId.
2. Validar que todas las llamadas actuales existan en OpenAPI.
3. Corregir rutas UI existentes para auth/tenant/settings segun matriz de acceso.
4. Normalizar manejo de errores por `error.code`.

### Ejemplo de implementacion

- Crear/validar wrappers:
  - `requestPublic`
  - `requestBrowserAuth`
  - `requestHeadlessAuth`
  - `requestTenantScoped`

### Validaciones necesarias

- 100% de llamadas mapeadas a OpenAPI.
- 0 endpoints inventados.
- 0 mutaciones cookie-auth sin CSRF.
- 0 rutas tenant-scoped sin `X-Tenant-Id`.

## Fase 2: Desarrollo funcional

### Objetivo

Completar integracion funcional por flujo de negocio y modulo.

### Etapas

#### Etapa 2.1 Auth + Tenant bootstrap

Tareas:

1. Registro/login/verify/resend/forgot/reset/change password.
2. Refresh y restauracion de sesion.
3. Selector de tenant y switch.
4. Invitaciones y ownership transfer.

Validaciones:

- Manejo completo de codigos Auth/Tenant criticos.
- Limpieza de cache tenant en switch/logout.

#### Etapa 2.2 Settings + Audit

Tareas:

1. Pantallas de tenant settings y runtime efectivo.
2. Pantallas de platform settings (segun permisos).
3. Auditoria tenant con filtros y paginacion.

Validaciones:

- Guardas por permiso.
- Refetch efectivo tras update settings.

#### Etapa 2.3 Modulos operativos (Inventory, CRM, HR)

Tareas:

1. Inventory CRUD + stock flow + low-stock.
2. CRM CRUD + pipeline + activities + counters.
3. HR empleados + compensacion por permisos.

Validaciones:

- Manejo de conflictos de dominio (`INV_STOCK_CONFLICT`, stage invalid, jerarquia HR, etc.).
- Invalidaciones de cache por modulo.

## Fase 3: Optimizacion

### Objetivo

Reducir deuda tecnica y redundancias antes de release.

### Tareas concretas

1. Consolidar hooks y adaptadores API duplicados.
2. Estandarizar query keys tenant-scoped.
3. Eliminar fetch directos fuera del API client.
4. Revisar optimistic updates y rollback en conflictos.

### Ejemplo de implementacion

- Unificar hooks por recurso:
  - `useTenantSettings`, `useTenantSettingsEffective`
  - `useInventoryItems`, `useCrmOpportunities`, `useHrEmployees`

### Validaciones necesarias

- Cero wrappers HTTP duplicados por modulo.
- Cero fugas cross-tenant en cache.
- Performance baseline estable en listados paginados.

## Fase 4: Validacion final

### Objetivo

Certificar integracion completa FE<->API y dejar manual de mantenimiento.

### Tareas concretas

1. Ejecutar suite E2E critica completa.
2. Ejecutar validaciones de permisos y aislamiento tenant.
3. Registrar evidencia de errores con `traceId`.
4. Cerrar checklist DoD por modulo.

### Ejemplo de implementacion

- Pipeline minimo recomendado:
  - lint + typecheck + unit + integration + e2e criticos.

### Validaciones necesarias

- 0 regresiones en login/refresh/tenant switch.
- 0 fallos en guardas de permisos por modulo.
- 0 bloqueos backend falsos en dependencias.

## 7. Matriz minima de errores obligatorios en FE

Mapeo obligatorio inicial:

- Auth: `AUTH_UNAUTHENTICATED`, `AUTH_INVALID_CREDENTIALS`, `AUTH_EMAIL_NOT_VERIFIED`, `AUTH_EMAIL_VERIFICATION_INVALID`, `AUTH_PASSWORD_RESET_INVALID`, `AUTH_PASSWORD_CHANGE_CURRENT_INVALID`, `AUTH_PASSWORD_CHANGE_REUSED`, `AUTH_TWO_FACTOR_REQUIRED`, `AUTH_TWO_FACTOR_INVALID`, `AUTH_CSRF_INVALID`.
- Tenant: `TENANT_HEADER_REQUIRED`, `TENANT_SCOPE_MISMATCH`, `TENANT_OWNER_REQUIRED`, `TENANT_MEMBER_LIMIT_REACHED`, `TENANT_INVITATION_*`.
- RBAC: `RBAC_PERMISSION_DENIED`, `RBAC_MODULE_DENIED`, `RBAC_PLAN_DENIED`.
- Inventory: `INV_STOCK_CONFLICT`, `INV_STOCK_UNDERFLOW` y codigos CRUD.
- CRM: `CRM_*` de contactos/organizaciones/oportunidades/actividades.
- HR: `HR_*` de empleados/compensacion/jerarquia.

## 8. Checklist de cierre (cero deuda tecnica)

- [ ] No hay endpoints fuera de OpenAPI en consumo FE.
- [ ] Cliente HTTP unico aplicado en toda la app.
- [ ] Reglas CSRF/Tenant headers validadas por pruebas.
- [ ] Error mapping por `error.code` completo para flujos activos.
- [ ] Cache tenant-scoped aislada e invalidada en switch/logout.
- [ ] Flujos E2E criticos en verde.
- [ ] Dependencias backend reales actualizadas (sin falsos positivos).
- [ ] Documentacion frontend sincronizada con OpenAPI y runtime actual.


