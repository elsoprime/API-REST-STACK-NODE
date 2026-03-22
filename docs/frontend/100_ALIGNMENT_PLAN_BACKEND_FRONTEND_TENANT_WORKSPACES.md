# Plan de Alineacion Backend-Frontend Tenant Workspaces

Version: 0.3.0
Estado: Alineacion backend-frontend completada
Ultima actualizacion: 2026-03-20

## 1. Proposito

Documentar el plan de alineacion entre `API-REST-STACK-NODE` y `FRONTEND-STACK-NEXT-TAILWIND` para consolidar los workspaces tenant ya publicados en frontend sin introducir ruido en la documentacion normativa existente.

Este documento no reemplaza:

- `10_IMPLEMENTATION_GUIDE_V2.md`
- `20_ACCESS_MATRIX.md`
- `80_BACKEND_DEPENDENCIES.md`

Su objetivo es servir como acta de cierre tecnico, handoff y referencia de trazabilidad para los gaps que fueron resueltos entre backend y frontend.

## 2. Estado actual de alineacion

### 2.1 Backend ya alineado

El backend soporta de forma consistente las siguientes superficies frontend:

- `Profile` y seguridad de usuario
  - `POST /api/v1/auth/2fa/setup`
  - `POST /api/v1/auth/2fa/confirm`
  - `POST /api/v1/auth/2fa/disable`
  - `POST /api/v1/auth/recovery-codes/regenerate`
  - `POST /api/v1/auth/change-password`
  - `POST /api/v1/auth/forgot-password`
  - `POST /api/v1/auth/reset-password`

- `Tenant settings`
  - `GET /api/v1/tenant/settings`
  - `PATCH /api/v1/tenant/settings`
  - `GET /api/v1/tenant/settings/effective`

- `Billing`
  - `GET /api/v1/billing/plans`
  - `POST /api/v1/billing/checkout/session`
  - `PATCH /api/v1/tenant/subscription`
  - `DELETE /api/v1/tenant/subscription`

- `Members > Equipo`
  - `GET /api/v1/tenant/memberships`
  - `PATCH /api/v1/tenant/memberships/{membershipId}`
  - `DELETE /api/v1/tenant/memberships/{membershipId}`

- `Members > Invitaciones`
  - `POST /api/v1/tenant/invitations`
  - `POST /api/v1/tenant/invitations/accept`
  - `POST /api/v1/tenant/invitations/revoke`

- `Members > Ownership`
  - `POST /api/v1/tenant/transfer-ownership`

- `Platform settings`
  - `GET /api/v1/platform/settings`
  - `PATCH /api/v1/platform/settings`

### 2.2 Frontend ya integrado

El frontend ya consume de forma efectiva los contratos alineados para:

- `Members > Equipo` sin datos mock
- `settings/security` sobre `platform/settings.security`
- invalidacion de cache tenant-scoped y platform-scoped
- cobertura E2E focalizada para memberships, platform security, recovery/reset y change password

## 3. Decisiones de arquitectura

### 3.1 Members

El cierre del gap de `Members > Equipo` se realiza mediante endpoints tenant-scoped de memberships.

No se debe inferir el equipo del tenant a partir de:

- invitaciones
- ownership
- `tenant/mine`

### 3.2 Seguridad de plataforma

La primera entrega de backend no crea un modulo separado `platform/security`.

La estrategia acordada es:

- ampliar `platform/settings`
- extender `PlatformSettings.security`
- conectar `settings/security` a esa estructura

### 3.3 Ownership

`ownership` sigue siendo un flujo independiente.

Aunque existan memberships CRUD:

- la transferencia de ownership se mantiene exclusivamente via `POST /api/v1/tenant/transfer-ownership`
- no se debe permitir cambiar owner efectivo mediante `PATCH /tenant/memberships`

## 4. Estado de ejecucion por fase

| Fase | Estado | Resultado |
|---|---|---|
| Fase A - Members CRUD tenant-scoped | Completada | Contrato OpenAPI, runtime, RBAC y tests en backend |
| Fase B - Ampliar `platform/settings.security` | Completada | Schema, runtime, validaciones y tests alineados |
| Fase C - Actualizacion documental backend | Completada | Docs frontend/backend de referencia actualizadas |
| Fase D - Integracion frontend posterior | Completada | Runtime FE conectado, docs alineadas y cobertura E2E focalizada |

## 5. Fase A ejecutada - Members CRUD tenant-scoped

### 5.1 Contratos publicados

- `GET /api/v1/tenant/memberships`
- `PATCH /api/v1/tenant/memberships/{membershipId}`
- `DELETE /api/v1/tenant/memberships/{membershipId}`

### 5.2 Reglas funcionales implementadas

