import { Router } from "express";
import { vehicleController } from "../controllers/vehicle.controller";
import { validateBody } from "../middlewares/validation.middleware";
import { validateCreateVehicle } from "../validators/vehicle.validator";

const router = Router();

router.get("/", vehicleController.list);
router.get("/:id", vehicleController.get);
router.post("/", validateBody(validateCreateVehicle), vehicleController.create);
router.patch("/:id", vehicleController.update);
router.delete("/:id", vehicleController.remove);

export default router;
