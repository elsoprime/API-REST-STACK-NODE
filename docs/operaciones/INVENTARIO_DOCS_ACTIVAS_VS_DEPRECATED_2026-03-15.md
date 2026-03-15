# Inventario Documental Activo vs Deprecated (2026-03-15)

## Objetivo

Alinear la documentacion del repositorio `API-REST-STACK-NODE` al estado real del codigo y reducir ruido/deuda tecnica documental.

## Fuente de verdad activa

La fuente de verdad vigente queda concentrada en:

- `docs/PLAN_MAESTRO.md`
- `docs/arquitectura/`
- `docs/checklists/CRITERIOS_DE_CIERRE.md`
- `docs/adrs/ADRs.md`
- `docs/PLAN_REMEDIACION_INTEGRACION_REPO.md`
- `docs/cierres/ETAPA_*` (evidencia formal por etapa)
- `openapi/openapi.yaml` y arbol `openapi/`

## Estado actual de deuda documental

- Enlaces absolutos locales (`H:/`, `/H:/`) en docs activas: `0`
- Enlaces markdown validados por gate: `npm run docs:links:validate` en verde
- Carpeta legacy historica: migrada a `docs/_deprecated/`
- Politica de enlaces: `docs/checklists/DOC_LINK_POLICY.md`

## Documentos en deprecated (historial)

- `docs/_deprecated/00_PLAN_MAESTRO.md`
- `docs/_deprecated/CODEX_AGENT_PROMPT_MAESTRO.md`
- `docs/_deprecated/DOCUMENTACION_COMPLETA_SAAS_V3.md`
- `docs/_deprecated/README.md` (motivo + reemplazo)

## Criterio de permanencia en ruta activa

Un documento se mantiene activo si cumple al menos una condicion:

- Referenciado por `docs/PLAN_MAESTRO.md` como contrato vigente.
- Es evidencia formal de etapa o reapertura tecnica en `docs/cierres/`.
- Forma parte de guias operativas necesarias para DoD/Go-Live.
- Es reflejo contractual FE/API requerido por `docs:coupling:check`.

## Criterio de deprecacion

Un documento se mueve a `docs/_deprecated/` cuando:

- Duplica contenido canonico ya existente.
- Es historico/no normativo para el estado actual.
- No participa en gates ni en flujo de cierre operativo.

## Riesgo residual documental

- Riesgo bajo: reintroduccion de enlaces no portables.
- Mitigacion activa: gate `docs:links:validate` en CI.

## Resultado esperado tras limpieza completa

- Ruta activa solo con documentos vigentes y trazables.
- Historial preservado en `docs/_deprecated/`.
- Menor ruido para auditoria, onboarding y releases.
