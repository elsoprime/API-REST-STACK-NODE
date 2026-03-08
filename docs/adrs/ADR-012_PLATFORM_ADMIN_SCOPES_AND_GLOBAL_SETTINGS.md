# ADR-012 Platform Admin Scopes and Global Settings

Fecha: 2026-03-08

## Estado

Aprobado

## Contexto

La Etapa 6 introduce `PlatformSettings` y permisos platform-scoped para operar settings y auditoria global.

Los hallazgos previos mostraron dos vacios:

- los scopes platform-scoped existian en guards y OpenAPI, pero no habia una fuente real y controlada para emitirlos en access tokens
- `PlatformSettings.modules.disabledModuleKeys` y `PlatformSettings.featureFlags.disabledFeatureFlagKeys` se persistian, pero no gobernaban la resolucion efectiva del runtime

Eso dejaba el contrato platform-scoped incompleto justo antes de Etapa 7.

## Decision

Se adopta el siguiente contrato minimo para Etapa 6:

1. los scopes platform-scoped viven en el access token
2. esos scopes solo pueden emitirse desde una fuente backend explicita y controlada
3. en este corte, la fuente controlada es `PLATFORM_ADMIN_EMAILS`
4. `PlatformSettings` participa en la resolucion efectiva del runtime para modulos y feature flags

## Reglas

### 1. Emision de scopes platform-scoped

- `platform:self` sigue siendo el scope base para cualquier usuario autenticado
- si el email autenticado pertenece a `PLATFORM_ADMIN_EMAILS`, el backend puede emitir adicionalmente:
  - `platform:settings:read`
  - `platform:settings:update`
  - `platform:audit:read`
- no se introduce todavia un modelo persistido de platform admins

### 2. Global settings como fuente de verdad operativa

- `PlatformSettings.modules.disabledModuleKeys` deshabilita globalmente modulos aunque el plan y el tenant los permitan
- `PlatformSettings.featureFlags.disabledFeatureFlagKeys` deshabilita globalmente flags aunque el plan las habilite
- la resolucion efectiva sigue este orden:
  1. plan
  2. estado global platform
  3. disponibilidad tenant
  4. overrides tenant permitidos

### 3. Validacion de claves configurables

- `disabledModuleKeys` debe validarse contra el catalogo real de modulos
- `disabledFeatureFlagKeys` debe validarse contra el catalogo real de feature flags
- no se aceptan claves arbitrarias en `PlatformSettings`

## Consecuencias

- los endpoints de `PlatformSettings` y auditoria platform-scoped dejan de depender de tokens fabricados fuera del contrato real
- Etapa 7 puede apoyarse sobre estado global efectivo para resolver defaults y overrides tenant
- un modelo persistido de administradores de plataforma puede introducirse mas adelante sin romper este contrato minimo
