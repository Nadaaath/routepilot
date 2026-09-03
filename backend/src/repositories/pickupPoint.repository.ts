import { prisma } from "../lib/prisma";

export interface CreatePickupPointInput {
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  mapUrl?: string;
}

export const pickupPointRepository = {
  findAll() {
    return prisma.pickupPoint.findMany({ orderBy: { id: "asc" } });
  },

  findById(id: number) {
    return prisma.pickupPoint.findUnique({ where: { id } });
  },

  create(data: CreatePickupPointInput) {
    return prisma.pickupPoint.create({ data });
  },

  update(id: number, data: Partial<CreatePickupPointInput>) {
    return prisma.pickupPoint.update({ where: { id }, data });
  },

  remove(id: number) {
    return prisma.pickupPoint.delete({ where: { id } });
  },
};
