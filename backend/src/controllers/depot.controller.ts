import type {
  Request,
  Response,
} from "express";

import { depotService } from "../services/depot.service";

export const depotController = {
  async list(
    _req: Request,
    res: Response
  ) {
    res.json(
      await depotService.getAll()
    );
  },

  async get(
    req: Request,
    res: Response
  ) {
    res.json(
      await depotService.getById(
        Number(req.params.id)
      )
    );
  },

  async create(
    req: Request,
    res: Response
  ) {
    const depot =
      await depotService.create(req.body);

    res.status(201).json(depot);
  },

  async update(
    req: Request,
    res: Response
  ) {
    res.json(
      await depotService.update(
        Number(req.params.id),
        req.body
      )
    );
  },

  async remove(
    req: Request,
    res: Response
  ) {
    await depotService.remove(
      Number(req.params.id)
    );

    res.status(204).send();
  },
};