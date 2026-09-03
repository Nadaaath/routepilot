import { Router } from 'express';
import { transportPlanController } from '../controllers/transportPlan.controller';

const router = Router();
router.get('/', transportPlanController.list);
router.get('/:id', transportPlanController.get);
router.post('/', transportPlanController.create);
router.post('/:id/validate', transportPlanController.validateManual);
router.post('/:id/manual-version', transportPlanController.createManualVersion);
router.patch('/:id', transportPlanController.update);
router.delete('/:id', transportPlanController.remove);
export default router;
