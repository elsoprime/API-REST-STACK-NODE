# Cierre Etapa 4

Fecha: 2026-03-08  
Estado: Cierre formal aprobado

## 1. Alcance cubierto

Se consideran implementados los bloques base de Etapa 4 definidos en:

- [PLAN_MAESTRO.md](..\PLAN_MAESTRO.md)
- [CONTRATOS_TRANSVERSALES.md](..\arquitectura\CONTRATOS_TRANSVERSALES.md)
- [ANEXO_03_SEGURIDAD_RBAC.md](..\anexos\ANEXO_03_SEGURIDAD_RBAC.md)
- [CRITERIOS_DE_CIERRE.md](..\checklists\CRITERIOS_DE_CIERRE.md)

Incluye:

- entidad unificada para `roles` sistema y custom
- catalogo base de `permissions`, `plans`, `modules` y `feature_flags`
- `rbac.service` como punto unico de resolucion de rol base, ownership efectivo, permisos, plan y modulos efectivos
- `resolveTenantContext` enriquecido con autorizacion efectiva resuelta desde RBAC
- guards `requireRole`, `requirePermission`, `requirePlan` y `requireModule`
- normalizacion contractual de ownership mediante [ADR-008_OWNERSHIP_EFFECTIVE_AUTHORIZATION.md](..\adrs\ADR-008_OWNERSHIP_EFFECTIVE_AUTHORIZATION.md)
- hardening de claims autenticados Mongo-backed antes de poblar `AuthContext`
- compatibilidad de tenant core con RBAC para invitaciones, ownership y limite efectivo por plan

## 2. Evidencia de codigo

Archivos principales implementados:

- [rbac.types.ts](..\..\src\core\platform\rbac\types\rbac.types.ts)
- [system-rbac.catalog.ts](..\..\src\core\platform\rbac\catalog\system-rbac.catalog.ts)
- [role.model.ts](..\..\src\core\platform\rbac\models\role.model.ts)
- [permission.model.ts](..\..\src\core\platform\rbac\models\permission.model.ts)
- [plan.model.ts](..\..\src\core\platform\rbac\models\plan.model.ts)
- [module.model.ts](..\..\src\core\platform\rbac\models\module.model.ts)
- [feature-flag.model.ts](..\..\src\core\platform\rbac\models\feature-flag.model.ts)
- [rbac.service.ts](..\..\src\core\platform\rbac\services\rbac.service.ts)
- [resolveTenantContext.middleware.ts](..\..\src\infrastructure\middleware\resolveTenantContext.middleware.ts)
- [requireRole.middleware.ts](..\..\src\infrastructure\middleware\requireRole.middleware.ts)
- [requirePermission.middleware.ts](..\..\src\infrastructure\middleware\requirePermission.middleware.ts)
- [requirePlan.middleware.ts](..\..\src\infrastructure\middleware\requirePlan.middleware.ts)
- [requireModule.middleware.ts](..\..\src\infrastructure\middleware\requireModule.middleware.ts)
- [token.service.ts](..\..\src\core\platform\auth\services\token.service.ts)
- [authenticate.middleware.ts](..\..\src\infrastructure\middleware\authenticate.middleware.ts)
- [tenant.service.ts](..\..\src\core\tenant\services\tenant.service.ts)

## 3. Evidencia automatizada

Comandos a verificar:

- `npm run build`
- `npm run test`
- `npm run openapi:validate`

Cobertura funcional relevante:

