# ADR-005

## Titulo

Logging estructurado con Pino y redaccion de sensibles.

## Decision

- Pino es el logger unico
- Todo request produce `traceId`
- Los campos sensibles se redactan

## Consecuencias

- La observabilidad no depende de `console.log`
- Las pruebas deben verificar redaccion donde aplique
