# Propuesta de Implementacion SaaS - Modulo Expenses

Version: 0.2.0
Estado: En ejecucion controlada (backend expenses implementado; frontend pendiente)
Fecha de registro: 2026-03-21
## 0. Estado de avance real (2026-03-21)

Resumen de corte:

- Olas 1 a 4: implementadas en backend (OpenAPI, modelos/schemas, workflow, adjuntos, bulk, reporting, export y notificaciones de estado).
- Ola 5 (backend): completada para la parte de integracion y QA de API con suites de integracion de `expenses`.
- Ola 5 (frontend): pendiente de ejecucion por equipo frontend.

Validacion de corte backend:

- `npm test -- tests/integration/expenses/expenses.workflow.routes.test.ts tests/integration/expenses/expenses.attachments.routes.test.ts tests/integration/expenses/expenses.bulk.routes.test.ts tests/integration/expenses/expenses.reporting.routes.test.ts` -> 17/17 tests passing.

Nota tecnica relevante del corte:

- Se corrigio orden de rutas en `expenses.routes` para evitar colision de `POST /requests/bulk/*` con `POST /requests/:requestId/*`.

## 1. Objetivo

Documentar una propuesta de implementacion futura para un modulo `expenses` dentro de `API-REST-STACK-NODE`, dejando el alcance, los contratos esperados y la estrategia de ejecucion listos para retomarse en otra sesion sin redescubrir decisiones ya analizadas.

Este documento:

- no modifica el roadmap activo por si mismo
- no agrega endpoints ni contratos vigentes
- no reemplaza `docs/PLAN_MAESTRO.md`
- no reemplaza `docs/frontend/10_IMPLEMENTATION_GUIDE_V2.md`
- no debe interpretarse como cierre de etapa, ADR ni backlog frontend abierto

## 2. Posicionamiento de producto

La recomendacion actual es modelar `expenses` como modulo SaaS tenant-scoped de `Expense Management`, no como modulo generico de pagos.

Boundary funcional recomendado:

- reembolsos de gastos
- anticipos o solicitudes internas de gasto
- aprobacion operativa y trazabilidad
- marcacion de pago o desembolso ya ejecutado

Fuera del MVP:

- ejecucion real de pagos
- cuentas por pagar completas a proveedores
- conciliacion bancaria
- OCR
- automatizacion antifraude avanzada

## 3. Encaje con el repositorio

El modulo debe seguir los contratos transversales ya cerrados:

- rutas de negocio bajo `/api/v1/modules/*`
- `X-Tenant-Id` obligatorio en rutas tenant-scoped
- aislamiento fuerte por `tenantId`
- guards RBAC con permisos atomicos
- OpenAPI como prerequisito de runtime
- auditoria tenant-scoped de mutaciones
- browser-first con CSRF condicional en mutaciones cookie-auth

Dependencias del core ya disponibles y reutilizables:

- auth y sesiones
- tenant context
- RBAC por rol/permiso/modulo/plan
- auditoria
- billing y runtime efectivo
- email transaccional

Capacidades a incorporar especificamente para `expenses`:

- workflow de aprobacion
- adjuntos de respaldo
- colas operativas
- acciones masivas (`bulk`)
- exportacion

## 4. Bounded contexts

### 4.1 Request Intake

- creacion de solicitudes
- edicion controlada
- envio para revision
- cancelacion por solicitante cuando la regla lo permita

### 4.2 Approval Workflow

- revision operativa
- devolucion al solicitante
- aprobacion
- rechazo
- futura aprobacion multinivel

### 4.3 Attachments

- metadata de archivos
- relacion con solicitud
- validaciones de tipo, tamano y estado

### 4.4 Policy and Settings

- categorias
- monedas permitidas
- montos maximos
- reglas de respaldo obligatorio
- estrategia de aprobacion simple o por escalones

### 4.5 Disbursement Tracking

- registro de pago realizado
- referencia externa
- fecha de pago
- actor responsable

### 4.6 Reporting

- counters
- cola de pendientes
- resumen por estado
- exportes

## 5. Modelo de dominio propuesto

### 5.1 ExpenseRequest

Campos minimos:

- `tenantId`
- `requestNumber`
- `requestType`
- `requesterUserId`
- `employeeId?`
- `title`
- `description`
- `categoryKey`
- `amount`
- `currency`
- `expenseDate`
- `status`
- `currentApprovalStep`
- `submittedAt?`
- `approvedAt?`
- `paidAt?`
- `canceledAt?`
- `rejectionReasonCode?`
- `paymentReference?`
- `metadata`

### 5.2 ExpenseApprovalStep

Campos minimos:

- `tenantId`
- `expenseRequestId`
- `stepOrder`
- `reviewerType`
- `reviewerUserId?`
- `reviewerRoleKey?`
- `status`
- `decisionAt?`
- `comment?`

### 5.3 ExpenseAttachment

Campos minimos:

- `tenantId`
- `expenseRequestId`
- `storageProvider`
- `objectKey`
- `originalFilename`
- `mimeType`
- `sizeBytes`
- `checksumSha256`
- `uploadedByUserId`

