# ADR-007

## Titulo

Entrega de tokens de invitacion tenant por puerto externo, sin exponer secretos por API publica.

## Contexto

Etapa 3 exige:

- `invitations`
- aceptacion por token
- no exponer secretos en responses ni logs

El Plan Maestro prohibe exponer secretos en responses y logs. Por lo tanto, el token de invitacion no puede formar parte del contrato HTTP publico.

## Decision

- las invitaciones tenant entregan su token por `TenantInvitationDeliveryPort`
- la API publica solo expone metadata de la invitacion, nunca el token
- `development` y `test` usan adaptador `in-memory` inspeccionable por tests
- `production` requiere un adaptador real cableado antes de go-live

## Consecuencias

- los tests de integracion deben obtener el token desde el adaptador, no desde respuestas HTTP
- OpenAPI debe documentar la entrega de invitaciones como canal externo seguro
- `production` no queda autorizada para go-live sin un adaptador real de delivery de invitaciones
