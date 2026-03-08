# Plan de Integracion Frontend V1

Version: 1.2.0  
Estado: Activo  
Ultima actualizacion: 2026-03-08

## 1. Proposito

Este documento es la guia operativa unica para integrar Frontend con `API-REST-STACK-NODE`.

Esta basado en codigo runtime + OpenAPI + evidencia de cierre, no en requerimientos aspiracionales.

## 2. Fuentes de verdad y prioridad

Si dos documentos se contradicen, usar esta prioridad:

1. `docs/PLAN_MAESTRO.md`
2. `docs/arquitectura/*`
3. `docs/adrs/*`
4. `docs/anexos/*`

Para contratos de endpoints:

1. `openapi/openapi.yaml` y `openapi/paths/*`
2. Rutas runtime en `src/*/routes/*.ts`

Regla global:

- Si no esta en `openapi/`, no existe para integracion frontend.

## 3. Contexto real del repositorio

### 3.1 Stack confirmado

- Runtime: Node.js LTS
- Lenguaje: TypeScript strict
- HTTP: Express 4.x
- DB: MongoDB 7.x replica set
- ODM: Mongoose 8.x
- Validacion: Zod 3.x
- Contrato API: OpenAPI 3.1

### 3.2 Estado de etapas (evidencia real de cierre)

- Etapa 0-1: Cerrada
- Etapa 2: Cerrada
- Etapa 3: Cerrada
- Etapa 4: Cerrada
- Etapa 5: Cerrada
- Etapa 6: Cerrada
- Etapa 7: Cerrada
- Etapa 8: Cerrada
- Etapa 9 (CRM): Cerrada
- Etapa 10 (HR): Cerrada
- Etapa 11 (hardening/readiness): Cerrada
- Estado release gate: NO-GO por bloqueo externo de billing en GitHub Actions (no bloquea integracion frontend local)

## 4. Contratos globales que Frontend debe respetar

### 4.1 Convenciones de rutas

- Health: `GET /health` (fuera de `/api/v1`)
- Prefijo API negocio: `/api/v1/*`

### 4.2 Envelope de exito

```json
{
  "success": true,
  "data": {},
  "traceId": "uuid"
}
```

Exito paginado incluye:

```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 0,
      "totalPages": 0
    }
  },
  "traceId": "uuid"
}
```

### 4.3 Envelope de error

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
  "traceId": "uuid"
}
```

### 4.4 Modos de autenticacion

- Modo browser:
  - Access token en cookie HttpOnly (`AUTH_ACCESS_COOKIE_NAME`)
  - Refresh token en cookie HttpOnly (`REFRESH_TOKEN_COOKIE_NAME`)
  - Cookie CSRF (`CSRF_COOKIE_NAME`, no HttpOnly)
  - Requests mutables en cookie-auth requieren `X-CSRF-Token` con valor double-submit
- Modo headless:
  - `Authorization: Bearer <accessToken>`
  - Refresh headless usa token en body

### 4.5 Contexto tenant

- Header: `X-Tenant-Id`
- Requerido en rutas tenant-scoped salvo contratos explicitos de switch/token bound.
- Frontend debe enviar tenant activo en toda llamada tenant-scoped.

### 4.6 Trazabilidad

- Toda respuesta incluye `traceId`.
- Frontend debe registrar y exponer `traceId` en monitoreo y soporte.

## 5. Variables de entorno relevantes para Frontend

Valores en `.env.example` usados por contrato:

- `APP_URL`
- `FRONTEND_URL`
- `APP_NAME`
- `APP_VERSION`
- `AUTH_ACCESS_COOKIE_NAME`
- `REFRESH_TOKEN_COOKIE_NAME`
- `CSRF_COOKIE_NAME`
- `COOKIE_DOMAIN`
- `COOKIE_SECURE`
- `COOKIE_SAME_SITE`
- `CORS_ORIGINS`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX_GLOBAL`
- `RATE_LIMIT_MAX_AUTH`
- `RATE_LIMIT_MAX_SENSITIVE`

Importante:

- OpenAPI documenta hoy nombres de cookies `__at` y `__rf`. Mantener alineacion con env para evitar drift en codegen cliente.

## 6. Indice de endpoints para integracion Frontend

