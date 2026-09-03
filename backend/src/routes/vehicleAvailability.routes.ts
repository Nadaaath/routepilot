import { Router } from 'express';
import { vehicleAvailabilityController } from '../controllers/vehicleAvailability.controller';

const router = Router();
router.get('/', vehicleAvailabilityController.list);
router.put('/', vehicleAvailabilityController.set);
export default router;
