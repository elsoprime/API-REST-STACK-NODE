# ADR-015 Subscription Gating and Tenant Lifecycle

Fecha: 2026-03-14

## Estado

Aprobado

## Contexto

La auditoria tecnica y la remediacion de integracion identifican una brecha de negocio y de gobierno:

- el ciclo de vida tenant/suscripcion no puede apoyarse en activaciones narrativas
- deben evitarse caminos de activacion que rompan el flujo canonico pago -> activacion
- la evidencia de pago y la trazabilidad de transiciones deben ser auditables
- cualquier re-cierre de etapa depende de evidencia automatizada, no solo de la decision documental

Esto impacta principalmente Etapa 03 y, por acoplamiento funcional, Etapa 11.

## Decision

Se define un modelo canonico de ciclo de vida tenant/suscripcion:

- estados admitidos: `pending`, `active`, `grace`, `suspended`, `canceled`, `reactivated`
- todo tenant nuevo inicia en `pending`
- la activacion a `active` requiere evidencia de pago valida y auditable
- `PATCH /api/v1/tenant/subscription` deja de ser via de activacion directa sin evidencia de pago
- cancelaciones, impagos y reactivaciones deben seguir una maquina de estados explicita

Reglas adicionales:

- toda transicion registra actor, origen y evidencia
- el acceso operativo pleno solo existe para tenants en estado compatible con el contrato
- las transiciones invalidas fallan cerrado con error de dominio estable
- el contrato OpenAPI y los tests de lifecycle son parte del cambio, no anexos opcionales

## Consecuencias

- se requiere alinear modelo, servicio, controlador y contrato OpenAPI de tenant/subscription
- se requieren pruebas de transicion de estados e invariantes de negocio
- frontend debe reflejar estado de activacion y restricciones asociadas
- esta decision no implica re-cierre automatico de Etapa 03; solo habilita su implementacion gobernada

## Alternativas consideradas

1. Mantener `PATCH /tenant/subscription` con validaciones parciales

- ventaja: menor cambio inmediato
- desventaja: persiste el riesgo de bypass de activacion

2. Gating total por evidencia de pago auditada (decision actual)

- ventaja: consistencia del flujo de negocio y mejor trazabilidad
- desventaja: mayor alcance de implementacion y pruebas

## Cierre de decision

La activacion de tenant/suscripcion queda condicionada a evidencia de pago validada por flujo de billing y auditoria.