### 6.1 Plataforma y Health

| Metodo | Ruta | Auth | X-CSRF-Token | X-Tenant-Id | Permiso / Guarda |
|---|---|---|---|---|---|
| GET | `/health` | Publico | No | No | Ninguna |
| GET | `/api/v1/platform/settings` | Bearer o cookie | No | No | `platform:settings:read` |
| PATCH | `/api/v1/platform/settings` | Bearer o cookie | Condicional (cookie auth) | No | `platform:settings:update` |

### 6.2 Auth

| Metodo | Ruta | Modo | X-CSRF-Token | Notas |
|---|---|---|---|---|
| POST | `/api/v1/auth/register` | Publico | No | Crea usuario y retorna metadata de verificacion |
| POST | `/api/v1/auth/login/browser` | Browser | No | Setea cookies access + refresh + csrf |
| POST | `/api/v1/auth/login/headless` | Headless | No | Retorna `accessToken` + `refreshToken` en body |
| POST | `/api/v1/auth/verify-email` | Publico | No | Verificacion de email por token |
| POST | `/api/v1/auth/refresh/browser` | Browser | Requerido | Rota cookies access + refresh + csrf |
| POST | `/api/v1/auth/refresh/headless` | Headless | No | Requiere refresh token en body |
| POST | `/api/v1/auth/2fa/setup` | Browser o headless | Condicional | Requiere sesion autenticada |
| POST | `/api/v1/auth/2fa/confirm` | Browser o headless | Condicional | Requiere sesion autenticada |
| POST | `/api/v1/auth/2fa/disable` | Browser o headless | Condicional | Requiere sesion autenticada |
| POST | `/api/v1/auth/recovery-codes/regenerate` | Browser o headless | Condicional | Requiere sesion autenticada |
| POST | `/api/v1/auth/logout` | Browser o headless | Condicional | Limpia cookies auth en flujo browser |
| POST | `/api/v1/auth/logout-all` | Browser o headless | Condicional | Limpia cookies auth en flujo browser |

### 6.3 Tenant Core y Tenant Settings

| Metodo | Ruta | Auth | X-CSRF-Token | X-Tenant-Id | Permiso / Guarda |
|---|---|---|---|---|---|
| POST | `/api/v1/tenant` | Bearer o cookie | Condicional | No | Auth requerida |
| GET | `/api/v1/tenant/mine` | Bearer o cookie | No | No | Auth requerida |
| POST | `/api/v1/tenant/switch` | Bearer o cookie | Condicional | No | Auth requerida |
| POST | `/api/v1/tenant/invitations` | Bearer o cookie | Condicional | Requerido | Contexto tenant + validacion owner actual |
| POST | `/api/v1/tenant/invitations/accept` | Bearer o cookie | Condicional | No | Auth requerida |
| POST | `/api/v1/tenant/invitations/revoke` | Bearer o cookie | Condicional | Requerido | Contexto tenant + validacion owner actual |
| POST | `/api/v1/tenant/transfer-ownership` | Bearer o cookie | Condicional | Requerido | Contexto tenant + validacion owner actual |
| GET | `/api/v1/tenant/settings` | Bearer o cookie | No | Requerido | `tenant:settings:read` |
| PATCH | `/api/v1/tenant/settings` | Bearer o cookie | Condicional | Requerido | `tenant:settings:update` |
| GET | `/api/v1/tenant/settings/effective` | Bearer o cookie | No | Requerido | `tenant:settings:read` |

### 6.4 Auditoria

| Metodo | Ruta | Auth | X-CSRF-Token | X-Tenant-Id | Permiso / Guarda |
|---|---|---|---|---|---|
| GET | `/api/v1/audit` | Bearer o cookie | No | Requerido | `tenant:audit:read` |

Query params:

- `page`, `limit`
- `action`
- `resourceType`
- `severity`
- `actorKind`
- `from`, `to`

### 6.5 Modulo Inventory

Todas las rutas inventory:

- Base: `/api/v1/modules/inventory/*`
- Auth: Bearer o cookie
- Guarda: `tenant:modules:inventory:use`
- Header: `X-Tenant-Id` requerido
- CSRF: requerido en mutaciones de cookie-auth

Endpoints:

