import express from "express";
import cors from "cors";

import employeeRoutes from "./routes/employee.routes";
import pickupPointRoutes from "./routes/pickupPoint.routes";
import vehicleRoutes from "./routes/vehicle.routes";
import shiftRoutes from "./routes/shift.routes";
import attendanceRoutes from "./routes/attendance.routes";
import optimizationRoutes from "./routes/optimization.routes";
import { errorMiddleware } from "./middlewares/error.middleware";
import depotRoutes from "./routes/depot.routes";
import shiftAssignmentRoutes from "./routes/shiftAssignment.routes";
import vehicleAvailabilityRoutes from "./routes/vehicleAvailability.routes";
import transportPlanRoutes from "./routes/transportPlan.routes";

export const app = express();

app.use(cors());
app.use(express.json());
app.use("/depots", depotRoutes);

app.get("/", (_req, res) => {
  res.send("Employee Transport Optimizer API");
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "Employee Transport Optimizer API is running",
  });
});

app.use("/employees", employeeRoutes);
app.use("/pickup-points", pickupPointRoutes);
app.use("/vehicles", vehicleRoutes);
app.use("/shifts", shiftRoutes);
app.use("/attendance", attendanceRoutes);
app.use("/optimization", optimizationRoutes);
app.use("/shift-assignments", shiftAssignmentRoutes);
app.use("/vehicle-availability", vehicleAvailabilityRoutes);
app.use("/plans", transportPlanRoutes);

app.use(errorMiddleware);
