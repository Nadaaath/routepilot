import { prisma } from "../lib/prisma";
import type { CreateVehicleInput, UpdateVehicleInput } from "../types/vehicle.types";

export const vehicleRepository = {
  findAll() {
    return prisma.vehicle.findMany({ orderBy: { id: "asc" } });
  },

  findActive() {
    return prisma.vehicle.findMany({
      where: { active: true },
      orderBy: { id: "asc" },
    });
  },

  findById(id: number) {
    return prisma.vehicle.findUnique({ where: { id } });
  },

  create(data: CreateVehicleInput) {
    return prisma.vehicle.create({ data });
  },

  update(id: number, data: UpdateVehicleInput) {
    return prisma.vehicle.update({ where: { id }, data });
  },

  remove(id: number) {
    return prisma.vehicle.delete({ where: { id } });
  },
};
