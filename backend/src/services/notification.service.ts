/**
 * @file notification.service.ts
 * @description Service layer for simulating disaster warning broadcasts across
 * multiple notification channels (SMS, push, TV/radio, coastal sirens).
 * Persists broadcast results and notification logs to the database, and
 * provides utilities for estimating total population reach.
 */

import { prisma } from '../config/database';
import { NotificationChannel } from '@prisma/client';

/**
 * @description Estimated maximum audience reach per notification channel.
 * Values represent the total number of people reachable via each channel
 * in the target region. Used as the baseline for simulating delivery counts.
 *
 * @constant
 * @type {Record<string, number>}
 *
 * @example
 * // SMS_BLAST can theoretically reach 8,200,000 recipients
 * // TV_RADIO has the broadest reach at 12,000,000
 */
const SIMULATED_REACH: Record<string, number> = {
  SMS_BLAST: 8200000,
  PUSH_NOTIFICATION: 1400000,
  TV_RADIO: 12000000,
  COASTAL_SIREN: 500000,
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
 *
 * @returns {Promise<import('@prisma/client').WarningBroadcast[]>} A promise
 *   that resolves to an array of created `WarningBroadcast` records, one per
 *   channel, each containing the estimated reach, confirmed delivery count,
 *   and failed count.
 *
 * @example
 * const broadcasts = await simulateBroadcast(
 *   'clx1abc000001',
 *   ['SMS_BLAST', 'PUSH_NOTIFICATION']
 * );
 * console.log(broadcasts[0].confirmedReach); // e.g. 7,234,000
 */
export async function simulateBroadcast(warningId: string, channels: string[]) {
  const results = [];

  for (const channel of channels) {
    const estimated = SIMULATED_REACH[channel] || 100000;
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
 * set of notification channels by summing each channel's value from
 * `SIMULATED_REACH`. Channels not present in the lookup table contribute 0
 * to the total.
 *
 * @param {string[]} channels - An array of channel identifiers whose reach
 *   values should be summed (e.g. `["SMS_BLAST", "TV_RADIO"]`).
 *
 * @returns {number} The total estimated number of people reachable across all
 *   provided channels. Returns `0` if the array is empty or all channels are
 *   unknown.
 *
 * @example
 * const total = calculateTotalReach(['SMS_BLAST', 'TV_RADIO']);
 * console.log(total); // 20,200,000
 *
 * @example
 * // Unknown channel contributes 0
 * const total = calculateTotalReach(['UNKNOWN_CHANNEL']);
 * console.log(total); // 0
 */
export function calculateTotalReach(channels: string[]): number {
  return channels.reduce((sum, ch) => sum + (SIMULATED_REACH[ch] || 0), 0);
}
