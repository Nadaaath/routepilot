export function timeStringToMinutes(
  time: string
): number {
  const parts =
    time.split(":");

  if (parts.length !== 2) {
    throw new Error(
      `Invalid time format: ${time}`
    );
  }

  const hours =
    Number(parts[0]);

  const minutes =
    Number(parts[1]);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error(
      `Invalid time: ${time}`
    );
  }

  return (
    hours * 60 +
    minutes
  );
}

export function minutesToTimeString(
  totalMinutes: number
): string {
  /*
   * We round because ORS returns fractional minutes.
   *
   * Example:
   * 07:29.42 -> 07:29
   */
  const rounded =
    Math.round(totalMinutes);

  /*
   * Normalize values in case a trip
   * crosses midnight.
   */
  const normalized =
    (
      (
        rounded % 1440
      ) +
      1440
    ) %
    1440;

  const hours =
    Math.floor(
      normalized / 60
    );

  const minutes =
    normalized % 60;

  return (
    `${String(hours)
      .padStart(2, "0")}:` +
    `${String(minutes)
      .padStart(2, "0")}`
  );
}