- `POST /api/v1/modules/inventory/categories`
- `GET /api/v1/modules/inventory/categories`
- `PATCH /api/v1/modules/inventory/categories/{categoryId}`
- `DELETE /api/v1/modules/inventory/categories/{categoryId}`
- `POST /api/v1/modules/inventory/items`
- `GET /api/v1/modules/inventory/items`
- `GET /api/v1/modules/inventory/items/{itemId}`
- `PATCH /api/v1/modules/inventory/items/{itemId}`
- `DELETE /api/v1/modules/inventory/items/{itemId}`
- `POST /api/v1/modules/inventory/stock-movements`
- `GET /api/v1/modules/inventory/stock-movements`
- `GET /api/v1/modules/inventory/alerts/low-stock`

### 6.6 Modulo CRM

Todas las rutas CRM:

- Base: `/api/v1/modules/crm/*`
- Auth: Bearer o cookie
- Guarda: `tenant:modules:crm:use`
- Header: `X-Tenant-Id` requerido
- CSRF: requerido en mutaciones de cookie-auth

Modelo de permisos:

- Lectura: `tenant:crm:read`
- Escritura: `tenant:crm:write`
- Eliminacion: `tenant:crm:delete`
- Cambio de etapa: `tenant:crm:stage:update`

Endpoints:

- `GET/POST /api/v1/modules/crm/contacts`
- `GET/PATCH/DELETE /api/v1/modules/crm/contacts/{contactId}`
- `GET/POST /api/v1/modules/crm/organizations`
- `GET/PATCH/DELETE /api/v1/modules/crm/organizations/{organizationId}`
- `GET/POST /api/v1/modules/crm/opportunities`
- `GET/PATCH/DELETE /api/v1/modules/crm/opportunities/{opportunityId}`
- `PATCH /api/v1/modules/crm/opportunities/{opportunityId}/stage`
- `GET/POST /api/v1/modules/crm/activities`
- `GET /api/v1/modules/crm/counters`

### 6.7 Modulo HR

Todas las rutas HR:

- Base: `/api/v1/modules/hr/*`
- Auth: Bearer o cookie
- Guarda: `tenant:modules:hr:use`
- Header: `X-Tenant-Id` requerido
- CSRF: requerido en mutaciones de cookie-auth

Modelo de permisos:

- Lectura empleado: `tenant:hr:employee:read`
- Escritura empleado: `tenant:hr:employee:write`
- Eliminacion empleado: `tenant:hr:employee:delete`
- Lectura compensacion: `tenant:hr:compensation:read`
- Actualizacion compensacion: `tenant:hr:compensation:update`

Endpoints:

- `GET/POST /api/v1/modules/hr/employees`
- `GET/PATCH/DELETE /api/v1/modules/hr/employees/{employeeId}`
- `GET/PATCH /api/v1/modules/hr/employees/{employeeId}/compensation`

## 7. Flujo de sesion browser y CSRF

### 7.1 Login browser y runtime normal

1. Frontend llama `POST /api/v1/auth/login/browser`.
2. Backend setea cookies access, refresh y csrf.
3. Frontend envia `credentials: include` para transporte cookie.
4. Para mutaciones cookie-auth, frontend envia `X-CSRF-Token` igual al valor de cookie csrf.

### 7.2 Refresh browser

1. Ante expiracion auth, llamar `POST /api/v1/auth/refresh/browser`.
2. Incluir `X-CSRF-Token`.
3. Backend rota cookies access + refresh + csrf.
4. Reintentar request original una sola vez.

### 7.3 Comportamiento de switch tenant

- `POST /api/v1/tenant/switch` retorna:
  - Browser: `tenant` + `membership` en body, access token por cookie, csrf cookie regenerada
  - Headless: `tenant` + `membership` + `accessToken` en body
- Frontend debe actualizar `tenantId` activo y limpiar cache tenant-scoped.

## 8. Contrato del cliente HTTP Frontend

Usar un cliente API compartido con:

- `baseURL = APP_URL`
- `credentials = include` en modo browser
- inyeccion automatica de `X-Tenant-Id` para rutas tenant-scoped
- inyeccion automatica de `X-CSRF-Token` para mutaciones cookie-auth
- reintento unico por 401 via refresh browser
- interceptor de respuesta para normalizar envelope de error y capturar `traceId`

