/**
 * @file supply.service.ts
 * @description Service layer for managing relief supplies and supply dispatches.
 * Provides functions for listing, creating, and tracking supplies as well as
 * dispatching them to shelters or destinations. Handles inventory deductions
 * atomically to prevent over-dispatching.
 */

import { prisma } from '../config/database';
import { generateDispatchCode } from '../utils/codeGenerator';

/**
 * @description Retrieves all relief supplies, optionally filtered by category and/or status.
 * Results are ordered alphabetically by category.
 *
 * @param {Object} params - Filter parameters.
 * @param {string} [params.category] - Optional category to filter supplies by (e.g. "FOOD", "MEDICINE").
 * @param {string} [params.status] - Optional status to filter supplies by (e.g. "AVAILABLE", "DEPLETED").
 * @returns {Promise<ReliefSupply[]>} A promise resolving to an array of matching relief supply records.
 * @throws {PrismaClientKnownRequestError} If the database query fails.
 */
export async function listSupplies(params: { category?: string; status?: string }) {
  const where: Record<string, unknown> = {};
  if (params.category) where.category = params.category;
  if (params.status) where.status = params.status;
  return prisma.reliefSupply.findMany({ where, orderBy: { category: 'asc' } });
}

/**
 * @description Creates a new relief supply record in the database.
 * The supply is associated with an optional organization and recorded by
 * the specified officer, though the officerId is not persisted to the record.
 *
 * @param {Object} dto - Data transfer object containing supply details.
 * @param {string} dto.name - Human-readable name of the supply item.
 * @param {string} dto.category - Category of the supply (e.g. "FOOD", "MEDICINE", "SHELTER").
 * @param {number} dto.quantity - Initial quantity in stock.
 * @param {string} dto.unit - Unit of measurement (e.g. "kg", "units", "litres").
 * @param {string} dto.location - Physical location where the supply is stored.
 * @param {string} [dto.organizationId] - Optional ID of the organization owning this supply.
 * @param {string} officerId - ID of the officer creating the supply record (for audit purposes).
 * @returns {Promise<ReliefSupply>} A promise resolving to the newly created relief supply record.
 * @throws {PrismaClientKnownRequestError} If a database constraint is violated or the query fails.
 */
export async function createSupply(dto: { name: string; category: string; quantity: number; unit: string; location: string; organizationId?: string }, officerId: string) {
  return prisma.reliefSupply.create({ data: dto });
}

/**
 * @description Retrieves a paginated list of supply dispatches, optionally filtered
 * by destination shelter and/or transit status. Each dispatch includes basic info
 * about the associated supply (name and category).
 *
 * @param {Object} params - Query and pagination parameters.
 * @param {string} [params.shelterId] - Optional shelter ID to filter dispatches by destination.
 * @param {string} [params.transitStatus] - Optional transit status to filter by (e.g. "IN_TRANSIT", "DELIVERED").
 *   The value is coerced to uppercase before querying.
 * @param {number} [params.page=1] - Page number for pagination (1-indexed).
 * @param {number} [params.limit=20] - Maximum number of records to return per page.
 * @returns {Promise<{ dispatches: SupplyDispatch[], meta: { total: number, page: number, limit: number, totalPages: number } }>}
 *   A promise resolving to an object containing the paginated dispatch records and pagination metadata.
 * @throws {PrismaClientKnownRequestError} If the database query fails.
 */
export async function listSupplyDispatches(params: { shelterId?: string; transitStatus?: string; page?: number; limit?: number }) {
  const page = params.page || 1;
  const limit = params.limit || 20;
  const where: Record<string, unknown> = {};
  if (params.shelterId) where.shelterId = params.shelterId;
  if (params.transitStatus) where.transitStatus = params.transitStatus.toUpperCase();

  const [dispatches, total] = await Promise.all([
    prisma.supplyDispatch.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { dispatchedAt: 'desc' },
      include: { supply: { select: { name: true, category: true } } },
    }),
    prisma.supplyDispatch.count({ where }),
  ]);
  return { dispatches, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}

/**
 * @description Creates a new supply dispatch, deducting the requested quantity from the
 * supply's current stock atomically within a database transaction. A unique dispatch
 * code is generated for tracking purposes.
 *
 * @param {Object} dto - Data transfer object containing dispatch details.
 * @param {string} dto.supplyId - ID of the relief supply to dispatch.
 * @param {string} [dto.shelterId] - Optional ID of the destination shelter.
 * @param {string} dto.destinationLabel - Human-readable label for the dispatch destination.
 * @param {number} dto.quantity - Quantity of the supply to dispatch. Must not exceed available stock.
 * @param {string} dto.unit - Unit of measurement for the dispatched quantity.
 * @param {string} officerId - ID of the officer authorising and creating the dispatch.
 * @returns {Promise<SupplyDispatch>} A promise resolving to the newly created dispatch record.
 * @throws {{ code: 'NOT_FOUND', message: string, status: 404 }} If no supply exists with the given `supplyId`.
 * @throws {{ code: 'INSUFFICIENT_SUPPLY', message: string, status: 400 }} If the requested quantity
 *   exceeds the supply's available stock.
 * @throws {PrismaClientKnownRequestError} If the database transaction fails.
 */
export async function createDispatch(dto: { supplyId: string; shelterId?: string; destinationLabel: string; quantity: number; unit: string }, officerId: string) {
  const supply = await prisma.reliefSupply.findUnique({ where: { id: dto.supplyId } });
  if (!supply) throw { code: 'NOT_FOUND', message: 'Supply not found', status: 404 };
  if (supply.quantity < dto.quantity) {
    throw { code: 'INSUFFICIENT_SUPPLY', message: `Only ${supply.quantity} ${supply.unit} available. You requested ${dto.quantity}.`, status: 400 };
  }
  const count = await prisma.supplyDispatch.count();
  const dispatchCode = generateDispatchCode(count + 1);
  const [dispatch] = await prisma.$transaction([
    prisma.supplyDispatch.create({ data: { dispatchCode, supplyId: dto.supplyId, shelterId: dto.shelterId, destinationLabel: dto.destinationLabel, quantity: dto.quantity, unit: dto.unit, dispatchedById: officerId } }),
    prisma.reliefSupply.update({ where: { id: dto.supplyId }, data: { quantity: { decrement: dto.quantity } } }),
  ]);
  return dispatch;
}

/**
 * @description Updates the transit status of an existing supply dispatch. If the new
 * status is `"DELIVERED"`, the `deliveredAt` timestamp is automatically set to the
 * current date and time. Status values are coerced to uppercase before being persisted.
 *
 * @param {string} id - The unique ID of the supply dispatch to update.
 * @param {string} transitStatus - The new transit status (e.g. "IN_TRANSIT", "DELIVERED", "CANCELLED").
 *   Coerced to uppercase automatically.
 * @returns {Promise<SupplyDispatch>} A promise resolving to the updated dispatch record.
 * @throws {{ code: 'NOT_FOUND', message: string, status: 404 }} If no dispatch exists with the given `id`.
 * @throws {PrismaClientKnownRequestError} If the database update fails.
 */
export async function updateTransitStatus(id: string, transitStatus: string) {
  const dispatch = await prisma.supplyDispatch.findUnique({ where: { id } });
  if (!dispatch) throw { code: 'NOT_FOUND', message: 'Dispatch not found', status: 404 };
  return prisma.supplyDispatch.update({
    where: { id },
    data: { transitStatus: transitStatus.toUpperCase() as any, deliveredAt: transitStatus.toUpperCase() === 'DELIVERED' ? new Date() : undefined },
  });
}
