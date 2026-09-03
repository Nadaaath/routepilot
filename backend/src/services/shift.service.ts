import { shiftRepository, type CreateShiftInput } from "../repositories/shift.repository";
import { HttpError } from "../utils/httpError";

export const shiftService = {
  getAll() {
    return shiftRepository.findAll();
  },

  async getById(id: number) {
    const shift = await shiftRepository.findById(id);
    if (!shift) throw new HttpError(404, "Shift not found");
    return shift;
  },

  create(data: CreateShiftInput) {
    return shiftRepository.create(data);
  },

  async update(id: number, data: Partial<CreateShiftInput>) {
    await this.getById(id);
    return shiftRepository.update(id, data);
  },

  async remove(id: number) {
    await this.getById(id);
    return shiftRepository.remove(id);
  },
};
