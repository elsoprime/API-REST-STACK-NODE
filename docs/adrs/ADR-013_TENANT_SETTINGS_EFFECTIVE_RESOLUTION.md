# ADR-013 Tenant Settings Effective Resolution

Fecha: 2026-03-08
Actualizacion: 2026-03-10

## Estado

Aprobado

## Contexto

La vista `GET /api/v1/tenant/settings/effective` combina:

- `TenantSettings`
- defaults de `PlatformSettings`
- estado runtime efectivo de plan, modulos y feature flags

La lectura tenant-scoped no debe crear ni mutar estado platform. Sin embargo, si el singleton de `PlatformSettings` no fue inicializado durante el arranque, la vista efectiva puede fallar con error interno.

## Decision

Se mantiene y extiende el contrato:

- una lectura tenant-scoped nunca crea ni muta estado platform
- `PlatformSettings` expone una lectura segura sin bootstrap implicito para callers tenant-scoped
- el arranque de la aplicacion debe ejecutar bootstrap platform-scoped explicito de `PlatformSettings` despues de conectar DB y antes de exponer trafico HTTP
- si `PlatformSettings` aun no existe en rutas no estandar (por ejemplo, apps de prueba que omiten bootstrap de runtime), la vista efectiva tenant falla cerrado con error interno controlado
- la resolucion runtime efectiva de plan, modulos y feature flags vive en RBAC como unica fuente de verdad
- `TenantSettings` solo proyecta esa resolucion; no la reimplementa
- identificadores fiscales como `taxId` quedan sujetos a redaccion de auditoria

## Consecuencias

- se conserva el aislamiento de scopes tenant -> platform
- se cierra la brecha operativa de inicializacion que generaba `500` en `GET /api/v1/tenant/settings/effective` cuando el singleton platform no estaba bootstrappeado
- la creacion bootstrap de `PlatformSettings` sigue siendo platform-scoped y ahora queda incorporada al ciclo formal de startup
