import { prisma } from "../lib/prisma";
import type { CreateEmployeeInput, UpdateEmployeeInput } from "../types/employee.types";

export const employeeRepository = {
  findAll() {
    return prisma.employee.findMany({
      include: { pickupPoint: true },
      orderBy: { id: "asc" },
    });
  },

  findById(id: number) {
    return prisma.employee.findUnique({
      where: { id },
      include: { pickupPoint: true },
    });
  },

  findByEmail(email: string) {
    return prisma.employee.findUnique({ where: { email } });
  },

  create(data: CreateEmployeeInput) {
    return prisma.employee.create({ data });
  },

  update(id: number, data: UpdateEmployeeInput) {
    return prisma.employee.update({ where: { id }, data });
  },

  remove(id: number) {
    return prisma.employee.delete({ where: { id } });
  },
};
