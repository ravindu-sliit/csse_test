// ─── Module mocks (must come before any imports of the mocked modules) ──────────
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../config/database', () => ({
  prisma: require('../mocks/prisma.mock').mockPrisma,
}));

// ─── Imports ─────────────────────────────────────────────────────────────────────

import { ShelterStatus } from '@prisma/client';
import { mockPrisma, resetMockPrisma } from '../mocks/prisma.mock';
import * as shelterService from '../../services/shelter.service';

// ─── Shared fixtures ─────────────────────────────────────────────────────────────

const OFFICER_ID = 'officer-uuid-1';

const CREATE_DTO = {
  name: 'Colombo Relief Centre',
  address: '12 Galle Road, Colombo 03',
  district: 'Colombo',
  capacity: 100,
  contactNumber: '0112345678',
  amenities: ['water', 'food', 'medical'],
};

const DB_SHELTER = {
  id: 'shelter-uuid-1',
  name: 'Colombo Relief Centre',
  address: '12 Galle Road, Colombo 03',
  district: 'Colombo',
  capacity: 100,
  currentOccupancy: 0,
  status: ShelterStatus.OPEN,
  contactNumber: '0112345678',
  amenities: ['water', 'food', 'medical'],
  registeredById: OFFICER_ID,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

const DB_SHELTER_WITH_LOGS = {
  ...DB_SHELTER,
  occupancyLogs: [
    {
      id: 'log-uuid-1',
      shelterId: 'shelter-uuid-1',
      previousCount: 0,
      newCount: 20,
      updatedById: OFFICER_ID,
      updatedAt: new Date('2024-01-02T00:00:00Z'),
    },
  ],
};

// ─── Setup / teardown ────────────────────────────────────────────────────────────

beforeEach(() => {
  resetMockPrisma();
});

// ─── createShelter() ─────────────────────────────────────────────────────────────

describe('createShelter()', () => {
  describe('successful creation', () => {
    it('creates a shelter with all provided fields', async () => {
      mockPrisma.shelter.create.mockResolvedValue(DB_SHELTER);

      const result = await shelterService.createShelter(CREATE_DTO, OFFICER_ID);

      expect(mockPrisma.shelter.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.shelter.create).toHaveBeenCalledWith({
        data: {
          ...CREATE_DTO,
          registeredById: OFFICER_ID,
          status: ShelterStatus.OPEN,
        },
      });
      expect(result).toEqual(DB_SHELTER);
    });

    it('sets status to OPEN by default', async () => {
      const openShelter = { ...DB_SHELTER, status: ShelterStatus.OPEN };
      mockPrisma.shelter.create.mockResolvedValue(openShelter);

      const result = await shelterService.createShelter(CREATE_DTO, OFFICER_ID);

      const callData = mockPrisma.shelter.create.mock.calls[0][0].data;
      expect(callData.status).toBe(ShelterStatus.OPEN);
      expect(result.status).toBe(ShelterStatus.OPEN);
    });

    it('includes registeredById from the officer id argument', async () => {
      mockPrisma.shelter.create.mockResolvedValue(DB_SHELTER);

      await shelterService.createShelter(CREATE_DTO, OFFICER_ID);

      const callData = mockPrisma.shelter.create.mock.calls[0][0].data;
      expect(callData.registeredById).toBe(OFFICER_ID);
    });

    it('works without an optional contactNumber', async () => {
      const dtoWithoutContact = { ...CREATE_DTO };
      delete (dtoWithoutContact as Partial<typeof CREATE_DTO>).contactNumber;
      const shelterWithoutContact = { ...DB_SHELTER, contactNumber: null };
      mockPrisma.shelter.create.mockResolvedValue(shelterWithoutContact);

      const result = await shelterService.createShelter(dtoWithoutContact as typeof CREATE_DTO, OFFICER_ID);

      expect(result).toEqual(shelterWithoutContact);
    });
  });
});

// ─── listShelters() ──────────────────────────────────────────────────────────────

describe('listShelters()', () => {
  const SHELTER_LIST = [DB_SHELTER];

  describe('pagination', () => {
    it('uses default page=1 and limit=50 when no params provided', async () => {
      mockPrisma.shelter.findMany.mockResolvedValue(SHELTER_LIST);
      mockPrisma.shelter.count.mockResolvedValue(1);

      const result = await shelterService.listShelters({});

      expect(mockPrisma.shelter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 50 }),
      );
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 50, totalPages: 1 });
    });

    it('calculates skip correctly for page 2 with limit 10', async () => {
      mockPrisma.shelter.findMany.mockResolvedValue(SHELTER_LIST);
      mockPrisma.shelter.count.mockResolvedValue(25);

      const result = await shelterService.listShelters({ page: 2, limit: 10 });

      expect(mockPrisma.shelter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
      expect(result.meta).toEqual({ total: 25, page: 2, limit: 10, totalPages: 3 });
    });

    it('returns totalPages rounded up (ceiling division)', async () => {
      mockPrisma.shelter.findMany.mockResolvedValue(SHELTER_LIST);
      mockPrisma.shelter.count.mockResolvedValue(11);

      const result = await shelterService.listShelters({ page: 1, limit: 10 });

      expect(result.meta.totalPages).toBe(2);
    });

    it('returns both shelters list and meta object', async () => {
      mockPrisma.shelter.findMany.mockResolvedValue(SHELTER_LIST);
      mockPrisma.shelter.count.mockResolvedValue(1);

      const result = await shelterService.listShelters({});

      expect(result).toHaveProperty('shelters');
      expect(result).toHaveProperty('meta');
      expect(result.shelters).toEqual(SHELTER_LIST);
    });

    it('orders results by name ascending', async () => {
      mockPrisma.shelter.findMany.mockResolvedValue(SHELTER_LIST);
      mockPrisma.shelter.count.mockResolvedValue(1);

      await shelterService.listShelters({});

      expect(mockPrisma.shelter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { name: 'asc' } }),
      );
    });
  });

  describe('district filter', () => {
    it('passes district to where clause when provided', async () => {
      mockPrisma.shelter.findMany.mockResolvedValue([]);
      mockPrisma.shelter.count.mockResolvedValue(0);

      await shelterService.listShelters({ district: 'Galle' });

      expect(mockPrisma.shelter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ district: 'Galle' }) }),
      );
      expect(mockPrisma.shelter.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ district: 'Galle' }) }),
      );
    });

    it('omits district from where clause when not provided', async () => {
      mockPrisma.shelter.findMany.mockResolvedValue([]);
      mockPrisma.shelter.count.mockResolvedValue(0);

      await shelterService.listShelters({});

      const whereArg = mockPrisma.shelter.findMany.mock.calls[0][0].where;
      expect(whereArg).not.toHaveProperty('district');
    });
  });

  describe('status filter', () => {
    it('converts status to uppercase before passing to where clause', async () => {
      mockPrisma.shelter.findMany.mockResolvedValue([]);
      mockPrisma.shelter.count.mockResolvedValue(0);

      await shelterService.listShelters({ status: 'open' });

      expect(mockPrisma.shelter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'OPEN' }) }),
      );
    });

    it('applies uppercase status filter when status is already uppercase', async () => {
      mockPrisma.shelter.findMany.mockResolvedValue([]);
      mockPrisma.shelter.count.mockResolvedValue(0);

      await shelterService.listShelters({ status: 'FULL' });

      expect(mockPrisma.shelter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'FULL' }) }),
      );
    });

    it('omits status from where clause when not provided', async () => {
      mockPrisma.shelter.findMany.mockResolvedValue([]);
      mockPrisma.shelter.count.mockResolvedValue(0);

      await shelterService.listShelters({});

      const whereArg = mockPrisma.shelter.findMany.mock.calls[0][0].where;
      expect(whereArg).not.toHaveProperty('status');
    });
  });

  describe('combined filters', () => {
    it('applies both district and status filters simultaneously', async () => {
      mockPrisma.shelter.findMany.mockResolvedValue([]);
      mockPrisma.shelter.count.mockResolvedValue(0);

      await shelterService.listShelters({ district: 'Kandy', status: 'full' });

      expect(mockPrisma.shelter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { district: 'Kandy', status: 'FULL' },
        }),
      );
    });
  });
});

