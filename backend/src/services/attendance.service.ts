import { attendanceRepository } from "../repositories/attendance.repository";
import { employeeRepository } from "../repositories/employee.repository";
import { shiftRepository } from "../repositories/shift.repository";
import { HttpError } from "../utils/httpError";

export interface AttendanceInput {
  employeeId: number;
  shiftId: number;
  date: string;
  present?: boolean;
}

export const attendanceService = {
  getAll() {
    return attendanceRepository.findAll();
  },

  async getById(id: number) {
    const attendance = await attendanceRepository.findById(id);
    if (!attendance) throw new HttpError(404, "Attendance record not found");
    return attendance;
  },

  async create(data: AttendanceInput) {
    const [employee, shift] = await Promise.all([
      employeeRepository.findById(data.employeeId),
      shiftRepository.findById(data.shiftId),
    ]);

    if (!employee) throw new HttpError(400, "employeeId does not reference an existing employee");
    if (!shift) throw new HttpError(400, "shiftId does not reference an existing shift");

    const date = new Date(data.date);
    if (Number.isNaN(date.getTime())) throw new HttpError(400, "date is invalid");

    return attendanceRepository.create({
      employeeId: data.employeeId,
      shiftId: data.shiftId,
      date,
      present: data.present ?? true,
    });
  },

  async update(id: number, data: Partial<AttendanceInput>) {
    await this.getById(id);

    const mapped: {
      employeeId?: number;
      shiftId?: number;
      date?: Date;
      present?: boolean;
    } = {};

    if (data.employeeId !== undefined) mapped.employeeId = data.employeeId;
    if (data.shiftId !== undefined) mapped.shiftId = data.shiftId;
    if (data.present !== undefined) mapped.present = data.present;

    if (data.date !== undefined) {
      const date = new Date(data.date);
      if (Number.isNaN(date.getTime())) throw new HttpError(400, "date is invalid");
      mapped.date = date;
    }

    return attendanceRepository.update(id, mapped);
  },

  async remove(id: number) {
    await this.getById(id);
    return attendanceRepository.remove(id);
  },
};
