# Checklist PR Etapa 11

## 1. Objetivo

Checklist de salida para PR de hardening/go-live de Etapa 11.
Fecha de validacion local: 2026-03-10.

## 2. Checklist tecnico

- [x] `npm run build` en verde
- [x] `npm run lint` en verde
- [x] `npm run openapi:validate` en verde
- [x] `npm run test` en verde
- [x] `npm run test:smoke` en verde
- [x] `npm run test:restore` en verde
- [x] `ENABLE_MONGODB_RESTORE_DRILL=true npm run test:restore:mongodb` en verde (staging o entorno con Mongo rs0)
- [x] `npm run go-live:check` en verde
- [x] `/health` mantiene contrato y expone `ready` + `checks`
- [x] readiness en `production` falla si faltan adaptadores reales de delivery

## 3. Checklist operacional

- [x] runbook actualizado: [RUNBOOK_GO_LIVE.md](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/docs/operaciones/RUNBOOK_GO_LIVE.md)
- [x] guia local de drill Mongo disponible: [MONGO_LOCAL_RESTORE_DRILL.md](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/docs/operaciones/MONGO_LOCAL_RESTORE_DRILL.md)
- [x] evidencia de cierre actualizada: [ETAPA_11_CIERRE.md](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/docs/cierres/ETAPA_11_CIERRE.md)
- [ ] pipeline de release candidate/staging ejecutando smoke + restore:
  - [staging-release-candidate-go-live.yml](/H:/Proyectos%20FullStack/API-REST-STACK-NODE/.github/workflows/staging-release-candidate-go-live.yml)

## 4. Riesgos residuales

- El drill Mongo real depende de infraestructura Mongo replica set disponible en CI/staging.
- Los webhooks de delivery pueden fallar por red/proveedor externo aunque la configuracion sea valida.
- El flag de readiness y la salud de DB no reemplazan monitoreo de latencia/errores funcionales por dominio.
- El rollback de aplicacion no revierte automaticamente efectos externos ya emitidos (emails/provisioning).

## 5. Criterio de merge

La PR solo se aprueba si los checklists tecnico y operacional quedan completos y sin riesgos criticos abiertos.
