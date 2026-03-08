# ADR-001

## Titulo

Estrategia de autenticacion browser-first con cookies separadas y soporte headless.

## Decision

- Browser:
  - access token en cookie HttpOnly dedicada
  - refresh token en cookie HttpOnly separada
  - CSRF obligatorio en mutaciones autenticadas por cookie
- Headless:
  - Bearer access token
- El middleware de autenticacion valida access token, no refresh token

## Consecuencias

- Se requiere `AUTH_ACCESS_COOKIE_NAME`
- Se requiere `REFRESH_TOKEN_COOKIE_NAME`
- OpenAPI debe distinguir claramente browser y headless
