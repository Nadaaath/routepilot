import type { TripDirection } from "../../types/trip.types";
import {
  minutesToTimeString,
  timeStringToMinutes,
} from "./timeUtils";

export interface ScheduledStop {
  pickupPointId: number;

  /*
   * Time the shuttle reaches the stop.
   */
  arrivalTime: string;

  /*
   * Time the shuttle leaves the stop.
   *
   * For INBOUND:
   * employees board between arrival and departure.
   *
   * For OUTBOUND:
   * employees leave the vehicle during this dwell period.
   */
  departureTime: string;

  /*
   * Time spent stopped for boarding/drop-off.
   */
  dwellMinutes: number;
}

export interface TripSchedule {
  /*
   * INBOUND:
   * time the shuttle arrives at the first pickup stop.
   *
   * OUTBOUND:
   * time the shuttle leaves the company.
   */
  departureTime: string;

  /*
   * INBOUND:
   * company arrival time.
   *
   * OUTBOUND:
   * departure time from the final drop-off stop.
   */
  arrivalTime: string;

  totalDwellMinutes: number;

  stops: ScheduledStop[];
}

export function buildTripSchedule(
  orderedPointIds: number[],
  pickupPoints: { id: number }[],
  durationMatrix: number[][],
  depotIndex: number,
  direction: TripDirection,
  shiftStartTime: string,
  shiftEndTime: string,
  dwellMinutesPerStop = 2
): TripSchedule {
  const pointIndexMap =
    new Map<number, number>();

  pickupPoints.forEach(
    (point, index) => {
      pointIndexMap.set(
        point.id,
        index
      );
    }
  );

  if (orderedPointIds.length === 0) {
    const baseTime =
      direction === "INBOUND"
        ? shiftStartTime
        : shiftEndTime;

    return {
      departureTime: baseTime,
      arrivalTime: baseTime,
      totalDwellMinutes: 0,
      stops: [],
    };
  }

  /*
   * ==================================================
   * INBOUND
   *
   * Example:
   *
   * Stop A
   *   ↓
   * Stop B
   *   ↓
   * Company
   *
   * Employees MUST arrive at company by shiftStartTime.
   *
   * Therefore we calculate BACKWARDS.
   * ==================================================
   */

  if (direction === "INBOUND") {
    let currentTime =
      timeStringToMinutes(
        shiftStartTime
      );

    const reversedStops:
      ScheduledStop[] = [];

    for (
      let i =
        orderedPointIds.length - 1;
      i >= 0;
      i--
    ) {
      const currentPointId =
        orderedPointIds[i];

      const currentPointIndex =
        pointIndexMap.get(
          currentPointId
        );

      if (
        currentPointIndex === undefined
      ) {
        throw new Error(
          `Point ${currentPointId} not found in duration matrix`
        );
      }

      /*
       * Determine travel time FROM this stop
       * TO the next destination.
       *
       * For the final pickup:
       *
       * final stop -> depot
       *
       * Otherwise:
       *
       * current stop -> next pickup stop
       */
      let travelMinutes: number;

      if (
        i ===
        orderedPointIds.length - 1
      ) {
        travelMinutes =
          durationMatrix
            [currentPointIndex]
            [depotIndex];
      } else {
        const nextPointId =
          orderedPointIds[i + 1];

        const nextPointIndex =
          pointIndexMap.get(
            nextPointId
          );

        if (
          nextPointIndex === undefined
        ) {
          throw new Error(
            `Point ${nextPointId} not found in duration matrix`
          );
        }

        travelMinutes =
          durationMatrix
            [currentPointIndex]
            [nextPointIndex];
      }

      /*
       * currentTime currently represents:
       *
       * time we must ARRIVE at the next destination.
       *
       * Therefore:
       *
       * departure from current stop
       * =
       * next arrival - travel time
       */
      const departureFromStop =
        currentTime -
        travelMinutes;

      /*
       * The shuttle must arrive BEFORE departure
       * so employees have time to board.
       */
      const arrivalAtStop =
        departureFromStop -
        dwellMinutesPerStop;

      reversedStops.push({
        pickupPointId:
          currentPointId,

        arrivalTime:
          minutesToTimeString(
            arrivalAtStop
          ),

        departureTime:
          minutesToTimeString(
            departureFromStop
          ),

        dwellMinutes:
          dwellMinutesPerStop,
      });

      /*
       * The previous stop must feed into
       * this stop's ARRIVAL time.
       */
      currentTime =
        arrivalAtStop;
    }

    const stops =
      reversedStops.reverse();

    return {
      departureTime:
        stops[0].arrivalTime,

      arrivalTime:
        shiftStartTime,

      totalDwellMinutes:
        dwellMinutesPerStop *
        stops.length,

      stops,
    };
  }

  /*
   * ==================================================
   * OUTBOUND
   *
   * Company
   *   ↓
   * Stop A
   *   ↓
   * Stop B
   *
   * Employees leave the company at shiftEndTime.
   *
   * Therefore we calculate FORWARDS.
   * ==================================================
   */

  let currentTime =
    timeStringToMinutes(
      shiftEndTime
    );

  const stops:
    ScheduledStop[] = [];

  let previousIndex =
    depotIndex;

  for (
    const pointId
    of orderedPointIds
  ) {
    const pointIndex =
      pointIndexMap.get(
        pointId
      );

    if (
      pointIndex === undefined
    ) {
      throw new Error(
        `Point ${pointId} not found in duration matrix`
      );
    }

    const travelMinutes =
      durationMatrix
        [previousIndex]
        [pointIndex];

    const arrivalAtStop =
      currentTime +
      travelMinutes;

    const departureFromStop =
      arrivalAtStop +
      dwellMinutesPerStop;

    stops.push({
      pickupPointId:
        pointId,

      arrivalTime:
        minutesToTimeString(
          arrivalAtStop
        ),

      departureTime:
        minutesToTimeString(
          departureFromStop
        ),

      dwellMinutes:
        dwellMinutesPerStop,
    });

    currentTime =
      departureFromStop;

    previousIndex =
      pointIndex;
  }

  return {
    departureTime:
      shiftEndTime,

    arrivalTime:
      stops[
        stops.length - 1
      ].departureTime,

    totalDwellMinutes:
      dwellMinutesPerStop *
      stops.length,

    stops,
  };
}