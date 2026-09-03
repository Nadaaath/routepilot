import {
  pickupPointRepository,
  type CreatePickupPointInput,
} from "../repositories/pickupPoint.repository";

import {
  extractCoordinatesFromMapUrl,
  extractPlaceQueryFromMapUrl,
} from "../utils/mapLocation";

import { resolveMapUrl } from "../utils/resolveMapUrl";
import { geocodeAddress } from "./geocoding.service";
import { HttpError } from "../utils/httpError";

interface PickupPointRequest {
  name: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  mapUrl?: string;
}

export const pickupPointService = {
  getAll() {
    return pickupPointRepository.findAll();
  },

  async getById(id: number) {
    const item = await pickupPointRepository.findById(id);

    if (!item) {
      throw new HttpError(404, "Pickup point not found");
    }

    return item;
  },

  async create(data: PickupPointRequest) {
    let latitude = data.latitude;
    let longitude = data.longitude;

    // 1. Try map URL
    if (
      (latitude === undefined || longitude === undefined) &&
      data.mapUrl
    ) {
      const coordinates =
        await extractCoordinatesFromMapUrl(data.mapUrl);

      if (coordinates) {
        latitude = coordinates.latitude;
        longitude = coordinates.longitude;
      } else {
        // Resolve shortened Google Maps link
        const resolvedUrl =
          await resolveMapUrl(data.mapUrl);

        if (resolvedUrl) {
          const placeQuery =
            extractPlaceQueryFromMapUrl(resolvedUrl);

          if (placeQuery) {
            const result =
              await geocodeAddress(placeQuery);

            latitude = result.latitude;
            longitude = result.longitude;
          }
        }
      }
    }

    // 2. If still no coordinates, geocode plain address
    if (
      (latitude === undefined || longitude === undefined) &&
      data.address
    ) {
      const result =
        await geocodeAddress(data.address);

      latitude = result.latitude;
      longitude = result.longitude;
    }

    // 3. Give up if nothing worked
    if (
      latitude === undefined ||
      longitude === undefined
    ) {
      throw new HttpError(
        400,
        "Could not determine pickup-point coordinates"
      );
    }

    const pickupPoint: CreatePickupPointInput = {
      name: data.name,
      latitude,
      longitude,
      address: data.address,
      mapUrl: data.mapUrl,
    };

    return pickupPointRepository.create(pickupPoint);
  },

  async update(
    id: number,
    data: Partial<PickupPointRequest>
  ) {
    await this.getById(id);

    const updateData: Partial<CreatePickupPointInput> = {
      ...data,
    };

    let latitude = data.latitude;
    let longitude = data.longitude;

    if (
      (latitude === undefined || longitude === undefined) &&
      data.mapUrl
    ) {
      const coordinates =
        await extractCoordinatesFromMapUrl(data.mapUrl);

      if (coordinates) {
        latitude = coordinates.latitude;
        longitude = coordinates.longitude;
      } else {
        const resolvedUrl =
          await resolveMapUrl(data.mapUrl);

        if (resolvedUrl) {
          const placeQuery =
            extractPlaceQueryFromMapUrl(resolvedUrl);

          if (placeQuery) {
            const result =
              await geocodeAddress(placeQuery);

            latitude = result.latitude;
            longitude = result.longitude;
          }
        }
      }
    }

    if (
      (latitude === undefined || longitude === undefined) &&
      data.address
    ) {
      const result =
        await geocodeAddress(data.address);

      latitude = result.latitude;
      longitude = result.longitude;
    }

    if (latitude !== undefined) {
      updateData.latitude = latitude;
    }

    if (longitude !== undefined) {
      updateData.longitude = longitude;
    }

    return pickupPointRepository.update(
      id,
      updateData
    );
  },

  async remove(id: number) {
    await this.getById(id);

    return pickupPointRepository.remove(id);
  },
};