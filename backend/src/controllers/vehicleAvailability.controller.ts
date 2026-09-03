import type { Request, Response } from 'express';
import { vehicleAvailabilityService } from '../services/vehicleAvailability.service';

export const vehicleAvailabilityController = {
  async list(req: Request, res: Response) {
    res.json(await vehicleAvailabilityService.getAll(req.query));
  },
  async set(req: Request, res: Response) {
    res.json(await vehicleAvailabilityService.set(req.body));
  },
};
