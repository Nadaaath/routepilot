import { Router } from "express";
import { optimizationController } from "../controllers/optimization.controller";
import { validateBody } from "../middlewares/validation.middleware";
import { validateOptimizationPreview } from "../validators/optimization.validator";

const router = Router();

router.post("/preview", validateBody(validateOptimizationPreview), optimizationController.preview);

export default router;
