const BASE_URL = "http://localhost:5000";

async function request(
  path: string,
  body: unknown
) {
  const response = await fetch(
    `${BASE_URL}${path}`,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body:
        JSON.stringify(body),
    }
  );

  const text =
    await response.text();

  let data: unknown;

  try {
    data =
      JSON.parse(text);
  } catch {
    data =
      text;
  }

  if (!response.ok) {
    console.error(
      `FAILED ${path}`,
      response.status,
      data
    );

    throw new Error(
      `Request failed: ${path}`
    );
  }

  return data;
}

async function main() {
  /*
   * ==============================================
   * 1. Pickup points
   * ==============================================
   */

  const pickupPointDefinitions = [
    {
      name:
        "Hay Riad Test Stop",

      latitude:
        33.9564,

      longitude:
        -6.8704,

      address:
        "Hay Riad, Rabat",
    },

    {
      name:
        "Agdal Test Stop",

      latitude:
        34.0026,

      longitude:
        -6.8528,

      address:
        "Agdal, Rabat",
    },

    {
      name:
        "Temara Test Stop",

      latitude:
        33.9274,

      longitude:
        -6.9063,

      address:
        "Temara, Morocco",
    },

    {
      name:
        "Yacoub El Mansour Test Stop",

      latitude:
        33.9908,

      longitude:
        -6.8772,

      address:
        "Yacoub El Mansour, Rabat",
    },

    {
      name:
        "Akkari Test Stop",

      latitude:
        34.0157,

      longitude:
        -6.8576,

      address:
        "Akkari, Rabat",
    },

    {
      name:
        "Sale Test Stop",

      latitude:
        34.0372,

      longitude:
        -6.7987,

      address:
        "Sale, Morocco",
    },
  ];

  const pickupPoints:
    any[] = [];

  for (
    const point
    of pickupPointDefinitions
  ) {
    const created =
      await request(
        "/pickup-points",
        point
      );

    pickupPoints.push(
      created
    );
  }

  console.log(
    "Created pickup points:",
    pickupPoints.map(
      (point) => ({
        id:
          point.id,

        name:
          point.name,
      })
    )
  );

  /*
   * ==============================================
   * 2. Vehicles
   * ==============================================
   */

  const vehicleDefinitions = [
    {
      name:
        "Test Shuttle 20",

      registration:
        "TEST-020",

      capacity:
        20,

      fuelConsumption:
        8.5,

      costPerKm:
        1.6,
    },

    {
      name:
        "Test Shuttle 25",

      registration:
        "TEST-025",

      capacity:
        25,

      fuelConsumption:
        9.2,

      costPerKm:
        1.8,
    },

    {
      name:
        "Test Bus 30",

      registration:
        "TEST-030",

      capacity:
        30,

      fuelConsumption:
        11.5,

      costPerKm:
        2.2,
    },
  ];

  for (
    const vehicle
    of vehicleDefinitions
  ) {
    await request(
      "/vehicles",
      vehicle
    );
  }

  console.log(
    "Created test vehicles"
  );

  /*
   * ==============================================
   * 3. Shift
   * ==============================================
   */

  const shift:
    any =
    await request(
      "/shifts",
      {
        name:
          "Large Test Morning",

        startTime:
          "08:00",

        endTime:
          "16:00",
      }
    );

  console.log(
    "Created shift:",
    shift.id
  );

  /*
   * ==============================================
   * 4. Employee distribution
   * ==============================================
   */

  const distribution = [
    {
      pickupIndex: 0,
      count: 12,
      label: "hayriad",
    },

    {
      pickupIndex: 1,
      count: 10,
      label: "agdal",
    },

    {
      pickupIndex: 2,
      count: 14,
      label: "temara",
    },

    {
      pickupIndex: 3,
      count: 8,
      label: "yacoub",
    },

    {
      pickupIndex: 4,
      count: 7,
      label: "akkari",
    },

    {
      pickupIndex: 5,
      count: 9,
      label: "sale",
    },
  ];

  const employees:
    any[] = [];

  let employeeNumber = 1;

  for (
    const group
    of distribution
  ) {
    const pickupPoint =
      pickupPoints[
        group.pickupIndex
      ];

    for (
      let i = 1;
      i <= group.count;
      i++
    ) {
      const employee =
        await request(
          "/employees",
          {
            firstName:
              `Test${employeeNumber}`,

            lastName:
              group.label,

            email:
              `test.employee.${employeeNumber}@example.com`,

            phone:
              `0600${String(
                employeeNumber
              ).padStart(
                6,
                "0"
              )}`,

            pickupPointId:
              pickupPoint.id,
          }
        );

      employees.push(
        employee
      );

      employeeNumber++;
    }
  }

  console.log(
    `Created ${employees.length} employees`
  );

  /*
   * ==============================================
   * 5. Attendance
   * ==============================================
   */

  for (
    const employee
    of employees
  ) {
    await request(
      "/attendance",
      {
        employeeId:
          employee.id,

        shiftId:
          shift.id,

        date:
          "2026-09-02",

        present:
          true,
      }
    );
  }

  console.log(
    `Created ${employees.length} attendance records`
  );

  console.log("");
  console.log(
    "========================================"
  );
  console.log(
    "LARGE TEST DATASET READY"
  );
  console.log(
    "========================================"
  );

  console.log(
    "Shift ID:",
    shift.id
  );

  console.log(
    "Date:",
    "2026-09-02"
  );

  console.log(
    "Employees:",
    employees.length
  );

  console.log(
    "Pickup points:",
    pickupPoints.length
  );

  console.log("");
  console.log(
    "Use this optimization request:"
  );

  console.log(
    JSON.stringify(
      {
        shiftId:
          shift.id,

        date:
          "2026-09-02",

        depotId:
          1,

        direction:
          "INBOUND",
      },
      null,
      2
    )
  );
}

main()
  .then(() => {
    console.log(
      "Seed completed successfully."
    );
  })
  .catch(
    (error) => {
      console.error(
        "Seed failed:",
        error
      );

      process.exit(1);
    }
  );