// ─── getShelterById() ────────────────────────────────────────────────────────────

describe('getShelterById()', () => {
  describe('when the shelter exists', () => {
    it('returns the shelter with occupancyLogs included', async () => {
      mockPrisma.shelter.findUnique.mockResolvedValue(DB_SHELTER_WITH_LOGS);

      const result = await shelterService.getShelterById('shelter-uuid-1');

      expect(result).toEqual(DB_SHELTER_WITH_LOGS);
      expect(result?.occupancyLogs).toHaveLength(1);
    });

    it('queries by the provided id', async () => {
      mockPrisma.shelter.findUnique.mockResolvedValue(DB_SHELTER_WITH_LOGS);

      await shelterService.getShelterById('shelter-uuid-1');

      expect(mockPrisma.shelter.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'shelter-uuid-1' } }),
      );
    });

    it('includes occupancyLogs ordered by updatedAt descending and limited to 10', async () => {
      mockPrisma.shelter.findUnique.mockResolvedValue(DB_SHELTER_WITH_LOGS);

      await shelterService.getShelterById('shelter-uuid-1');

      expect(mockPrisma.shelter.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            occupancyLogs: {
              orderBy: { updatedAt: 'desc' },
              take: 10,
            },
          },
        }),
      );
    });
  });

  describe('when the shelter does not exist', () => {
    it('returns null', async () => {
      mockPrisma.shelter.findUnique.mockResolvedValue(null);

      const result = await shelterService.getShelterById('nonexistent-id');

      expect(result).toBeNull();
    });
  });
});

