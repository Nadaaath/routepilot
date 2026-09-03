import { env } from "../config/env";
import { HttpError } from "../utils/httpError";

export interface MatrixLocation {
  id: number;
  latitude: number;
  longitude: number;
}

export interface RoadMatrixResult {
  distancesKm: number[][];
  durationsMinutes: number[][];
}

interface OrsMatrixResponse {
  distances?: number[][];
  durations?: number[][];
}

export async function buildRoadMatrix(
  locations: MatrixLocation[]
): Promise<RoadMatrixResult> {
  if (locations.length === 0) {
    return {
      distancesKm: [],
      durationsMinutes: [],
    };
  }

  const url =
    "https://api.heigit.org/openrouteservice/v2/matrix/driving-car";

  const body = {
    locations: locations.map((location) => [
      location.longitude,
      location.latitude,
    ]),
    metrics: ["distance", "duration"],
    units: "km",
  };
  console.log(
  "ORS MATRIX LOCATIONS:",
  JSON.stringify(body.locations, null, 2)
);

  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",

      headers: {
        Authorization: env.ORS_API_KEY,
        "Content-Type": "application/json",
      },

      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error("Routing matrix request failed:", error);

    throw new HttpError(
      502,
      "Could not connect to routing service"
    );
  }

  if (!response.ok) {
    const text = await response.text();

    console.error(
      "Routing service error:",
      response.status,
      text
    );

    throw new HttpError(
      502,
      `Routing service failed with status ${response.status}`
    );
  }

  const data =
    (await response.json()) as OrsMatrixResponse;

  if (!data.distances || !data.durations) {
    throw new HttpError(
      502,
      "Routing service returned an incomplete matrix"
    );
  }

  return {
    distancesKm: data.distances,

    // ORS duration values are seconds
    durationsMinutes: data.durations.map((row) =>
      row.map((seconds) => seconds / 60)
    ),
  };
}