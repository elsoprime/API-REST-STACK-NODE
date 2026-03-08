# Cierre Etapa 6

Fecha: 2026-03-08  
Estado: Cierre formal aprobado

## 1. Alcance previsto

La Etapa 6 construye `PlatformSettings` como singleton platform-scoped sobre RBAC y auditoria ya cerrados.

Incluye:

- modelo singleton `PlatformSettings`
- bootstrap on-demand con proteccion contra duplicados
- lectura HTTP de `PlatformSettings`
- actualizacion HTTP auditada
- permisos platform-scoped explicitos para lectura y actualizacion

## 2. Evidencia de codigo

Archivos principales:

- [platform-scope-grant.service.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/src/core/platform/auth/services/platform-scope-grant.service.ts)
- [platform-settings.model.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/src/core/platform/settings/models/platform-settings.model.ts)
- [platform-settings.types.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/src/core/platform/settings/types/platform-settings.types.ts)
- [platform-settings.schemas.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/src/core/platform/settings/schemas/platform-settings.schemas.ts)
- [platform-settings.service.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/src/core/platform/settings/services/platform-settings.service.ts)
- [platform-settings.controller.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/src/core/platform/settings/controllers/platform-settings.controller.ts)
- [platform-settings.routes.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/src/core/platform/settings/routes/platform-settings.routes.ts)
- [requirePlatformPermission.middleware.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/src/infrastructure/middleware/requirePlatformPermission.middleware.ts)
- [rbac.service.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/src/core/platform/rbac/services/rbac.service.ts)
- [platform-settings.yaml](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/openapi/components/schemas/platform-settings.yaml)
- [settings.yaml](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/openapi/paths/platform/settings.yaml)

## 3. Evidencia automatizada

Comandos a verificar:

- `npm run build`
- `npm run test`
- `npm run openapi:validate`

Cobertura funcional minima:

- bootstrap y actualizacion del singleton: [platform-settings.service.test.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/tests/unit/core/platform/settings/platform-settings.service.test.ts)
- lectura y actualizacion HTTP bajo contrato: [platform-settings.routes.test.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/tests/integration/platform-settings/platform-settings.routes.test.ts)
- auditoria platform-scoped de cambios: [platform-settings.audit.test.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/tests/integration/platform-settings/platform-settings.audit.test.ts)
- enforcement real de modulos globalmente deshabilitados: [platform-settings.runtime-enforcement.test.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/tests/integration/platform-settings/platform-settings.runtime-enforcement.test.ts)
- scopes platform-scoped emitidos por una fuente backend controlada: [auth.service.test.ts](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/tests/unit/core/platform/auth/auth.service.test.ts)

## 4. Evidencia de contrato

- se publica `GET /api/v1/platform/settings`
- se publica `PATCH /api/v1/platform/settings`
- ambos endpoints requieren autenticacion valida
- la lectura requiere `platform:settings:read`
- la actualizacion requiere `platform:settings:update`
- la respuesta usa `buildSuccess()`
- los scopes platform-scoped se emiten desde una fuente backend controlada
- los modulos y feature flags globalmente deshabilitados gobiernan la resolucion efectiva del runtime
- `PlatformSettings` rechaza claves de modulo o feature flag fuera del catalogo real

## 5. Veredicto

La Etapa 6 queda formalmente cerrada.
