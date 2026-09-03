import { Router } from "express";
import { attendanceController } from "../controllers/attendance.controller";

const router = Router();

router.get("/", attendanceController.list);
router.get("/:id", attendanceController.get);
router.post("/", attendanceController.create);
router.patch("/:id", attendanceController.update);
router.delete("/:id", attendanceController.remove);

export default router;
