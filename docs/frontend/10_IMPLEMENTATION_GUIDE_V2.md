# Guia de Implementacion Frontend V2 (API -> Frontend)

Version: 2.3.0
Estado: Activo
Ultima actualizacion: 2026-03-20

## 1. Objetivo

Definir un manual operativo exacto para implementar el Frontend contra `API-REST-STACK-NODE` por fases y etapas, minimizando riesgo de integracion y evitando deuda tecnica.

Esta guia reemplaza como referencia principal a `_deprecated/90_INTEGRATION_PLAN_V1.md`.

## 2. Alcance y fuente de verdad

### 2.1 Alcance

- Incluye integracion FE para Auth, Tenant, Billing/Provisioning, Tenant Settings, Platform Settings, Members, Audit, Inventory, CRM y HR.
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

### 3.5 Scope split obligatorio (tenant vs platform)

Implementar dos clientes API explicitos:

- `tenantClient`:
  - rutas tenant-scoped
  - inyecta `X-Tenant-Id`
  - puede operar con token tenant-scoped (emitido tras `tenant/switch`)
- `platformClient`:
  - rutas platform-scoped (`/api/v1/platform/*`)
  - prohibe `X-Tenant-Id`
  - debe operar con token/sesion no tenant-scoped

Reglas:

- no usar fallback automatico de un scope a otro
- no reintentar automaticamente un request platform con contexto tenant
- ante `TENANT_SCOPE_MISMATCH`, forzar cambio explicito de contexto

Flujo recomendado:

1. login/refresh base
2. bootstrap de tenant (si aplica) con `tenant/switch`
3. usar `tenantClient` para modulo tenant
4. usar `platformClient` para modulo platform

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

### Validaciones FE obligatorias

- En frontend, la seguridad de usuario debe vivir en `/app/settings/profile?tab=security`.
- No asumir que `register`, `resend-verification` ni `forgot-password` revelan estado real de cuenta.
- En `401` browser, reintentar solo una vez via `refresh/browser`.
- En `change-password` o `reset-password`, invalidar sesion local segun `revokedSessionIds`.
- Manejar codigos: `AUTH_EMAIL_VERIFICATION_INVALID`, `AUTH_PASSWORD_RESET_INVALID`, `AUTH_PASSWORD_CHANGE_CURRENT_INVALID`, `AUTH_PASSWORD_CHANGE_REUSED`, `AUTH_TWO_FACTOR_*`.

## 4.3 Tenant

### Casos de uso principales

- Crear tenant inicial.
- Listar tenants del usuario.
- Cambiar tenant activo.
- Gestionar miembros, invitaciones y ownership.

### Endpoints

| Metodo | Endpoint | Auth | X-Tenant-Id | X-CSRF-Token | Status |
|---|---|---|---|---|---|
| POST | `/api/v1/tenant` | Si | No | Condicional | 201,400,401,409 |
| GET | `/api/v1/tenant/mine` | Si | No | No | 200,401 |
| POST | `/api/v1/tenant/switch` | Si | No | Condicional | 200,400,401,403,404 |
| GET | `/api/v1/tenant/memberships` | Si | Si | No | 200,400,401,403 |
| PATCH | `/api/v1/tenant/memberships/{membershipId}` | Si | Si | Condicional | 200,400,401,403,404,409 |
| DELETE | `/api/v1/tenant/memberships/{membershipId}` | Si | Si | Condicional | 200,400,401,403,404,409 |
| POST | `/api/v1/tenant/invitations` | Si | Si | Condicional | 201,400,401,403,404,409 |
| POST | `/api/v1/tenant/invitations/accept` | Si | No | Condicional | 200,400,401,403,404,409 |
| POST | `/api/v1/tenant/invitations/revoke` | Si | Si | Condicional | 200,400,401,403,404,409 |
| POST | `/api/v1/tenant/transfer-ownership` | Si | Si | Condicional | 200,400,401,403,404,409 |
| PATCH | `/api/v1/tenant/subscription` | Si | Si | Condicional | 200,400,401,403,404 |
| DELETE | `/api/v1/tenant/subscription` | Si | Si | Condicional | 200,401,403,404 |

