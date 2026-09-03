import { employeeRepository } from "../repositories/employee.repository";
import { pickupPointRepository } from "../repositories/pickupPoint.repository";
import type { CreateEmployeeInput, UpdateEmployeeInput } from "../types/employee.types";
import { HttpError } from "../utils/httpError";

export const employeeService = {
  getAll() {
    return employeeRepository.findAll();
  },

  async getById(id: number) {
    const employee = await employeeRepository.findById(id);
    if (!employee) throw new HttpError(404, "Employee not found");
    return employee;
  },

  async create(data: CreateEmployeeInput) {
    const existing = await employeeRepository.findByEmail(data.email);
    if (existing) throw new HttpError(409, "An employee with this email already exists");

    if (data.pickupPointId) {
      const pickupPoint = await pickupPointRepository.findById(data.pickupPointId);
      if (!pickupPoint) throw new HttpError(400, "pickupPointId does not reference an existing pickup point");
    }

    return employeeRepository.create(data);
  },

  async update(id: number, data: UpdateEmployeeInput) {
    await this.getById(id);

    if (data.pickupPointId) {
      const pickupPoint = await pickupPointRepository.findById(data.pickupPointId);
      if (!pickupPoint) throw new HttpError(400, "pickupPointId does not reference an existing pickup point");
    }

    return employeeRepository.update(id, data);
  },

  async remove(id: number) {
    await this.getById(id);
    return employeeRepository.remove(id);
  },
};
