# ADR-008

## Titulo

Ownership de tenant como atributo de negocio con autorizacion efectiva sobre RBAC.

## Decision

- `tenant.ownerUserId` es la fuente de verdad unica para ownership.
- `membership.roleKey` representa el rol base RBAC de la membership.
- Los privilegios de owner se resuelven en runtime como autorizacion efectiva cuando `membership.userId === tenant.ownerUserId`.
- `transferOwnership` cambia `ownerUserId` y no reescribe roles custom por sorpresa.
- Si la membership saliente usa el rol sistema `tenant:owner`, se normaliza a `tenant:member` durante la transferencia para evitar estados legacy incoherentes.
- `requireRole('tenant:owner')` y permisos como `tenant:ownership:transfer` se evalúan contra la autorizacion efectiva, no contra `roleKey` persistido en forma aislada.
- Los claims autenticados que identifican recursos Mongo (`sub`, `tenantId`, `membershipId`) deben ser `ObjectId` validos al entrar al runtime HTTP.

## Consecuencias

- Se elimina la doble autoridad entre `ownerUserId` y `roleKey`.
- Un owner con rol custom mantiene su rol base y aun asi obtiene privilegios efectivos de owner.
- Un no-owner con rol custom alto no hereda semantica de owner.
- Las rutas autenticadas fallan en 401 antes de tocar servicios si los claims son estructuralmente invalidos.
