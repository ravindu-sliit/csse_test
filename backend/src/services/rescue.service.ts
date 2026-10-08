/**
 * @file rescue.service.ts
 * @description Service layer for rescue team management and coordination operations.
 *
 * Provides business logic for listing rescue teams, dispatching them to disaster sites,
 * updating dispatch statuses, and generating coordination summaries for DMC officers.
 * All database interactions are performed via Prisma within transactions where data
 * consistency is required.
 *
 * @solid
 * - SRP: This service ONLY handles rescue team and dispatch operations.
 *        Shelter and supply logic are in separate services.
 * - OCP: New team statuses can be added to RescueTeamStatus enum without modifying dispatch logic.
 * - LSP: All errors follow { code, message, status } contract for consistent error handling.
 * - DIP: Controllers call this service, not Prisma directly.
 */

import { prisma } from '../config/database';
import { RescueTeamStatus } from '@prisma/client';

/**
 * @description Retrieves a list of rescue teams, optionally filtered by district and/or status.
 * Results are returned in ascending order by team code.
 *
 * @param params - Filter parameters for the query.
 * @param params.district - Optional district name to filter teams by their assigned district.
 * @param params.status - Optional status string (case-insensitive) to filter teams by their
 *   current operational status (e.g. `"available"`, `"dispatched"`, `"on_mission"`).
 *
 * @returns A promise that resolves to an array of `RescueTeam` records ordered by `teamCode`.
 *   Returns an empty array if no teams match the given filters.
 *
 * @throws {PrismaClientKnownRequestError} If a database error occurs during the query.
 *
 * @example
 * // Fetch all available teams in the Western Province
 * const teams = await listTeams({ district: 'Western', status: 'available' });
 */
export async function listTeams(params: { district?: string; status?: string }) {
  const where: Record<string, unknown> = {};
  if (params.district) where.district = params.district;
  if (params.status) where.status = params.status.toUpperCase();
  return prisma.rescueTeam.findMany({ where, orderBy: { teamCode: 'asc' } });
}

/**
 * @description Dispatches a rescue team to a target district by creating a new
 * `RescueDispatch` record and atomically updating the team's status to `DISPATCHED`.
 *
 * Both the dispatch creation and the team status update are executed inside a single
 * Prisma transaction to guarantee consistency — either both succeed or neither is applied.
 *
 * @param dto - Data transfer object containing dispatch details.
 * @param dto.teamId - The unique identifier of the rescue team to dispatch.
 * @param dto.targetDistrict - The name of the district to which the team is being sent.
 * @param dto.missionDetails - Optional free-text description of the mission objectives.
 * @param dto.criticality - Criticality level of the mission (e.g. `"LOW"`, `"MEDIUM"`, `"HIGH"`, `"CRITICAL"`).
 * @param dto.gearChecklist - List of gear/equipment items confirmed for the mission.
 * @param officerId - The ID of the DMC officer authorising and recording the dispatch.
 *
 * @returns A promise that resolves to the newly created `RescueDispatch` record.
 *
 * @throws {{ code: 'NOT_FOUND', message: string, status: 404 }}
 *   If no rescue team with the given `teamId` exists in the database.
 * @throws {{ code: 'TEAM_UNAVAILABLE', message: string, status: 409 }}
 *   If the team exists but its current status is not `AVAILABLE` (e.g. already dispatched
 *   or on a mission).
 * @throws {PrismaClientKnownRequestError} If a database or transaction error occurs.
 *
 * @example
 * const dispatch = await dispatchTeam(
 *   {
 *     teamId: 'clxyz123',
 *     targetDistrict: 'Colombo',
 *     missionDetails: 'Flood rescue near Kelani river',
 *     criticality: 'HIGH',
 *     gearChecklist: ['life_jackets', 'first_aid_kit', 'rope'],
 *   },
 *   officerUserId,
 * );
 */
export async function dispatchTeam(dto: { teamId: string; targetDistrict: string; missionDetails?: string; criticality: string; gearChecklist: string[] }, officerId: string) {
  const team = await prisma.rescueTeam.findUnique({ where: { id: dto.teamId } });
  if (!team) throw { code: 'NOT_FOUND', message: 'Rescue team not found', status: 404 };
  if (team.status !== RescueTeamStatus.AVAILABLE) {
    throw { code: 'TEAM_UNAVAILABLE', message: `${team.teamCode} is currently ${team.status.toLowerCase()}. Select an available team.`, status: 409 };
  }
  const [dispatch] = await prisma.$transaction([
    prisma.rescueDispatch.create({ data: { teamId: dto.teamId, targetDistrict: dto.targetDistrict, missionDetails: dto.missionDetails, criticality: dto.criticality as any, gearChecklist: dto.gearChecklist, dispatchedById: officerId } }),
    prisma.rescueTeam.update({ where: { id: dto.teamId }, data: { status: RescueTeamStatus.DISPATCHED } }),
  ]);
  return dispatch;
}

