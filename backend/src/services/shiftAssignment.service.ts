import { shiftAssignmentRepository } from '../repositories/shiftAssignment.repository';
import { employeeRepository } from '../repositories/employee.repository';
import { shiftRepository } from '../repositories/shift.repository';
import { HttpError } from '../utils/httpError';
import { parseDateOnly } from '../utils/date';

export const shiftAssignmentService = {
  getAll(query: Record<string, unknown>) {
    const employeeId = query.employeeId ? Number(query.employeeId) : undefined;
    const shiftId = query.shiftId ? Number(query.shiftId) : undefined;
    const start = typeof query.startDate === 'string' ? parseDateOnly(query.startDate) : undefined;
    const end = typeof query.endDate === 'string' ? parseDateOnly(query.endDate) : undefined;
    if (end) end.setUTCDate(end.getUTCDate() + 1);
    return shiftAssignmentRepository.findAll({ employeeId, shiftId, start, end });
  },

  async replaceForShiftAndDay(input: { shiftId: number; date: string; employeeIds: number[] }) {
    if (!Number.isInteger(input.shiftId) || input.shiftId <= 0) throw new HttpError(400, 'shiftId is required');
    if (!Array.isArray(input.employeeIds) || input.employeeIds.some((id) => !Number.isInteger(id) || id <= 0)) {
      throw new HttpError(400, 'employeeIds must be an array of employee IDs');
    }
    const shift = await shiftRepository.findById(input.shiftId);
    if (!shift) throw new HttpError(404, 'Shift not found');

    const uniqueIds = [...new Set(input.employeeIds)];
    if (uniqueIds.length) {
      const employees = await Promise.all(uniqueIds.map((id) => employeeRepository.findById(id)));
      const missing = uniqueIds.filter((_, index) => !employees[index]);
      if (missing.length) throw new HttpError(400, `Unknown employee IDs: ${missing.join(', ')}`);
    }

    return shiftAssignmentRepository.replaceForShiftAndDay(input.shiftId, parseDateOnly(input.date), uniqueIds);
  },

  async remove(id: number) {
    const current = await shiftAssignmentRepository.findById(id);
    if (!current) throw new HttpError(404, 'Shift assignment not found');
    return shiftAssignmentRepository.remove(id);
  },
};
