import { HttpError } from './httpError';

export function parseDateOnly(input: string) {
  const match = /^\d{4}-\d{2}-\d{2}$/.test(input);
  if (!match) throw new HttpError(400, 'date must use YYYY-MM-DD');
  const date = new Date(`${input}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, 'date is invalid');
  return date;
}

export function utcDayBounds(input: string) {
  const start = parseDateOnly(input);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}