/**
 * @description Updates the status of an existing rescue dispatch record and synchronises
 * the parent rescue team's status accordingly.
 *
 * The mapping from dispatch status to team status is:
 * - `"dispatched"`  → `DISPATCHED`
 * - `"on_mission"`  → `ON_MISSION`
 * - `"returning"`   → `RETURNING`
 * - `"completed"`   → `AVAILABLE` (team is freed up for future deployments)
 * - Any other value → `AVAILABLE` (fallback)
 *
 * Both updates are executed inside a single Prisma transaction.
 *
 * @param id - The unique identifier of the `RescueDispatch` record to update.
 * @param status - The new dispatch status string (case-insensitive).
 *   Accepted values: `"dispatched"`, `"on_mission"`, `"returning"`, `"completed"`.
 *
 * @returns A promise that resolves to a tuple `[updatedDispatch, updatedTeam]` containing
 *   the updated `RescueDispatch` and `RescueTeam` records produced by the transaction.
 *
 * @throws {{ code: 'NOT_FOUND', message: string, status: 404 }}
 *   If no dispatch record with the given `id` exists.
 * @throws {PrismaClientKnownRequestError} If a database or transaction error occurs.
 *
 * @example
 * // Mark a dispatch as completed, freeing the team for new assignments
 * const [dispatch, team] = await updateDispatchStatus('clxyz456', 'completed');
 */
export async function updateDispatchStatus(id: string, status: string) {
  // Map dispatch status to team status
  const teamStatusMap: Record<string, RescueTeamStatus> = {
    dispatched: RescueTeamStatus.DISPATCHED,
    on_mission: RescueTeamStatus.ON_MISSION,
    returning: RescueTeamStatus.RETURNING,
    completed: RescueTeamStatus.AVAILABLE,
  };
  const dispatch = await prisma.rescueDispatch.findUnique({ where: { id } });
  if (!dispatch) throw { code: 'NOT_FOUND', message: 'Dispatch not found', status: 404 };
  const newTeamStatus = teamStatusMap[status.toLowerCase()] || RescueTeamStatus.AVAILABLE;
  return prisma.$transaction([
    prisma.rescueDispatch.update({ where: { id }, data: { status } }),
    prisma.rescueTeam.update({ where: { id: dispatch.teamId }, data: { status: newTeamStatus } }),
  ]);
}

/**
 * @description Generates an aggregated coordination summary for the disaster management
 * dashboard, optionally scoped to a specific district.
 *
 * The summary includes:
 * - Number of rescue teams currently deployed (statuses: `DISPATCHED`, `EN_ROUTE`, `ON_MISSION`).
 * - Total number of rescue teams registered (in the given district, if specified).
 * - Number of active shelters (statuses: `OPEN` or `FULL`).
 * - Number of available relief supply hubs (status: `available`).
 *
 * All four counts are fetched in parallel via `Promise.all` to minimise latency.
 *
 * @param district - Optional district name to scope the summary. When omitted, the summary
 *   covers all districts nationally. Note: supply hub counts are always nationwide regardless
 *   of this parameter.
 *
 * @returns A promise that resolves to a coordination summary object with the shape:
 * ```ts
 * {
 *   teamsDeployed: number;      // Teams currently active in the field
 *   teamsTotal: number;         // Total registered teams (filtered by district if provided)
 *   activeShelters: number;     // Shelters with status OPEN or FULL
 *   supplyHubsActive: number;   // Relief supply records with status 'available'
 * }
 * ```
 *
 * @throws {PrismaClientKnownRequestError} If any of the parallel database queries fail.
 *
 * @example
 * // National summary for the main dashboard
 * const summary = await getCoordinationSummary();
 *
 * // District-level summary for the Galle coordination centre
 * const galleSummary = await getCoordinationSummary('Galle');
 */
export async function getCoordinationSummary(district?: string) {
  const teamWhere: Record<string, unknown> = {};
  const shelterWhere: Record<string, unknown> = {};
  if (district) { teamWhere.district = district; shelterWhere.district = district; }

  const [teamsDeployed, teamsTotal, activeShelters, supplyHubs] = await Promise.all([
    prisma.rescueTeam.count({ where: { ...teamWhere, status: { in: ['DISPATCHED', 'EN_ROUTE', 'ON_MISSION'] } } }),
    prisma.rescueTeam.count({ where: teamWhere }),
    prisma.shelter.count({ where: { ...shelterWhere, status: { in: ['OPEN', 'FULL'] } } }),
    prisma.reliefSupply.count({ where: { status: 'available' } }),
  ]);
  return { teamsDeployed, teamsTotal, activeShelters, supplyHubsActive: supplyHubs };
}

/**
 * @description Gets all dispatch missions for a specific rescue team based on the team leader's user ID.
 * First finds the rescue team by matching the team leader's email pattern, then fetches dispatches.
 *
 * @param userId - The user ID of the rescue team leader
 * @returns Array of dispatch records with team info
 */
export async function getMyMissions(userId: string) {
  // Find the rescue team associated with this user
  // In a real system, there would be a direct relation. For now, we match by district or return all for the user's team
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw { code: 'NOT_FOUND', message: 'User not found', status: 404 };
  
  // Find team by matching email domain or team code pattern
  const team = await prisma.rescueTeam.findFirst({
    where: {
      OR: [
        { teamCode: { contains: user.email.split('@')[0].toUpperCase() } },
        { district: user.district || undefined },
      ],
    },
  });
  
  if (!team) {
    // Return empty if no team found
    return { team: null, missions: [] };
  }
  
  const missions = await prisma.rescueDispatch.findMany({
    where: { teamId: team.id },
    orderBy: { dispatchedAt: 'desc' },
  });
  
  return { team, missions };
}