### 5.4 ExpenseCategory

Campos minimos:

- `tenantId`
- `key`
- `name`
- `isActive`
- `requiresAttachment`
- `defaultApprovalMode`
- `monthlyLimit?`

### 5.5 ExpenseSettings

Singleton tenant-scoped con:

- `allowedCurrencies`
- `maxAmountWithoutReview`
- `attachmentRules`
- `approvalMode`
- `bulk.maxItemsPerOperation`
- `exports.enabled`

## 6. Estados y reglas de negocio

Estados recomendados:

- `draft`
- `submitted`
- `returned`
- `approved`
- `rejected`
- `paid`
- `canceled`

Reglas base:

- `draft` y `returned` pueden ser editados por el solicitante
- `submitted` bloquea cambios estructurales del request
- `returned` exige comentario del revisor
- `approved`, `rejected`, `paid` y `canceled` son terminales
- `paid` en MVP significa "marcado como pagado", no pago ejecutado por integracion externa

## 7. RBAC propuesto

Roles funcionales sugeridos:

- `requester`
- `approver`
- `finance_operator`
- `auditor`
- `tenant_admin`

Permisos atomicos sugeridos:

- `tenant:modules:expenses:use`
- `tenant:expenses:request:create`
- `tenant:expenses:request:read:own`
- `tenant:expenses:request:update:own`
- `tenant:expenses:request:cancel:own`
- `tenant:expenses:request:read`
- `tenant:expenses:request:review`
- `tenant:expenses:request:approve`
- `tenant:expenses:request:reject`
- `tenant:expenses:payment:mark-paid`
- `tenant:expenses:report:read`
- `tenant:expenses:export`
- `tenant:expenses:settings:read`
- `tenant:expenses:settings:update`

Feature flags sugeridas:

- `expenses:base`
- `expenses:attachments`
- `expenses:bulk`
- `expenses:exports`
- `expenses:multi-approval`

## 8. Bulk actions

`Bulk actions` se consideran capability transversal del modulo, no conveniencia de UI aislada.

Primer corte recomendado:

- bulk approve
- bulk reject
- bulk mark-paid
- bulk export

Reglas recomendadas:

- endpoint bulk explicito por accion
- limite maximo de items por lote
- validacion item por item
- resultado con `partial success` permitido
- resumen agregado y detalle por item
- auditoria del lote y de cada mutacion critica
- idempotencia en acciones destructivas u operativas

Respuesta recomendada:

- `processed`
- `succeeded`
- `failed`
- `results[]` por `id`

## 9. Adjuntos y storage

No se recomienda guardar binarios en MongoDB.

Flujo propuesto:

1. `presign`
2. upload directo desde cliente
3. `finalize` o registro de metadata en backend

El backend persiste solo metadata e invariantes de negocio.

Decisiones pendientes para implementacion real:

- storage provider
- tipos MIME permitidos
- tamano maximo por archivo
- cantidad maxima de adjuntos por solicitud

## 10. Notificaciones

MVP recomendado:

- email transaccional

Eventos iniciales:

- `expense-submitted`
- `expense-returned`
- `expense-approved`
- `expense-rejected`
- `expense-paid`

Realtime por websocket o SSE queda fuera del MVP.

## 11. Contrato HTTP MVP propuesto

Base path:

- `/api/v1/modules/expenses`

Endpoints base:

- `GET /requests`
- `POST /requests`
- `GET /requests/{requestId}`
- `PATCH /requests/{requestId}`
- `POST /requests/{requestId}/submit`
- `POST /requests/{requestId}/cancel`
- `POST /requests/{requestId}/review`
- `POST /requests/{requestId}/mark-paid`
- `GET /queue`
- `GET /counters`
- `GET /categories`
- `POST /categories`
- `PATCH /categories/{categoryId}`
- `GET /settings`
- `PUT /settings`
- `POST /uploads/presign`
- `POST /requests/{requestId}/attachments`
- `GET /requests/{requestId}/attachments`
- `DELETE /requests/{requestId}/attachments/{attachmentId}`
- `GET /reports/summary`
- `GET /exports/requests.csv`

Bulk endpoints iniciales:

- `POST /requests/bulk/approve`
- `POST /requests/bulk/reject`
- `POST /requests/bulk/mark-paid`
- `POST /requests/bulk/export`

## 12. Plan de implementacion recomendado

### Ola 0 - Alineacion y congelamiento de alcance

Entregables:

- decision log con alcance MVP y exclusiones explicitas
- confirmacion de semantica de `paid`
- definicion de aprobacion inicial (`single-step` o `multi-step` diferido)
- criterio de moneda (`single` o `multi-currency`)
- limites base de `bulk`

DoD (Definition of Done):

- existe un registro unico de decisiones en este documento
- no hay contradicciones con `docs/PLAN_MAESTRO.md`
- no se tocaron documentos normativos activos
- backend y frontend mantienen espejo 1:1 del archivo de propuesta

### Ola 1 - Contrato y foundations backend

Entregables:

