import type { Request, Response } from "express";
import { vehicleService } from "../services/vehicle.service";

export const vehicleController = {
  async list(_req: Request, res: Response) {
    res.json(await vehicleService.getAll());
  },

  async get(req: Request, res: Response) {
    res.json(await vehicleService.getById(Number(req.params.id)));
  },

  async create(req: Request, res: Response) {
    const vehicle = await vehicleService.create(req.body);
    res.status(201).json(vehicle);
  },

  async update(req: Request, res: Response) {
    res.json(await vehicleService.update(Number(req.params.id), req.body));
  },

  async remove(req: Request, res: Response) {
    await vehicleService.remove(Number(req.params.id));
    res.status(204).send();
  },
};
