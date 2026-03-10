# Plan de Integracion Frontend V1 (Deprecado)

Version: 2.1.0
Estado: Deprecado controlado
Ultima actualizacion: 2026-03-10
Reemplazo oficial: `docs/frontend/10_IMPLEMENTATION_GUIDE_V2.md`

## 1. Estado del documento

Este documento se conserva solo para trazabilidad historica.
No debe usarse como fuente principal para nuevas implementaciones frontend.

## 2. Documento vigente

Usar como fuente principal:

- `docs/frontend/10_IMPLEMENTATION_GUIDE_V2.md`

Documentos complementarios vigentes:

- `docs/frontend/20_ACCESS_MATRIX.md`
- `docs/frontend/30_API_CLIENT_STANDARD.md`
- `docs/frontend/40_STATE_AND_CACHE_POLICY.md`
- `docs/frontend/50_ERROR_CATALOG.md`
- `docs/frontend/60_MOCKING_GUIDE.md`
- `docs/frontend/70_E2E_CRITICAL_FLOWS.md`
- `docs/frontend/80_BACKEND_DEPENDENCIES.md`
- `docs/frontend/90_DOD_CHECKLIST.md`
- `docs/frontend/95_DOCS_DEPRECATION_MATRIX.md`

## 3. Regla de uso

Si hay conflicto entre V1 y V2, siempre gana V2.
Si hay conflicto entre V2 y OpenAPI/runtime, siempre gana OpenAPI/runtime.

## 4. Motivo de deprecacion

- Rutas y referencias internas historicas no alineadas con estructura documental actual.
- Reorganizacion de la guia por fases/etapas y por flujo modulo -> funciones -> endpoints.
- Necesidad de una fuente unica exacta y no ambigua para ejecucion frontend sin deuda tecnica.

