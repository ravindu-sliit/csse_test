// ─── Module mocks (must come before any imports of the mocked modules) ──────────
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../config/database', () => ({
  prisma: require('../mocks/prisma.mock').mockPrisma,
}));

jest.mock('../../utils/codeGenerator', () => ({
  generateDispatchCode: jest.fn().mockReturnValue('TX-0001'),
}));

// ─── Imports ─────────────────────────────────────────────────────────────────────

import { mockPrisma, resetMockPrisma } from '../mocks/prisma.mock';
import { generateDispatchCode } from '../../utils/codeGenerator';
import * as supplyService from '../../services/supply.service';

// ─── Shared fixtures ─────────────────────────────────────────────────────────────

const OFFICER_ID = 'officer-uuid-1';
const SUPPLY_ID = 'supply-uuid-1';
const SHELTER_ID = 'shelter-uuid-1';
const DISPATCH_ID = 'dispatch-uuid-1';

const DB_SUPPLY_FOOD = {
  id: SUPPLY_ID,
  name: 'Rice Bags',
  category: 'FOOD',
  quantity: 200,
  unit: 'kg',
  location: 'Colombo Warehouse',
  organizationId: null,
  status: 'AVAILABLE',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

const DB_SUPPLY_MEDICINE = {
  id: 'supply-uuid-2',
  name: 'First Aid Kits',
  category: 'MEDICINE',
  quantity: 50,
  unit: 'units',
  location: 'Galle Depot',
  organizationId: null,
  status: 'AVAILABLE',
  createdAt: new Date('2024-01-02T00:00:00Z'),
  updatedAt: new Date('2024-01-02T00:00:00Z'),
};

const DB_SUPPLY_LOW = {
  ...DB_SUPPLY_FOOD,
  id: 'supply-uuid-3',
  status: 'LOW_STOCK',
};

const DB_DISPATCH = {
  id: DISPATCH_ID,
  dispatchCode: 'TX-0001',
  supplyId: SUPPLY_ID,
  shelterId: SHELTER_ID,
  destinationLabel: 'Colombo Shelter A',
  quantity: 50,
  unit: 'kg',
  dispatchedById: OFFICER_ID,
  transitStatus: 'PENDING',
  deliveredAt: null,
  dispatchedAt: new Date('2024-01-03T00:00:00Z'),
  createdAt: new Date('2024-01-03T00:00:00Z'),
  updatedAt: new Date('2024-01-03T00:00:00Z'),
};

const DB_DISPATCH_WITH_INCLUDE = {
  ...DB_DISPATCH,
  supply: { name: 'Rice Bags', category: 'FOOD' },
};

const DB_DISPATCH_DELIVERED = {
  ...DB_DISPATCH,
  transitStatus: 'DELIVERED',
  deliveredAt: new Date('2024-01-04T00:00:00Z'),
};

const CREATE_SUPPLY_DTO = {
  name: 'Rice Bags',
  category: 'FOOD',
  quantity: 200,
  unit: 'kg',
  location: 'Colombo Warehouse',
  organizationId: undefined as string | undefined,
};

const CREATE_DISPATCH_DTO = {
  supplyId: SUPPLY_ID,
  shelterId: SHELTER_ID,
  destinationLabel: 'Colombo Shelter A',
  quantity: 50,
  unit: 'kg',
};

// ─── Setup / teardown ────────────────────────────────────────────────────────────

beforeEach(() => {
  resetMockPrisma();
  (generateDispatchCode as jest.Mock).mockReturnValue('TX-0001');
});

// ─── listSupplies() ───────────────────────────────────────────────────────────────

describe('listSupplies()', () => {
  describe('no filters', () => {
    it('returns all supplies ordered by category when no params given', async () => {
      mockPrisma.reliefSupply.findMany.mockResolvedValue([DB_SUPPLY_FOOD, DB_SUPPLY_MEDICINE]);

      const result = await supplyService.listSupplies({});

      expect(mockPrisma.reliefSupply.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.reliefSupply.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { category: 'asc' },
      });
      expect(result).toHaveLength(2);
      expect(result).toEqual([DB_SUPPLY_FOOD, DB_SUPPLY_MEDICINE]);
    });

    it('returns empty array when no supplies exist', async () => {
      mockPrisma.reliefSupply.findMany.mockResolvedValue([]);

      const result = await supplyService.listSupplies({});

      expect(result).toEqual([]);
    });
  });

  describe('category filter', () => {
    it('filters by category when category param is provided', async () => {
      mockPrisma.reliefSupply.findMany.mockResolvedValue([DB_SUPPLY_FOOD]);

      const result = await supplyService.listSupplies({ category: 'FOOD' });

      expect(mockPrisma.reliefSupply.findMany).toHaveBeenCalledWith({
        where: { category: 'FOOD' },
        orderBy: { category: 'asc' },
      });
      expect(result).toEqual([DB_SUPPLY_FOOD]);
    });

    it('returns empty array when no supplies match the category', async () => {
      mockPrisma.reliefSupply.findMany.mockResolvedValue([]);

      const result = await supplyService.listSupplies({ category: 'EQUIPMENT' });

      expect(mockPrisma.reliefSupply.findMany).toHaveBeenCalledWith({
        where: { category: 'EQUIPMENT' },
        orderBy: { category: 'asc' },
      });
      expect(result).toEqual([]);
    });
  });

  describe('status filter', () => {
    it('filters by status when status param is provided', async () => {
      mockPrisma.reliefSupply.findMany.mockResolvedValue([DB_SUPPLY_LOW]);

      const result = await supplyService.listSupplies({ status: 'LOW_STOCK' });

      expect(mockPrisma.reliefSupply.findMany).toHaveBeenCalledWith({
        where: { status: 'LOW_STOCK' },
        orderBy: { category: 'asc' },
      });
      expect(result).toEqual([DB_SUPPLY_LOW]);
    });
  });

  describe('combined filters', () => {
    it('applies both category and status filters together', async () => {
      mockPrisma.reliefSupply.findMany.mockResolvedValue([DB_SUPPLY_LOW]);

      await supplyService.listSupplies({ category: 'FOOD', status: 'LOW_STOCK' });

      expect(mockPrisma.reliefSupply.findMany).toHaveBeenCalledWith({
        where: { category: 'FOOD', status: 'LOW_STOCK' },
        orderBy: { category: 'asc' },
      });
    });
  });
});

