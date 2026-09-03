import { Router } from "express";
import { shiftController } from "../controllers/shift.controller";

const router = Router();

router.get("/", shiftController.list);
router.get("/:id", shiftController.get);
router.post("/", shiftController.create);
router.patch("/:id", shiftController.update);
router.delete("/:id", shiftController.remove);

export default router;