Pseudo-codigo de referencia:

```ts
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function needsTenant(path: string): boolean {
  return path.startsWith('/api/v1/audit')
    || path.startsWith('/api/v1/tenant/settings')
    || path.startsWith('/api/v1/modules/');
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers ?? {});

  if (needsTenant(path)) {
    headers.set('X-Tenant-Id', session.activeTenantId);
  }

  if (MUTATING.has(method) && session.mode === 'browser') {
    const csrf = readCookie(process.env.CSRF_COOKIE_NAME);
    if (csrf) headers.set('X-CSRF-Token', csrf);
  }

  const response = await fetch(`${process.env.APP_URL}${path}`, {
    ...init,
    method,
    credentials: 'include',
    headers
  });

  const payload = await response.json();

  if (!response.ok) {
    throw { status: response.status, traceId: payload?.traceId, error: payload?.error };
  }

  return payload;
}
```

## 9. Estrategia de guardas UI (RBAC, plan, modulos, feature flags)

Leer desde payloads runtime:

- Resumen tenant desde `/api/v1/tenant/mine`
- Settings efectivos runtime desde `/api/v1/tenant/settings/effective`

Definiciones de catalogo disponibles:

- Roles: `platform:super_admin`, `tenant:owner`, `tenant:member`
- Modulos: `inventory`, `crm`, `hr`
- Feature flags: `inventory:base`, `inventory:analytics`, `crm:base`, `hr:base`
- Planes: `plan:starter`, `plan:growth`

Politica frontend:

- Ocultar ruta/menu si modulo no esta habilitado en runtime efectivo.
- Ocultar acciones si faltan permisos requeridos.
- Backend siempre es autoridad final (la guarda UI es UX, no frontera de seguridad).

## 10. Brechas conocidas y endpoints inexistentes (estado actual)

Los siguientes requerimientos frontend no estan expuestos en OpenAPI hoy:

- Endpoints de forgot password
- Endpoints de reset password
- Endpoints CRUD de memberships para listar/actualizar/remover miembros
- Endpoints publicos de gestion de roles/permisos
- Endpoint publico de auditoria plataforma (`platform-audit` existe en codigo pero no esta montado en router raiz/OpenAPI)
- Endpoint publico de docs OpenAPI runtime (no existe mount `/api/v1/docs`)

Politica:

- Marcar estos puntos como dependencias backend.
- No implementar llamadas frontend especulativas hacia esos endpoints.

## 11. Roadmap de entrega Frontend alineado al backend real

### Onda 1: Acceso y sesion core

- Login/register/verify email
- Manejo de sesion browser/headless
- CSRF y refresh retry
- Shell autenticado basico

### Onda 2: Contexto tenant y settings

- Tenant list/create/switch
- Invitation accept/create/revoke
- Tenant settings + effective settings
- Platform settings (solo usuarios platform-scoped)

### Onda 3: Auditoria e inventory piloto

- Lista de auditoria con filtros y paginacion
- CRUD completo inventory + stock movements + low-stock alerts

### Onda 4: CRM y HR

- UI CRM completa por set de permisos
- UI HR completa por set de permisos y restricciones de privacidad

### Onda 5: Hardening

- Observabilidad de errores con correlacion por `traceId`
- Invalidacion cache en logout y tenant switch
- UX de rate-limit para rutas auth/sensibles
- Flujos E2E para auth, tenant switch, inventory CRUD, rutas criticas CRM/HR

## 12. Flujos UX para usuarios finales (operacional)

Esta seccion define comportamiento UX esperado. Los detalles visuales de implementacion siguen siendo responsabilidad del equipo Frontend.

### 12.1 Reglas UX globales

- Nunca exponer tokens en UI o local storage en modo browser.
- Preservar y mostrar `traceId` en errores recuperables y no recuperables.
- Limpiar datos tenant-scoped inmediatamente despues de tenant switch y logout.
- Usar `error.code` estable para decisiones de mensajes UX; no depender de `error.message`.
- Para denegaciones por permiso/modulo, renderizar estado explicito de "sin acceso".

### 12.2 UX de autenticacion

#### A. Registro y verificacion de email

