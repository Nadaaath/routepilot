ALTER TABLE "Vehicle"
  ADD COLUMN "maintenanceCostPerKm" DOUBLE PRECISION,
  ADD COLUMN "optimizerEligible" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "planningPriority" TEXT NOT NULL DEFAULT 'NORMAL';

-- Preserve the economic assumptions entered in previous RoutePilot versions.
-- costPerKm remains as a legacy column, but V9 reads maintenanceCostPerKm.
UPDATE "Vehicle"
SET "maintenanceCostPerKm" = "costPerKm"
WHERE "maintenanceCostPerKm" IS NULL
  AND "costPerKm" IS NOT NULL;
