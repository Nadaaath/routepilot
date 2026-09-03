import type { Request, Response } from 'express';
import { transportPlanService } from '../services/transportPlan.service';
import { manualPlanService } from '../services/manualPlan.service';

export const transportPlanController = {
  async list(req: Request, res: Response) { res.json(await transportPlanService.getAll(req.query)); },
  async get(req: Request, res: Response) { res.json(await transportPlanService.getById(Number(req.params.id))); },
  async create(req: Request, res: Response) { res.status(201).json(await transportPlanService.create(req.body)); },
  async update(req: Request, res: Response) { res.json(await transportPlanService.update(Number(req.params.id), req.body)); },
  async validateManual(req: Request, res: Response) { res.json(await manualPlanService.validate(Number(req.params.id), req.body)); },
  async createManualVersion(req: Request, res: Response) { res.status(201).json(await manualPlanService.createVersion(Number(req.params.id), req.body)); },
  async remove(req: Request, res: Response) { await transportPlanService.remove(Number(req.params.id)); res.status(204).send(); },
};
