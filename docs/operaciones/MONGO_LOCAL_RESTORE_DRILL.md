# Mongo Local Restore Drill

## 1. Objetivo

Levantar un MongoDB 7 con replica set `rs0` en local para ejecutar el drill real:

- `tests/integration/go-live/restore.mongodb-drill.test.ts`

## 2. Prerrequisitos

- Docker Desktop operativo
- puerto `27017` libre en el host
- Node.js y dependencias del proyecto instaladas

## 3. Levantar Mongo replica set local

```bash
npm run mongo:restore:up
```

Este comando usa:

- `docker/mongodb-replicaset/docker-compose.restore.yml`

## 4. Ejecutar restore drill real

```bash
npm run test:restore:mongodb:enabled
```

Equivalente manual:

```bash
ENABLE_MONGODB_RESTORE_DRILL=true npm run test:restore:mongodb
```

## 5. Bajar o resetear entorno local

Detener contenedores:

```bash
npm run mongo:restore:down
```

Detener y limpiar volumenes:

```bash
npm run mongo:restore:reset
```

## 6. Troubleshooting rapido

- `ECONNREFUSED 127.0.0.1:27017`: Mongo local no esta levantado o puerto en conflicto.
- Drill skipped: faltó `ENABLE_MONGODB_RESTORE_DRILL=true`.
- Replica set no inicializado: relanzar `npm run mongo:restore:reset` y luego `npm run mongo:restore:up`.
