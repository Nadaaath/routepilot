import { prisma } from "../lib/prisma";

export interface CreateAttendanceInput {
  employeeId: number;
  shiftId: number;
  date: Date;
  present?: boolean;
}

export const attendanceRepository = {
  findAll() {
    return prisma.attendance.findMany({
      include: {
        employee: { include: { pickupPoint: true } },
        shift: true,
      },
      orderBy: { date: "desc" },
    });
  },

  findById(id: number) {
    return prisma.attendance.findUnique({
      where: { id },
      include: {
        employee: { include: { pickupPoint: true } },
        shift: true,
      },
    });
  },

  findPresentForShiftAndDay(shiftId: number, start: Date, end: Date) {
    return prisma.attendance.findMany({
      where: {
        shiftId,
        present: true,
        date: { gte: start, lt: end },
        employee: { active: true },
      },
      include: {
        employee: { include: { pickupPoint: true } },
        shift: true,
      },
      orderBy: { employeeId: "asc" },
    });
  },

  create(data: CreateAttendanceInput) {
    return prisma.attendance.create({ data });
  },

  update(id: number, data: Partial<CreateAttendanceInput>) {
    return prisma.attendance.update({ where: { id }, data });
  },

  remove(id: number) {
    return prisma.attendance.delete({ where: { id } });
  },
};
