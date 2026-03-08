# ADR-003

## Titulo

Separacion entre `users` y `user_security`.

## Decision

- `users` contiene solo perfil y estado publico
- `user_security` contiene hashes, secrets, recovery codes y tokens sensibles

## Consecuencias

- Ningun endpoint ni serializer expone `user_security`
- Register y auth requieren consistencia multi-coleccion
