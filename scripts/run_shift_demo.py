from optimizer.models import (
    Employee,
    Vehicle,
    Shift,
    ShiftAssignment,
    Attendance,
    VehicleAvailability,
    OptimizationProblem,
)

from optimizer.solver import optimize

from routing.osrm_client import (
    Coordinate,
    OSRMClient,
)

from routing.matrix_builder import (
    build_transport_matrix,
)

from workforce.service import (
    get_employees_for_shift,
)
from archive.fleet.service import (
    get_available_vehicles,
)

# ==================================================
# EMPLOYEES
# ==================================================

employees = [
    Employee(
        id=1,
        name="E1",
        latitude=33.5800,
        longitude=-7.5950,
    ),

    Employee(
        id=2,
        name="E2",
        latitude=33.5870,
        longitude=-7.6030,
    ),

    Employee(
        id=3,
        name="E3",
        latitude=33.5910,
        longitude=-7.6100,
    ),

    Employee(
        id=4,
        name="E4",
        latitude=33.5650,
        longitude=-7.5800,
    ),

    Employee(
        id=5,
        name="E5",
        latitude=33.5590,
        longitude=-7.5750,
    ),

    Employee(
        id=6,
        name="E6",
        latitude=33.5530,
        longitude=-7.5700,
    ),
]


# ==================================================
# SHIFTS
# ==================================================
#
# We still use the current relative-time convention:
#
# 06:00 = 0
#
# Therefore:
#
# 08:00 = 120 minutes
# 14:00 = 480 minutes
#

shifts = [
    Shift(
        id=1,
        name="Morning",
        arrival_time=120,
    ),

    Shift(
        id=2,
        name="Afternoon",
        arrival_time=480,
    ),
]


# ==================================================
# WEEKLY SHIFT ASSIGNMENTS
# ==================================================

shift_assignments = [
    ShiftAssignment(
        employee_id=1,
        shift_id=1,
    ),

    ShiftAssignment(
        employee_id=2,
        shift_id=1,
    ),

    ShiftAssignment(
        employee_id=3,
        shift_id=1,
    ),

    ShiftAssignment(
        employee_id=4,
        shift_id=1,
    ),

    ShiftAssignment(
        employee_id=5,
        shift_id=2,
    ),

    ShiftAssignment(
        employee_id=6,
        shift_id=2,
    ),
]


# ==================================================
# ATTENDANCE
# ==================================================
#
# E3 is absent today.
#

attendance = [
    Attendance(
        employee_id=1,
        present=True,
    ),

    Attendance(
        employee_id=2,
        present=True,
    ),

    Attendance(
        employee_id=3,
        present=False,
    ),

    Attendance(
        employee_id=4,
        present=True,
    ),

    Attendance(
        employee_id=5,
        present=True,
    ),

    Attendance(
        employee_id=6,
        present=True,
    ),
]


# ==================================================
# SELECT SHIFT TO PLAN
# ==================================================

selected_shift_id = 1


selected_shift = next(
    shift
    for shift in shifts
    if shift.id == selected_shift_id
)


# ==================================================
# FILTER EMPLOYEES
# ==================================================

eligible_employees = (
    get_employees_for_shift(
        employees=employees,
        shift_assignments=shift_assignments,
        attendance=attendance,
        shift_id=selected_shift_id,
    )
)


print()
print(
    "Employees requiring transport:"
)

for employee in eligible_employees:
    print(
        f"- {employee.name}"
    )


# ==================================================
# DEPOT + COMPANY
# ==================================================

depot = Coordinate(
    latitude=33.5731,
    longitude=-7.5898,
)

company = Coordinate(
    latitude=33.6000,
    longitude=-7.6200,
)


# ==================================================
# FLEET
# ==================================================

vehicles = [
    Vehicle(
        id=1,
        capacity=6,
        fixed_cost=8000,
        fuel_consumption_per_100km=18.0,
        fuel_price_per_liter=1300,
        other_cost_per_km=250,
    ),

    Vehicle(
        id=2,
        capacity=3,
        fixed_cost=2500,
        fuel_consumption_per_100km=9.0,
        fuel_price_per_liter=1300,
        other_cost_per_km=100,
    ),

    Vehicle(
        id=3,
        capacity=3,
        fixed_cost=2500,
        fuel_consumption_per_100km=9.0,
        fuel_price_per_liter=1300,
        other_cost_per_km=100,
    ),
]