1. Usuario envia formulario de registro.
2. Frontend llama `POST /api/v1/auth/register`.
3. Si exito, mostrar estado "verificacion requerida" con siguiente paso.
4. Usuario completa verificacion via `POST /api/v1/auth/verify-email`.
5. Redirigir a login tras verificacion exitosa.

UX de error:

- `409`: mostrar guia de cuenta ya existente.
- `400`: renderizar errores de campo desde `error.details`.
- `429`: mostrar enfriamiento y sugerencia de reintento.

#### B. Login browser y bootstrap de sesion

1. Usuario envia credenciales.
2. Frontend llama `POST /api/v1/auth/login/browser`.
3. En exito, inicializar contexto de sesion y enrutar por disponibilidad de tenants:
   - sin tenants: ir a onboarding de creacion tenant
   - con tenants: ir a selector tenant o dashboard activo
4. Guardar solo metadata no sensible de sesion en estado de app.

UX de error:

- `401` credenciales invalidas -> error inline en credenciales.
- `403` restriccion de politica auth -> estado de cuenta restringida.
- `423` bloqueo -> mensaje de lockout y ruta de soporte.

#### C. Flujos de challenge 2FA

- Setup: `POST /api/v1/auth/2fa/setup`
- Confirm: `POST /api/v1/auth/2fa/confirm`
- Disable: `POST /api/v1/auth/2fa/disable`
- Recovery codes: `POST /api/v1/auth/recovery-codes/regenerate`

Reglas UX:

- Mantener vista dedicada de seguridad.
- Para disable/regenerate, exigir confirmacion explicita.
- Mostrar advertencias de irreversibilidad al regenerar recovery codes.

#### D. Refresh silencioso y falla dura de sesion

1. Ante 401 en request browser autenticado, intentar un refresh:
   - `POST /api/v1/auth/refresh/browser` con `X-CSRF-Token`
2. Si refresh exito, reintentar request original una vez.
3. Si refresh falla, limpiar sesion local y redirigir a login con estado "sesion expirada".

### 12.3 UX tenant

#### A. Seleccion y switch tenant

1. Cargar `GET /api/v1/tenant/mine`.
2. Permitir elegir tenant activo si hay multiples.
3. Llamar `POST /api/v1/tenant/switch`.
4. En exito:
   - actualizar tenant activo
   - limpiar cache tenant
   - refetch de settings efectivos, permisos y feature flags
   - navegar a dashboard tenant

#### B. Onboarding tenant

1. Usuario nuevo sin tenants aterriza en onboarding.
2. Crear tenant con `POST /api/v1/tenant`.
3. Refrescar lista de tenants y fijar tenant activo.

#### C. Invitaciones y transferencia de ownership

- Crear invitacion: `POST /api/v1/tenant/invitations`
- Aceptar invitacion: `POST /api/v1/tenant/invitations/accept`
- Revocar invitacion: `POST /api/v1/tenant/invitations/revoke`
- Transferir ownership: `POST /api/v1/tenant/transfer-ownership`

Reglas UX:

- Mostrar acciones de invitaciones/ownership solo a usuarios con capacidad efectiva de owner.
- Tras aceptar invitacion, refrescar lista tenant y pedir seleccion tenant.
- Tras transferir ownership, refrescar permisos y ocultar acciones owner-only si corresponde.

### 12.4 UX de settings

#### A. Platform settings

- Lectura: `GET /api/v1/platform/settings`
- Actualizacion: `PATCH /api/v1/platform/settings`

Comportamiento UX:

- Mostrar solo a usuarios platform-scoped autorizados.
- Estados explicitos de guardado: idle -> saving -> success/error.
- Ante `403`, redirigir a estado sin acceso.

#### B. Tenant settings y vista efectiva

- Lectura singleton: `GET /api/v1/tenant/settings`
- Actualizacion: `PATCH /api/v1/tenant/settings`
- Lectura vista efectiva: `GET /api/v1/tenant/settings/effective`

Comportamiento UX:

- Mostrar valores con fuente (valor tenant vs valor runtime efectivo).
- Tras actualizar, refrescar vista efectiva antes de confirmar cierre UX.

### 12.5 UX de auditoria

