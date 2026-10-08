/**
 * @file shelter.service.ts
 * @description Service layer for shelter management operations in the disaster
 * early-warning and emergency coordination system. Handles creation, querying,
 * occupancy tracking, and summary reporting for emergency shelters.
 */

import { prisma } from '../config/database';
import { ShelterStatus } from '@prisma/client';

type GeocodeResult = { latitude: number; longitude: number; displayName: string } | null;
const geocodeCache = new Map<string, GeocodeResult>();
let lastGeocodeAt = 0;
let geocodeQueue: Promise<void> = Promise.resolve();

/** Looks up one user-submitted shelter address via Nominatim, with caching and a 1 req/sec limit. */
export async function geocodeShelterAddress(address: string, district: string): Promise<GeocodeResult> {
  const query = `${address.trim()}, ${district.trim()}, Sri Lanka`;
  const cacheKey = query.toLocaleLowerCase();
  if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey)!;

  let releaseQueue!: () => void;
  const previous = geocodeQueue;
  geocodeQueue = new Promise<void>((resolve) => { releaseQueue = resolve; });
  await previous;
  try {
    const cached = geocodeCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const waitMs = Math.max(0, 1000 - (Date.now() - lastGeocodeAt));
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    lastGeocodeAt = Date.now();

    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.search = new URLSearchParams({ q: query, format: 'jsonv2', limit: '1', countrycodes: 'lk' }).toString();
    const response = await fetch(url, {
      headers: { 'User-Agent': `DMC-Sri-Lanka-Disaster-Coordination/1.0${process.env.GEOCODING_CONTACT ? ` (${process.env.GEOCODING_CONTACT})` : ''}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Geocoding service returned ${response.status}`);
    const results = await response.json() as Array<{ lat: string; lon: string; display_name: string }>;
    const result = results[0]
      ? { latitude: Number(results[0].lat), longitude: Number(results[0].lon), displayName: results[0].display_name }
      : null;
    geocodeCache.set(cacheKey, result);
    return result;
  } finally {
    releaseQueue();
  }
}

/**
 * @description Creates a new emergency shelter record and registers it under the
 * given officer. The shelter is created with an initial status of OPEN and zero
 * current occupancy (Prisma default).
 *
 * @param dto - Data transfer object containing shelter details.
 * @param dto.name - Human-readable name of the shelter.
 * @param dto.address - Full street address of the shelter.
 * @param dto.district - Administrative district the shelter belongs to.
 * @param dto.capacity - Maximum number of occupants the shelter can hold.
 * @param dto.contactNumber - Optional primary contact phone number for the shelter.
 * @param dto.amenities - List of amenities available at the shelter (e.g. "water", "medical").
 * @param officerId - ID of the DMC officer registering the shelter.
 *
 * @returns A promise that resolves to the newly created {@link Shelter} record.
 *
 * @throws {PrismaClientKnownRequestError} If a database constraint is violated
 * (e.g. duplicate entry or foreign-key failure on `officerId`).
 */
export async function createShelter(dto: {
  name: string; address: string; district: string;
  latitude?: number; longitude?: number;
  capacity: number; contactNumber?: string; amenities: string[];
}, officerId: string) {
  return prisma.shelter.create({
    data: { ...dto, registeredById: officerId, status: ShelterStatus.OPEN },
  });
}

/**
 * @description Retrieves a paginated list of shelters, optionally filtered by
 * district and/or status. Results are ordered alphabetically by shelter name.
 *
 * @param params - Query parameters for filtering and pagination.
 * @param params.district - Optional district name to filter shelters by.
 * @param params.status - Optional status string to filter shelters by (case-insensitive;
 * converted to uppercase before querying, e.g. "open" → "OPEN").
 * @param params.page - Page number for pagination (1-based, defaults to `1`).
 * @param params.limit - Maximum number of records per page (defaults to `50`).
 *
 * @returns A promise that resolves to an object containing:
 * - `shelters` – Array of {@link Shelter} records for the requested page.
 * - `meta` – Pagination metadata:
 *   - `total` – Total number of shelters matching the filter.
 *   - `page` – Current page number.
 *   - `limit` – Records per page.
 *   - `totalPages` – Total number of available pages.
 *
 * @throws {PrismaClientKnownRequestError} If the database query fails.
 */
export async function listShelters(params: { district?: string; status?: string; page?: number; limit?: number }) {
  const page = params.page || 1;
  const limit = params.limit || 50;
  const where: Record<string, unknown> = {};
  if (params.district) where.district = params.district;
  if (params.status) where.status = params.status.toUpperCase();

  const [shelters, total] = await Promise.all([
    prisma.shelter.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { name: 'asc' } }),
    prisma.shelter.count({ where }),
  ]);
  return { shelters, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}

