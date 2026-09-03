import { resolveMapUrl } from "./resolveMapUrl";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

function validCoordinates(
  latitude: number,
  longitude: number
): boolean {
  return (
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function extractCoordinates(
  mapUrl: string
): Coordinates | null {
  const decodedUrl = decodeURIComponent(mapUrl);

  // Google Maps format:
  // /@33.9564,-6.8704,15z
  const atMatch = decodedUrl.match(
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/
  );

  if (atMatch) {
    const latitude = Number(atMatch[1]);
    const longitude = Number(atMatch[2]);

    if (validCoordinates(latitude, longitude)) {
      return {
        latitude,
        longitude,
      };
    }
  }

  // Format:
  // ?q=33.9564,-6.8704
  const queryMatch = decodedUrl.match(
    /[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/
  );

  if (queryMatch) {
    const latitude = Number(queryMatch[1]);
    const longitude = Number(queryMatch[2]);

    if (validCoordinates(latitude, longitude)) {
      return {
        latitude,
        longitude,
      };
    }
  }

  // Another Google Maps format:
  // !3d33.9564!4d-6.8704
  const dataMatch = decodedUrl.match(
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/
  );

  if (dataMatch) {
    const latitude = Number(dataMatch[1]);
    const longitude = Number(dataMatch[2]);

    if (validCoordinates(latitude, longitude)) {
      return {
        latitude,
        longitude,
      };
    }
  }

  return null;
}

export async function extractCoordinatesFromMapUrl(
  mapUrl: string
): Promise<Coordinates | null> {
  // 1. Maybe coordinates already exist directly in the URL
  const directCoordinates = extractCoordinates(mapUrl);

  if (directCoordinates) {
    return directCoordinates;
  }

  // 2. Resolve shortened URL
  const resolvedUrl = await resolveMapUrl(mapUrl);

  if (!resolvedUrl) {
    return null;
  }

  console.log("Resolved map URL:", resolvedUrl);

  // 3. Try extracting coordinates from final URL
  return extractCoordinates(resolvedUrl);
}

export function extractPlaceQueryFromMapUrl(
  mapUrl: string
): string | null {
  try {
    const url = new URL(mapUrl);

    const query = url.searchParams.get("q");

    if (!query) {
      return null;
    }

    if (
      /^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(query)
    ) {
      return null;
    }

    return query;
  } catch {
    return null;
  }
}