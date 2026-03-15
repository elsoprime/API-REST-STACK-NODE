# ADR-016 Webhook Security and Anti-Replay

Fecha: 2026-03-14

## Estado

Aprobado

## Contexto

La auditoria tecnica detecta que los webhooks de billing necesitan una postura antifraude mas fuerte:

- validacion de firma insuficiente como unica defensa
- riesgo de replay si no existe ventana temporal controlada
- idempotencia incompleta si solo se mira una clave operativa
- necesidad de observabilidad explicita para rechazos y duplicados

Esto impacta principalmente Etapa 11 y el contrato operativo del dominio billing.

## Decision

Se formaliza el siguiente estandar de seguridad para webhooks:

- validacion de firma sobre el payload canonico o `raw body`, segun defina el contrato final del proveedor
- validacion de timestamp con tolerancia temporal acotada
- idempotencia por `eventId` y huella operativa complementaria cuando aplique
- almacenamiento de eventos procesados y rechazos de seguridad
- rechazo explicito de eventos fuera del catalogo soportado

Reglas operativas:

- los errores de firma o timestamp se registran con severidad de seguridad
- los eventos duplicados no mutan estado y responden de forma idempotente
- toda mutacion originada en webhook deja evidencia de auditoria
- el cambio debe reflejarse en OpenAPI y en pruebas automatizadas de replay/duplicados

## Consecuencias

- puede requerirse ajuste del pipeline HTTP para preservar payload verificable
- se amplian pruebas para firma invalida, timestamp vencido y duplicados
- se endurecen logs y metricas de eventos rechazados
- esta decision no implica re-cierre automatico de Etapa 11; solo define la via canonica de implementacion

## Alternativas consideradas

1. Mantener la validacion actual y apoyarse solo en firma e idempotencia basica

- ventaja: menor cambio inmediato
- desventaja: postura de seguridad insuficiente para go-live endurecido

2. Firma + anti-replay temporal + idempotencia reforzada (decision actual)

- ventaja: mejor resistencia operativa y trazabilidad de fraude
- desventaja: mayor complejidad de implementacion y pruebas

## Cierre de decision

El flujo de webhook de billing pasa a un modelo antifraude con validacion de autenticidad, anti-replay temporal e idempotencia reforzada.