- Todas las rutas requieren `X-Tenant-Id`
- Operan solo sobre membresias del tenant activo
- El owner efectivo no puede:
  - ser removido
  - ser degradado
    por esta via
- Ownership sigue gestionado por endpoint separado

### 5.3 Listado soportado

El listado soporta:

- paginacion
- busqueda por nombre o email
- filtro por `roleKey`
- filtro por `status`

Payload expuesto al frontend:

- `membershipId`
- `userId`
- `fullName`
- `email`
- `roleKey`
- `status`
- `joinedAt`
- `createdAt`
- `isEffectiveOwner`

Respuesta paginada:

- `items`
- `page`
- `limit`
- `total`
- `totalPages`

### 5.4 Mutaciones y permisos

`PATCH /tenant/memberships/{membershipId}`

- permite cambiar `roleKey` y/o `status` dentro de reglas permitidas
- rechaza cambios sobre owner efectivo
- requiere `tenant:memberships:update`

`DELETE /tenant/memberships/{membershipId}`

- permite remover miembro si la regla de ownership lo permite
- rechaza remocion del owner efectivo
- requiere `tenant:memberships:delete`

`GET /tenant/memberships`

- requiere `tenant:memberships:read`

Permisos actualmente otorgados por catalogo base:

- `tenant:owner`
- `tenant:admin`

## 6. Fase B ejecutada - `platform/settings.security`

### 6.1 Campos activos

`PlatformSettings.security` ahora expone:

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

### 6.2 Compatibilidad mantenida

- se mantiene `PATCH` parcial
- se mantienen `allowUserRegistration` y `requireEmailVerification`
- hay validaciones de tipos y rangos consistentes en schema y servicio

## 7. Fase C ejecutada - Actualizacion documental backend

Documentos actualizados en esta fase:

- `docs/frontend/20_ACCESS_MATRIX.md`
- `docs/frontend/10_IMPLEMENTATION_GUIDE_V2.md`
- `docs/frontend/80_BACKEND_DEPENDENCIES.md`
- `docs/frontend/95_DOCS_DEPRECATION_MATRIX.md`

Tambien queda reflejado que:

- `ownership` ya no es una pagina aislada de navegacion principal
- `Members > Equipo` depende de memberships CRUD ya disponibles
- `settings/security` se alimenta desde `platform/settings` ampliado, no desde un modulo separado

## 8. Fase D ejecutada - Integracion frontend

### 8.1 Members > Equipo

Frontend ya:

- reemplazo datos mock por `GET /tenant/memberships`
- mantuvo paginacion y filtros disenados
- conecto acciones por fila a `PATCH` y `DELETE`
- invalida cache tras mutaciones

### 8.2 settings/security

Frontend ya:

- lee `platform/settings.security`
- edita politicas globales soportadas
- limita UI a campos con backend real
- invalida cache de `platform/settings` tras `PATCH`

### 8.3 Cobertura validada en frontend

Cobertura focalizada ejecutada:

- `Members > Equipo`
- `settings/security`
- `Profile > security` 2FA
- `forgot + reset password`
- `change password` con revocacion de sesiones

## 9. Plan de pruebas ejecutado en backend

### 9.1 Members CRUD

Cubierto en backend:

- listar miembros con `X-Tenant-Id`
- paginacion correcta
- filtros por rol, estado y busqueda
- `PATCH` valido
- `PATCH` invalido sobre owner efectivo
- `DELETE` valido
- `DELETE` invalido sobre owner efectivo

### 9.2 Platform settings security

Cubierto en backend:

- `GET /platform/settings` devuelve estructura ampliada
- `PATCH` parcial funciona
- validaciones de tipos y rangos
- compatibilidad con consumidores existentes de platform settings

## 10. Riesgos residuales

### 10.1 Riesgo: mezclar ownership con memberships CRUD

Mitigacion:

- ownership sigue exclusivamente en `POST /tenant/transfer-ownership`
- memberships CRUD bloquea mutaciones del owner efectivo

### 10.2 Riesgo: frontend asume capacidades no implementadas

Mitigacion:

- la UI de `settings/security` queda limitada a campos soportados por `platform/settings.security`
- capacidades evolutivas permanecen en tabs o secciones de roadmap no operativas

## 11. Criterios de cierre cumplidos

La alineacion backend-frontend queda cerrada porque:

- `Members > Equipo` dejo de usar datos mock en frontend
- `settings/security` consume politicas reales desde `platform/settings`
- no quedan rutas UI antiguas como referencia principal en docs activas
- el frontend valida cache, permisos y flujos contra los contratos publicados

## 12. Notas finales

Este documento complementa la documentacion existente y no debe interpretarse como ADR ni como especificacion normativa cerrada. Su objetivo queda reducido a trazabilidad de cierre de la alineacion ejecutada entre backend y frontend.