- Endpoint: `GET /api/v1/audit`
- Filtros: `action`, `resourceType`, `severity`, `actorKind`, `from`, `to`, paginacion

Comportamiento UX:

- Orden por defecto: mas reciente primero.
- Persistir estado de filtros en URL.
- Mostrar empty-state claro para "sin eventos con filtros actuales".
- Dejar tabla preparada para export futuro si se habilita.

### 12.6 UX de inventory

Endpoints bajo `/api/v1/modules/inventory/*`.

Reglas UX:

- Separar vistas de categorias e items.
- Usar paginacion y filtro server-side para volumen alto.
- Ante conflictos/validaciones de stock movement, mostrar guia de correccion y conservar datos de formulario.
- Mostrar low-stock alerts como widgets de alta prioridad.

### 12.7 UX de CRM

Endpoints bajo `/api/v1/modules/crm/*`.

Reglas UX:

- Gate de modulo por `tenant:modules:crm:use`.
- Gate de acciones por permisos `tenant:crm:*`.
- Soportar UX de cambio de etapa con confirmacion explicita en transiciones criticas.
- Mostrar `counters` en cards y refrescar tras mutaciones.

### 12.8 UX de HR

Endpoints bajo `/api/v1/modules/hr/*`.

Reglas UX:

- Render estricto por permisos en secciones de empleados y compensacion.
- Ocultar campos de compensacion cuando no haya permiso.
- Mostrar copy orientado a privacidad en pantallas de datos sensibles.
- Ante error de validacion jerarquica, mostrar guia especifica de ciclo de manager.

### 12.9 UX de errores y rate limit

- `400`: validacion inline desde `error.details`.
- `401`: flujo de no autenticado/sesion expirada.
- `403`: estado sin acceso sin loops de reintento.
- `404`: estado no encontrado con navegacion contextual.
- `409`: guia de resolucion de conflicto.
- `429`: banner de enfriamiento segun perfil (auth/sensible/global).
- `5xx`: estado generico de falla mostrando `traceId` para soporte.

### 12.10 Criterios de aceptacion UX (listo para handoff)

- Toda mutacion browser envia CSRF automaticamente.
- Toda ruta tenant-scoped envia `X-Tenant-Id` activo.
- Flujo de sesion expirada funciona sin callejones sin salida para usuario.
- Tenant switch resetea cache tenant y refetch de contexto runtime.
- Estados sin acceso son explicitos y testeables.
- Vistas de error siempre exponen `traceId`.
- Ninguna pantalla llama endpoints no existentes listados en seccion 10.

## 13. Checklist de integracion Frontend

- [ ] Cliente HTTP global aplica envelopes y extrae `traceId`.
- [ ] Modo browser usa `credentials: include`.
- [ ] Header CSRF se envia en mutaciones cookie-auth.
- [ ] Rutas tenant-scoped siempre incluyen `X-Tenant-Id`.
- [ ] Tenant switch limpia cache tenant y rehidrata runtime settings.
- [ ] Guardas de ruta son permission-aware y module-aware.
- [ ] UI de error usa `error.code` estable y muestra `traceId`.
- [ ] Ninguna llamada frontend apunta a endpoints fuera de OpenAPI.

## 14. Regla de mantenimiento documental

Ante cualquier cambio de API o contrato:

1. Actualizar OpenAPI primero.
2. Actualizar implementacion runtime.
3. Actualizar este documento en el mismo PR.
4. Si endpoint aun no existe, marcarlo como dependencia backend (bloqueo explicito).

## 15. Documentos operativos complementarios

Para ejecucion diaria del equipo frontend usar ademas:

- `docs/frontend/FRONTEND_ACCESS_MATRIX.md`
- `docs/frontend/FRONTEND_ERROR_CATALOG.md`
- `docs/frontend/FRONTEND_STATE_AND_CACHE_POLICY.md`
- `docs/frontend/FRONTEND_API_CLIENT_STANDARD.md`
- `docs/frontend/FRONTEND_MOCKING_GUIDE.md`
- `docs/frontend/FRONTEND_E2E_CRITICAL_FLOWS.md`
- `docs/frontend/FRONTEND_BACKEND_DEPENDENCIES.md`
- `docs/frontend/FRONTEND_DOD_CHECKLIST.md`
