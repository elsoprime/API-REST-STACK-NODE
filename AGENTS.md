# AGENTS.md — Global
# API-REST-STACK-NODE · SaaS Core Engine V3

## Contexto

- Stack: Node.js LTS + TypeScript strict + MongoDB 7.x replica set + Mongoose 8.x
- Arquitectura: SaaS multitenant shared schema con aislamiento por `tenantId`
- Auth browser-first: cookies HttpOnly separadas para access y refresh + CSRF
- Headless: Bearer access token
- RBAC: motor compatible con roles sistema y custom desde Etapa 4
- Tenant context: `X-Tenant-Id` como contrato principal en rutas tenant-scoped

## Fuente de verdad

- `docs/PLAN_MAESTRO.md`
- `docs/arquitectura/CONTRATOS_TRANSVERSALES.md`
- `docs/arquitectura/ESTRUCTURA_REPO_OBJETIVO.md`
- `docs/arquitectura/ETAPA_-1_BOOTSTRAP.md`
- `docs/arquitectura/ENTORNOS_Y_RESILIENCIA.md`
- `docs/checklists/CRITERIOS_DE_CIERRE.md`
- `docs/anexos/`
- `docs/adrs/`

Si dos documentos se contradicen:

1. gana `docs/PLAN_MAESTRO.md`
2. luego `docs/arquitectura/`
3. luego ADRs
4. luego anexos

## Modo de trabajo — GUIADO

Antes de escribir codigo, mostrar siempre un plan con este formato y esperar aprobacion:

```text
=== PLAN ETAPA [N] — [NOMBRE] ===

📁 Archivos a crear:
  - src/ruta/archivo.ts → qué hace

✏️  Archivos a modificar:
  - src/ruta/existente.ts → qué cambia

📋 Orden de implementación:
  1. primero esto
  2. luego esto

⚠️  Decisiones a confirmar:
  - pregunta concreta si hay ambigüedad

¿Procedo con este plan?
```

Sin aprobacion explicita, no implementar.

## Etapas

- Etapa -1 → Bootstrap real del repo y del entorno
- Etapa 0 → Fundaciones HTTP, logger, errores, OpenAPI base, healthcheck
- Etapa 1 → DB, constantes, utilidades y middlewares base
- Etapa 2 → Platform identity y auth
- Etapa 3 → Tenant core
- Etapa 4 → RBAC, scopes, permisos, planes, modulos
- Etapa 5 → Auditoria y observabilidad
- Etapa 6 → Settings platform
- Etapa 7 → Settings tenant
- Etapa 8 → Inventory piloto
- Etapa 9 → CRM
- Etapa 10 → HR
- Etapa 11 → Hardening y go-live

## Contratos globales obligatorios

- Error HTTP:
  - `{ success: false, error: { code, message, details? }, traceId }`
- Exito:
  - `buildSuccess()` o `buildPaginatedSuccess()`
- Health:
  - `GET /health`
- API negocio:
  - `/api/v1/*`
- Tenant:
  - `X-Tenant-Id` obligatorio en rutas tenant-scoped
- OpenAPI:
  - si no esta en `openapi/`, no existe
- Entornos:
  - `development`, `test` y `production` son formales
  - configuracion valida obligatoria al arranque
  - retries de conexion acotados
  - `production` falla rapido si la DB critica no inicia

## Lo que ningun agente debe hacer

- crear endpoints fuera del contrato OpenAPI
- usar `any` en produccion sin justificacion documentada
- responder errores con formatos alternativos al contrato
- poner logica de negocio en controllers
- hacer queries tenant-scoped sin `tenantId`
- exponer `user_security`
- avanzar de etapa sin cierre formal
- introducir contradicciones documentales sin ADR
