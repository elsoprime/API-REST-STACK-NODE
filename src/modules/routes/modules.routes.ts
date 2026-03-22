import { Router } from 'express';

import { crmRouter } from '@/modules/crm/routes/crm.routes';
import { expensesRouter } from '@/modules/expenses/routes/expenses.routes';
import { hrRouter } from '@/modules/hr/routes/hr.routes';
import { inventoryRouter } from '@/modules/inventory/routes/inventory.routes';

export function createModulesRouter(): Router {
  const router = Router();

  router.use('/crm', crmRouter);
  router.use('/expenses', expensesRouter);
  router.use('/hr', hrRouter);
  router.use('/inventory', inventoryRouter);

  return router;
}

export const modulesRouter = createModulesRouter();
