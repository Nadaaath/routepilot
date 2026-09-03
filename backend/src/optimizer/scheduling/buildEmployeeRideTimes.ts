import { timeStringToMinutes } from "./timeUtils";
import type { TripDirection } from "../../types/trip.types";

interface EmployeeInput {
  id: number;
  firstName: string;
  lastName: string;

  pickupPoint: {
    id: number;
  } | null;
}

interface ScheduledStop {
  pickupPointId: number;
  arrivalTime: string;
  departureTime: string;
  dwellMinutes: number;
}

interface TripSchedule {
  departureTime: string;
  arrivalTime: string;
  stops: ScheduledStop[];
}

export interface EmployeeRideTime {
  employeeId: number;
  firstName: string;
  lastName: string;
  pickupPointId: number;

  originTime: string;
  destinationTime: string;

  rideTimeMinutes: number;
}

function calculateDurationMinutes(
  startTime: string,
  endTime: string
): number {
  const start =
    timeStringToMinutes(startTime);

  const end =
    timeStringToMinutes(endTime);

  let duration =
    end - start;

  /*
   * Handle trips crossing midnight.
   *
   * Example:
   * 23:50 -> 00:20 = 30 minutes
   */
  if (duration < 0) {
    duration += 1440;
  }

  return duration;
}

export function buildEmployeeRideTimes(
  employees: EmployeeInput[],
  schedule: TripSchedule,
  direction: TripDirection
): EmployeeRideTime[] {
  const stopMap =
    new Map<number, ScheduledStop>();

  for (const stop of schedule.stops) {
    stopMap.set(
      stop.pickupPointId,
      stop
    );
  }

  const results:
    EmployeeRideTime[] = [];

  for (const employee of employees) {
    if (!employee.pickupPoint) {
      continue;
    }

    const stop =
      stopMap.get(
        employee.pickupPoint.id
      );

    if (!stop) {
      continue;
    }

    /*
     * ==========================================
     * INBOUND
     *
     * Employee boards when shuttle leaves
     * their pickup point.
     *
     * Employee exits at the company.
     * ==========================================
     */
    if (direction === "INBOUND") {
      const originTime =
        stop.departureTime;

      const destinationTime =
        schedule.arrivalTime;

      results.push({
        employeeId:
          employee.id,

        firstName:
          employee.firstName,

        lastName:
          employee.lastName,

        pickupPointId:
          employee.pickupPoint.id,

        originTime,

        destinationTime,

        rideTimeMinutes:
          calculateDurationMinutes(
            originTime,
            destinationTime
          ),
      });

      continue;
    }

    /*
     * ==========================================
     * OUTBOUND
     *
     * Every employee boards at the company
     * when the shuttle leaves.
     *
     * Employee exits when the shuttle ARRIVES
     * at their drop-off stop.
     *
     * We do not include the dwell time at their
     * own stop in their ride time because they
     * have already reached their destination.
     * ==========================================
     */

    const originTime =
      schedule.departureTime;

    const destinationTime =
      stop.arrivalTime;

    results.push({
      employeeId:
        employee.id,

      firstName:
        employee.firstName,

      lastName:
        employee.lastName,

      pickupPointId:
        employee.pickupPoint.id,

      originTime,

      destinationTime,

      rideTimeMinutes:
        calculateDurationMinutes(
          originTime,
          destinationTime
        ),
    });
  }

  return results;
}