- resolucion de roles sistema/custom y autorizacion efectiva: [rbac.service.test.ts](..\..\tests\unit\core\platform\rbac\rbac.service.test.ts)
- tenant context enriquecido desde RBAC: [resolveTenantContext.middleware.test.ts](..\..\tests\unit\infrastructure\middleware\resolveTenantContext.middleware.test.ts)
- acceso permitido y denegado por rol/permiso: [rbac.guards.test.ts](..\..\tests\integration\rbac\rbac.guards.test.ts)
- acceso permitido y denegado por plan/modulo: [rbac.plan-module.test.ts](..\..\tests\integration\rbac\rbac.plan-module.test.ts)
- permisos ligados a modulo sin bypass accidental: [rbac.permission-module-coupling.test.ts](..\..\tests\integration\rbac\rbac.permission-module-coupling.test.ts)
- compatibilidad end-to-end de roles custom con `resolveTenantContext` y guards: [rbac.custom-roles.test.ts](..\..\tests\integration\rbac\rbac.custom-roles.test.ts)
- ownership efectivo sobre rol base y fail-closed de owner legacy incoherente: [owner-overlay-resolution.test.ts](..\..\tests\unit\core\platform\rbac\owner-overlay-resolution.test.ts), [tenant-ownership-effective-authorization.test.ts](..\..\tests\integration\tenant\tenant-ownership-effective-authorization.test.ts)
- owner-only real bajo RBAC y transferencia de ownership: [tenant-ownership-rbac.test.ts](..\..\tests\integration\tenant\tenant-ownership-rbac.test.ts), [member-limit-resolution.test.ts](..\..\tests\unit\core\tenant\member-limit-resolution.test.ts), [tenant.service.test.ts](..\..\tests\unit\core\tenant\tenant.service.test.ts)
- hardening de claims invalidos en rutas autenticadas tenant y no-tenant: [tenant-auth-objectid-hardening.test.ts](..\..\tests\integration\tenant\tenant-auth-objectid-hardening.test.ts), [auth.invalid-sub-hardening.test.ts](..\..\tests\integration\auth\auth.invalid-sub-hardening.test.ts), [authenticate.middleware.test.ts](..\..\tests\unit\infrastructure\middleware\authenticate.middleware.test.ts), [token.service.test.ts](..\..\tests\unit\core\platform\auth\token.service.test.ts)

## 4. Evidencia de contrato

- no se agregan endpoints de negocio nuevos en este corte; la superficie HTTP publicada permanece sin cambios
- `openapi/openapi.yaml` sigue siendo la fuente contractual de endpoints existentes
- los guards y el motor RBAC se validan mediante rutas de fixture de test sin abrir contrato publico prematuro

## 5. Riesgos residuales

- el CRUD HTTP de roles custom queda diferido a un bloque posterior sobre este motor
- `platform:super_admin` no se habilita como bypass transversal hasta que exista contrato explicito por endpoint
- el bootstrap persistente del catalogo RBAC en base de datos queda pendiente si se quiere operacion full-DB sin fallback de catalogo sistema

## 6. Veredicto

La remediacion pre-Etapa 5 quedo completada y verificada. Etapa 4 recupera su cierre formal con ownership efectivo coherente, claims Mongo-backed fail-closed y frontera serializable lista para auditoria.

## 7. Re-cierre tecnico

Fecha: 2026-03-10  
Estado: Re-cierre aplicado por hardening contractual de guards RBAC.

Se incorpora al cierre de Etapa 4:

- `requireRole` y `requirePermission` aceptan bypass opcional `allowPlatformSuperAdmin` con `default = false`.
- el bypass de `platform:super_admin` queda bloqueado por defecto y solo habilitable por declaracion explicita del guard.
- `assertPermissionGranted` valida coincidencia de `permission.scope` con `authorization.role.scope` para evitar escalamiento cross-scope.
- pruebas contractuales nuevas:
  - `tests/integration/rbac/rbac.super-admin-bypass.contract.test.ts`
  - `tests/integration/rbac/rbac.tenant-role-resolution.contract.test.ts`
- cobertura unitaria ampliada:
  - `tests/unit/core/platform/rbac/rbac.service.test.ts`

Validaciones ejecutadas:

- `npm run openapi:validate`
- `npm run build`
- `npm run lint`
- `npm run test`