### Requerimientos FE especificos para Members

Tabs esperadas:

- `/app/members?tab=team`
- `/app/members?tab=invitations`
- `/app/members?tab=ownership`
- `roadmap` puede seguir como tab informativa si frontend la mantiene

Payload minimo esperado en `Members > Equipo`:

- `membershipId`
- `userId`
- `fullName`
- `email`
- `roleKey`
- `status`
- `joinedAt` o `createdAt`
- `isEffectiveOwner`

Filtros soportados por backend:

- `page`
- `limit`
- `search`
- `roleKey`
- `status`

Reglas duras:

- no enviar `X-Tenant-Id` en `tenant/switch` ni `invitations/accept`
- invalidar cache tenant-scoped despues de `PATCH/DELETE /tenant/memberships/{membershipId}`
- tratar `TENANT_MEMBERSHIP_OWNER_PROTECTED` como error de negocio, sin retry automatico
- ownership se mantiene exclusivamente en `POST /api/v1/tenant/transfer-ownership`

## 4.4 Billing y Provisioning

### Casos de uso principales

- Consultar catalogo de planes disponibles.
- Crear checkout session para pago real/simulado.
- Asignar/cambiar/cancelar suscripcion del tenant.
- Reflejar cambio de plan/modulos/features en runtime efectivo.

### Endpoints

| Metodo | Endpoint | Auth | X-Tenant-Id | X-CSRF-Token | Status |
|---|---|---|---|---|---|
| GET | `/api/v1/billing/plans` | Si | No | No | 200,401 |
| POST | `/api/v1/billing/checkout/session` | Si | Si | Condicional | 201,400,401,403,404 |
| POST | `/api/v1/billing/webhooks/provider` | No (system-to-system) | No | No | 200,401 |
| PATCH | `/api/v1/tenant/subscription` | Si | Si | Condicional | 200,400,401,403,404 |
| DELETE | `/api/v1/tenant/subscription` | Si | Si | Condicional | 200,401,403,404 |

### Validaciones FE obligatorias

- No llamar `billing/webhooks/provider` desde UI; solo backend/provider.
- Runbook local recomendado para demo operativa: `docs/operaciones/BILLING_LOCAL_DEMO_RUNBOOK.md`.
- Tratar `checkout/session` como estado intermedio hasta recibir webhook o asignacion directa.
- Tras `PATCH/DELETE /tenant/subscription`, invalidar cache tenant-scoped y refetch de `tenant/settings/effective`.
- Si runtime llega incompleto o nulo, degradar a estado seguro sin romper render.

## 4.5 Tenant Settings

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

### Validaciones FE obligatorias

- Siempre usar `tenant/settings/effective` para guardas de modulo/plan/features en shell.
- Evitar inferencias locales de permisos por plan sin backend.
- Si `GET /api/v1/tenant/settings/effective` responde `GEN_INTERNAL_ERROR`, tratarlo como incidente backend de inicializacion, sin retry en loop desde frontend.

## 4.6 Platform Settings y Security

### Casos de uso

- Leer y actualizar singleton platform.
- Exponer seguridad de plataforma en `/app/settings/security` usando el mismo contrato `platform/settings`.

### Endpoints

| Metodo | Endpoint | Auth | X-Tenant-Id | X-CSRF-Token | Status |
|---|---|---|---|---|---|
| GET | `/api/v1/platform/settings` | Si | No | No | 200,401,403 |
| PATCH | `/api/v1/platform/settings` | Si | No | Condicional | 200,400,401,403 |

### Campos activos en `platform/settings.security`

- `allowUserRegistration`
- `requireEmailVerification`
- `requireTwoFactorForPrivilegedUsers`
- `passwordPolicy`
  - `minLength`
  - `preventReuseCount`
  - `requireUppercase`
  - `requireLowercase`
  - `requireNumber`
  - `requireSpecialChar`
- `sessionPolicy`
  - `browserSessionTtlMinutes`
  - `idleTimeoutMinutes`
- `riskControls`
  - `allowRecoveryCodes`
  - `enforceVerifiedEmailForPrivilegedAccess`

### Validaciones FE obligatorias

