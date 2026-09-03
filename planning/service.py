from dataclasses import dataclass
from typing import List

from optimizer.models import (
    Attendance,
    Employee,
    EmployeePickupOption,
    PickupStop,
    PlanningPreferences,
    Shift,
    ShiftAssignment,
    Vehicle,
    VehicleAvailability,
)

from workforce.service import (
    get_employees_for_shift,
)

from archive.fleet.service import (
    get_available_vehicles,
)

from pickup.service import (
    build_pickup_eligibility,
    build_employee_pickup_options,
)

from pickup.route_aware_solver import (
    RouteAwarePickupResult,
    optimize_route_aware_pickups,
)

from routing.osrm_client import (
    Coordinate,
    OSRMClient,
)

from routing.walking_router import (
    OpenRouteServiceWalkingRouter,
)


@dataclass
class TransportPlanningResult:
    shift: Shift

    eligible_employees: List[Employee]

    available_vehicles: List[Vehicle]

    pickup_options: List[EmployeePickupOption]

    pickup_result: RouteAwarePickupResult


def generate_transport_plan(
    employees: List[Employee],
    shifts: List[Shift],
    shift_assignments: List[ShiftAssignment],
    attendance: List[Attendance],

    vehicles: List[Vehicle],
    vehicle_availability: List[VehicleAvailability],

    pickup_stops: List[PickupStop],

    preferences: PlanningPreferences,

    selected_shift_id: int,

    depot: Coordinate,
    company: Coordinate,

    osrm_client: OSRMClient,
    walking_router: OpenRouteServiceWalkingRouter,

    max_commute: int = 60,
    service_time: int = 1,
) -> TransportPlanningResult:
    """
    Generate one transport plan for one shift.

    Pipeline:

    1. Resolve shift.
    2. Filter employees using shift + attendance.
    3. Filter available vehicles.
    4. Calculate real pedestrian distances.
    5. Apply maximum walking distance rule.
    6. Build pickup options.
    7. Run route-aware transport optimization.
    """

    # ==================================================
    # SELECT SHIFT
    # ==================================================

    selected_shift = next(
        (
            shift
            for shift in shifts
            if shift.id == selected_shift_id
        ),
        None,
    )

    if selected_shift is None:
        raise ValueError(
            f"Shift {selected_shift_id} does not exist."
        )

    # ==================================================
    # WORKFORCE FILTERING
    # ==================================================

    eligible_employees = get_employees_for_shift(
        employees=employees,
        shift_assignments=shift_assignments,
        attendance=attendance,
        shift_id=selected_shift_id,
    )

    if not eligible_employees:
        raise ValueError(
            "No employees require transport for this shift."
        )

    # ==================================================
    # FLEET FILTERING
    # ==================================================

    available_vehicles = get_available_vehicles(
        vehicles=vehicles,
        availability=vehicle_availability,
    )

    if not available_vehicles:
        raise ValueError(
            "No vehicles are available for this transport run."
        )

    # ==================================================
    # REAL WALKING DISTANCES
    # ==================================================
    #
    # Instead of receiving a manually created dictionary,
    # the planning service asks the pedestrian routing
    # provider for actual walking-network distances.
    #

    walking_distances = (
        walking_router.build_walking_distances(
            employees=eligible_employees,
            pickup_stops=pickup_stops,
        )
    )

    # ==================================================
    # PICKUP ELIGIBILITY
    # ==================================================
    #
    # Example:
    #
    # max_walking_distance_m = 500
    #
    # An employee-stop pair is valid only when the
    # real pedestrian route is within that threshold.
    #

    eligible_pairs = build_pickup_eligibility(
        employees=eligible_employees,
        pickup_stops=pickup_stops,
        walking_distances=walking_distances,
        preferences=preferences,
    )

    # ==================================================
    # PICKUP OPTIONS
    # ==================================================

    pickup_options = build_employee_pickup_options(
        employees=eligible_employees,
        eligible_pairs=eligible_pairs,
    )

    # ==================================================
    # ROUTE-AWARE OPTIMIZATION
    # ==================================================

    pickup_result = optimize_route_aware_pickups(
        employees=eligible_employees,
        pickup_stops=pickup_stops,
        pickup_options=pickup_options,
        vehicles=available_vehicles,
        depot=depot,
        company=company,
        osrm_client=osrm_client,
        arrival_deadline=selected_shift.arrival_time,
        max_commute=max_commute,
        service_time=service_time,
    )

    # ==================================================
    # RESULT
    # ==================================================

    return TransportPlanningResult(
        shift=selected_shift,
        eligible_employees=eligible_employees,
        available_vehicles=available_vehicles,
        pickup_options=pickup_options,
        pickup_result=pickup_result,
    )