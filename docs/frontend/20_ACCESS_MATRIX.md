# Matriz de Acceso Frontend

Version: 1.6.0
Estado: Activo
Ultima actualizacion: 2026-03-11

## 1. Proposito

Definir la relacion exacta entre rutas UI, endpoints backend, permisos y restricciones de modulo/plan para implementar guardas frontend sin ambiguedad.

## 2. Reglas de uso

- Esta matriz no reemplaza autorizacion backend.
- Si una ruta no existe en OpenAPI, no se implementa en frontend.
- Si hay conflicto, priorizar `openapi/*` y rutas runtime.

## 3. Matriz de acceso

| Area | Ruta UI sugerida | Endpoint backend | Auth | X-Tenant-Id | Permiso minimo | Modulo/Plan | Notas UX |
|---|---|---|---|---|---|---|---|
| Health | `/health` (tecnica) | `GET /health` | Publico | No | Ninguno | N/A | No es vista de negocio |
| Registro | `/register` | `POST /api/v1/auth/register` | Publico | No | Ninguno | N/A | Ack generico; no revelar existencia de cuenta |
| Reenviar verificacion | `/auth/verify-email` | `POST /api/v1/auth/resend-verification` | Publico | No | Ninguno | N/A | Confirmacion generica con cooldown |
| Verificar email | `/auth/verify-email` | `POST /api/v1/auth/verify-email` | Publico | No | Ninguno | N/A | Requiere `email` + `token` |
| Forgot password | `/auth/forgot-password` | `POST /api/v1/auth/forgot-password` | Publico | No | Ninguno | N/A | Ack generico; no revelar estado de cuenta |
| Reset password | `/auth/reset-password` | `POST /api/v1/auth/reset-password` | Publico | No | Ninguno | N/A | Requiere `email` + `token` + `newPassword` |
| Login browser | `/login` | `POST /api/v1/auth/login/browser` | Publico | No | Ninguno | N/A | Setea cookies access/refresh/csrf |
| Login headless | N/A (integracion) | `POST /api/v1/auth/login/headless` | Publico | No | Ninguno | N/A | Uso API client externo |
| Shell autenticado | `/app` | `POST /api/v1/auth/refresh/browser` + `GET /api/v1/tenant/mine` + `POST /api/v1/tenant/switch` | Requerida | No | Sesion autenticada | N/A | Bootstrap tenant al entrar directo |
| Refresh headless | N/A (integracion) | `POST /api/v1/auth/refresh/headless` | No (token en body) | No | Ninguno | N/A | Integracion de cliente headless |
| Seguridad 2FA setup | `/app/settings/security` | `POST /api/v1/auth/2fa/setup` | Requerida | No | Sesion autenticada | N/A | CSRF en cookie-auth |
| Seguridad 2FA confirm | `/app/settings/security` | `POST /api/v1/auth/2fa/confirm` | Requerida | No | Sesion autenticada | N/A | CSRF en cookie-auth |
| Seguridad 2FA disable | `/app/settings/security` | `POST /api/v1/auth/2fa/disable` | Requerida | No | Sesion autenticada | N/A | CSRF en cookie-auth |
| Recovery codes | `/app/settings/security` | `POST /api/v1/auth/recovery-codes/regenerate` | Requerida | No | Sesion autenticada | N/A | Accion sensible |
| Change password | `/app/settings/security` | `POST /api/v1/auth/change-password` | Requerida | No | Sesion autenticada | N/A | Revoca otras sesiones activas |
| Logout | `/logout` | `POST /api/v1/auth/logout` | Requerida | No | Sesion autenticada | N/A | Redirige a `/login?loggedOut=1` |
| Logout global | `/logout-all` | `POST /api/v1/auth/logout-all` | Requerida | No | Sesion autenticada | N/A | Redirige a `/login?loggedOut=all` |
| Mis tenants | `/app/tenants` | `GET /api/v1/tenant/mine` | Requerida | No | Sesion autenticada | N/A | Hub de tenants |
| Crear tenant | `/app/tenants/create` | `POST /api/v1/tenant` + `POST /api/v1/tenant/switch` | Requerida | No | Sesion autenticada | N/A | Crea tenant y fija contexto activo |
| Switch tenant | `/app/tenants/select` | `GET /api/v1/tenant/mine` + `POST /api/v1/tenant/switch` | Requerida | No | Sesion autenticada | N/A | `tenant/switch` sin `X-Tenant-Id` |
| Crear invitacion | `/app/members/invitations` | `POST /api/v1/tenant/invitations` | Requerida | Si | Capacidad owner efectiva | N/A | CSRF en cookie-auth |
| Aceptar invitacion | `/accept-invitation` | `POST /api/v1/tenant/invitations/accept` | Requerida | No | Sesion autenticada | N/A | Ruta token-bound sin `X-Tenant-Id` |
| Revocar invitacion | `/app/members/invitations` | `POST /api/v1/tenant/invitations/revoke` | Requerida | Si | Capacidad owner efectiva | N/A | CSRF en cookie-auth |
| Transferir ownership | `/app/tenant/ownership` | `POST /api/v1/tenant/transfer-ownership` | Requerida | Si | Capacidad owner efectiva | N/A | CSRF en cookie-auth |
| Tenant settings read | `/app/settings/tenant` | `GET /api/v1/tenant/settings` | Requerida | Si | `tenant:settings:read` | N/A | Carga singleton |
| Tenant settings update | `/app/settings/tenant` | `PATCH /api/v1/tenant/settings` | Requerida | Si | `tenant:settings:update` | N/A | Refetch runtime efectivo |
| Tenant settings effective | `/app/settings/tenant/effective` | `GET /api/v1/tenant/settings/effective` | Requerida | Si | `tenant:settings:read` | N/A | Fuente para plan/modulos/features |
| Billing planes | `/app/settings/billing` | `GET /api/v1/billing/plans` | Requerida | No | Sesion autenticada | N/A | Catalogo para seleccion de plan |
| Billing checkout session | `/app/settings/billing` | `POST /api/v1/billing/checkout/session` | Requerida | Si | `tenant:settings:update` | N/A | Inicia checkout; requiere CSRF en cookie-auth |
| Tenant subscription assign | `/app/settings/billing` | `PATCH /api/v1/tenant/subscription` | Requerida | Si | `tenant:settings:update` (runtime owner) | N/A | Asigna/cambia plan y modulos del tenant |
| Tenant subscription cancel | `/app/settings/billing` | `DELETE /api/v1/tenant/subscription` | Requerida | Si | `tenant:settings:update` (runtime owner) | N/A | Cancela plan y limpia modulos activos |
| Billing webhooks provider | N/A UI (sistema) | `POST /api/v1/billing/webhooks/provider` | System-to-system | No | N/A | N/A | Endpoint exclusivo backend/provider; no consumo FE |
| Platform settings read | `/app/settings/platform` | `GET /api/v1/platform/settings` | Requerida | No | `platform:settings:read` | N/A | Solo usuarios platform-scoped |
| Platform settings update | `/app/settings/platform` | `PATCH /api/v1/platform/settings` | Requerida | No | `platform:settings:update` | N/A | CSRF en cookie-auth |
| Auditoria tenant | `/app/audit` | `GET /api/v1/audit` | Requerida | Si | `tenant:audit:read` | N/A | Filtros + paginacion |
| Inventory categorias | `/app/inventory/categories` | `GET/POST /api/v1/modules/inventory/categories` | Requerida | Si | `tenant:modules:inventory:use` | Modulo `inventory` habilitado | Mutaciones con CSRF |
| Inventory categoria detalle | `/app/inventory/categories/:id` | `PATCH/DELETE /api/v1/modules/inventory/categories/{categoryId}` | Requerida | Si | `tenant:modules:inventory:use` | Modulo `inventory` habilitado | |
| Inventory items | `/app/inventory/items` | `GET/POST /api/v1/modules/inventory/items` | Requerida | Si | `tenant:modules:inventory:use` | Modulo `inventory` habilitado | |
| Inventory item detalle | `/app/inventory/items/:id` | `GET/PATCH/DELETE /api/v1/modules/inventory/items/{itemId}` | Requerida | Si | `tenant:modules:inventory:use` | Modulo `inventory` habilitado | |
| Inventory stock | `/app/inventory/stock` | `GET/POST /api/v1/modules/inventory/stock-movements` | Requerida | Si | `tenant:modules:inventory:use` | Modulo `inventory` habilitado | Manejar `INV_STOCK_CONFLICT` |
| Inventory alertas | `/app/inventory/alerts` | `GET /api/v1/modules/inventory/alerts/low-stock` | Requerida | Si | `tenant:modules:inventory:use` | Modulo `inventory` habilitado | |
| CRM contactos | `/app/crm/contacts` | `GET/POST /api/v1/modules/crm/contacts` | Requerida | Si | `tenant:modules:crm:use` + `tenant:crm:read/write` | Modulo `crm` habilitado | |
| CRM contacto detalle | `/app/crm/contacts/:id` | `GET/PATCH/DELETE /api/v1/modules/crm/contacts/{contactId}` | Requerida | Si | `tenant:crm:read/write/delete` | Modulo `crm` habilitado | |
| CRM organizaciones | `/app/crm/organizations` | `GET/POST /api/v1/modules/crm/organizations` | Requerida | Si | `tenant:crm:read/write` | Modulo `crm` habilitado | |
| CRM organizacion detalle | `/app/crm/organizations/:id` | `GET/PATCH/DELETE /api/v1/modules/crm/organizations/{organizationId}` | Requerida | Si | `tenant:crm:read/write/delete` | Modulo `crm` habilitado | |
| CRM oportunidades | `/app/crm/opportunities` | `GET/POST /api/v1/modules/crm/opportunities` | Requerida | Si | `tenant:crm:read/write` | Modulo `crm` habilitado | |
| CRM oportunidad detalle | `/app/crm/opportunities/:id` | `GET/PATCH/DELETE /api/v1/modules/crm/opportunities/{opportunityId}` | Requerida | Si | `tenant:crm:read/write/delete` | Modulo `crm` habilitado | |
| CRM cambio etapa | `/app/crm/opportunities/:id/stage` | `PATCH /api/v1/modules/crm/opportunities/{opportunityId}/stage` | Requerida | Si | `tenant:crm:stage:update` | Modulo `crm` habilitado | |
| CRM actividades | `/app/crm/activities` | `GET/POST /api/v1/modules/crm/activities` | Requerida | Si | `tenant:crm:read/write` | Modulo `crm` habilitado | |
| CRM counters | `/app/crm/dashboard` | `GET /api/v1/modules/crm/counters` | Requerida | Si | `tenant:crm:read` | Modulo `crm` habilitado | Refetch tras mutaciones |
| HR empleados | `/app/hr/employees` | `GET/POST /api/v1/modules/hr/employees` | Requerida | Si | `tenant:modules:hr:use` + `tenant:hr:employee:read/write` | Modulo `hr` habilitado | |
| HR empleado detalle | `/app/hr/employees/:id` | `GET/PATCH/DELETE /api/v1/modules/hr/employees/{employeeId}` | Requerida | Si | `tenant:hr:employee:read/write/delete` | Modulo `hr` habilitado | |
| HR compensacion | `/app/hr/employees/:id/compensation` | `GET/PATCH /api/v1/modules/hr/employees/{employeeId}/compensation` | Requerida | Si | `tenant:hr:compensation:read/update` | Modulo `hr` habilitado | Datos sensibles |

## 4. Dependencias backend sin contrato/consumo FE cerrado

- Memberships CRUD tenant (`GET/PATCH/DELETE /api/v1/tenant/memberships*`) no disponible en OpenAPI actual.
- Gestion publica de roles/permisos tenant no disponible en OpenAPI actual.
- Auditoria platform-scoped no expuesta en router principal/OpenAPI para consumo FE.