- Pantallas solo para usuarios con permisos `platform:settings:read/update`.
- `/app/settings/security` debe leer y mutar `data.security` dentro de `platform/settings`; no existe `platform/security` separado en esta fase.
- Limitar UI a los campos anteriores; no exponer enforcement no soportado todavia.
- Tras `PATCH /api/v1/platform/settings`, invalidar cache de `platform/settings`.

## 4.7 Audit

### Casos de uso

- Listado de auditoria tenant-scoped con filtros y paginacion.
- Extension futura: auditoria platform-scoped para usuarios internos con permisos globales.

### Endpoints

| Metodo | Endpoint | Auth | X-Tenant-Id | X-CSRF-Token | Status |
|---|---|---|---|---|---|
| GET | `/api/v1/audit` | Si | Si | No | 200,401,403 |

Contratos futuros recomendados para retomar sin redescubrir alcance:

- `GET /api/v1/platform/audit`
- scope platform-only, sin `X-Tenant-Id`
- permiso minimo esperado: `platform:audit:read`
- filtros minimos recomendados: `page`, `limit`, `action` o `eventKey`, `actorUserId`, `from`, `to`
- respuesta paginada consistente con otros listados: `items`, `page`, `limit`, `total`, `totalPages`

### Validaciones FE obligatorias

- Persistir filtros en URL.
- Mantener `traceId` visible para soporte en errores.
- Si se implementa `platform/audit`, mantener pantalla y cliente separados de la auditoria tenant-scoped.
- Tratar `401/403` de platform audit como estado de acceso restringido, no como fallback a contexto tenant.

## 4.8 Inventory

### Casos de uso principales

- CRUD categorias.
- CRUD items.
- Registro y consulta de movimientos de stock.
- Alertas de bajo stock.

### Endpoints

| Metodo | Endpoint | Auth | X-Tenant-Id | X-CSRF-Token | Status |
|---|---|---|---|---|---|
| GET/POST | `/api/v1/modules/inventory/categories` | Si | Si | Condicional en POST | GET: 200,400,401,403 / POST: 201,400,401,403,409 |
| PATCH/DELETE | `/api/v1/modules/inventory/categories/{categoryId}` | Si | Si | Condicional | 200,400,401,403,404,409 |
| GET/POST | `/api/v1/modules/inventory/items` | Si | Si | Condicional en POST | GET: 200,400,401,403 / POST: 201,400,401,403,404,409 |
| GET/PATCH/DELETE | `/api/v1/modules/inventory/items/{itemId}` | Si | Si | Condicional en PATCH/DELETE | 200,400,401,403,404,409 |
| GET/POST | `/api/v1/modules/inventory/stock-movements` | Si | Si | Condicional en POST | GET: 200,400,401,403 / POST: 201,400,401,403,404,409 |
| GET | `/api/v1/modules/inventory/alerts/low-stock` | Si | Si | No | 200,400,401,403 |

### Validaciones FE obligatorias

- En `INV_STOCK_CONFLICT`: rollback de estado optimista y refetch.
- En `INV_STOCK_UNDERFLOW`: bloqueo UX y guia de correccion, sin retry.
- Tratar el hardening actual de Inventory como trabajo de integracion/UX, no como dependencia backend nueva.
- Si un listado ya llega paginado desde backend pero la busqueda textual sigue siendo local a la pagina cargada, documentarlo como limitacion operativa hasta contar con filtro server-side equivalente.
- Mantener errores de formulario dentro del modal y reservar banners de pagina para errores operativos o de accion.

## 4.9 CRM

### Casos de uso principales

- CRUD contactos.
- CRUD organizaciones.
- CRUD oportunidades.
- Cambio de etapa de oportunidad.
- Actividades y counters.

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

## 4.10 HR

### Casos de uso principales

- CRUD empleados.
- Lectura/actualizacion de compensacion por empleado.

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
| Tenant activo | Tenant, Tenant Settings, Members, Audit, Inventory, CRM, HR | Sin tenant activo, bloquear rutas tenant-scoped |
| Runtime efectivo (`tenant/settings/effective`) | Shell, guardas de modulos, navegacion | Fuente unica para habilitar/ocultar modulos y features |
| Provisioning billing (`checkout/session`, `tenant/subscription`) | Shell, tenant settings effective, modulos | Todo cambio de plan requiere refetch runtime efectivo antes de habilitar modulos/features |
| Permisos RBAC efectivos | Tenant, Members, Settings, Audit, Inventory, CRM, HR | Frontend solo sugiere acceso; backend es autoridad |
| Politica de errores por `error.code` | Todos | UX y acciones definidas por codigo, no por texto libre |

