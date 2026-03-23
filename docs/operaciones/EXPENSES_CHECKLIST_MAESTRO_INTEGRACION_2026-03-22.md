# Expenses Checklist Maestro de Integracion

Fecha de corte: 2026-03-22
Tipo: checklist maestro de planificacion y control
Estado: activo

## Proposito

Centralizar en un solo documento el estado real de la integracion de `Expenses`, lo ya cerrado, lo pendiente y la forma correcta de ejecutar nuevas olas sin generar ruido documental ni acoplamiento accidental entre backend y frontend.

Este documento no reemplaza cierres por ola.
Este documento no reemplaza PRs funcionales.
Este documento sirve para retomar trabajo futuro con contexto operativo suficiente.

## Snapshot Actual

Estado de repositorios al corte:
- Backend: `API-REST-STACK-NODE`, rama `main`, snapshot limpio en `b8bd326`.
- Frontend: `FRONTEND-STACK-NEXT-TAILWIND`, rama `main`, snapshot limpio en `8378d77`.

Integraciones ya cerradas o activas:
- Requests base del modulo.
- Workspace base del modulo.
- Settings del modulo.
- Hardening inicial de settings.
- Catalogo de categorias con alta individual.
- Importacion masiva CSV de categorias.
- Dashboard de reportes en frontend.
- Metricas nativas backend para reports/dashboard.
- Gobernanza inicial del catalogo en frontend.
- Ajuste de limites de query frontend para respetar validacion backend (`max 100`).

Gaps todavia abiertos:
- Subcategorias como entidad real y no solo convencion de key.
- Workflow multi-step real por politicas.
- Integracion de pagos y conciliacion.
- Notificaciones transaccionales.
- Exportes/reportes enterprise.
- Hardening y QA integral de release.

## Fuente de Verdad

Documentos a leer antes de abrir una nueva ola:
1. `docs/operaciones/EXPENSES_PROPUESTA_IMPLEMENTACION_SAAS_2026-03-21.md`
2. cierres de ola ya ejecutados en backend
3. cierres espejo ya ejecutados en frontend
4. este checklist maestro

Regla de prioridad documental:
1. `PLAN_MAESTRO.md`
2. arquitectura y contratos
3. cierres tecnicos
4. checklist maestro

Documento complementario recomendado:
- `docs/operaciones/EXPENSES_PROPUESTA_REFACTORIZACION_TAXONOMIA_Y_RUNTIME_2026-03-22.md`

## Regla de Trabajo Recomendada

- Nunca mezclar documentacion y runtime en el mismo PR salvo cierre de una ola ya terminada.
- Para nuevas tareas funcionales: una rama por ola y por repo.
- Para trabajo solo documental: ramas docs-only separadas por repo.
- Backend PR primero si se modifica contrato.
- Frontend PR despues cuando el contrato backend ya este claro.
- Si una ola es solo frontend, igual debe actualizarse el espejo documental backend indicando dependencia pendiente o no aplicable.

## Convenciones de Ramas y PR

Ramas recomendadas:
- backend funcional: `feat/expenses-<ola-o-capacidad>`
- frontend funcional: `feat/expenses-<ola-o-capacidad>`
- documental: `docs/expenses-<tema>`
- hotfix: `fix/expenses-<problema>`

Reglas:
- Una ola = un objetivo funcional principal.
- No mezclar dos olas grandes en una sola rama.
- No abrir PRs simultaneos a `main` que modifiquen el mismo flujo de Expenses.
- Si hay dependencia de contrato, merge por orden: backend -> frontend.

## Checklist de Control Transversal

Antes de iniciar una nueva ola:
- [ ] validar que ambos repositorios parten desde `main` limpio
- [ ] definir si la ola toca contrato backend
- [ ] definir si la ola requiere espejo documental en ambos repos
- [ ] fijar DoD de la ola antes de escribir codigo
- [ ] fijar estrategia de pruebas (`lint`, `build`, e2e focal, smoke runtime)

Antes de mergear una ola:
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] pruebas focales de la ola
- [ ] documento de cierre creado
- [ ] README operativo actualizado si cambia la referencia activa
- [ ] PR revisado sin mezclar ruido ajeno

## Estado de Olas Ejecutadas

- [x] Ola Requests base
- [x] Ola Settings y categorias iniciales
- [x] Ola Catalogo CLP y request form relacionado
- [x] Ola Importacion masiva de categorias
- [x] Ola Dashboard frontend en reports
- [x] Ola Gobernanza inicial del catalogo
- [x] Hotfix limites de query frontend (`100`)
- [x] Ola Metricas nativas backend/frontend
- [x] Hotfix create-request date ISO (Ola 6.0)
- [x] Ola 6 Backend Subcategorias Reales

## Prioridad Operativa Inmediata

### Hotfix previo a nuevas olas

Objetivo:
- corregir la brecha de runtime de `create-request` antes de considerar cerrado el flujo operativo de solicitudes

Estado:
- [x] completado (Ola 6.0)

Referencia tecnica:
- ver `docs/operaciones/EXPENSES_PROPUESTA_REFACTORIZACION_TAXONOMIA_Y_RUNTIME_2026-03-22.md`
- ver `docs/operaciones/EXPENSES_HOTFIX_CREATE_REQUEST_CIERRE_2026-03-22.md`

## Pendientes Priorizados

### Ola 5 - Metricas Nativas Backend

Estado:
- [x] completada

