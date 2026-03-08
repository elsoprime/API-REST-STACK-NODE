# Criterios de Cierre

## Regla general

Toda etapa necesita evidencia en cuatro capas:

- codigo
- tests
- contrato
- documentacion de cierre

## Checklist base

- `npm run build` verde
- `npm run test` verde
- `npm run openapi:validate` verde
- documento de cierre publicado en `docs/cierres/`
- evidencia de criterios funcionales de la etapa
- evidencia de comportamiento por entorno cuando aplique

## Evidencia minima por tipo

### Infraestructura

- test de health
- test de error envelope
- validacion real de env
- comportamiento correcto en `development`, `test` y `production` cuando corresponda
- evidencia de fail-fast o degradacion ante falla de DB
- evidencia de graceful shutdown

### Auth

- register
- login
- refresh
- logout
- CSRF
- revocacion de sesion

### Tenant

- aislamiento cross-tenant
- invitaciones
- cambio de tenant activo

### RBAC

- acceso permitido
- acceso denegado por rol
- acceso denegado por permiso
- acceso denegado por plan
- acceso denegado por modulo

### Auditoria

- escritura produce log
- escritura usa `AuditContext`, no `Request`
- sensibles redactados
- consulta aislada por tenant

### Modulos

- CRUD base
- aislamiento tenant
- audit log
- guardas de plan y modulo

## Go-Live

Go-Live requiere:

- Etapas -1 a 8 cerradas
- 9 y 10 cerradas solo si van en el release
- smoke suite en staging
- restore probado
- runbook vigente
- observabilidad minima operativa
