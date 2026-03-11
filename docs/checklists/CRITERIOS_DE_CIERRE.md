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

## Nomenclatura de etapas y cierres

Patron canonico de cierre documental:

- `ETAPA_{ID}_{TIPO}.md`

IDs permitidos:

- `M1` para la etapa `-1` (se mantiene canonica en `docs/arquitectura/ETAPA_-1_BOOTSTRAP.md`)
- `00` a `12` para etapas individuales
- `00_01` para cierres combinados existentes

TIPOS permitidos:

- `CIERRE` (documento canonico principal por etapa)
- `REAPERTURA_TECNICA` (solo cuando aplique deuda tecnica formal)
- `EVIDENCIA_RELEASE` (solo para gates de release/go-live)

Reglas de gobernanza documental:

- no crear documentos nuevos si el documento existente puede ampliarse sin perder trazabilidad
- mantener historial append-only: no borrar evidencia historica de cierres/reaperturas
- usar mayusculas y `_` en nombres de archivo
- mantener un unico `*_CIERRE.md` canonico por etapa
- cualquier alta de archivo en `docs/cierres` requiere actualizacion explicita del gate `docs:cierres:validate`

Regla operativa de reapertura/re-cierre:

- si una etapa cerrada presenta deuda tecnica, registrar `Reapertura tecnica` con fecha y motivo
- al completar los fix, registrar `Re-cierre` con fecha y evidencia automatizada
- usar `ETAPA_XX_REAPERTURA_TECNICA.md` solo cuando ya exista o cuando el volumen requiera separacion formal

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