// ─── updateOccupancy() ───────────────────────────────────────────────────────────

describe('updateOccupancy()', () => {
  const OCCUPANCY_LOG = {
    id: 'log-uuid-2',
    shelterId: 'shelter-uuid-1',
    previousCount: 0,
    newCount: 40,
    updatedById: OFFICER_ID,
    updatedAt: new Date('2024-01-03T00:00:00Z'),
  };

  describe('successful update', () => {
    it('updates occupancy and creates a log entry via $transaction', async () => {
      const updatedShelter = { ...DB_SHELTER, currentOccupancy: 40, status: ShelterStatus.OPEN };
      mockPrisma.shelter.findUnique.mockResolvedValue(DB_SHELTER);
      mockPrisma.shelter.update.mockResolvedValue(updatedShelter);
      mockPrisma.shelterOccupancyLog.create.mockResolvedValue(OCCUPANCY_LOG);
      mockPrisma.$transaction.mockResolvedValue([updatedShelter, OCCUPANCY_LOG]);

      const result = await shelterService.updateOccupancy('shelter-uuid-1', 40, OFFICER_ID);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result).toEqual([updatedShelter, OCCUPANCY_LOG]);
    });

    it('passes the correct shelter update args inside the transaction', async () => {
      const updatedShelter = { ...DB_SHELTER, currentOccupancy: 40, status: ShelterStatus.OPEN };
      mockPrisma.shelter.findUnique.mockResolvedValue(DB_SHELTER);
      mockPrisma.shelter.update.mockResolvedValue(updatedShelter);
      mockPrisma.shelterOccupancyLog.create.mockResolvedValue(OCCUPANCY_LOG);
      mockPrisma.$transaction.mockResolvedValue([updatedShelter, OCCUPANCY_LOG]);

      await shelterService.updateOccupancy('shelter-uuid-1', 40, OFFICER_ID);

      const txArgs = mockPrisma.$transaction.mock.calls[0][0];
      // The transaction receives an array of two Prisma operation promises
      expect(Array.isArray(txArgs)).toBe(true);
      expect(txArgs).toHaveLength(2);
    });

    it('looks up the shelter before performing the transaction', async () => {
      const updatedShelter = { ...DB_SHELTER, currentOccupancy: 40, status: ShelterStatus.OPEN };
      mockPrisma.shelter.findUnique.mockResolvedValue(DB_SHELTER);
      mockPrisma.$transaction.mockResolvedValue([updatedShelter, OCCUPANCY_LOG]);

      await shelterService.updateOccupancy('shelter-uuid-1', 40, OFFICER_ID);

      expect(mockPrisma.shelter.findUnique).toHaveBeenCalledWith({ where: { id: 'shelter-uuid-1' } });
    });
  });

  describe('status transitions', () => {
    it('sets status to FULL when new occupancy equals capacity', async () => {
      const fullShelter = { ...DB_SHELTER, currentOccupancy: 100, status: ShelterStatus.FULL };
      mockPrisma.shelter.findUnique.mockResolvedValue(DB_SHELTER); // capacity = 100
      mockPrisma.$transaction.mockResolvedValue([fullShelter, OCCUPANCY_LOG]);

      await shelterService.updateOccupancy('shelter-uuid-1', 100, OFFICER_ID);

      // Verify shelter.update was called with FULL status
      expect(mockPrisma.shelter.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currentOccupancy: 100,
            status: ShelterStatus.FULL,
          }),
        }),
      );
    });

    it('sets status to OPEN when new occupancy is below capacity', async () => {
      const openShelter = { ...DB_SHELTER, currentOccupancy: 50, status: ShelterStatus.OPEN };
      mockPrisma.shelter.findUnique.mockResolvedValue(DB_SHELTER); // capacity = 100
      mockPrisma.$transaction.mockResolvedValue([openShelter, OCCUPANCY_LOG]);

      await shelterService.updateOccupancy('shelter-uuid-1', 50, OFFICER_ID);

      expect(mockPrisma.shelter.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currentOccupancy: 50,
            status: ShelterStatus.OPEN,
          }),
        }),
      );
    });

    it('returns to OPEN status when occupancy drops from FULL to below capacity', async () => {
      const fullShelter = { ...DB_SHELTER, currentOccupancy: 100, status: ShelterStatus.FULL };
      const openShelter = { ...DB_SHELTER, currentOccupancy: 80, status: ShelterStatus.OPEN };
      mockPrisma.shelter.findUnique.mockResolvedValue(fullShelter);
      mockPrisma.$transaction.mockResolvedValue([openShelter, OCCUPANCY_LOG]);

      await shelterService.updateOccupancy('shelter-uuid-1', 80, OFFICER_ID);

      expect(mockPrisma.shelter.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: ShelterStatus.OPEN }),
        }),
      );
    });
  });

  describe('capacity exceeded error', () => {
    it('throws SHELTER_CAPACITY_EXCEEDED when new occupancy exceeds capacity', async () => {
      mockPrisma.shelter.findUnique.mockResolvedValue(DB_SHELTER); // capacity = 100

      await expect(
        shelterService.updateOccupancy('shelter-uuid-1', 101, OFFICER_ID),
      ).rejects.toMatchObject({
        code: 'SHELTER_CAPACITY_EXCEEDED',
        status: 409,
      });
    });

    it('includes the field "newOccupancy" in the capacity exceeded error', async () => {
      mockPrisma.shelter.findUnique.mockResolvedValue(DB_SHELTER);

      await expect(
        shelterService.updateOccupancy('shelter-uuid-1', 200, OFFICER_ID),
      ).rejects.toMatchObject({ field: 'newOccupancy' });
    });

    it('does not call $transaction when capacity is exceeded', async () => {
      mockPrisma.shelter.findUnique.mockResolvedValue(DB_SHELTER);

      await expect(
        shelterService.updateOccupancy('shelter-uuid-1', 101, OFFICER_ID),
      ).rejects.toBeDefined();

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('shelter not found error', () => {
    it('throws NOT_FOUND when the shelter does not exist', async () => {
      mockPrisma.shelter.findUnique.mockResolvedValue(null);

      await expect(
        shelterService.updateOccupancy('nonexistent-id', 10, OFFICER_ID),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
        status: 404,
      });
    });

    it('does not call $transaction when shelter is not found', async () => {
      mockPrisma.shelter.findUnique.mockResolvedValue(null);

      await expect(
        shelterService.updateOccupancy('nonexistent-id', 10, OFFICER_ID),
      ).rejects.toBeDefined();

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('$transaction usage', () => {
    it('returns an array of [updatedShelter, occupancyLog]', async () => {
      const updatedShelter = { ...DB_SHELTER, currentOccupancy: 30, status: ShelterStatus.OPEN };
      const log = { ...OCCUPANCY_LOG, newCount: 30 };
      mockPrisma.shelter.findUnique.mockResolvedValue(DB_SHELTER);
      mockPrisma.$transaction.mockResolvedValue([updatedShelter, log]);

      const result = await shelterService.updateOccupancy('shelter-uuid-1', 30, OFFICER_ID);

      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toEqual(updatedShelter);
      expect(result[1]).toEqual(log);
    });

    it('passes previous occupancy count to the log entry', async () => {
      const shelterAt20 = { ...DB_SHELTER, currentOccupancy: 20 };
      const updatedShelter = { ...shelterAt20, currentOccupancy: 50 };
      const log = { ...OCCUPANCY_LOG, previousCount: 20, newCount: 50 };
      mockPrisma.shelter.findUnique.mockResolvedValue(shelterAt20);
      mockPrisma.$transaction.mockResolvedValue([updatedShelter, log]);

      await shelterService.updateOccupancy('shelter-uuid-1', 50, OFFICER_ID);

      expect(mockPrisma.shelterOccupancyLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shelterId: 'shelter-uuid-1',
            previousCount: 20,
            newCount: 50,
            updatedById: OFFICER_ID,
          }),
        }),
      );
    });
  });
});

// ─── getSheltersSummary() ────────────────────────────────────────────────────────

describe('getSheltersSummary()', () => {
  describe('aggregation of shelter metrics', () => {
    it('returns totalCapacity summed across all active shelters', async () => {
      const shelters = [
        { ...DB_SHELTER, id: 's1', capacity: 100, currentOccupancy: 60, status: ShelterStatus.OPEN },
        { ...DB_SHELTER, id: 's2', capacity: 200, currentOccupancy: 150, status: ShelterStatus.FULL },
      ];
      mockPrisma.shelter.findMany.mockResolvedValue(shelters);

      const result = await shelterService.getSheltersSummary();

      expect(result.totalCapacity).toBe(300);
    });

    it('returns totalOccupancy summed across all active shelters', async () => {
      const shelters = [
        { ...DB_SHELTER, id: 's1', capacity: 100, currentOccupancy: 60, status: ShelterStatus.OPEN },
        { ...DB_SHELTER, id: 's2', capacity: 200, currentOccupancy: 150, status: ShelterStatus.FULL },
      ];
      mockPrisma.shelter.findMany.mockResolvedValue(shelters);

      const result = await shelterService.getSheltersSummary();

      expect(result.totalOccupancy).toBe(210);
    });

    it('returns availableSpots as totalCapacity minus totalOccupancy', async () => {
      const shelters = [
        { ...DB_SHELTER, id: 's1', capacity: 100, currentOccupancy: 60, status: ShelterStatus.OPEN },
        { ...DB_SHELTER, id: 's2', capacity: 200, currentOccupancy: 150, status: ShelterStatus.FULL },
      ];
      mockPrisma.shelter.findMany.mockResolvedValue(shelters);

      const result = await shelterService.getSheltersSummary();

      expect(result.availableSpots).toBe(90);
    });

    it('returns shelterCount equal to the number of active shelters', async () => {
      const shelters = [
        { ...DB_SHELTER, id: 's1', status: ShelterStatus.OPEN },
        { ...DB_SHELTER, id: 's2', status: ShelterStatus.FULL },
        { ...DB_SHELTER, id: 's3', status: ShelterStatus.OPEN },
      ];
      mockPrisma.shelter.findMany.mockResolvedValue(shelters);

      const result = await shelterService.getSheltersSummary();

      expect(result.shelterCount).toBe(3);
    });

    it('queries only shelters with status OPEN or FULL', async () => {
      mockPrisma.shelter.findMany.mockResolvedValue([]);

      await shelterService.getSheltersSummary();

      expect(mockPrisma.shelter.findMany).toHaveBeenCalledWith({
        where: { status: { in: ['OPEN', 'FULL'] } },
      });
    });
  });

  describe('edge cases', () => {
    it('returns all zeros when there are no active shelters', async () => {
      mockPrisma.shelter.findMany.mockResolvedValue([]);

      const result = await shelterService.getSheltersSummary();

      expect(result).toEqual({
        totalCapacity: 0,
        totalOccupancy: 0,
        availableSpots: 0,
        shelterCount: 0,
      });
    });

    it('returns zero availableSpots when all shelters are at capacity', async () => {
      const shelters = [
        { ...DB_SHELTER, id: 's1', capacity: 50, currentOccupancy: 50, status: ShelterStatus.FULL },
        { ...DB_SHELTER, id: 's2', capacity: 75, currentOccupancy: 75, status: ShelterStatus.FULL },
      ];
      mockPrisma.shelter.findMany.mockResolvedValue(shelters);

      const result = await shelterService.getSheltersSummary();

      expect(result.availableSpots).toBe(0);
      expect(result.totalCapacity).toBe(125);
      expect(result.totalOccupancy).toBe(125);
    });

    it('handles a single shelter correctly', async () => {
      mockPrisma.shelter.findMany.mockResolvedValue([
        { ...DB_SHELTER, capacity: 80, currentOccupancy: 25, status: ShelterStatus.OPEN },
      ]);

      const result = await shelterService.getSheltersSummary();

      expect(result).toEqual({
        totalCapacity: 80,
        totalOccupancy: 25,
        availableSpots: 55,
        shelterCount: 1,
      });
    });
  });
});
