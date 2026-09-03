import { transportPlanRepository } from '../repositories/transportPlan.repository';
import { shiftRepository } from '../repositories/shift.repository';
import { depotRepository } from '../repositories/depot.repository';
import { HttpError } from '../utils/httpError';
import { parseDateOnly } from '../utils/date';

const STATUSES = new Set(['DRAFT', 'APPROVED', 'PUBLISHED', 'SUPERSEDED']);

export const transportPlanService = {
  getAll(query: Record<string, unknown>) {
    const shiftId = query.shiftId ? Number(query.shiftId) : undefined;
    const status = typeof query.status === 'string' && query.status ? query.status.toUpperCase() : undefined;
    const start = typeof query.startDate === 'string' ? parseDateOnly(query.startDate) : undefined;
    const end = typeof query.endDate === 'string' ? parseDateOnly(query.endDate) : undefined;
    if (end) end.setUTCDate(end.getUTCDate() + 1);
    return transportPlanRepository.findAll({ shiftId, status, start, end });
  },

  async getById(id: number) {
    const plan = await transportPlanRepository.findById(id);
    if (!plan) throw new HttpError(404, 'Transport plan not found');
    return plan;
  },

  async create(input: { request: any; result: any; status?: string }) {
    const result = input.result;
    if (!result || result.status !== 'preview' || !result.shift?.id || !result.depot?.id || !result.date || !result.direction) {
      throw new HttpError(400, 'result must be a complete optimization preview response');
    }
    const [shift, depot] = await Promise.all([
      shiftRepository.findById(Number(result.shift.id)),
      depotRepository.findById(Number(result.depot.id)),
    ]);
    if (!shift || !depot) throw new HttpError(400, 'Plan references an unknown shift or depot');

    const status = (input.status ?? 'DRAFT').toUpperCase();
    if (!STATUSES.has(status)) throw new HttpError(400, 'Invalid plan status');

    const date = parseDateOnly(String(result.date));
    const version = await transportPlanRepository.nextVersion(date, shift.id, String(result.direction));
    return transportPlanRepository.create({
      date,
      shiftId: shift.id,
      depotId: depot.id,
      direction: String(result.direction),
      strategy: String(result.strategy ?? result.policyApplied?.strategy ?? 'BALANCED'),
      status,
      version,
      request: input.request ?? {},
      result,
    });
  },

  async update(id: number, input: { status?: string; request?: object; result?: object }) {
    const current = await this.getById(id);
    const data: { status?: string; request?: object; result?: object; approvedAt?: Date | null; publishedAt?: Date | null } = {};
    if (input.status !== undefined) {
      const status = input.status.toUpperCase();
      if (!STATUSES.has(status)) throw new HttpError(400, 'Invalid plan status');
      data.status = status;
      if (status === 'APPROVED' && !current.approvedAt) data.approvedAt = new Date();
      if (status === 'PUBLISHED') {
        data.approvedAt = current.approvedAt ?? new Date();
        data.publishedAt = new Date();
      }
    }
    if (input.request !== undefined) data.request = input.request;
    if (input.result !== undefined) data.result = input.result;
    return transportPlanRepository.update(id, data);
  },

  async remove(id: number) {
    await this.getById(id);
    return transportPlanRepository.remove(id);
  },
};
