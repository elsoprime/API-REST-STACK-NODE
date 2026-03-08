# Etapa -1

## Objetivo

Crear el repositorio minimo ejecutable para que las etapas posteriores puedan cerrarse con evidencia real.

## Entregables obligatorios

- `package.json` con scripts:
  - `build`
  - `dev`
  - `lint`
  - `test`
  - `test:unit`
  - `test:integration`
  - `test:e2e`
  - `openapi:validate`
- `tsconfig.json`
- `vitest.config.ts`
- `.env.example`
- `openapi/openapi.yaml`
- estructura `src/` vacia pero creada
- estructura `tests/` vacia pero creada
- setup reproducible de MongoDB replica set
- pipeline CI minima para `build`, `lint`, `test`, `openapi:validate`
- politica formal de entornos y resiliencia

## Prerrequisitos tecnicos cerrados

- MongoDB replica set local
- estrategia de aliases TypeScript
- modulo Node definido
- politica de lint definida
- politica de coverage minima definida
- politica de retries y fail-fast definida

## Criterio de salida

La Etapa -1 termina cuando el repo puede:

1. instalar dependencias
2. compilar TypeScript
3. validar OpenAPI
4. ejecutar tests vacios o smoke base
5. levantar Mongo replica set local de forma repetible
6. dejar cerrada la politica de `development`, `test` y `production`

Sin Etapa -1 cerrada, Etapa 0 no inicia.
