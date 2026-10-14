import { prisma } from "../src/lib/prisma";
const TODAY = new Date();
TODAY.setUTCHours(0, 0, 0, 0);

const pickupPoints = [
  
  {
    name: "DEMO - Agdal",
    latitude: 33.9911,
    longitude: -6.8498,
    address: "Agdal, Rabat",
  },
  {
    name: "DEMO - Hassan",
    latitude: 34.0209,
    longitude: -6.8297,
    address: "Hassan, Rabat",
  },
  {
    name: "DEMO - Akkari",
    latitude: 34.0157,
    longitude: -6.8576,
    address: "Akkari, Rabat",
  },
  {
    name: "DEMO - Yacoub El Mansour",
    latitude: 33.995,
    longitude: -6.885,
    address: "Yacoub El Mansour, Rabat",
  },
  {
    name: "DEMO - Souissi",
    latitude: 33.978,
    longitude: -6.831,
    address: "Souissi, Rabat",
  },
  {
    name: "DEMO - Temara",
    latitude: 33.9287,
    longitude: -6.9066,
    address: "Temara, Morocco",
  },
  {
    name: "DEMO - Sale",
    latitude: 34.0372,
    longitude: -6.7987,
    address: "Sale, Morocco",
  },
  {
    name: "DEMO - Aviation",
    latitude: 33.987,
    longitude: -6.843,
    address: "Aviation, Rabat",
  },
  {
    name: "DEMO - Madinat Al Irfane",
    latitude: 33.982,
    longitude: -6.865,
    address: "Madinat Al Irfane, Rabat",
  },
];

async function main() {
  console.log("Starting RoutePilot demo seed...");

  // --------------------------------------------------
  // 1. Reuse existing shifts
  // --------------------------------------------------

  const shifts = await prisma.shift.findMany();

  const morning = shifts.find((s) => s.name === "Morning");
  const between = shifts.find((s) => s.name === "In-Between Shift");
  const night = shifts.find((s) => s.name === "Night");

  if (!morning || !between || !night) {
    throw new Error(
      "Expected shifts not found. Required: Morning, In-Between Shift, Night."
    );
  }

  console.log("Existing shifts found:");
  console.log(
    shifts.map((s) => ({
      id: s.id,
      name: s.name,
    }))
  );

  const demoShifts = [morning, between, night];

  // --------------------------------------------------
  // 2. Create / reuse pickup points
  // --------------------------------------------------

  const createdPoints = [];

  for (const point of pickupPoints) {
    let existing = await prisma.pickupPoint.findFirst({
      where: {
        name: point.name,
      },
    });

    if (!existing) {
      existing = await prisma.pickupPoint.create({
        data: {
          ...point,
          mapUrl: null,
        },
      });
    }

    createdPoints.push(existing);
  }

  console.log(`${createdPoints.length} pickup points ready.`);

  // --------------------------------------------------
  // 3. Create 45 employees
  // --------------------------------------------------

  const employees = [];

  for (let i = 1; i <= 45; i++) {
    const point = createdPoints[(i - 1) % createdPoints.length];

    const padded = String(i).padStart(2, "0");

    const email = `demo.employee.${padded}@routepilot.test`;

    let employee = await prisma.employee.findUnique({
      where: {
        email,
      },
    });

    if (!employee) {
      employee = await prisma.employee.create({
        data: {
          firstName: `Demo${padded}`,
          lastName: `Employee`,
          email,
          phone: `060001${String(i).padStart(4, "0")}`,
          active: true,
          pickupPointId: point.id,
        },
      });
    }

    employees.push(employee);
  }

  console.log(`${employees.length} employees ready.`);

  // --------------------------------------------------
  // 4. Assign employees to the existing shifts
  //
  // Employees are distributed evenly:
  // Morning -> In-Between -> Night -> Morning...
  // --------------------------------------------------

  for (let i = 0; i < employees.length; i++) {
    const employee = employees[i];
    const shift = demoShifts[i % demoShifts.length];

    const existingAssignment =
      await prisma.shiftAssignment.findFirst({
        where: {
          employeeId: employee.id,
          shiftId: shift.id,
          date: TODAY,
        },
      });

    if (!existingAssignment) {
      await prisma.shiftAssignment.create({
        data: {
          employeeId: employee.id,
          shiftId: shift.id,
          date: TODAY,
        },
      });
    }

    // ----------------------------------------------
    // 5. Attendance
    //
    // Around 90% present.
    // Every 10th employee is absent.
    // ----------------------------------------------

    const present = (i + 1) % 10 !== 0;

    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        employeeId: employee.id,
        shiftId: shift.id,
        date: TODAY,
      },
    });

    if (!existingAttendance) {
      await prisma.attendance.create({
        data: {
          employeeId: employee.id,
          shiftId: shift.id,
          date: TODAY,
          present,
        },
      });
    }
  }

  console.log("");
  console.log("RoutePilot demo dataset ready.");
  console.log("--------------------------------");
  console.log(`Pickup points : ${createdPoints.length}`);
  console.log(`Employees     : ${employees.length}`);
  console.log(`Shifts reused : ${demoShifts.length}`);
  console.log(`Date          : ${TODAY.toISOString().slice(0, 10)}`);
  console.log("");
  console.log("Morning employees: approximately 15");
  console.log("In-Between employees: approximately 15");
  console.log("Night employees: approximately 15");
  console.log("Attendance: approximately 90%");
}

main()
  .catch((error) => {
    console.error("Seed failed:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });