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
- alinear visualmente una vista ya integrada

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

### Paridad visual y UX del modulo Expenses en frontend

Estado: pendiente

Tipo de trabajo:

- refactor visual
- alineacion UX
- sin cambio funcional de negocio

Objetivo:

- corregir la desviacion visual de `Expenses` respecto del dashboard actual
- homologar `Expenses` con el lenguaje UI de modulos maduros como `Inventory`
- mantener intacto el funcionamiento ya integrado del modulo

Se va a hacer concretamente:

- alinear el layout general del workspace con el patron del dashboard existente
- corregir jerarquia visual de titulos, subtitulos, barras de acciones y tabs
- normalizar tablas y listados para que sigan el mismo patron visual de `Inventory`
- ajustar formularios y drawers para que usen el mismo estilo, espaciado y feedback visual del resto de modulos
- revisar badges, estados empty/loading/error y mensajes de accion para que se vean nativos del sistema
- revisar bulk actions bar y acciones contextuales para que mantengan consistencia visual con las demas pantallas
- corregir paddings, gaps, cards, shells y contenedores que hoy hacen que `Expenses` se vea como un modulo paralelo

No se va a tocar:

- contratos API
- cliente API
- permisos
- plan gating
- workflow de negocio
- reglas de aprobacion, rechazo, pago o cancelacion
- OpenAPI
- logica backend

Base recomendada:

- frontend `main`
- rama sugerida: `feat/expenses-ui-parity`

DoD minimo:

- `Expenses` se percibe visualmente parte del mismo dashboard que `Inventory`, `CRM` y los workspaces tenant
- `/app/expenses` y `/app/expenses/[requestId]` mantienen el mismo comportamiento funcional actual
- estados read-only por permisos siguen intactos
- no se introducen cambios de contrato ni acoplamientos nuevos con backend
- si cambia la navegacion visual o estructura del workspace, se actualiza documentacion operativa minima