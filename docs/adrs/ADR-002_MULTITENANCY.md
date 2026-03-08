# ADR-002

## Titulo

Shared schema con aislamiento fuerte por `tenantId`.

## Decision

- Una sola base MongoDB
- Todo recurso tenant-scoped lleva `tenantId`
- Todo query tenant-scoped filtra por `tenantId`
- Los tests de fuga cross-tenant son obligatorios

## Consecuencias

- Los repositorios tenant-scoped no aceptan filtros sin `tenantId`
- Los indices compuestos arrancan por `tenantId`
