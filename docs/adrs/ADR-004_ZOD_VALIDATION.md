# ADR-004

## Titulo

Validacion de entrada con Zod.

## Decision

- Todo input se valida en el borde con Zod
- Los errores de validacion usan `GEN_VALIDATION_ERROR`

## Consecuencias

- Los schemas son parte del contrato operativo
- La inferencia de tipos evita duplicacion
