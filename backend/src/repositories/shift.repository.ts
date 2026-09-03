import { prisma } from "../lib/prisma";

export interface CreateShiftInput {
  name: string;
  startTime: string;
  endTime: string;
}

export const shiftRepository = {
  findAll() {
    return prisma.shift.findMany({ orderBy: { id: "asc" } });
  },

  findById(id: number) {
    return prisma.shift.findUnique({ where: { id } });
  },

  create(data: CreateShiftInput) {
    return prisma.shift.create({ data });
  },

  update(id: number, data: Partial<CreateShiftInput>) {
    return prisma.shift.update({ where: { id }, data });
  },

  remove(id: number) {
    return prisma.shift.delete({ where: { id } });
  },
};
