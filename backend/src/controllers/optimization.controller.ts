import type { Request, Response } from "express";
import { optimizationService } from "../services/optimization.service";

export const optimizationController = {
  async preview(req: Request, res: Response) {
    res.json(await optimizationService.preview(req.body));
  },
};
