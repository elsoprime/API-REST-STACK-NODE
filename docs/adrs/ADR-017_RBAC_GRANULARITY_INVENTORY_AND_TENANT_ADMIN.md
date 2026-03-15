# ADR-017 RBAC Granularity for Inventory and Tenant Admin Role

Fecha: 2026-03-14

## Estado

Aprobado

## Contexto

La auditoria tecnica detecta privilegio excesivo en `inventory` cuando varias acciones se agrupan bajo permisos demasiado amplios:

- falta de permisos por accion en `inventory`
- necesidad de un rol operativo intermedio `tenant:admin`
- riesgo de privilegios excesivos intra-tenant
- necesidad de mantener el modelo consistente con el motor RBAC ya canonico

Esto impacta principalmente Etapa 08 y el catalogo RBAC de plataforma.

## Decision

Se actualiza el modelo RBAC tenant con dos cambios estructurales:

1. Introducir `tenant:admin` como rol operativo intermedio entre owner y member.
2. Definir permisos granulares de `inventory` por accion:
   - `tenant:modules:inventory:read`
   - `tenant:modules:inventory:create`
   - `tenant:modules:inventory:update`
   - `tenant:modules:inventory:delete`
   - `tenant:modules:inventory:stock:write`

Reglas de aplicacion:

- operaciones destructivas requieren permisos explicitos
- `tenant:owner` conserva permisos totales compatibles con ownership
- `tenant:member` no hereda privilegios destructivos por defecto
- el backend debe poder exponer capacidades efectivas para consumo frontend

## Consecuencias

- cambian catalogo de permisos y asignaciones de rol sistema
- las rutas de `inventory` deben documentar el permiso esperado por endpoint
- deben agregarse pruebas de autorizacion por accion
- esta decision no implica re-cierre automatico de Etapa 08; solo fija el modelo canonico para implementarlo

## Alternativas consideradas

1. Mantener permiso unico de modulo

- ventaja: simplicidad
- desventaja: no cumple principio de menor privilegio

2. Permisos granulares + rol `tenant:admin` (decision actual)

- ventaja: control fino y mejor alineacion con el principio de minimo privilegio
- desventaja: mayor trabajo de migracion y pruebas

## Cierre de decision

El modulo `inventory` adopta autorizacion granular y el dominio tenant incorpora `tenant:admin` como rol operativo formal.