## 6. Fases de implementacion frontend

## Fase 1: Sincronizacion inicial

### Objetivo

Alinear el frontend actual con el contrato real de API y eliminar drift documental/tecnico.

### Tareas concretas

1. Actualizar cliente API comun con reglas de headers, CSRF, refresh y traceId.
2. Validar que todas las llamadas actuales existan en OpenAPI.
3. Corregir rutas UI existentes para auth/tenant/settings/members segun matriz de acceso.
4. Normalizar manejo de errores por `error.code`.

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

#### Etapa 2.2 Members + Settings + Audit

Tareas:

1. `Members > Equipo` con `GET/PATCH/DELETE /tenant/memberships`.
2. `Members > Invitaciones` y `Members > Ownership` en tabs del workspace `/app/members`.
3. Pantallas de tenant settings y runtime efectivo.
4. Pantallas de platform settings y `settings/security` usando `platform/settings`.
5. Auditoria tenant con filtros y paginacion.
6. Dejar documentada como siguiente extension la auditoria platform-scoped con contrato minimo GET /api/v1/platform/audit y UX separada por scope.

Validaciones:

- Guardas por permiso.
- Refetch efectivo tras update settings.
- Invalidaciones correctas de memberships y platform settings.

#### Etapa 2.3 Modulos operativos (Inventory, CRM, HR)

Tareas:

1. Inventory CRUD + stock flow + low-stock.
2. CRM CRUD + pipeline + activities + counters.
3. HR empleados + compensacion por permisos.

#### Etapa 2.4 Billing + Provisioning

Tareas:

1. Pantalla de planes y checkout (`GET /billing/plans`, `POST /billing/checkout/session`).
2. Acciones de suscripcion (`PATCH/DELETE /tenant/subscription`).
3. Sincronizacion automatica de runtime efectivo luego de cambios de plan.
4. Manejo UX para estados `pending`, `paid`, `activated`, `failed`, `canceled`.

## Fase 3: Optimizacion

### Objetivo

Reducir deuda tecnica y redundancias antes de release.

### Tareas concretas

1. Consolidar hooks y adaptadores API duplicados.
2. Estandarizar query keys tenant-scoped y platform-scoped.
3. Eliminar fetch directos fuera del API client.
4. Revisar optimistic updates y rollback en conflictos.

## Fase 4: Validacion final

### Objetivo

Certificar integracion completa FE<->API y dejar manual de mantenimiento.

### Tareas concretas

1. Ejecutar suite E2E critica completa.
2. Ejecutar validaciones de permisos y aislamiento tenant.
3. Registrar evidencia de errores con `traceId`.
4. Cerrar checklist DoD por modulo.

## 7. Matriz minima de errores obligatorios en FE

Mapeo obligatorio inicial:

- Auth: `AUTH_UNAUTHENTICATED`, `AUTH_INVALID_CREDENTIALS`, `AUTH_EMAIL_NOT_VERIFIED`, `AUTH_EMAIL_VERIFICATION_INVALID`, `AUTH_PASSWORD_RESET_INVALID`, `AUTH_PASSWORD_CHANGE_CURRENT_INVALID`, `AUTH_PASSWORD_CHANGE_REUSED`, `AUTH_TWO_FACTOR_REQUIRED`, `AUTH_TWO_FACTOR_INVALID`, `AUTH_CSRF_INVALID`.
- Tenant: `TENANT_HEADER_REQUIRED`, `TENANT_SCOPE_MISMATCH`, `TENANT_OWNER_REQUIRED`, `TENANT_MEMBER_LIMIT_REACHED`, `TENANT_INVITATION_*`, `TENANT_MEMBERSHIP_NOT_FOUND`, `TENANT_MEMBERSHIP_OWNER_PROTECTED`.
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