vehicle_availability = [
    VehicleAvailability(
        vehicle_id=1,
        available=True,
    ),

    VehicleAvailability(
        vehicle_id=2,
        available=False,
    ),

    VehicleAvailability(
        vehicle_id=3,
        available=False,
    ),
]
available_vehicles = (
    get_available_vehicles(
        vehicles=vehicles,
        availability=vehicle_availability,
    )
)
# ==================================================
# BUILD REAL ROAD MATRICES
# ==================================================

osrm_client = OSRMClient()


road_matrix = build_transport_matrix(
    depot=depot,
    employees=eligible_employees,
    company=company,
    osrm_client=osrm_client,
)


# ==================================================
# CREATE OPTIMIZATION PROBLEM
# ==================================================

problem = OptimizationProblem(
    employees=eligible_employees,
    vehicles=available_vehicles,

    distance_matrix=(
        road_matrix.distance_matrix
    ),

    time_matrix=(
        road_matrix.time_matrix
    ),

    depot_node=0,

    company_node=(
        len(eligible_employees) + 1
    ),

    arrival_deadline=(
        selected_shift.arrival_time
    ),

    max_commute=60,

    service_time=1,
)


# ==================================================
# SOLVE
# ==================================================
print()
print("TIME MATRIX")
for row in road_matrix.time_matrix:
    print(row)

print()
print("DISTANCE MATRIX")
for row in road_matrix.distance_matrix:
    print(row)

print()
print(
    "Arrival deadline:",
    problem.arrival_deadline,
)

print(
    "Max commute:",
    problem.max_commute,
)
result = optimize(
    problem
)


# ==================================================
# HELPERS
# ==================================================

def format_time(
    minutes: int,
) -> str:

    total_minutes = (
        6 * 60
        + minutes
    )

    hours = (
        total_minutes // 60
    )

    mins = (
        total_minutes % 60
    )

    return (
        f"{hours:02d}:"
        f"{mins:02d}"
    )


def format_money(
    centimes: int,
) -> str:

    return (
        f"{centimes / 100:.2f} MAD"
    )


# ==================================================
# DISPLAY RESULT
# ==================================================

print()
print(
    "================================"
)

print(
    "SHIFT TRANSPORT PLAN"
)

print(
    "================================"
)

print(
    f"Shift: "
    f"{selected_shift.name}"
)

print(
    f"Employees requiring transport: "
    f"{len(eligible_employees)}"
)

print(
    f"Total fleet: "
    f"{len(vehicles)}"
)

print(
    f"Available vehicles: "
    f"{len(available_vehicles)}"
)

print(
    f"Selected vehicles: "
    f"{len(result.routes)}"
)

print(
    f"Total distance: "
    f"{result.total_distance / 1000:.2f} km"
)

print(
    f"Total fuel used: "
    f"{result.total_fuel_used:.2f} L"
)

print(
    f"Total fuel cost: "
    f"{format_money(result.total_fuel_cost)}"
)

print(
    f"Total operating cost: "
    f"{format_money(result.total_cost)}"
)

print()
print("Available vehicles:")

for vehicle in available_vehicles:
    print(
        f"- Vehicle {vehicle.id}"
    )
# ==================================================
# DISPLAY EACH VEHICLE ROUTE
# ==================================================

for route in result.routes:

    print()

    print(
        f"Vehicle {route.vehicle_id}"
    )

    print(
        "----------------"
    )

    for stop in route.stops:

        node = stop.node

        # ----------------------------------------------
        # NODE NAME
        # ----------------------------------------------

        if node == problem.depot_node:

            name = "Depot"

        elif node == problem.company_node:

            name = "Company"

        else:

            employee = (
                eligible_employees[
                    node - 1
                ]
            )

            name = employee.name

        # ----------------------------------------------
        # DISPLAY STOP
        # ----------------------------------------------

        if stop.commute_time is None:

            print(
                f"{name:<10} "
                f"{format_time(stop.arrival_time)}"
            )

        else:

            print(
                f"{name:<10} "
                f"{format_time(stop.arrival_time)} "
                f"commute="
                f"{stop.commute_time} min"
            )

    # ----------------------------------------------
    # ROUTE KPIs
    # ----------------------------------------------

    print()

    print(
        f"Distance: "
        f"{route.distance / 1000:.2f} km"
    )

    print(
        f"Fuel used: "
        f"{route.fuel_used:.2f} L"
    )

    print(
        f"Fuel cost: "
        f"{format_money(route.fuel_cost)}"
    )

    print(
        f"Operating cost: "
        f"{format_money(route.operating_cost)}"
    )