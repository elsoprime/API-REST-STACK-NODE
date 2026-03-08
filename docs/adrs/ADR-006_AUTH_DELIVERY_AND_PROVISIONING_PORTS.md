# ADR-006

## Titulo

Puertos de delivery para verify-email y provisioning de 2FA sin exponer secretos por API publica.

## Contexto

Etapa 2 exige:

- `verify email`
- `2FA setup/confirm/disable`
- `recovery codes`
- no exponer secretos en responses ni logs

El Plan Maestro prohibe exponer secretos en responses y logs. Por lo tanto, el token de verificacion de email y el material de provisioning TOTP no pueden formar parte del contrato HTTP publico.

## Decision

- `verify-email` entrega el token por `EmailVerificationDeliveryPort`
- `2FA setup` entrega el secreto TOTP y el `otpauthUrl` por `TwoFactorProvisioningPort`
- la API publica solo expone estado operativo, nunca secretos
- `development` y `test` usan adaptadores `in-memory` inspeccionables por tests
- `production` requiere un adaptador real cableado antes de go-live

## Consecuencias

- los tests de integracion deben obtener token/secreto desde los adaptadores, no desde respuestas HTTP
- OpenAPI debe describir el delivery/provisioning como canal externo seguro al response publico
- el backend conserva el contrato seguro aun cuando el canal real de entrega se implemente mas adelante
- `production` no queda autorizada para go-live sin un adaptador real de delivery/provisioning