// ─── createSupply() ───────────────────────────────────────────────────────────────

describe('createSupply()', () => {
  describe('success', () => {
    it('creates a supply record with all provided fields', async () => {
      mockPrisma.reliefSupply.create.mockResolvedValue(DB_SUPPLY_FOOD);

      const result = await supplyService.createSupply(CREATE_SUPPLY_DTO, OFFICER_ID);

      expect(mockPrisma.reliefSupply.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.reliefSupply.create).toHaveBeenCalledWith({
        data: CREATE_SUPPLY_DTO,
      });
      expect(result).toEqual(DB_SUPPLY_FOOD);
    });

    it('creates a supply record with organizationId when provided', async () => {
      const dtoWithOrg = { ...CREATE_SUPPLY_DTO, organizationId: 'org-uuid-1' };
      const dbSupplyWithOrg = { ...DB_SUPPLY_FOOD, organizationId: 'org-uuid-1' };
      mockPrisma.reliefSupply.create.mockResolvedValue(dbSupplyWithOrg);

      const result = await supplyService.createSupply(dtoWithOrg, OFFICER_ID);

      expect(mockPrisma.reliefSupply.create).toHaveBeenCalledWith({
        data: dtoWithOrg,
      });
      expect(result).toEqual(dbSupplyWithOrg);
    });

    it('returns the created supply object from prisma', async () => {
      mockPrisma.reliefSupply.create.mockResolvedValue(DB_SUPPLY_MEDICINE);

      const result = await supplyService.createSupply(
        { name: 'First Aid Kits', category: 'MEDICINE', quantity: 50, unit: 'units', location: 'Galle Depot' },
        OFFICER_ID,
      );

      expect(result).toEqual(DB_SUPPLY_MEDICINE);
    });
  });
});

