/**
 * @file notification.service.ts
 * @description Service layer for simulating disaster warning broadcasts across
 * multiple notification channels (SMS, push, TV/radio, coastal sirens).
 * Persists broadcast results and notification logs to the database, and
 * provides utilities for estimating total population reach.
 *
 * @solid
 * - SRP: This service ONLY handles notification/broadcast concerns.
 *        Warning persistence is handled by warning.service.ts.
 * - OCP: New notification channels can be added to SIMULATED_REACH without code changes.
 *        New districts can be added to DISTRICT_POPULATION without algorithm changes.
 * - DIP: Depends on prisma abstraction, not direct database calls.
 */

import { prisma } from '../config/database';
import { NotificationChannel } from '@prisma/client';

/**
 * @description Estimated maximum audience reach per notification channel.
 * Values represent the *multiplier* applied to the target population to
 * estimate how many people can be reached via each channel. Used together
 * with district population data to produce realistic reach figures.
 *
 * @constant
 * @type {Record<string, number>}
 */
const SIMULATED_REACH: Record<string, number> = {
  SMS_BLAST: 8200000,
  PUSH_NOTIFICATION: 1400000,
  TV_RADIO: 12000000,
  COASTAL_SIREN: 500000,
};

/**
 * @description Approximate populations for each Sri Lankan district.
 * Figures are based on 2012 census data with estimated growth adjustments.
 *
 * @constant
 * @type {Record<string, number>}
 */
const DISTRICT_POPULATION: Record<string, number> = {
  Colombo: 2324349,
  Gampaha: 2304833,
  Kalutara: 1221948,
  Kandy: 1375382,
  Matale: 484531,
  'Nuwara Eliya': 703830,
  Galle: 1063334,
  Matara: 814828,
  Hambantota: 599903,
  Jaffna: 583882,
  Kilinochchi: 116554,
  Mannar: 99081,
  Vavuniya: 172115,
  Mullaitivu: 92238,
  Batticaloa: 526567,
  Ampara: 649402,
  Trincomalee: 379541,
  Kurunegala: 1618465,
  Puttalam: 762396,
  Anuradhapura: 860575,
  Polonnaruwa: 406088,
  Badulla: 815379,
  Monaragala: 451058,
  Ratnapura: 1088007,
  Kegalle: 840648,
};

/**
 * @description Simulates broadcasting a disaster warning across one or more
 * notification channels. For each channel a randomised delivery rate between
 * 87 % and 96 % is applied to the channel's estimated reach, and both a
 * `WarningBroadcast` record and a `NotificationLog` record are persisted to
 * the database.
 *
 * @param {string} warningId - The unique identifier of the disaster warning
 *   being broadcast. Must correspond to an existing `Warning` record.
 * @param {string[]} channels - An array of channel identifiers to broadcast
 *   through (e.g. `["SMS_BLAST", "TV_RADIO"]`). Each value must be a valid
 *   `NotificationChannel` enum member. Unknown channels fall back to an
 *   estimated reach of 100,000.
 * @param {string[]} [targetDistricts] - Optional list of district names used
 *   to scope the broadcast reach to actual local populations. When omitted,
 *   national reach figures are used.
 *
 * @returns {Promise<import('@prisma/client').WarningBroadcast[]>} A promise
 *   that resolves to an array of created `WarningBroadcast` records, one per
 *   channel, each containing the estimated reach, confirmed delivery count,
 *   and failed count.
 *
 * @example
 * const broadcasts = await simulateBroadcast(
 *   'clx1abc000001',
 *   ['SMS_BLAST', 'PUSH_NOTIFICATION'],
 *   ['Colombo', 'Gampaha']
 * );
 * console.log(broadcasts[0].confirmedReach); // proportional to district population
 */
export async function simulateBroadcast(warningId: string, channels: string[], targetDistricts?: string[]) {
  // Calculate population-based reach for targeted districts
  const targetPopulation = targetDistricts && targetDistricts.length > 0
    ? targetDistricts.reduce((s, d) => s + (DISTRICT_POPULATION[d] || 0), 0)
    : Object.values(DISTRICT_POPULATION).reduce((s, p) => s + p, 0);

  const totalNationalPopulation = Object.values(DISTRICT_POPULATION).reduce((s, p) => s + p, 0);
  const populationFraction = totalNationalPopulation > 0 ? targetPopulation / totalNationalPopulation : 1;

  const results = [];

  for (const channel of channels) {
    const nationalReach = SIMULATED_REACH[channel] || 100000;
    const estimated = Math.floor(nationalReach * populationFraction);
    // Simulate ~87-96% delivery rate
    const deliveryRate = 0.87 + Math.random() * 0.09;
    const delivered = Math.floor(estimated * deliveryRate);
    const failed = estimated - delivered;

    // Create broadcast record
    const broadcast = await prisma.warningBroadcast.create({
      data: {
        warningId,
        channel: channel as NotificationChannel,
        status: 'completed',
        estimatedReach: estimated,
        confirmedReach: delivered,
        failedCount: failed,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });

    // Create notification log
    await prisma.notificationLog.create({
      data: {
        warningId,
        channel: channel as NotificationChannel,
        recipientCount: estimated,
        deliveredCount: delivered,
        failedCount: failed,
      },
    });

    results.push(broadcast);
  }

  return results;
}

/**
 * @description Calculates the combined estimated audience reach for a given
 * set of notification channels across the specified target districts.
 *
 * The base population is derived from the sum of each targeted district's
 * population. Each channel then applies its own multiplier relative to the
 * national totals stored in `SIMULATED_REACH`. If no districts are supplied
 * the function falls back to the raw `SIMULATED_REACH` values (national
 * coverage), matching the original behaviour.
 *
 * @param {string[]} channels - Channel identifiers whose reach should be
 *   estimated (e.g. `["SMS_BLAST", "TV_RADIO"]`).
 * @param {string[]} [targetDistricts] - Optional list of district names used
 *   to scope the reach to actual local populations.
 *
 * @returns {number} Total estimated reach across all provided channels and
 *   districts. Returns `0` if both arrays are empty or all channels are
 *   unknown.
 *
 * @example
 * // National fallback (no districts supplied)
 * const total = calculateTotalReach(['SMS_BLAST', 'TV_RADIO']);
 * console.log(total); // 20,200,000
 *
 * @example
 * // District-scoped reach
 * const total = calculateTotalReach(['SMS_BLAST'], ['Colombo', 'Gampaha']);
 * console.log(total); // ~proportional to combined population of those districts
 */
export function calculateTotalReach(channels: string[], targetDistricts?: string[]): number {
  // If no districts provided, fall back to national SIMULATED_REACH totals
  if (!targetDistricts || targetDistricts.length === 0) {
    return channels.reduce((sum, ch) => sum + (SIMULATED_REACH[ch] || 0), 0);
  }

  // Sum the population of the targeted districts
  const totalNationalPopulation = Object.values(DISTRICT_POPULATION).reduce((s, p) => s + p, 0);
  const targetPopulation = targetDistricts.reduce((s, d) => s + (DISTRICT_POPULATION[d] || 0), 0);

  // Calculate the fraction of the national population in targeted districts
  const populationFraction = totalNationalPopulation > 0 ? targetPopulation / totalNationalPopulation : 1;

  // Apply fraction to each channel's national reach estimate
  return channels.reduce((sum, ch) => sum + Math.floor((SIMULATED_REACH[ch] || 0) * populationFraction), 0);
}
