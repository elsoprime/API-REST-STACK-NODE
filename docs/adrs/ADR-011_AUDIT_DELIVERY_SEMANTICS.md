# ADR-011

## Titulo

Semantica de entrega de auditoria con atomicidad transaccional y outbox durable.

## Decision

- Si una mutacion de negocio ya corre dentro de una transaccion Mongo, la auditoria se escribe en `audit_logs` dentro de la misma `session`.
- Si no existe `session`, la captura auditable se persiste primero en `audit_outbox` como fallback durable.
- La entrega desde `audit_outbox` hacia `audit_logs` puede ocurrir inmediatamente o por reproceso posterior.
- La consulta de auditoria puede drenar eventos pendientes del outbox antes de listar.
- La auditoria soporta dos alcances formales:
  - `tenant`
  - `platform`

## Consecuencias

- Se elimina la necesidad de fallar abierto o perder trazabilidad cuando no exista transaccion previa.
- Las mutaciones criticas deben preferir una `session` explicita para mantener semantica atomica.
- Etapa 6 puede auditar `PlatformSettings` sin depender artificialmente de `tenantId`.
- La politica de redaccion debe cubrir secretos operativos y de settings antes de exponer nuevos payloads.
