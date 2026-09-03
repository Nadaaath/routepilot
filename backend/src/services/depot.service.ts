import {
  depotRepository,
  type CreateDepotInput,
} from "../repositories/depot.repository";

import {
  extractCoordinatesFromMapUrl,
  extractPlaceQueryFromMapUrl,
} from "../utils/mapLocation";

import { resolveMapUrl } from "../utils/resolveMapUrl";
import { geocodeAddress } from "./geocoding.service";
import { HttpError } from "../utils/httpError";

interface DepotRequest {
  name: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  mapUrl?: string;
}

async function resolveCoordinates(
  data: DepotRequest
) {
  let latitude = data.latitude;
  let longitude = data.longitude;

  // Try Google Maps URL
  if (
    (latitude === undefined ||
      longitude === undefined) &&
    data.mapUrl
  ) {
    const coordinates =
      await extractCoordinatesFromMapUrl(
        data.mapUrl
      );

    if (coordinates) {
      latitude = coordinates.latitude;
      longitude = coordinates.longitude;
    } else {
      const resolvedUrl =
        await resolveMapUrl(data.mapUrl);

      if (resolvedUrl) {
        const placeQuery =
          extractPlaceQueryFromMapUrl(
            resolvedUrl
          );

        if (placeQuery) {
          const result =
            await geocodeAddress(placeQuery);

          latitude = result.latitude;
          longitude = result.longitude;
        }
      }
    }
  }

  // Try plain address
  if (
    (latitude === undefined ||
      longitude === undefined) &&
    data.address
  ) {
    const result =
      await geocodeAddress(data.address);

    latitude = result.latitude;
    longitude = result.longitude;
  }

  if (
    latitude === undefined ||
    longitude === undefined
  ) {
    throw new HttpError(
      400,
      "Could not determine depot coordinates"
    );
  }

  return {
    latitude,
    longitude,
  };
}

export const depotService = {
  getAll() {
    return depotRepository.findAll();
  },

  async getById(id: number) {
    const depot =
      await depotRepository.findById(id);

    if (!depot) {
      throw new HttpError(
        404,
        "Depot not found"
      );
    }

    return depot;
  },

  async create(data: DepotRequest) {
    const coordinates =
      await resolveCoordinates(data);

    const depot: CreateDepotInput = {
      name: data.name,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      address: data.address,
      mapUrl: data.mapUrl,
    };

    return depotRepository.create(depot);
  },

  async update(
    id: number,
    data: Partial<DepotRequest>
  ) {
    const existing =
      await this.getById(id);

    let latitude =
      data.latitude ?? existing.latitude;

    let longitude =
      data.longitude ?? existing.longitude;

    if (data.mapUrl || data.address) {
      const coordinates =
        await resolveCoordinates({
          name: data.name ?? existing.name,
          latitude: data.latitude,
          longitude: data.longitude,
          address: data.address,
          mapUrl: data.mapUrl,
        });

      latitude = coordinates.latitude;
      longitude = coordinates.longitude;
    }

    return depotRepository.update(id, {
      name: data.name ?? existing.name,
      address:
        data.address ?? existing.address ?? undefined,
      mapUrl:
        data.mapUrl ?? existing.mapUrl ?? undefined,
      latitude,
      longitude,
    });
  },

  async remove(id: number) {
    await this.getById(id);

    return depotRepository.remove(id);
  },
};