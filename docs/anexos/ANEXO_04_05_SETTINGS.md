# ANEXO 04-05

## Settings Platform y Settings Tenant · Etapas 6 y 7

Prerequisito: Etapa 5 cerrada.

## 1. Source of truth

### Tenant

`Tenant` conserva:

- `name`
- `slug`
- `status`
- `ownerUserId`
- `planId`
- `activeModuleKeys`

### TenantSettings

`TenantSettings` concentra:

- branding
- localizacion
- contacto
- billing
- overrides permitidos

Primer corte objetivo para Etapa 7:

- `branding.displayName`
- `branding.supportEmail`
- `branding.supportUrl`
- `localization.defaultTimezone`
- `localization.defaultCurrency`
- `localization.defaultLanguage`
- `contact.primaryEmail`
- `contact.phone`
- `contact.websiteUrl`
- `billing.billingEmail`
- `billing.legalName`
- `billing.taxId`

No se duplican `country`, `timezone`, `currency` y `language` entre `Tenant` y `TenantSettings` salvo denormalizacion explicitamente documentada.

## 2. Platform settings

`PlatformSettings` es singleton.

Debe definirse:

- politica de bootstrap del documento
- comportamiento si falta
- proteccion contra duplicados
- auditoria platform-scoped sin depender de `tenantId`
- permisos platform-scoped explicitos para lectura y actualizacion
- fuente controlada para emitir scopes platform-scoped reales

Primer corte cerrado para Etapa 6:

- `branding`
- `localization`
- `security`
- `operations`
- `modules.disabledModuleKeys`
- `featureFlags.disabledFeatureFlagKeys`

Contrato operativo de Etapa 6:

- `platform:self` es el scope base para usuario autenticado
- los scopes platform-scoped de administracion se emiten desde una fuente backend controlada
- en este corte, la fuente minima es `PLATFORM_ADMIN_EMAILS`
- `modules.disabledModuleKeys` gobierna el runtime y puede apagar modulos globalmente
- `featureFlags.disabledFeatureFlagKeys` gobierna el runtime y puede apagar flags globalmente
- ninguna de esas listas acepta claves fuera del catalogo real

## 3. Planes

Los planes dejan de ser solo constantes hardcodeadas.

Regla:

- pueden existir seeds iniciales en constantes
- la fuente de verdad operativa es la entidad `Plan`

## 4. Roles custom

Etapa 7 no redefine RBAC.

Solo administra roles custom sobre el motor ya cerrado en Etapa 4.

## 5. Resolucion efectiva

Orden recomendado para modulo/flag/plan:

1. plan
2. estado global del modulo o flag
3. disponibilidad por tenant
4. override tenant permitido

Reglas cerradas para la vista efectiva tenant:

- `GET /tenant/settings/effective` puede leer defaults platform, pero nunca bootstrappear ni mutar `PlatformSettings`
- si el singleton platform no existe todavia, la vista efectiva tenant falla cerrado
- la resolucion runtime efectiva de plan, modulos y feature flags se delega al motor RBAC
- `TenantSettings` solo proyecta esa resolucion; no mantiene una segunda logica paralela

## 6. Riesgos cerrados

- doble fuente de verdad en settings
- planes CRUD incompatibles con constantes
- roles custom injertados tarde