// ─── listSupplyDispatches() ───────────────────────────────────────────────────────

describe('listSupplyDispatches()', () => {
  describe('no filters — default pagination', () => {
    it('returns dispatches with meta using default page=1 and limit=20', async () => {
      mockPrisma.supplyDispatch.findMany.mockResolvedValue([DB_DISPATCH_WITH_INCLUDE]);
      mockPrisma.supplyDispatch.count.mockResolvedValue(1);

      const result = await supplyService.listSupplyDispatches({});

      expect(mockPrisma.supplyDispatch.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        orderBy: { dispatchedAt: 'desc' },
        include: { supply: { select: { name: true, category: true } } },
      });
      expect(mockPrisma.supplyDispatch.count).toHaveBeenCalledWith({ where: {} });
      expect(result).toEqual({
        dispatches: [DB_DISPATCH_WITH_INCLUDE],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });
    });

    it('returns empty dispatches array when none exist', async () => {
      mockPrisma.supplyDispatch.findMany.mockResolvedValue([]);
      mockPrisma.supplyDispatch.count.mockResolvedValue(0);

      const result = await supplyService.listSupplyDispatches({});

      expect(result.dispatches).toEqual([]);
      expect(result.meta).toEqual({ total: 0, page: 1, limit: 20, totalPages: 0 });
    });
  });

  describe('pagination', () => {
    it('applies correct skip/take for page 2 with limit 10', async () => {
      mockPrisma.supplyDispatch.findMany.mockResolvedValue([]);
      mockPrisma.supplyDispatch.count.mockResolvedValue(15);

      const result = await supplyService.listSupplyDispatches({ page: 2, limit: 10 });

      expect(mockPrisma.supplyDispatch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
      expect(result.meta).toEqual({ total: 15, page: 2, limit: 10, totalPages: 2 });
    });

    it('calculates totalPages correctly when total is not evenly divisible', async () => {
      mockPrisma.supplyDispatch.findMany.mockResolvedValue([]);
      mockPrisma.supplyDispatch.count.mockResolvedValue(25);

      const result = await supplyService.listSupplyDispatches({ page: 1, limit: 10 });

      expect(result.meta.totalPages).toBe(3);
    });

    it('uses page=1 as default when page is not provided', async () => {
      mockPrisma.supplyDispatch.findMany.mockResolvedValue([]);
      mockPrisma.supplyDispatch.count.mockResolvedValue(0);

      await supplyService.listSupplyDispatches({ limit: 5 });

      expect(mockPrisma.supplyDispatch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 5 }),
      );
    });
  });

  describe('shelterId filter', () => {
    it('filters dispatches by shelterId when provided', async () => {
      mockPrisma.supplyDispatch.findMany.mockResolvedValue([DB_DISPATCH_WITH_INCLUDE]);
      mockPrisma.supplyDispatch.count.mockResolvedValue(1);

      await supplyService.listSupplyDispatches({ shelterId: SHELTER_ID });

      expect(mockPrisma.supplyDispatch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { shelterId: SHELTER_ID } }),
      );
      expect(mockPrisma.supplyDispatch.count).toHaveBeenCalledWith({
        where: { shelterId: SHELTER_ID },
      });
    });
  });

  describe('transitStatus filter', () => {
    it('uppercases transitStatus before filtering', async () => {
      mockPrisma.supplyDispatch.findMany.mockResolvedValue([]);
      mockPrisma.supplyDispatch.count.mockResolvedValue(0);

      await supplyService.listSupplyDispatches({ transitStatus: 'pending' });

      expect(mockPrisma.supplyDispatch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { transitStatus: 'PENDING' } }),
      );
    });

    it('filters by DELIVERED transitStatus', async () => {
      mockPrisma.supplyDispatch.findMany.mockResolvedValue([DB_DISPATCH_DELIVERED]);
      mockPrisma.supplyDispatch.count.mockResolvedValue(1);

      const result = await supplyService.listSupplyDispatches({ transitStatus: 'DELIVERED' });

      expect(mockPrisma.supplyDispatch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { transitStatus: 'DELIVERED' } }),
      );
      expect(result.dispatches).toEqual([DB_DISPATCH_DELIVERED]);
    });
  });

  describe('combined filters', () => {
    it('applies both shelterId and transitStatus filters together', async () => {
      mockPrisma.supplyDispatch.findMany.mockResolvedValue([]);
      mockPrisma.supplyDispatch.count.mockResolvedValue(0);

      await supplyService.listSupplyDispatches({ shelterId: SHELTER_ID, transitStatus: 'in_transit' });

      expect(mockPrisma.supplyDispatch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { shelterId: SHELTER_ID, transitStatus: 'IN_TRANSIT' },
        }),
      );
    });
  });
});

