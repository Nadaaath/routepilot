interface EmployeeForTrip {
  id: number;
  firstName: string;
  lastName: string;
  pickupPoint: {
    id: number;
    name?: string;
    latitude?: number;
    longitude?: number;
  } | null;
}

interface VehicleForTrip {
  id: number;
  name: string;
  capacity: number;
  fuelConsumption: number | null;
  costPerKm?: number | null;
  maintenanceCostPerKm?: number | null;
  planningPriority?: string;
}

export type TripSplitMode = "BEST_FIT" | "BALANCED" | "COMFORT_SPREAD";

export interface VehicleTripGroup {
  vehicle: VehicleForTrip;
  employees: EmployeeForTrip[];
  employeeCount: number;
  pointIds: number[];
}

export interface TripSplitResult {
  trips: VehicleTripGroup[];
  unassignedEmployeeIds: number[];
}

function freeSeats(trip: VehicleTripGroup) {
  return trip.vehicle.capacity - trip.employeeCount;
}

function occupancy(trip: VehicleTripGroup) {
  return trip.vehicle.capacity > 0
    ? trip.employeeCount / trip.vehicle.capacity
    : 1;
}

/**
 * Split one geographic cluster across its assigned vehicles.
 *
 * BEST_FIT keeps the old behaviour and packs complete pickup groups tightly.
 * BALANCED spreads demand by relative occupancy.
 * COMFORT_SPREAD deliberately spreads pickup groups across available vehicles
 * so each trip tends to visit fewer stops. The final optimizer still evaluates
 * every resulting plan using the same business constraints.
 */
export function splitClusterIntoTrips(
  employees: EmployeeForTrip[],
  vehicles: VehicleForTrip[],
  mode: TripSplitMode = "BEST_FIT"
): TripSplitResult {
  const transportEmployees = employees.filter(
    (employee) => employee.pickupPoint !== null
  );

  const employeesByPoint = new Map<number, EmployeeForTrip[]>();
  for (const employee of transportEmployees) {
    const pointId = employee.pickupPoint!.id;
    const existing = employeesByPoint.get(pointId) ?? [];
    existing.push(employee);
    employeesByPoint.set(pointId, existing);
  }

  const pickupGroups = [...employeesByPoint.entries()]
    .map(([pointId, groupEmployees]) => ({
      pointId,
      employees: [...groupEmployees],
    }))
    .sort((a, b) => b.employees.length - a.employees.length);

  const sortedVehicles = [...vehicles].sort((a, b) => {
    if (mode === "COMFORT_SPREAD") return a.capacity - b.capacity;
    return b.capacity - a.capacity;
  });

  const trips: VehicleTripGroup[] = sortedVehicles.map((vehicle) => ({
    vehicle,
    employees: [],
    employeeCount: 0,
    pointIds: [],
  }));

  for (const pickupGroup of pickupGroups) {
    let remainingEmployees = [...pickupGroup.employees];

    const wholeGroupCandidates = trips.filter(
      (trip) => freeSeats(trip) >= remainingEmployees.length
    );

    let fittingTrip: VehicleTripGroup | undefined;

    if (mode === "COMFORT_SPREAD") {
      fittingTrip = [...wholeGroupCandidates].sort((a, b) => {
        const stopDifference = a.pointIds.length - b.pointIds.length;
        if (stopDifference !== 0) return stopDifference;
        const occupancyDifference = occupancy(a) - occupancy(b);
        if (occupancyDifference !== 0) return occupancyDifference;
        return freeSeats(b) - freeSeats(a);
      })[0];
    } else if (mode === "BALANCED") {
      fittingTrip = [...wholeGroupCandidates].sort((a, b) => {
        const occupancyDifference = occupancy(a) - occupancy(b);
        if (occupancyDifference !== 0) return occupancyDifference;
        return freeSeats(b) - freeSeats(a);
      })[0];
    } else {
      fittingTrip = [...wholeGroupCandidates].sort(
        (a, b) => freeSeats(a) - freeSeats(b)
      )[0];
    }

    if (fittingTrip) {
      fittingTrip.employees.push(...remainingEmployees);
      fittingTrip.employeeCount += remainingEmployees.length;
      if (!fittingTrip.pointIds.includes(pickupGroup.pointId)) {
        fittingTrip.pointIds.push(pickupGroup.pointId);
      }
      continue;
    }

    const splitTargets = [...trips].sort((a, b) => {
      if (mode === "COMFORT_SPREAD") {
        const stopDifference = a.pointIds.length - b.pointIds.length;
        if (stopDifference !== 0) return stopDifference;
      }
      if (mode === "BALANCED" || mode === "COMFORT_SPREAD") {
        const occupancyDifference = occupancy(a) - occupancy(b);
        if (occupancyDifference !== 0) return occupancyDifference;
      }
      return freeSeats(b) - freeSeats(a);
    });

    for (const trip of splitTargets) {
      if (remainingEmployees.length === 0) break;
      const availableSeats = freeSeats(trip);
      if (availableSeats <= 0) continue;

      const employeesForThisTrip = remainingEmployees.splice(
        0,
        availableSeats
      );
      trip.employees.push(...employeesForThisTrip);
      trip.employeeCount += employeesForThisTrip.length;
      if (
        employeesForThisTrip.length > 0 &&
        !trip.pointIds.includes(pickupGroup.pointId)
      ) {
        trip.pointIds.push(pickupGroup.pointId);
      }
    }
  }

  const assignedEmployeeIds = new Set<number>();
  for (const trip of trips) {
    for (const employee of trip.employees) assignedEmployeeIds.add(employee.id);
  }

  const unassignedEmployeeIds = transportEmployees
    .filter((employee) => !assignedEmployeeIds.has(employee.id))
    .map((employee) => employee.id);

  return {
    trips: trips.filter((trip) => trip.employeeCount > 0),
    unassignedEmployeeIds,
  };
}
