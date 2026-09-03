import { Router } from 'express';
import { shiftAssignmentController } from '../controllers/shiftAssignment.controller';

const router = Router();
router.get('/', shiftAssignmentController.list);
router.put('/day', shiftAssignmentController.replace);
router.delete('/:id', shiftAssignmentController.remove);
export default router;
