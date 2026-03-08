# ANEXO 03

## Seguridad, RBAC, Planes y Auditoria · Etapas 4 y 5

Prerequisito: Etapa 3 cerrada.

## 1. RBAC

Fuente de verdad:

- `roles`
- `permissions`
- `plans`
- `feature_flags`

## 2. Roles

Regla de diseno:

- los roles sistema y custom usan la misma entidad `Role`
- `requireRole` no usa jerarquia hardcodeada en codigo como unica fuente de verdad
- `requirePermission` es el guard principal para recursos tenant-scoped
- el ownership de tenant no se persiste como una segunda jerarquia RBAC distinta; se resuelve como autorizacion efectiva sobre el rol base usando `tenant.ownerUserId`
- un rol custom alto no implica ownership; `tenant:owner` es una capacidad efectiva derivada del owner real del tenant

Campos minimos de `Role`:

- `key`
- `scope`
- `tenantId?`
- `isSystem`
- `hierarchyLevel`
- `permissions`

## 3. Plans y modules

- el plan efectivo define techo de modulos y limites
- los modulos activos del tenant no pueden superar el plan
- los feature flags no pueden habilitar algo fuera del plan salvo bypass administrativo explicitamente documentado

## 4. Auditoria

La auditoria usa `AuditContext`, no `Request`.

Base contractual cerrada:

- ownership efectivo ya queda resuelto en Etapa 4 y no debe reintroducirse como excepcion ad-hoc en auditoria
- `AuditContext` queda formalizado en [ADR-009_AUDIT_CONTEXT.md](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/docs/adrs/ADR-009_AUDIT_CONTEXT.md)

Campos minimos:

- `traceId`
- `actor`
- `tenant?`
- `action`
- `resource`
- `changes?`
- `severity`

Reglas:

- `changes` no usa `any`
- `before` y `after` pasan por redaccion/allowlist
- `audit_logs` son inmutables
- la retencion es configurable, no hardcodeada por sorpresa
- la evidencia minima de Etapa 5 debe cubrir escritura, redaccion y consulta aislada por tenant

## 5. Riesgos cerrados

- incompatibilidad entre roles fijos y roles custom
- bypass accidental de `platform:super_admin`
- auditoria acoplada a Express
- fuga de secretos en `before/after`
