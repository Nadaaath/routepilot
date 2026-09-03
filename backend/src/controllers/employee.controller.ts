import type { Request, Response } from "express";
import { employeeService } from "../services/employee.service";

function idFrom(req: Request): number {
  return Number(req.params.id);
}

export const employeeController = {
  async list(_req: Request, res: Response) {
    res.json(await employeeService.getAll());
  },

  async get(req: Request, res: Response) {
    res.json(await employeeService.getById(idFrom(req)));
  },

  async create(req: Request, res: Response) {
    const employee = await employeeService.create(req.body);
    res.status(201).json(employee);
  },

  async update(req: Request, res: Response) {
    res.json(await employeeService.update(idFrom(req), req.body));
  },

  async remove(req: Request, res: Response) {
    await employeeService.remove(idFrom(req));
    res.status(204).send();
  },
};