/**
 * @description Fetches a single shelter by its unique identifier, including the
 * 10 most recent occupancy log entries for audit and reporting purposes.
 *
 * @param id - The unique identifier (UUID) of the shelter to retrieve.
 *
 * @returns A promise that resolves to the {@link Shelter} record with its
 * `occupancyLogs` relation included (up to 10 entries, ordered by
 * `updatedAt` descending), or `null` if no shelter with the given `id` exists.
 *
 * @throws {PrismaClientKnownRequestError} If the database query fails.
 */
export async function getShelterById(id: string) {
  return prisma.shelter.findUnique({
    where: { id },
    include: { occupancyLogs: { orderBy: { updatedAt: 'desc' }, take: 10 } },
  });
}

/**
 * @description Updates the current occupancy count of a shelter and automatically
 * adjusts its status to `FULL` when the new count meets or exceeds capacity, or
 * back to `OPEN` when below capacity. The operation is performed inside a
 * database transaction to keep the shelter record and its occupancy log in sync.
 *
 * @param id - The unique identifier (UUID) of the shelter to update.
 * @param newOccupancy - The new total occupancy count to set on the shelter.
 * Must be a non-negative integer and must not exceed the shelter's `capacity`.
 * @param officerId - ID of the officer recording the occupancy change, stored in
 * the created {@link ShelterOccupancyLog} entry.
 *
 * @returns A promise that resolves to a tuple of two Prisma results:
 * - `[0]` – The updated {@link Shelter} record.
 * - `[1]` – The newly created {@link ShelterOccupancyLog} record.
 *
 * @throws `{ code: 'NOT_FOUND', message: string, status: 404 }` If no shelter
 * with the given `id` exists in the database.
 * @throws `{ code: 'SHELTER_CAPACITY_EXCEEDED', message: string, status: 409, field: 'newOccupancy' }`
 * If `newOccupancy` exceeds the shelter's registered `capacity`.
 * @throws {PrismaClientKnownRequestError} If the transaction fails at the
 * database level.
 */
export async function updateOccupancy(id: string, newOccupancy: number, officerId: string) {
  const shelter = await prisma.shelter.findUnique({ where: { id } });
  if (!shelter) throw { code: 'NOT_FOUND', message: 'Shelter not found', status: 404 };
  if (newOccupancy > shelter.capacity) {
    throw { code: 'SHELTER_CAPACITY_EXCEEDED', message: `Cannot update occupancy. New count (${newOccupancy}) exceeds shelter capacity (${shelter.capacity}).`, status: 409, field: 'newOccupancy' };
  }
  const status: ShelterStatus = newOccupancy >= shelter.capacity ? ShelterStatus.FULL : ShelterStatus.OPEN;
  return prisma.$transaction([
    prisma.shelter.update({ where: { id }, data: { currentOccupancy: newOccupancy, status } }),
    prisma.shelterOccupancyLog.create({ data: { shelterId: id, previousCount: shelter.currentOccupancy, newCount: newOccupancy, updatedById: officerId } }),
  ]);
}

/** Deletes an empty shelter. Occupied shelters must be cleared first. */
export async function deleteShelter(id: string) {
  const shelter = await prisma.shelter.findUnique({ where: { id } });
  if (!shelter) throw { code: 'NOT_FOUND', message: 'Shelter not found', status: 404 };
  if (shelter.currentOccupancy > 0) {
    throw { code: 'SHELTER_NOT_EMPTY', message: 'Shelter cannot be deleted while people are staying there. Update occupancy to zero first.', status: 409 };
  }
  return prisma.shelter.delete({ where: { id } });
}

/**
 * @description Computes an aggregated summary of all currently active shelters
 * (those with status `OPEN` or `FULL`). Useful for dashboard widgets and
 * high-level capacity planning during a disaster event.
 *
 * @returns A promise that resolves to a summary object containing:
 * - `totalCapacity` – Sum of `capacity` across all active shelters.
 * - `totalOccupancy` – Sum of `currentOccupancy` across all active shelters.
 * - `availableSpots` – Remaining capacity (`totalCapacity - totalOccupancy`).
 * - `shelterCount` – Number of active shelters included in the calculation.
 *
 * @throws {PrismaClientKnownRequestError} If the database query fails.
 */
export async function getSheltersSummary() {
  const shelters = await prisma.shelter.findMany({ where: { status: { in: ['OPEN', 'FULL'] } } });
  const totalCapacity = shelters.reduce((s, sh) => s + sh.capacity, 0);
  const totalOccupancy = shelters.reduce((s, sh) => s + sh.currentOccupancy, 0);
  return { totalCapacity, totalOccupancy, availableSpots: totalCapacity - totalOccupancy, shelterCount: shelters.length };
}
