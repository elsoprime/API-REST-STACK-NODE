# ADR-006

## Titulo

Uso de transacciones MongoDB para operaciones criticas.

## Decision

- Registro de usuario
- Creacion de tenant
- Aceptacion de invitacion
- Movimientos de stock

Estas operaciones usan transacciones multi-documento.

## Consecuencias

- Mongo replica set obligatorio desde desarrollo local
- Los tests que cubran estos flujos deben correr sobre replica set real
