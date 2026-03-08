# Entornos y Resiliencia

## 1. Objetivo

Definir la politica operativa minima para ejecutar la API en `development`, `test` y `production` sin ambiguedades sobre configuracion, arranque, dependencias criticas, reintentos, healthchecks y apagado ordenado.

## 2. Entornos soportados

### development

- enfocado en productividad y diagnostico
- permite logs legibles
- admite reintentos acotados al arranque
- no relaja la validacion de configuracion
- usa `.env.dev` como archivo de entorno por defecto
- usa puerto `4000` como valor local base del proyecto

### test

- enfocado en ejecucion determinista
- usa infraestructura aislada
- falla rapido ante setup invalido
- no depende de reintentos infinitos

### production

- enfocado en seguridad, trazabilidad y estabilidad
- usa logs estructurados
- requiere secretos y cookies seguras
- falla rapido si una dependencia critica no arranca
- el logger base usa Pino como implementacion de referencia

## 3. Configuracion

La configuracion debe:

- validarse con Zod al arranque
- contemplar `development`, `test` y `production`
- centralizarse en `src/config/env.ts`
- cargarse de forma determinista segun entorno:
  - `development` usa `.env.dev`
  - `production` usa `.env`
  - `test` no depende de archivos de entorno implicitos
  - `DOTENV_CONFIG_PATH` tiene prioridad si se define explicitamente
- fallar si el runtime depende de variables no validadas

## 4. Dependencias criticas

Dependencia critica minima del proyecto:

- MongoDB

Consecuencias:

- si MongoDB no esta disponible en `production` durante startup, el proceso falla
- en `development` se permiten reintentos acotados
- en `test` la falla de DB corta la ejecucion rapidamente

## 5. Reintentos

### Startup

Politica base:

- reintentos acotados
- backoff incremental
- logs por intento
- error final explicito
- los logs de startup incluyen entorno, puerto o URL, estado de dependencia critica y resultado final

Variables recomendadas:

- `DB_CONNECT_MAX_RETRIES`
- `DB_CONNECT_RETRY_DELAY_MS`

### Runtime

No se define reconexion silenciosa infinita como comportamiento base.

Si la DB cae despues del arranque:

- debe quedar trazado en logs
- `/health` debe reflejar degradacion
- cualquier reconexion avanzada futura debe documentarse explicitamente

## 6. Healthchecks

`/health` debe reflejar:

- estado global
- timestamp
- version
- estado de DB
- `traceId`

Estados recomendados:

- `ok`
- `degraded`
- `down`

## 7. Graceful shutdown

El proceso debe:

- escuchar `SIGTERM`
- dejar de aceptar trafico nuevo
- cerrar recursos abiertos
- cerrar DB correctamente
- salir con codigo apropiado
- registrar en logs el inicio y fin del apagado

## 8. Evidencia esperada

La politica se considera implementada cuando exista evidencia automatizada de:

- arranque con env valido
- fallo con env invalido
- reintentos acotados al arranque
- fail-fast en `production` ante DB critica no disponible
- health coherente con el estado real
- graceful shutdown
