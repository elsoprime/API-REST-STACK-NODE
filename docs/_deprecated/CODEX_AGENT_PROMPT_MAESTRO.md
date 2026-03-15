# CODEX AGENT — PROMPT MAESTRO

## API-REST-STACK-NODE

Lee siempre antes de implementar:

- `docs/PLAN_MAESTRO.md`
- `docs/arquitectura/CONTRATOS_TRANSVERSALES.md`
- `docs/arquitectura/ESTRUCTURA_REPO_OBJETIVO.md`
- `docs/arquitectura/ETAPA_-1_BOOTSTRAP.md`
- `docs/checklists/CRITERIOS_DE_CIERRE.md`
- `docs/anexos/`
- `docs/adrs/`

## Regla absoluta

Antes de escribir codigo:

1. leer la etapa correspondiente
2. mostrar plan
3. esperar aprobacion

## Contratos cerrados

- `GET /health`
- negocio bajo `/api/v1`
- error envelope: `{ success:false, error:{ code, message, details? }, traceId }`
- browser auth con cookies separadas para access y refresh
- headless auth con bearer
- `X-Tenant-Id` obligatorio en rutas tenant-scoped

## Etapas

- `-1` bootstrap
- `0` fundaciones
- `1` base de persistencia y utilidades
- `2` identidad y auth
- `3` tenant core
- `4` RBAC y politicas
- `5` auditoria
- `6` settings platform
- `7` settings tenant
- `8` inventory piloto
- `9` crm
- `10` hr
- `11` hardening/go-live

## Regla final

Si encuentras contradiccion entre documentos, no inventes.

Debes:

1. reportarla
2. proponer ajuste
3. esperar aprobacion o apoyarte en el orden de precedencia definido en `AGENTS.md`
