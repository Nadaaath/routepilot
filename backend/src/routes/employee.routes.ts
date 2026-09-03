import { Router } from "express";
import { employeeController } from "../controllers/employee.controller";
import { validateBody } from "../middlewares/validation.middleware";
import { validateCreateEmployee } from "../validators/employee.validator";

const router = Router();

router.get("/", employeeController.list);
router.get("/:id", employeeController.get);
router.post("/", validateBody(validateCreateEmployee), employeeController.create);
router.patch("/:id", employeeController.update);
router.delete("/:id", employeeController.remove);

export default router;