- `openapi` inicial del modulo `expenses`
- catalogo de errores del modulo alineado al contrato global
- modelos y schemas base (`ExpenseRequest`, `ExpenseCategory`, `ExpenseSettings`)
- permisos RBAC, modulo, plan y feature flags declarados
- validaciones tenant-scoped obligatorias en capa de entrada

DoD (Definition of Done):

- el modulo existe en `openapi/` con endpoints MVP definidos
- toda ruta tenant-scoped exige `X-Tenant-Id`
- no hay uso de `any` sin justificacion documentada
- linters y tests unitarios de la capa foundation pasan

### Ola 2 - Workflow operativo y auditoria

Entregables:

- transiciones de estado: `submit`, `review/return`, `approve`, `reject`, `cancel`, `mark-paid`
- reglas de mutabilidad por estado implementadas
- validaciones de autorizacion por permiso atomico
- eventos de auditoria por mutacion critica

DoD (Definition of Done):

- maquina de estados bloquea transiciones invalidas
- cada transicion deja traza de auditoria tenant-scoped
- respuestas de error usan formato contractual global
- pruebas de integracion cubren flujo feliz y rechazos de regla

### Ola 3 - Adjuntos y notificaciones transaccionales

Entregables:

- flujo `presign -> upload directo -> finalize metadata`
- politicas de MIME, tamano y cantidad por solicitud
- asociacion de adjuntos por `tenantId + requestId`
- disparo de correos por eventos clave (`submitted`, `returned`, `approved`, `rejected`, `paid`)

DoD (Definition of Done):

- no se almacenan binarios en MongoDB
- metadata de adjuntos queda consistente e indexada
- los eventos de correo se disparan solo en transiciones validas
- pruebas de integracion validan permisos y ownership de adjuntos

### Ola 4 - Bulk actions y reporting

Entregables:

- endpoints `bulk` iniciales (`approve`, `reject`, `mark-paid`, `export`)
- procesamiento item por item con `partial success`
- limites por lote configurables por tenant o setting global
- `queue`, `counters`, `summary` y export CSV inicial

DoD (Definition of Done):

- cada accion bulk responde con resumen agregado y detalle por item
- las operaciones son idempotentes donde corresponda
- auditoria registra lote y mutaciones individuales
- pruebas de carga basica confirman limites y tiempos aceptables

### Ola 5 - Integracion frontend, QA y cierre operativo

Entregables:

- cliente HTTP y contratos tipados alineados a OpenAPI
- guardas de modulo, plan y permisos en UI
- flujos UI: bandeja, detalle, transiciones, adjuntos y bulk
- mocks y pruebas E2E de rutas criticas
- documentacion espejo backend/frontend actualizada a mismo corte

DoD (Definition of Done):

- frontend consume solo endpoints publicados en OpenAPI vigente
- E2E cubre al menos crear, aprobar/rechazar, adjuntar y bulk approve
- no existen dependencias documentales abiertas sin dueno
- checklist de cierre de ola firmado para backend y frontend

### Criterios globales de cierre del modulo (MVP)

- seguridad: sin brechas de aislamiento por `tenantId`
- contrato: 100% de endpoints implementados estan en OpenAPI
- observabilidad: errores, auditoria y metricas minimas operativas activas
- gobernanza documental: sin ruido en guias normativas no aprobadas
## 13. Politica documental para retomarlo

Para evitar ruido o deuda tecnica:

- este documento vive en `docs/operaciones/`
- no actualiza por si solo `docs/PLAN_MAESTRO.md`
- no abre dependencia nueva en `docs/frontend/80_BACKEND_DEPENDENCIES.md`
- no modifica guias normativas hasta que exista contrato OpenAPI real o aprobacion formal de roadmap
- no debe tratarse como contrato vigente

Si en una futura sesion el modulo se aprueba para implementacion real:

1. abrir ADR o decision estructural minima
2. publicar OpenAPI
3. actualizar guias activas backend/frontend
4. abrir implementacion runtime
5. documentar cierre o reapertura segun corresponda

## 14. Espejo frontend

Este documento debe mantenerse en modo espejo en:

- `H:/FullStack-Projects/FRONTEND-STACK-NEXT-TAILWIND/docs/operaciones/EXPENSES_PROPUESTA_IMPLEMENTACION_SAAS_2026-03-21.md`

Reglas de espejo:

- mismo nombre de archivo
- misma version
- misma fecha de corte
- mismas secciones base
- sin reinterpretaciones de alcance

## 15. Decisiones pendientes para la siguiente retomada

- si `vendor payments` entra o no en el modulo
- si el MVP usa aprobacion simple o multi-step
- si el tenant opera con una sola moneda o multimoneda
- storage final para adjuntos
- semantica exacta de `paid`
- limites de bulk por accion

## 16. Checklist de reactivacion futura

- validar que el roadmap activo admita el modulo
- confirmar si el frontend necesita guia dedicada o solo extension de V2
- revisar compatibilidad con planes y feature flags reales
- definir storage y seguridad de adjuntos
- decidir si el primer corte incluye solo requests o tambien anticipos
- convertir este documento en backlog ejecutable por ola


