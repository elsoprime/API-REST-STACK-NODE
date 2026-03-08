# ANEXO 00

## Fundaciones, Bootstrap y Etapas 0-1

Prerequisito: [ETAPA_-1_BOOTSTRAP.md](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/docs/arquitectura/ETAPA_-1_BOOTSTRAP.md) cerrada.

Politica operativa aplicable: [ENTORNOS_Y_RESILIENCIA.md](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/docs/arquitectura/ENTORNOS_Y_RESILIENCIA.md)

## 1. Decisiones cerradas

- `GET /health` vive fuera de `/api/v1`
- la API de negocio vive bajo `/api/v1`
- `openapi/openapi.yaml` debe reflejar ambas superficies
- el schema de entorno valida todas las variables realmente usadas
- MongoDB corre sobre replica set desde desarrollo

## 2. Entregables de Etapa 0

- `src/app/index.ts`
- `src/app/server.ts`
- `src/app/router.ts`
- `src/infrastructure/errors/*`
- `src/infrastructure/logger/*`
- `src/infrastructure/middleware/traceId.middleware.ts`
- `src/infrastructure/middleware/requestLogger.middleware.ts`
- `openapi/openapi.yaml`
- `openapi/paths/health.yaml`
- `tests/integration/health.test.ts`

## 3. Contrato de health

- Ruta: `GET /health`
- No requiere auth
- Responde estado de app y DB
- No usa el envelope de negocio porque es endpoint operativo, pero si incluye `traceId`

Ejemplo:

```json
{
  "status": "ok",
  "timestamp": "2026-03-07T00:00:00.000Z",
  "version": "3.0.0",
  "db": "connected",
  "traceId": "uuid"
}
```

## 4. Entregables de Etapa 1

- `src/config/env.ts`
- `src/config/app.ts`
- `src/infrastructure/database/connection.ts`
- `src/infrastructure/database/plugins/baseDocument.plugin.ts`
- `src/constants/*`
- `src/core/shared/utils/*`
- `src/infrastructure/middleware/validateBody.middleware.ts`
- `src/infrastructure/middleware/validateQuery.middleware.ts`
- `src/infrastructure/middleware/rateLimiter.middleware.ts`
- `buildSuccess()` y `buildPaginatedSuccess()` son los helpers canonicos de exito para endpoints de negocio

## 5. Politica de arranque y conexion

- `env.ts` distingue `development`, `test` y `production`
- la conexion a Mongo usa reintentos acotados al arranque
- en `production`, si MongoDB no esta disponible tras el maximo de reintentos, el proceso falla
- `/health` no reporta `ok` si la dependencia critica esta caida
- el servidor implementa graceful shutdown
- el startup deja logs operativos minimos con entorno, version, URL o puerto, estado de DB y resultado del arranque
- los logs de conexion no exponen credenciales de MongoDB
- el pipeline HTTP base incluye `traceId`, request logging, `notFound` y `errorHandler`

## 6. Variables de entorno minimas

El schema de `env.ts` debe contemplar, como minimo:

- `APP_VERSION`
- `MONGODB_CONNECT_TIMEOUT_MS`
- `AUTH_ACCESS_COOKIE_NAME`
- `REFRESH_TOKEN_COOKIE_NAME`
- `CSRF_SECRET`
- `CSRF_COOKIE_NAME`
- `RATE_LIMIT_MAX_SENSITIVE`
- `CORS_ORIGINS`
- `DB_CONNECT_MAX_RETRIES`
- `DB_CONNECT_RETRY_DELAY_MS`

Si el runtime usa una variable no validada por Zod, la etapa no cierra.

## 7. OpenAPI base

- `servers` debe usar base root del host, no `/api/v1` duro para todo
- `GET /health` se documenta fuera de la version de negocio
- los paths de negocio se documentan bajo `/api/v1/...`
- el schema de error debe coincidir con [CONTRATOS_TRANSVERSALES.md](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/docs/arquitectura/CONTRATOS_TRANSVERSALES.md)

## 8. Testing base

Las pruebas minimas de Etapas 0-1 son:

- health 200
- 404 con envelope correcto
- 500 con envelope correcto
- `X-Trace-Id` presente
- abortar arranque por env invalido
- retries de conexion verificados
- fail-fast o degradacion correcta ante DB no disponible
- graceful shutdown
- rate limiters funcionales
- utilidades compartidas con tests unitarios

## 9. Riesgos que quedan cerrados con este anexo

- conflicto `/health` vs `/api/health` vs `/api/v1/health`
- bootstrap sin scripts verificables
- esquema de env incompleto
- OpenAPI no alineada con runtime
- comportamiento ambiguo por entorno
- fallos de conexion sin politica definida
