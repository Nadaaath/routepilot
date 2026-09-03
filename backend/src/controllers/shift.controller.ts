import type { Request, Response } from "express";
import { shiftService } from "../services/shift.service";

export const shiftController = {
  async list(_req: Request, res: Response) {
    res.json(await shiftService.getAll());
  },

  async get(req: Request, res: Response) {
    res.json(await shiftService.getById(Number(req.params.id)));
  },

  async create(req: Request, res: Response) {
    const shift = await shiftService.create(req.body);
    res.status(201).json(shift);
  },

  async update(req: Request, res: Response) {
    res.json(await shiftService.update(Number(req.params.id), req.body));
  },

  async remove(req: Request, res: Response) {
    await shiftService.remove(Number(req.params.id));
    res.status(204).send();
  },
};
