import type { Request, Response } from 'express';
import { shiftAssignmentService } from '../services/shiftAssignment.service';

export const shiftAssignmentController = {
  async list(req: Request, res: Response) {
    res.json(await shiftAssignmentService.getAll(req.query));
  },
  async replace(req: Request, res: Response) {
    res.json(await shiftAssignmentService.replaceForShiftAndDay(req.body));
  },
  async remove(req: Request, res: Response) {
    await shiftAssignmentService.remove(Number(req.params.id));
    res.status(204).send();
  },
};
