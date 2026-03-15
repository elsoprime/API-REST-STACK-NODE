# Politica de Enlaces Documentales

## Objetivo
Mantener documentacion portable y verificable en cualquier entorno de trabajo.

## Reglas
- Usar enlaces relativos para archivos internos del repositorio.
- No usar rutas absolutas de disco (`H:/`, `/H:/`, `C:/`, etc.).
- No usar enlaces raiz (`/docs/...`) para contenido local del repo.
- Mantener anclas (`#...`) y query (`?...`) solo sobre rutas relativas validas.

## Validacion
- Ejecutar `npm run docs:links:validate`.
- CI bloquea cambios si detecta enlaces absolutos o destinos inexistentes.

## Alcance
- `README.md`
- `docs/**/*.md`
