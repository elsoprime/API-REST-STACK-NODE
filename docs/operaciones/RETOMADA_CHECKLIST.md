# Checklist de Retomada

## Objetivo

Usar una regla corta y consistente para retomar trabajo funcional, visual o tecnico sin reintroducir ruido en los repositorios.

## Regla base

`main` = estado estable  
`wip/*` = respaldo de trabajo no integrado  
`feat/*` = nueva rama limpia para continuar trabajo

## Checklist operativo

1. Entrar a `main` y ejecutar `git pull --ff-only`.
2. Confirmar si el cambio nuevo parte de lo que ya esta estable.
3. Si el cambio ya esta en `main`, crear una rama nueva `feat/*`.
4. Si el cambio depende de algo no integrado, revisar `wip/*`.
5. Nunca continuar trabajo nuevo directamente sobre `wip/*`; crear una rama `feat/*` desde ahi.
6. Mantener commits scopeados por modulo o flujo.

## Cuando usar cada base

### Caso 1. Cambio nuevo sobre funcionalidad ya integrada

Usar `main`.

Ejemplos:

- cambiar una funcionalidad existente
- corregir bugs
- ajustar un flujo de aprobacion
- rediseñar una vista ya integrada

### Caso 2. Rescatar trabajo que no entro a `main`

Revisar `wip/*`, validar que el contenido realmente hace falta y abrir una rama `feat/*` desde esa base.

### Caso 3. Probar una idea sin contaminar lo estable

Crear una rama `feat/*` desde `main`.

## Comandos de referencia

### Retomar desde estable

```bash
git switch main
git pull --ff-only
git switch -c feat/nombre-del-cambio
```

### Retomar desde respaldo

```bash
git switch wip/frontend-residual-2026-03-22
git switch -c feat/rescate-o-ajuste
```

## Tarea activa

### Rediseñar modulo Expenses en frontend

Estado: pendiente

Objetivo:

- homologar `Expenses` al lenguaje visual del dashboard
- revisar layout, jerarquia visual, tablas, formularios y feedback de acciones
- mantener compatibilidad con permisos, plan gating y contratos API actuales

Base recomendada:

- frontend `main`
- rama sugerida: `feat/expenses-frontend-redesign`

DoD minimo:

- UI de `Expenses` coherente con modulos maduros del dashboard
- sin regresion en rutas `/app/expenses` y `/app/expenses/[requestId]`
- permisos y estados read-only respetados
- documentacion operativa actualizada si cambia el flujo