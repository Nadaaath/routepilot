-- CreateTable
CREATE TABLE "ShiftAssignment" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "shiftId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShiftAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleAvailability" (
    "id" SERIAL NOT NULL,
    "vehicleId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VehicleAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportPlan" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "shiftId" INTEGER NOT NULL,
    "depotId" INTEGER NOT NULL,
    "direction" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "request" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TransportPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShiftAssignment_employeeId_shiftId_date_key" ON "ShiftAssignment"("employeeId", "shiftId", "date");
CREATE INDEX "ShiftAssignment_date_idx" ON "ShiftAssignment"("date");
CREATE INDEX "ShiftAssignment_shiftId_date_idx" ON "ShiftAssignment"("shiftId", "date");
CREATE UNIQUE INDEX "VehicleAvailability_vehicleId_date_key" ON "VehicleAvailability"("vehicleId", "date");
CREATE INDEX "VehicleAvailability_date_idx" ON "VehicleAvailability"("date");
CREATE INDEX "TransportPlan_date_idx" ON "TransportPlan"("date");
CREATE INDEX "TransportPlan_shiftId_date_idx" ON "TransportPlan"("shiftId", "date");
CREATE INDEX "TransportPlan_status_idx" ON "TransportPlan"("status");

-- AddForeignKey
ALTER TABLE "ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleAvailability" ADD CONSTRAINT "VehicleAvailability_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransportPlan" ADD CONSTRAINT "TransportPlan_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransportPlan" ADD CONSTRAINT "TransportPlan_depotId_fkey" FOREIGN KEY ("depotId") REFERENCES "Depot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
