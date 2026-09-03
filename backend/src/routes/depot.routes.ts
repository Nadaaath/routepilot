import { Router } from "express";
import { depotController } from "../controllers/depot.controller";

const router = Router();

router.get("/", depotController.list);
router.get("/:id", depotController.get);
router.post("/", depotController.create);
router.patch("/:id", depotController.update);
router.delete("/:id", depotController.remove);

export default router;