# ANEXO 02

## Tenant Core, Memberships e Invitations · Etapa 3

Prerequisito: Etapa 2 cerrada.

## 1. Contrato tenant

- toda ruta tenant-scoped exige `X-Tenant-Id`
- `resolveTenantContext` resuelve desde header salvo excepcion explicitamente documentada
- el switch de tenant no reemplaza la validacion por header en rutas tenant-scoped

## 2. Modelos

### Tenant

El `Tenant` contiene solo:

- identidad base
- estado
- owner
- plan o `planId`
- modulos activos

Branding, localizacion y contacto viven en `TenantSettings`, no duplicados aqui.

### Membership

- una membership vigente por `tenantId + userId`
- reingreso reusa el documento o se resuelve por estrategia explicitamente documentada; no queda a interpretacion del implementador
- el rol no se hardcodea como enum de negocio final; debe ser compatible con el motor RBAC

### Invitation

- se persiste `tokenHash`, no token plano
- la expiracion usa `expiresAt`
- la limpieza fisica no puede destruir trazabilidad de negocio antes de auditarla
- el token se entrega por `TenantInvitationDeliveryPort`, no por response HTTP

## 3. Operaciones transaccionales

Estas operaciones son transaccionales:

- crear tenant + membership owner
- aceptar invitacion + crear/reactivar membership

## 4. Reglas de negocio obligatorias

- no se puede dejar un tenant sin owner
- debe existir politica de transferencia de ownership
- aceptar invitacion dos veces no puede crear dos memberships
- el limite de plan debe verificarse antes de crear o reactivar membership

## 5. Testing obligatorio

Etapa 3 no depende de Inventory.

Los tests de aislamiento deben usar recursos tenant-core o fixtures dedicados, no endpoints de etapas futuras.

Pruebas minimas:

- acceso denegado a tenant ajeno
- membership suspendida
- invitacion expirada
- invitacion revocada
- doble aceptacion concurrente
- aislamiento cross-tenant

## 6. Aclaraciones de implementacion

- `create invitation` entrega el token por `TenantInvitationDeliveryPort`
- `development` y `test` usan adaptador `in-memory` inspeccionable por tests
- `production` requiere cablear un adaptador real antes de go-live
- el switch de tenant fija `activeTenantId` y `activeMembershipId` en `auth_sessions`
- el switch reemite access token tenant-bound, pero no reemplaza la validacion por `X-Tenant-Id`
- `POST /tenant/invitations/accept` es excepcion token-bound y no requiere `X-Tenant-Id`
- `transfer ownership` solo puede ejecutarlo el owner actual hacia una membership activa del mismo tenant
- `tenant.ownerUserId` es la fuente de verdad del ownership; `membership.roleKey` representa solo el rol base RBAC
- los privilegios de owner se resuelven de forma efectiva cuando `membership.userId === tenant.ownerUserId`, sin exigir que la membership persista exactamente `tenant:owner`
- la transferencia de ownership no reescribe roles custom por sorpresa; si la membership saliente usa el rol sistema `tenant:owner`, se normaliza a `tenant:member`
- el conflicto concurrente de doble aceptacion se traduce a error estable `TENANT_INVITATION_ALREADY_ACCEPTED`
