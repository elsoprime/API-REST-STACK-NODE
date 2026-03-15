# Reapertura Tecnica Etapa 03

Fecha: 2026-03-14  
Estado: En remediacion controlada

## 1. Motivo

La auditoria tecnica detecta que el dominio tenant necesita reapertura formal para cerrar una brecha de lifecycle y suscripcion:

- coexisten caminos de activacion que deben alinearse con el flujo canonico pago -> activacion
- el estado tenant/suscripcion necesita una maquina de estados explicita
- el contrato OpenAPI y la evidencia automatizada deben acompanar el cambio

## 2. Alcance de remediacion

- formalizar lifecycle de tenant/suscripcion segun ADR-015
- impedir activaciones directas fuera del flujo canonico definido
- alinear modelo, servicio, controlador y contrato OpenAPI de tenant/subscription
- agregar pruebas automatizadas de transicion de estados e invariantes de dominio

## 3. Dependencias documentales

- `docs/adrs/ADR-015_SUBSCRIPTION_GATING_AND_TENANT_LIFECYCLE.md`
- `docs/PLAN_REMEDIACION_INTEGRACION_REPO.md`

## 4. Regla de re-cierre

La Etapa 03 no vuelve a cierre formal hasta completar:

- `npm run build`
- `npm run lint`
- `npm run test`
- `npm run openapi:validate`
- contrato OpenAPI alineado para tenant/subscription
- evidencia automatizada de lifecycle tenant/suscripcion sin bypass funcional

## 5. Resultado actual

La etapa queda reabierta formalmente para remediacion controlada. No existe re-cierre narrativo en esta ola.
## 6. Re-cierre formal (2026-03-15)

Estado: Re-cierre formal completado.

Evidencia automatizada del corte:

- `npm run lint` -> OK
- `npm run build` -> OK
- `npm run test` -> OK
- `npm run test:coverage` -> OK
- `npm run openapi:validate` -> OK
- `npm run docs:cierres:validate` -> OK
- cobertura reforzada en `tenant.service.ts` y pruebas de lifecycle/suscripcion (unit + integration)

Observacion de gobernanza:

- El historial se mantiene append-only: no se elimina evidencia previa de reapertura.
- El re-cierre se documenta despues de ejecutar gates en verde del repositorio.

