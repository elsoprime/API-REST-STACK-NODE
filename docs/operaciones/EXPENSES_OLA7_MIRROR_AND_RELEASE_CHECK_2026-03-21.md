# Expenses - Ola 7 Mirror and Release Check - Cierre 2026-03-21

## Objetivo

Cerrar el ciclo de `expenses` con alineacion documental backend/frontend, trazabilidad de permisos/contratos y handoff claro para continuidad.

## Alcance ejecutado

1. Se actualizaron guias frontend en este repo para reflejar estado real de backend `expenses`.
2. Se formalizo cobertura E2E critica esperada para `settings` y ciclo de vida de categorias.
3. Se agrego criterio DoD explicito de espejo documental backend/frontend.
4. Se enlazo continuidad desde el cierre de Ola 6.

## Matriz de trazabilidad (backend -> permiso -> evidencia)

| Endpoint | Permiso RBAC | Evidencia backend | Evidencia E2E frontend esperada |
|---|---|---|---|
| `GET /api/v1/modules/expenses/settings` | `tenant:expenses:settings:read` | `tests/integration/expenses/expenses.settings.routes.test.ts` | `tests/e2e/expenses-settings-critical.spec.ts` |
| `PUT /api/v1/modules/expenses/settings` | `tenant:expenses:settings:update` | `tests/integration/expenses/expenses.settings.routes.test.ts` | `tests/e2e/expenses-settings-critical.spec.ts` |
| `GET /api/v1/modules/expenses/categories` | `tenant:expenses:settings:read` | `tests/integration/expenses/expenses.settings.routes.test.ts` | `tests/e2e/expenses-settings-critical.spec.ts` |
| `PATCH /api/v1/modules/expenses/categories/{categoryId}` | `tenant:expenses:settings:update` | `tests/integration/expenses/expenses.settings.routes.test.ts` | `tests/e2e/expenses-settings-critical.spec.ts` |
| `UI settings read-only` (sin update) | Falta `tenant:expenses:settings:update` | `403` validado en integracion backend | `tests/e2e/expenses-settings-permissions.spec.ts` |

## Archivos alineados en esta ola

- `docs/frontend/80_BACKEND_DEPENDENCIES.md`
- `docs/frontend/70_E2E_CRITICAL_FLOWS.md`
- `docs/frontend/90_DOD_CHECKLIST.md`
- `docs/operaciones/EXPENSES_OLA6_BACKEND_SETTINGS_PERMISSIONS_CIERRE_2026-03-21.md` (cross-reference)

## Handoff recomendado al equipo frontend

1. Mantener activos `expenses-settings-critical` y `expenses-settings-permissions` en pipeline PR.
2. Verificar que nuevas mutaciones de settings sigan contrato OpenAPI vigente antes de merge.
3. Mantener espejo documental del archivo de cierre en repo frontend bajo mismo nombre/fecha.

## DoD

- [x] Dependencias backend/frontend de `expenses` actualizadas a estado real.
- [x] Flujo E2E critico de `settings` y permisos documentado como obligatorio.
- [x] DoD frontend incluye criterio espejo para `expenses`.
- [x] Cierre de Ola 6 enlazado con continuidad explicita.
- [x] Handoff operativo definido para retomar sin ruido.
