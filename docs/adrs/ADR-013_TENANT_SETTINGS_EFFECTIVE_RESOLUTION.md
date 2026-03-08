# ADR-013 Tenant Settings Effective Resolution

Fecha: 2026-03-08

## Estado

Aprobado

## Contexto

La vista `GET /api/v1/tenant/settings/effective` combina:

- `TenantSettings`
- defaults de `PlatformSettings`
- estado runtime efectivo de plan, modulos y feature flags

Antes de esta decision, la lectura tenant-scoped podia gatillar bootstrap implicito de `PlatformSettings` y duplicaba parte de la resolucion runtime fuera del motor RBAC.

## Decision

Se cierra el siguiente contrato:

- una lectura tenant-scoped nunca crea ni muta estado platform
- `PlatformSettings` expone una lectura segura sin bootstrap implicito para callers tenant-scoped
- si `PlatformSettings` aun no existe, la vista efectiva tenant falla cerrado con error interno controlado
- la resolucion runtime efectiva de plan, modulos y feature flags vive en RBAC como unica fuente de verdad
- `TenantSettings` solo proyecta esa resolucion; no la reimplementa
- identificadores fiscales como `taxId` quedan sujetos a redaccion de auditoria

## Consecuencias

- se elimina el cruce de scopes tenant -> platform detectado en la revision final de Etapa 7
- Inventory y modulos posteriores consumen la misma resolucion runtime que aplica autorizacion real
- la creacion bootstrap de `PlatformSettings` sigue siendo una operacion platform-scoped explicita
