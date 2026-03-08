# ADR-009

## Titulo

`AuditContext` desacoplado de Express como contrato base de auditoria.

## Decision

- La auditoria de Etapa 5 no depende de `Request` ni de `Response`.
- Todo evento auditable se construye desde un `AuditContext` explicito.
- `AuditContext` debe poder resolverse tanto en flujos HTTP como en servicios, jobs o procesos internos.
- Campos minimos del contexto:
  - `traceId`
  - `actor`
  - `tenant?`
  - `action`
  - `resource`
  - `severity`
  - `changes?`
- `actor` debe diferenciar como minimo:
  - usuario autenticado
  - actor sistema
  - actor desconocido controlado
- `changes.before` y `changes.after` pasan por politica de redaccion o allowlist antes de persistirse.
- `audit_logs` son inmutables desde el contrato de aplicacion.
- La consulta de auditoria debe respetar aislamiento por `tenantId` cuando el evento sea tenant-scoped.

## Consecuencias

- La captura de auditoria puede reutilizarse fuera de Express sin duplicar contratos.
- Los servicios no reciben `req` ni `res` para auditar; reciben o construyen `AuditContext`.
- La Etapa 5 debe incluir una politica de redaccion verificable por tests.
- La consulta HTTP de auditoria solo puede exponerse cuando exista contrato OpenAPI explicito y aislado por `tenantId`.