// ─── createDispatch() ─────────────────────────────────────────────────────────────

describe('createDispatch()', () => {
  describe('success', () => {
    it('creates a dispatch and decrements supply quantity in a transaction', async () => {
      mockPrisma.reliefSupply.findUnique.mockResolvedValue(DB_SUPPLY_FOOD);
      mockPrisma.supplyDispatch.count.mockResolvedValue(0);
      mockPrisma.$transaction.mockResolvedValue([DB_DISPATCH, { ...DB_SUPPLY_FOOD, quantity: 150 }]);

      const result = await supplyService.createDispatch(CREATE_DISPATCH_DTO, OFFICER_ID);

      expect(mockPrisma.reliefSupply.findUnique).toHaveBeenCalledWith({
        where: { id: SUPPLY_ID },
      });
      expect(mockPrisma.supplyDispatch.count).toHaveBeenCalledTimes(1);
      expect(generateDispatchCode).toHaveBeenCalledWith(1);
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result).toEqual(DB_DISPATCH);
    });

    it('returns the first element (the new dispatch) from the transaction array', async () => {
      mockPrisma.reliefSupply.findUnique.mockResolvedValue(DB_SUPPLY_FOOD);
      mockPrisma.supplyDispatch.count.mockResolvedValue(5);
      mockPrisma.$transaction.mockResolvedValue([DB_DISPATCH, { ...DB_SUPPLY_FOOD, quantity: 150 }]);

      const result = await supplyService.createDispatch(CREATE_DISPATCH_DTO, OFFICER_ID);

      expect(result).toBe(DB_DISPATCH);
    });

    it('passes the generated dispatchCode into the create call within the transaction', async () => {
      (generateDispatchCode as jest.Mock).mockReturnValue('TX-0006');
      mockPrisma.reliefSupply.findUnique.mockResolvedValue(DB_SUPPLY_FOOD);
      mockPrisma.supplyDispatch.count.mockResolvedValue(5);
      mockPrisma.$transaction.mockResolvedValue([{ ...DB_DISPATCH, dispatchCode: 'TX-0006' }, {}]);

      const result = await supplyService.createDispatch(CREATE_DISPATCH_DTO, OFFICER_ID);

      expect(generateDispatchCode).toHaveBeenCalledWith(6);
      expect(result).toMatchObject({ dispatchCode: 'TX-0006' });
    });

    it('passes two operations to $transaction — dispatch create and supply decrement', async () => {
      mockPrisma.reliefSupply.findUnique.mockResolvedValue(DB_SUPPLY_FOOD);
      mockPrisma.supplyDispatch.count.mockResolvedValue(0);
      mockPrisma.$transaction.mockResolvedValue([DB_DISPATCH, {}]);

      await supplyService.createDispatch(CREATE_DISPATCH_DTO, OFFICER_ID);

      const txArg = (mockPrisma.$transaction as jest.Mock).mock.calls[0][0] as unknown[];
      expect(txArg).toHaveLength(2);
    });

    it('works when shelterId is omitted (direct delivery without shelter)', async () => {
      const dtoNoShelter = { ...CREATE_DISPATCH_DTO, shelterId: undefined };
      mockPrisma.reliefSupply.findUnique.mockResolvedValue(DB_SUPPLY_FOOD);
      mockPrisma.supplyDispatch.count.mockResolvedValue(0);
      mockPrisma.$transaction.mockResolvedValue([{ ...DB_DISPATCH, shelterId: undefined }, {}]);

      const result = await supplyService.createDispatch(dtoNoShelter, OFFICER_ID);

      expect(result).toBeDefined();
    });
  });

  describe('supply not found', () => {
    it('throws NOT_FOUND error when supply does not exist', async () => {
      mockPrisma.reliefSupply.findUnique.mockResolvedValue(null);

      await expect(supplyService.createDispatch(CREATE_DISPATCH_DTO, OFFICER_ID)).rejects.toMatchObject({
        code: 'NOT_FOUND',
        status: 404,
      });
    });

    it('does not call $transaction when supply is not found', async () => {
      mockPrisma.reliefSupply.findUnique.mockResolvedValue(null);

      await expect(supplyService.createDispatch(CREATE_DISPATCH_DTO, OFFICER_ID)).rejects.toBeDefined();

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('includes a descriptive message in the NOT_FOUND error', async () => {
      mockPrisma.reliefSupply.findUnique.mockResolvedValue(null);

      await expect(supplyService.createDispatch(CREATE_DISPATCH_DTO, OFFICER_ID)).rejects.toMatchObject({
        message: 'Supply not found',
      });
    });
  });

  describe('insufficient quantity', () => {
    it('throws INSUFFICIENT_SUPPLY error when requested quantity exceeds available stock', async () => {
      const lowStockSupply = { ...DB_SUPPLY_FOOD, quantity: 10 };
      mockPrisma.reliefSupply.findUnique.mockResolvedValue(lowStockSupply);

      await expect(
        supplyService.createDispatch({ ...CREATE_DISPATCH_DTO, quantity: 50 }, OFFICER_ID),
      ).rejects.toMatchObject({
        code: 'INSUFFICIENT_SUPPLY',
        status: 400,
      });
    });

    it('includes available and requested quantities in the error message', async () => {
      const lowStockSupply = { ...DB_SUPPLY_FOOD, quantity: 10 };
      mockPrisma.reliefSupply.findUnique.mockResolvedValue(lowStockSupply);

      await expect(
        supplyService.createDispatch({ ...CREATE_DISPATCH_DTO, quantity: 50 }, OFFICER_ID),
      ).rejects.toMatchObject({
        message: expect.stringContaining('10'),
      });
    });

    it('does not call $transaction when quantity is insufficient', async () => {
      const lowStockSupply = { ...DB_SUPPLY_FOOD, quantity: 10 };
      mockPrisma.reliefSupply.findUnique.mockResolvedValue(lowStockSupply);

      await expect(
        supplyService.createDispatch({ ...CREATE_DISPATCH_DTO, quantity: 50 }, OFFICER_ID),
      ).rejects.toBeDefined();

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('allows dispatch when requested quantity exactly equals available stock', async () => {
      const exactSupply = { ...DB_SUPPLY_FOOD, quantity: 50 };
      mockPrisma.reliefSupply.findUnique.mockResolvedValue(exactSupply);
      mockPrisma.supplyDispatch.count.mockResolvedValue(0);
      mockPrisma.$transaction.mockResolvedValue([DB_DISPATCH, { ...exactSupply, quantity: 0 }]);

      const result = await supplyService.createDispatch(CREATE_DISPATCH_DTO, OFFICER_ID);

      expect(result).toEqual(DB_DISPATCH);
    });
  });
});

// ─── updateTransitStatus() ────────────────────────────────────────────────────────

describe('updateTransitStatus()', () => {
  describe('status update', () => {
    it('updates transitStatus to the uppercased value provided', async () => {
      const updatedDispatch = { ...DB_DISPATCH, transitStatus: 'IN_TRANSIT' };
      mockPrisma.supplyDispatch.findUnique.mockResolvedValue(DB_DISPATCH);
      mockPrisma.supplyDispatch.update.mockResolvedValue(updatedDispatch);

      const result = await supplyService.updateTransitStatus(DISPATCH_ID, 'in_transit');

      expect(mockPrisma.supplyDispatch.findUnique).toHaveBeenCalledWith({
        where: { id: DISPATCH_ID },
      });
      expect(mockPrisma.supplyDispatch.update).toHaveBeenCalledWith({
        where: { id: DISPATCH_ID },
        data: {
          transitStatus: 'IN_TRANSIT',
          deliveredAt: undefined,
        },
      });
      expect(result).toEqual(updatedDispatch);
    });

    it('uppercases the transitStatus value before persisting', async () => {
      const updatedDispatch = { ...DB_DISPATCH, transitStatus: 'PENDING' };
      mockPrisma.supplyDispatch.findUnique.mockResolvedValue(DB_DISPATCH);
      mockPrisma.supplyDispatch.update.mockResolvedValue(updatedDispatch);

      await supplyService.updateTransitStatus(DISPATCH_ID, 'pending');

      expect(mockPrisma.supplyDispatch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ transitStatus: 'PENDING' }),
        }),
      );
    });
  });

  describe('DELIVERED sets deliveredAt', () => {
    it('sets deliveredAt to a Date when transitStatus is DELIVERED', async () => {
      mockPrisma.supplyDispatch.findUnique.mockResolvedValue(DB_DISPATCH);
      mockPrisma.supplyDispatch.update.mockResolvedValue(DB_DISPATCH_DELIVERED);

      await supplyService.updateTransitStatus(DISPATCH_ID, 'DELIVERED');

      const updateCall = (mockPrisma.supplyDispatch.update as jest.Mock).mock.calls[0][0] as {
        data: { deliveredAt?: Date };
      };
      expect(updateCall.data.deliveredAt).toBeInstanceOf(Date);
    });

    it('leaves deliveredAt as undefined for non-DELIVERED statuses', async () => {
      const updatedDispatch = { ...DB_DISPATCH, transitStatus: 'IN_TRANSIT' };
      mockPrisma.supplyDispatch.findUnique.mockResolvedValue(DB_DISPATCH);
      mockPrisma.supplyDispatch.update.mockResolvedValue(updatedDispatch);

      await supplyService.updateTransitStatus(DISPATCH_ID, 'IN_TRANSIT');

      const updateCall = (mockPrisma.supplyDispatch.update as jest.Mock).mock.calls[0][0] as {
        data: { deliveredAt?: Date };
      };
      expect(updateCall.data.deliveredAt).toBeUndefined();
    });

    it('also sets deliveredAt when DELIVERED is passed in lowercase', async () => {
      mockPrisma.supplyDispatch.findUnique.mockResolvedValue(DB_DISPATCH);
      mockPrisma.supplyDispatch.update.mockResolvedValue(DB_DISPATCH_DELIVERED);

      await supplyService.updateTransitStatus(DISPATCH_ID, 'delivered');

      const updateCall = (mockPrisma.supplyDispatch.update as jest.Mock).mock.calls[0][0] as {
        data: { deliveredAt?: Date };
      };
      expect(updateCall.data.deliveredAt).toBeInstanceOf(Date);
    });
  });

  describe('dispatch not found', () => {
    it('throws NOT_FOUND error when dispatch does not exist', async () => {
      mockPrisma.supplyDispatch.findUnique.mockResolvedValue(null);

      await expect(
        supplyService.updateTransitStatus('nonexistent-id', 'DELIVERED'),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
        status: 404,
      });
    });

    it('does not call update when dispatch is not found', async () => {
      mockPrisma.supplyDispatch.findUnique.mockResolvedValue(null);

      await expect(
        supplyService.updateTransitStatus('nonexistent-id', 'DELIVERED'),
      ).rejects.toBeDefined();

      expect(mockPrisma.supplyDispatch.update).not.toHaveBeenCalled();
    });

    it('includes a descriptive message in the NOT_FOUND error', async () => {
      mockPrisma.supplyDispatch.findUnique.mockResolvedValue(null);

      await expect(
        supplyService.updateTransitStatus('nonexistent-id', 'DELIVERED'),
      ).rejects.toMatchObject({
        message: 'Dispatch not found',
      });
    });
  });
});
