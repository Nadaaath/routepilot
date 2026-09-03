import { env } from "../config/env";
import { HttpError } from "../utils/httpError";

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  label?: string;
}

interface OrsFeature {
  geometry?: {
    coordinates?: [number, number];
  };

  properties?: {
    label?: string;
  };
}

interface OrsGeocodingResponse {
  features?: OrsFeature[];
}

export async function geocodeAddress(
  address: string
): Promise<GeocodingResult> {
  if (!address.trim()) {
    throw new HttpError(
      400,
      "Address cannot be empty"
    );
  }

  const url = new URL(
    "https://api.heigit.org/pelias/v1/search"
  );

  url.searchParams.set(
    "api_key",
    env.ORS_API_KEY
  );

  url.searchParams.set(
    "text",
    address
  );

  url.searchParams.set(
    "size",
    "1"
  );

  let response: Response;

  try {
    response = await fetch(url);
  } catch (error) {
    console.error(
      "Geocoding request failed:",
      error
    );

    throw new HttpError(
      502,
      "Could not connect to the geocoding service"
    );
  }

  if (!response.ok) {
    const responseText =
      await response.text();

    console.error(
      "Geocoding service error:",
      response.status,
      responseText
    );

    throw new HttpError(
      502,
      `Geocoding service failed with status ${response.status}`
    );
  }

  let data: OrsGeocodingResponse;

  try {
    data =
      (await response.json()) as OrsGeocodingResponse;
  } catch {
    throw new HttpError(
      502,
      "Geocoding service returned an invalid response"
    );
  }

  const feature =
    data.features?.[0];

  if (!feature) {
    throw new HttpError(
      400,
      "Could not find coordinates for this address"
    );
  }

  const coordinates =
    feature.geometry?.coordinates;

  if (
    !coordinates ||
    coordinates.length < 2
  ) {
    throw new HttpError(
      502,
      "Geocoding result does not contain coordinates"
    );
  }

  // GeoJSON coordinates are:
  // [longitude, latitude]
  const [longitude, latitude] =
    coordinates;

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    throw new HttpError(
      502,
      "Geocoding service returned invalid coordinates"
    );
  }

  if (
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new HttpError(
      502,
      "Geocoding service returned coordinates outside valid ranges"
    );
  }

  return {
    latitude,
    longitude,
    label: feature.properties?.label,
  };
}