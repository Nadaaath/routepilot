import { prisma } from "../lib/prisma";

export interface CreateDepotInput {
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  mapUrl?: string;
}

export const depotRepository = {
  findAll() {
    return prisma.depot.findMany({
      orderBy: { id: "asc" },
    });
  },

  findById(id: number) {
    return prisma.depot.findUnique({
      where: { id },
    });
  },

  create(data: CreateDepotInput) {
    return prisma.depot.create({
      data,
    });
  },

  update(
    id: number,
    data: Partial<CreateDepotInput>
  ) {
    return prisma.depot.update({
      where: { id },
      data,
    });
  },

  remove(id: number) {
    return prisma.depot.delete({
      where: { id },
    });
  },
};