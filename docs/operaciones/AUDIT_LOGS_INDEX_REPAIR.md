# Audit Logs Index Repair

## 1. Objetivo

Reparar el indice historico `sourceOutboxId_1` en bases ya existentes para evitar colisiones por `sourceOutboxId: null`.

## 2. Contexto

Los logs de auditoria escritos dentro de transaccion no deben persistir `sourceOutboxId`.

Si una base antigua conserva un indice unico creado sobre `sourceOutboxId` sin filtro parcial correcto, MongoDB puede lanzar:

```text
E11000 duplicate key error collection: <db>.audit_logs index: sourceOutboxId_1 dup key: { sourceOutboxId: null }
```

## 3. Reparacion manual

Ejecutar en la base afectada:

```javascript
db.audit_logs.dropIndex('sourceOutboxId_1')

db.audit_logs.createIndex(
  { sourceOutboxId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sourceOutboxId: { $type: 'objectId' }
    }
  }
)
```

## 4. Verificacion

Confirmar que el indice resultante incluya `partialFilterExpression`:

```javascript
db.audit_logs.getIndexes()
```

## 5. Impacto

- no cambia el contrato HTTP
- no borra registros de `audit_logs`
- restaura compatibilidad entre logs directos y logs entregados desde `audit_outbox`
