# ANEXO 06-09

## Inventory, CRM, HR y Operacion · Etapas 8-11

## 1. Inventory · Etapa 8

Inventory es el modulo piloto.

### Reglas cerradas

- todos los recursos filtran por `tenantId`
- los codigos de error del modulo deben agregarse al catalogo global antes de implementarse
- los movimientos de stock deben ser seguros bajo concurrencia

### Concurrencia

El ejemplo operativo correcto debe:

- abrir la transaccion antes de leer el item si la operacion depende del estado actual
- o usar control optimista/versionado real
- nunca calcular `currentStock + delta` fuera de un mecanismo de concurrencia valido y darlo por seguro

### Scope funcional minimo

- categories
- items
- stock movements
- alerts

## 2. CRM · Etapa 9

Entra despues de validar Inventory.

Antes de implementarse debe cerrar:

- estrategia de soft delete
- deduplicacion de contactos y organizaciones
- enum operativo de `Opportunity.stage`
- consistencia de contadores desnormalizados

## 3. HR · Etapa 10

No inicia sin politica de privacidad cerrada.

Minimos obligatorios:

- control de acceso por rol para datos personales y salariales
- redaccion de sensibles en logs y auditoria
- reglas anticiclo para jerarquias
- validaciones laborales minimas

## 4. Go-Live · Etapa 11

El release piloto puede ocurrir tras Etapa 8.

CRM y HR solo son prerequisito si forman parte del release comprometido.

El runbook debe ser agnostico a infraestructura. No se asume Kubernetes como verdad unica.

## 5. Smoke suite

Minimo del piloto:

- health
- auth completo
- tenant create/invite/accept
- settings tenant basicos
- inventory create/move/check
- audit log en flujos criticos
- aislamiento cross-tenant

## 6. Riesgos cerrados

- pilot bloqueado por CRM/HR
- inventario inseguro bajo concurrencia
- runbook acoplado a una sola plataforma de despliegue
