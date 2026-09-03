import type { Request, Response } from "express";
import { pickupPointService } from "../services/pickupPoint.service";

export const pickupPointController = {
  async list(_req: Request, res: Response) {
    res.json(await pickupPointService.getAll());
  },

  async get(req: Request, res: Response) {
    res.json(await pickupPointService.getById(Number(req.params.id)));
  },

  async create(req: Request, res: Response) {
    const item = await pickupPointService.create(req.body);
    res.status(201).json(item);
  },

  async update(req: Request, res: Response) {
    res.json(await pickupPointService.update(Number(req.params.id), req.body));
  },

  async remove(req: Request, res: Response) {
    await pickupPointService.remove(Number(req.params.id));
    res.status(204).send();
  },
};
