import { prisma } from '../lib/prisma';

export const transportPlanRepository = {
  findAll(filters?: { status?: string; shiftId?: number; start?: Date; end?: Date }) {
    return prisma.transportPlan.findMany({
      where: {
        status: filters?.status,
        shiftId: filters?.shiftId,
        date: filters?.start && filters?.end ? { gte: filters.start, lt: filters.end } : undefined,
      },
      include: { shift: true, depot: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
  },

  findById(id: number) {
    return prisma.transportPlan.findUnique({ where: { id }, include: { shift: true, depot: true } });
  },

  async nextVersion(date: Date, shiftId: number, direction: string) {
    const end = new Date(date);
    end.setUTCDate(end.getUTCDate() + 1);
    const latest = await prisma.transportPlan.findFirst({
      where: { date: { gte: date, lt: end }, shiftId, direction },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    return (latest?.version ?? 0) + 1;
  },

  create(data: {
    date: Date;
    shiftId: number;
    depotId: number;
    direction: string;
    strategy: string;
    status: string;
    version: number;
    request: object;
    result: object;
  }) {
    return prisma.transportPlan.create({ data: { ...data, request: data.request as any, result: data.result as any }, include: { shift: true, depot: true } });
  },

  update(id: number, data: { status?: string; request?: object; result?: object; approvedAt?: Date | null; publishedAt?: Date | null }) {
    return prisma.transportPlan.update({ where: { id }, data: { ...data, request: data.request as any, result: data.result as any }, include: { shift: true, depot: true } });
  },

  remove(id: number) {
    return prisma.transportPlan.delete({ where: { id } });
  },
};
