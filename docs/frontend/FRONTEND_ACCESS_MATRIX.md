# Matriz de Acceso Frontend

Version: 1.0.0  
Estado: Activo  
Ultima actualizacion: 2026-03-08

## 1. Proposito

Definir la relacion entre rutas UI, endpoints backend, permisos, modulos y restricciones de plan para implementar guardas frontend sin ambiguedad.

## 2. Reglas de uso

- Esta matriz no reemplaza autorizacion backend.
- Si una ruta no existe en OpenAPI, no se agrega aqui.
- Si hay conflicto, priorizar `openapi/*` y runtime routes.

## 3. Matriz de acceso

| Area | Ruta UI sugerida | Endpoint backend | Auth | X-Tenant-Id | Permiso minimo | Modulo/Plan | Notas UX |
|---|---|---|---|---|---|---|---|
| Health | `/health` (tecnica) | `GET /health` | Publico | No | Ninguno | N/A | No es vista de negocio |
| Registro | `/register` | `POST /api/v1/auth/register` | Publico | No | Ninguno | N/A | Puede derivar en verificacion de email |
| Verificar email | `/verify-email` | `POST /api/v1/auth/verify-email` | Publico | No | Ninguno | N/A | Token por canal externo |
| Login browser | `/login` | `POST /api/v1/auth/login/browser` | Publico | No | Ninguno | N/A | Setea cookies access/refresh/csrf |
| Login headless | N/A (integracion) | `POST /api/v1/auth/login/headless` | Publico | No | Ninguno | N/A | Uso API client externo |
| Seguridad 2FA | `/app/settings/security` | `POST /api/v1/auth/2fa/setup` | Requerida | No | Sesion autenticada | N/A | CSRF en cookie-auth |
| Seguridad 2FA | `/app/settings/security` | `POST /api/v1/auth/2fa/confirm` | Requerida | No | Sesion autenticada | N/A | CSRF en cookie-auth |
| Seguridad 2FA | `/app/settings/security` | `POST /api/v1/auth/2fa/disable` | Requerida | No | Sesion autenticada | N/A | CSRF en cookie-auth |
| Recovery codes | `/app/settings/security` | `POST /api/v1/auth/recovery-codes/regenerate` | Requerida | No | Sesion autenticada | N/A | Accion sensible |
| Logout | `/logout` | `POST /api/v1/auth/logout` | Requerida | No | Sesion autenticada | N/A | Limpia cookies en browser |
| Logout global | `/logout-all` | `POST /api/v1/auth/logout-all` | Requerida | No | Sesion autenticada | N/A | Revoca sesiones |
| Mis tenants | `/app/tenants` | `GET /api/v1/tenant/mine` | Requerida | No | Sesion autenticada | N/A | Base de selector tenant |
| Crear tenant | `/app/tenants/create` | `POST /api/v1/tenant` | Requerida | No | Sesion autenticada | N/A | CSRF en cookie-auth |
| Switch tenant | `/app/tenants/select` | `POST /api/v1/tenant/switch` | Requerida | No | Sesion autenticada | N/A | Debe resetear cache tenant |
| Crear invitacion | `/app/members/invitations` | `POST /api/v1/tenant/invitations` | Requerida | Si | Capacidad owner efectiva | N/A | CSRF en cookie-auth |
| Aceptar invitacion | `/accept-invitation` | `POST /api/v1/tenant/invitations/accept` | Requerida | No | Sesion autenticada | N/A | Token de invitacion |
| Revocar invitacion | `/app/members/invitations` | `POST /api/v1/tenant/invitations/revoke` | Requerida | Si | Capacidad owner efectiva | N/A | CSRF en cookie-auth |
| Transferir ownership | `/app/tenant/ownership` | `POST /api/v1/tenant/transfer-ownership` | Requerida | Si | Capacidad owner efectiva | N/A | CSRF en cookie-auth |
| Tenant settings (read) | `/app/settings/tenant` | `GET /api/v1/tenant/settings` | Requerida | Si | `tenant:settings:read` | N/A | |
| Tenant settings (update) | `/app/settings/tenant` | `PATCH /api/v1/tenant/settings` | Requerida | Si | `tenant:settings:update` | N/A | CSRF en cookie-auth |
| Tenant settings effective | `/app/settings/tenant/effective` | `GET /api/v1/tenant/settings/effective` | Requerida | Si | `tenant:settings:read` | N/A | Fuente para gating runtime |
| Platform settings (read) | `/app/settings/platform` | `GET /api/v1/platform/settings` | Requerida | No | `platform:settings:read` | N/A | Solo usuarios platform-scoped |
| Platform settings (update) | `/app/settings/platform` | `PATCH /api/v1/platform/settings` | Requerida | No | `platform:settings:update` | N/A | CSRF en cookie-auth |
| Auditoria | `/app/audit` | `GET /api/v1/audit` | Requerida | Si | `tenant:audit:read` | N/A | Paginado + filtros |
| Inventory categorias | `/app/inventory/categories` | `GET/POST/PATCH/DELETE /api/v1/modules/inventory/categories*` | Requerida | Si | `tenant:modules:inventory:use` | Modulo `inventory` habilitado por plan/runtime | Mutaciones con CSRF en cookie-auth |
| Inventory items | `/app/inventory/items` | `GET/POST/PATCH/DELETE /api/v1/modules/inventory/items*` | Requerida | Si | `tenant:modules:inventory:use` | Modulo `inventory` habilitado por plan/runtime | |
| Inventory stock | `/app/inventory/stock` | `GET/POST /api/v1/modules/inventory/stock-movements` | Requerida | Si | `tenant:modules:inventory:use` | Modulo `inventory` habilitado por plan/runtime | Manejar `INV_STOCK_CONFLICT` |
| Inventory alertas | `/app/inventory/alerts` | `GET /api/v1/modules/inventory/alerts/low-stock` | Requerida | Si | `tenant:modules:inventory:use` | Modulo `inventory` habilitado por plan/runtime | |
| CRM contactos | `/app/crm/contacts` | `GET/POST /api/v1/modules/crm/contacts` | Requerida | Si | `tenant:modules:crm:use` + `tenant:crm:read/write` | Modulo `crm` habilitado por plan/runtime | |
| CRM contacto detalle | `/app/crm/contacts/:id` | `GET/PATCH/DELETE /api/v1/modules/crm/contacts/{contactId}` | Requerida | Si | `tenant:crm:read/write/delete` | Modulo `crm` habilitado por plan/runtime | |
| CRM organizaciones | `/app/crm/organizations` | `GET/POST /api/v1/modules/crm/organizations` | Requerida | Si | `tenant:crm:read/write` | Modulo `crm` habilitado por plan/runtime | |
| CRM oportunidades | `/app/crm/opportunities` | `GET/POST /api/v1/modules/crm/opportunities` | Requerida | Si | `tenant:crm:read/write` | Modulo `crm` habilitado por plan/runtime | |
| CRM oportunidad detalle | `/app/crm/opportunities/:id` | `GET/PATCH/DELETE /api/v1/modules/crm/opportunities/{opportunityId}` | Requerida | Si | `tenant:crm:read/write/delete` | Modulo `crm` habilitado por plan/runtime | |
| CRM cambio etapa | `/app/crm/opportunities/:id/stage` | `PATCH /api/v1/modules/crm/opportunities/{opportunityId}/stage` | Requerida | Si | `tenant:crm:stage:update` | Modulo `crm` habilitado por plan/runtime | |
| CRM actividades | `/app/crm/activities` | `GET/POST /api/v1/modules/crm/activities` | Requerida | Si | `tenant:crm:read/write` | Modulo `crm` habilitado por plan/runtime | |
| CRM counters | `/app/crm/dashboard` | `GET /api/v1/modules/crm/counters` | Requerida | Si | `tenant:crm:read` | Modulo `crm` habilitado por plan/runtime | |
| HR empleados | `/app/hr/employees` | `GET/POST /api/v1/modules/hr/employees` | Requerida | Si | `tenant:modules:hr:use` + `tenant:hr:employee:read/write` | Modulo `hr` habilitado por plan/runtime | |
| HR empleado detalle | `/app/hr/employees/:id` | `GET/PATCH/DELETE /api/v1/modules/hr/employees/{employeeId}` | Requerida | Si | `tenant:hr:employee:read/write/delete` | Modulo `hr` habilitado por plan/runtime | |
| HR compensacion | `/app/hr/employees/:id/compensation` | `GET/PATCH /api/v1/modules/hr/employees/{employeeId}/compensation` | Requerida | Si | `tenant:hr:compensation:read/update` | Modulo `hr` habilitado por plan/runtime | Pantalla sensible |

## 4. Endpoints sin cobertura UI formal (hoy)

- No hay contrato OpenAPI para:
  - forgot-password
  - reset-password
  - memberships CRUD (lista/cambio rol/eliminacion)
  - gestion publica de roles/permisos

Estos items deben quedar en `FRONTEND_BACKEND_DEPENDENCIES.md` como bloqueos de producto.
