import type { Request, Response } from "express";
import { attendanceService } from "../services/attendance.service";

export const attendanceController = {
  async list(_req: Request, res: Response) {
    res.json(await attendanceService.getAll());
  },

  async get(req: Request, res: Response) {
    res.json(await attendanceService.getById(Number(req.params.id)));
  },

  async create(req: Request, res: Response) {
    const attendance = await attendanceService.create(req.body);
    res.status(201).json(attendance);
  },

  async update(req: Request, res: Response) {
    res.json(await attendanceService.update(Number(req.params.id), req.body));
  },

  async remove(req: Request, res: Response) {
    await attendanceService.remove(Number(req.params.id));
    res.status(204).send();
  },
};
