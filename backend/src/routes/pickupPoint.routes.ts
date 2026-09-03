import { Router } from "express";
import { pickupPointController } from "../controllers/pickupPoint.controller";

const router = Router();

router.get("/", pickupPointController.list);
router.get("/:id", pickupPointController.get);
router.post("/", pickupPointController.create);
router.patch("/:id", pickupPointController.update);
router.delete("/:id", pickupPointController.remove);

export default router;
