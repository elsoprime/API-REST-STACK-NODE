# ADR-010

## Titulo

`ExecutionContext` serializable como frontera base previa a auditoria.

## Decision

- Antes de iniciar Etapa 5, el runtime expone un `ExecutionContext` serializable y desacoplado de Express.
- `ExecutionContext` no reemplaza a `AuditContext`; lo prepara.
- Campos minimos:
  - `traceId`
  - `actor`
  - `tenant?`
- `actor` soporta al menos:
  - usuario autenticado
  - actor sistema
  - actor desconocido controlado
- Controllers HTTP construyen `ExecutionContext` y lo pasan a servicios sin entregar `Request` ni `Response`.
- Auth y tenant aceptan `context?` en sus inputs de servicio para abrir costura de auditoria sin romper contrato de negocio actual.

## Consecuencias

- Etapa 5 puede construir `AuditContext` sobre una frontera ya serializable.
- Jobs, procesos internos y modulos futuros no dependen de `res.locals` como unica fuente de actor o tenant.
- La introduccion de auditoria no requiere refactor transversal tardio solo para extraer contexto operativo.
