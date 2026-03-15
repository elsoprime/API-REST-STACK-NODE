# Cierre Etapa 5

Fecha: 2026-03-08  
Estado: Cierre formal aprobado

## 1. Alcance previsto

La Etapa 5 toma como prerequisito el cierre formal restablecido de Etapa 4 y se apoya en:

- [PLAN_MAESTRO.md](..\PLAN_MAESTRO.md)
- [CONTRATOS_TRANSVERSALES.md](..\arquitectura\CONTRATOS_TRANSVERSALES.md)
- [ANEXO_03_SEGURIDAD_RBAC.md](..\anexos\ANEXO_03_SEGURIDAD_RBAC.md)
- [ADR-009_AUDIT_CONTEXT.md](..\adrs\ADR-009_AUDIT_CONTEXT.md)
- [ADR-010_AUDITABLE_EXECUTION_CONTEXT.md](..\adrs\ADR-010_AUDITABLE_EXECUTION_CONTEXT.md)
- [CRITERIOS_DE_CIERRE.md](..\checklists\CRITERIOS_DE_CIERRE.md)

Primer corte planificado:

- contrato `AuditContext`
- resolucion de actor, tenant y `traceId`
- modelo inmutable de `audit_logs`
- politica de redaccion de cambios sensibles
- servicios o puertos de escritura de auditoria desacoplados de Express
- evidencia de consulta aislada por tenant

Remediacion pre-Etapa 6 aplicada:

- semantica de entrega con `atomic audit` cuando existe `session` y `audit_outbox` durable cuando no existe
- soporte formal para eventos `tenant` y `platform`
- redaccion extendida para secretos operativos y futuros payloads de settings

## 2. Evidencia de codigo

Archivos principales implementados:

- [audit.types.ts](..\..\src\core\platform\audit\types\audit.types.ts)
- [audit-redaction.policy.ts](..\..\src\core\platform\audit\policies\audit-redaction.policy.ts)
- [audit-log.model.ts](..\..\src\core\platform\audit\models\audit-log.model.ts)
- [audit-outbox.model.ts](..\..\src\core\platform\audit\models\audit-outbox.model.ts)
- [audit-context.factory.ts](..\..\src\core\platform\audit\services\audit-context.factory.ts)
- [audit.service.ts](..\..\src\core\platform\audit\services\audit.service.ts)
- [audit.controller.ts](..\..\src\core\platform\audit\controllers\audit.controller.ts)
- [audit.routes.ts](..\..\src\core\platform\audit\routes\audit.routes.ts)
- [platform-audit.routes.ts](..\..\src\core\platform\audit\routes\platform-audit.routes.ts)
- [audit.schemas.ts](..\..\src\core\platform\audit\schemas\audit.schemas.ts)
- [audit-query.types.ts](..\..\src\core\platform\audit\types\audit-query.types.ts)
- [auth.service.ts](..\..\src\core\platform\auth\services\auth.service.ts)
- [tenant.service.ts](..\..\src\core\tenant\services\tenant.service.ts)
- [router.ts](..\..\src\app\router.ts)
- [openapi/components/schemas/audit.yaml](..\..\openapi\components\schemas\audit.yaml)
- [openapi/paths/audit/list.yaml](..\..\openapi\paths\audit\list.yaml)
- [ADR-011_AUDIT_DELIVERY_SEMANTICS.md](..\adrs\ADR-011_AUDIT_DELIVERY_SEMANTICS.md)

## 3. Evidencia automatizada

Comandos verificados:

- `npm run build`
- `npm run test`
- `npm run openapi:validate`

Cobertura funcional minima:

- escritura con `AuditContext` desacoplado de Express: [audit.write-flow.test.ts](..\..\tests\integration\audit\audit.write-flow.test.ts), [auth.service.test.ts](..\..\tests\unit\core\platform\auth\auth.service.test.ts), [tenant.service.test.ts](..\..\tests\unit\core\tenant\tenant.service.test.ts)
- redaccion de sensibles en `changes` y `metadata`: [audit-redaction.policy.test.ts](..\..\tests\unit\core\platform\audit\audit-redaction.policy.test.ts), [audit.service.test.ts](..\..\tests\unit\core\platform\audit\audit.service.test.ts)
- semantica de entrega atomica o durable segun contexto: [audit-delivery-semantics.test.ts](..\..\tests\unit\core\platform\audit\audit-delivery-semantics.test.ts), [audit.write-flow.test.ts](..\..\tests\integration\audit\audit.write-flow.test.ts)
- redaccion extendida para secretos operativos y settings: [audit-redaction-extended.test.ts](..\..\tests\unit\core\platform\audit\audit-redaction-extended.test.ts), [logger-redaction.test.ts](..\..\tests\unit\infrastructure\logger\logger-redaction.test.ts)
- resolucion de `AuditContext` desde `ExecutionContext`: [audit-context.factory.test.ts](..\..\tests\unit\core\platform\audit\audit-context.factory.test.ts)
- consulta HTTP paginada y aislada por tenant: [audit.routes.test.ts](..\..\tests\integration\audit\audit.routes.test.ts), [audit.tenant-isolation.test.ts](..\..\tests\integration\audit\audit.tenant-isolation.test.ts)
- soporte de consulta `platform` a nivel de servicio para Settings futuros: [audit.platform-scope.test.ts](..\..\tests\integration\audit\audit.platform-scope.test.ts)

Resultado ejecutable final:

- `56` archivos
- `147` tests pasando

## 4. Evidencia de contrato

- se publica `GET /api/v1/audit` como consulta tenant-scoped bajo OpenAPI explicito
- la ruta requiere `X-Tenant-Id`, autenticacion valida y permiso `tenant:audit:read`
- la respuesta usa `buildPaginatedSuccess()` y conserva el envelope contractual
- no existe mutacion HTTP de `audit_logs`; la persistencia sigue siendo inmutable
- el alcance `platform` queda soportado en tipos, servicio y `route factory`, pero no se publica todavia mientras no exista un guard de plataforma contractual

## 5. Riesgos controlados

- fuga de secretos en `before` o `after`
- auditoria acoplada a middleware HTTP
- eventos tenant-scoped sin `tenantId`
- mutabilidad accidental de `audit_logs`
- endpoints de consulta expuestos sin contrato OpenAPI
- mutacion de negocio confirmada con `500` por fallo tardio de auditoria
- ausencia de soporte `platform` para Settings futuros

## 6. Veredicto

La Etapa 5 queda cerrada formalmente. La auditoria ya tiene semantica de entrega segura, soporte `tenant` y `platform`, y redaccion endurecida para habilitar Etapa 6 sin bloqueos abiertos.

## 7. Re-cierre tecnico

Fecha: 2026-03-10  
Estado: Re-cierre aplicado por hardening de serializacion auditable y redaccion operacional.

Se incorpora al cierre de Etapa 5:

- `AuditService` ahora normaliza payloads a JSON serializable antes de redaccion y persistencia:
  - soporte seguro para `Date`, `ObjectId`, `BigInt`, `Map`, `Set` y referencias circulares.
  - deduplicacion de `changes.fields` y `tenant.effectiveRoleKeys` para evitar ruido operativo.
- `AuditService` valida coherencia contractual de alcance:
  - `scope=tenant` exige `tenantId`.
  - `scope=platform` rechaza `tenantId`.
  - ambos casos fallan cerrado con `TENANT_SCOPE_MISMATCH` (`400`).
- Logger: ampliacion de redaccion para secretos adicionales de auth/settings:
  - headers (`x-api-key`), credenciales de cambio de password y secretos operacionales (`clientSecret`, `privateKey`, `apiKey`, `smtpPassword`, etc.).
- Cobertura de tests ampliada:
  - `tests/unit/core/platform/audit/audit.service.test.ts`
  - `tests/unit/infrastructure/logger/logger-redaction.test.ts`

Validaciones ejecutadas:

- `npm run openapi:validate`
- `npm run build`
- `npm run lint`
- `npm run test` (`98` archivos, `268` tests en verde, `1` skipped)