Objetivo:
- mover el dashboard de reports a un contrato backend agregado, sin depender de combinar `requests` y `categories` en frontend

Backend:
- [x] definido endpoint agregado `GET /api/v1/modules/expenses/reports/dashboard`
- [x] expuestos KPIs
- [x] expuestas tendencias por rango
- [x] expuesta distribucion por categoria
- [x] expuestas alertas operativas derivadas
- [x] documentado contrato en OpenAPI
- [x] agregados tests de integracion

Frontend:
- [x] reemplazada agregacion local por hook basado en endpoint dedicado
- [x] mantenidos filtros actuales
- [x] validados fallback/error states

DoD:
- [x] dashboard deja de depender de combinacion local paginada
- [x] OpenAPI actualizado
- [x] backend y frontend con pruebas verdes
- [x] `reports/summary` sigue compatible

### Ola 6 - Subcategorias Reales

Objetivo:
- convertir la convencion por `key` en una estructura formal de catalogo

Backend:
- [x] definir modelo de subcategoria
- [x] relacionar `categoryId` / `subcategoryId`
- [x] CRUD tenant-scoped de subcategorias
- [x] reglas de integridad y activacion/inactivacion
- [ ] migracion o compatibilidad con keys historicas (pendiente decision formal)

Frontend:
- [ ] UI de subcategorias en settings
- [ ] selector jerarquico en request form
- [ ] gobernanza visual real sin depender de convencion `parent_sub`

DoD:
- [ ] request usa subcategoria real
- [x] categorias/subcategorias con contratos propios (backend)
- [ ] compatibilidad de datos existentes definida

### Ola 7 - Workflow Multi-Step

Objetivo:
- soportar aprobacion por etapas, por monto, categoria o rol

Backend:
- [ ] politicas de workflow por tenant
- [ ] transiciones multi-step
- [ ] auditoria por etapa
- [ ] SLA por etapa

Frontend:
- [ ] timeline de aprobacion
- [ ] estado de etapa actual
- [ ] acciones segun rol y etapa
- [ ] reportes con embudo de aprobacion

DoD:
- [ ] aprobacion multi-step funcional
- [ ] estados consistentes
- [ ] pruebas por rol/escenario

### Ola 8 - Pagos y Conciliacion

Objetivo:
- llevar el modulo desde aprobacion a ejecucion financiera controlada

Backend:
- [ ] integracion con ERP/pasarela o capa de simulacion controlada
- [ ] idempotencia en marcacion de pago
- [ ] conciliacion y reintentos
- [ ] errores y callbacks consistentes

Frontend:
- [ ] panel de pagos
- [ ] estado de ejecucion
- [ ] conciliacion visible
- [ ] feedback de errores de pago

DoD:
- [ ] flujo aprobado -> pagado robusto
- [ ] conciliacion visible y trazable

### Ola 9 - Notificaciones Transaccionales

Objetivo:
- comunicar eventos criticos del modulo

Backend:
- [ ] eventos `submitted`, `approved`, `rejected`, `paid`
- [ ] plantillas base
- [ ] colas o envio transaccional

Frontend:
- [ ] estados de notificacion relevantes
- [ ] opcionalmente centro de actividad o avisos in-app

DoD:
- [ ] eventos criticos entregados y trazables

### Ola 10 - Reporteria Enterprise y Exportes

Objetivo:
- escalar reportes y exportes para volumen real

Backend:
- [ ] exportes asincronos por job
- [ ] filtros avanzados
- [ ] snapshots historicos

Frontend:
- [ ] panel de exportes
- [ ] estado del job
- [ ] descarga diferida

DoD:
- [ ] exportes grandes sin bloquear UI ni request sincrono

### Ola 11 - Hardening Final y Release

Objetivo:
- preparar el modulo para release estable

Backend:
- [ ] reglas antifraude basicas
- [ ] validaciones de duplicado
- [ ] controles de abuso para bulk
- [ ] observabilidad y alertas tecnicas

Frontend:
- [ ] cobertura e2e transversal por rol y plan
- [ ] smoke suite de regresion
- [ ] pulido final de UX y mensajes de error

DoD:
- [ ] checklist de release completo
- [ ] smoke integral en verde
- [ ] documentacion de handoff lista

## Dependencias Cruzadas

Dependencias backend -> frontend:
- dashboard agregado
- subcategorias reales
- multi-step workflow
- pagos y conciliacion
- notificaciones y exportes asincronos

Dependencias frontend -> backend:
- feedback temprano de UX
- validacion de contratos insuficientes
- casos reales para filtros y payloads

## Riesgos Principales

- Mezclar olas de contrato y olas visuales en la misma rama
- abrir PR frontend antes de fijar contrato backend
- sobrecargar `requests` listando demasiados registros para analitica
- modelar subcategorias solo en UI sin una decision de datos real
- introducir cierres documentales sin espejo entre repos

## Rollback y Control

Si una ola falla:
- no revertir otras olas ya cerradas
- aislar rollback a la rama/PR de la ola
- documentar en el cierre que quedo pendiente
- actualizar este checklist con nuevo estado real

## Protocolo Para Retomar Otro Dia

1. abrir este checklist
2. confirmar `main` limpio en ambos repos
3. confirmar ultima ola mergeada
4. elegir una sola ola pendiente
5. abrir ramas nuevas por repo
6. ejecutar cambios, pruebas y cierre documental espejo

## Estado del Checklist

- [x] creado en backend
- [ ] proximo paso: crear espejo frontend y registrar referencia en README operativo


