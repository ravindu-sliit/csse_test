// ─── Module mocks (must come before any imports of the mocked modules) ──────────

jest.mock('../../config/database', () => ({
  prisma: require('../mocks/prisma.mock').mockPrisma,
}));

// ─── Imports ─────────────────────────────────────────────────────────────────────

import { RescueTeamStatus } from '@prisma/client';
import { mockPrisma, resetMockPrisma } from '../mocks/prisma.mock';
import * as rescueService from '../../services/rescue.service';

// ─── Shared fixtures ─────────────────────────────────────────────────────────────

const OFFICER_ID = 'officer-uuid-1';
const TEAM_ID = 'team-uuid-1';
const DISPATCH_ID = 'dispatch-uuid-1';

const DB_TEAM_AVAILABLE = {
  id: TEAM_ID,
  teamCode: 'RT-001',
  name: 'Alpha Rescue',
  district: 'Colombo',
  status: RescueTeamStatus.AVAILABLE,
  contactNumber: '0712345678',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

const DB_TEAM_DISPATCHED = {
  ...DB_TEAM_AVAILABLE,
  status: RescueTeamStatus.DISPATCHED,
};

const DB_TEAM_GALLE = {
  ...DB_TEAM_AVAILABLE,
  id: 'team-uuid-2',
  teamCode: 'RT-002',
  name: 'Bravo Rescue',
  district: 'Galle',
};

const DB_DISPATCH = {
  id: DISPATCH_ID,
  teamId: TEAM_ID,
  targetDistrict: 'Galle',
  missionDetails: 'Flood rescue operation',
  criticality: 'HIGH',
  gearChecklist: ['rope', 'life_jacket'],
  dispatchedById: OFFICER_ID,
  status: 'dispatched',
  createdAt: new Date('2024-01-02T00:00:00Z'),
  updatedAt: new Date('2024-01-02T00:00:00Z'),
};

const DISPATCH_DTO = {
  teamId: TEAM_ID,
  targetDistrict: 'Galle',
  missionDetails: 'Flood rescue operation',
  criticality: 'HIGH',
  gearChecklist: ['rope', 'life_jacket'],
};

// ─── Setup / teardown ────────────────────────────────────────────────────────────

beforeEach(() => {
  resetMockPrisma();
});

// ─── listTeams() ─────────────────────────────────────────────────────────────────

describe('listTeams()', () => {
  describe('no filters', () => {
    it('returns all teams ordered by teamCode when no params given', async () => {
      mockPrisma.rescueTeam.findMany.mockResolvedValue([DB_TEAM_AVAILABLE, DB_TEAM_GALLE]);

      const result = await rescueService.listTeams({});

      expect(mockPrisma.rescueTeam.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.rescueTeam.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { teamCode: 'asc' },
      });
      expect(result).toHaveLength(2);
      expect(result).toEqual([DB_TEAM_AVAILABLE, DB_TEAM_GALLE]);
    });

    it('returns empty array when no teams exist', async () => {
      mockPrisma.rescueTeam.findMany.mockResolvedValue([]);

      const result = await rescueService.listTeams({});

      expect(result).toEqual([]);
    });
  });

  describe('district filter', () => {
    it('filters teams by district when district param provided', async () => {
      mockPrisma.rescueTeam.findMany.mockResolvedValue([DB_TEAM_AVAILABLE]);

      const result = await rescueService.listTeams({ district: 'Colombo' });

      expect(mockPrisma.rescueTeam.findMany).toHaveBeenCalledWith({
        where: { district: 'Colombo' },
        orderBy: { teamCode: 'asc' },
      });
      expect(result).toEqual([DB_TEAM_AVAILABLE]);
    });

    it('returns empty array when no teams match the district', async () => {
      mockPrisma.rescueTeam.findMany.mockResolvedValue([]);

      const result = await rescueService.listTeams({ district: 'Jaffna' });

      expect(mockPrisma.rescueTeam.findMany).toHaveBeenCalledWith({
        where: { district: 'Jaffna' },
        orderBy: { teamCode: 'asc' },
      });
      expect(result).toEqual([]);
    });
  });

  describe('status filter', () => {
    it('uppercases status before filtering', async () => {
      mockPrisma.rescueTeam.findMany.mockResolvedValue([DB_TEAM_AVAILABLE]);

      await rescueService.listTeams({ status: 'available' });

      expect(mockPrisma.rescueTeam.findMany).toHaveBeenCalledWith({
        where: { status: 'AVAILABLE' },
        orderBy: { teamCode: 'asc' },
      });
    });

    it('filters dispatched teams when status is "dispatched"', async () => {
      mockPrisma.rescueTeam.findMany.mockResolvedValue([DB_TEAM_DISPATCHED]);

      const result = await rescueService.listTeams({ status: 'dispatched' });

      expect(mockPrisma.rescueTeam.findMany).toHaveBeenCalledWith({
        where: { status: 'DISPATCHED' },
        orderBy: { teamCode: 'asc' },
      });
      expect(result).toEqual([DB_TEAM_DISPATCHED]);
    });
  });

  describe('combined filters', () => {
    it('applies both district and status filters together', async () => {
      mockPrisma.rescueTeam.findMany.mockResolvedValue([DB_TEAM_AVAILABLE]);

      await rescueService.listTeams({ district: 'Colombo', status: 'available' });

      expect(mockPrisma.rescueTeam.findMany).toHaveBeenCalledWith({
        where: { district: 'Colombo', status: 'AVAILABLE' },
        orderBy: { teamCode: 'asc' },
      });
    });
  });
});

// ─── dispatchTeam() ───────────────────────────────────────────────────────────────

describe('dispatchTeam()', () => {
  describe('success', () => {
    it('creates a dispatch record and updates team status to DISPATCHED', async () => {
      mockPrisma.rescueTeam.findUnique.mockResolvedValue(DB_TEAM_AVAILABLE);
      // $transaction resolves to [dispatch, updatedTeam]; service destructures index 0
      mockPrisma.$transaction.mockResolvedValue([DB_DISPATCH, DB_TEAM_DISPATCHED]);

      const result = await rescueService.dispatchTeam(DISPATCH_DTO, OFFICER_ID);

      expect(mockPrisma.rescueTeam.findUnique).toHaveBeenCalledWith({
        where: { id: TEAM_ID },
      });
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result).toEqual(DB_DISPATCH);
    });

    it('passes all dto fields and officerId into the dispatch create call', async () => {
      mockPrisma.rescueTeam.findUnique.mockResolvedValue(DB_TEAM_AVAILABLE);
      mockPrisma.$transaction.mockResolvedValue([DB_DISPATCH, DB_TEAM_DISPATCHED]);

      await rescueService.dispatchTeam(DISPATCH_DTO, OFFICER_ID);

      // Inspect the array passed to $transaction
      const txArg = (mockPrisma.$transaction as jest.Mock).mock.calls[0][0] as unknown[];
      expect(txArg).toHaveLength(2);
    });

    it('works when missionDetails is omitted', async () => {
      const dtoWithoutDetails = { ...DISPATCH_DTO, missionDetails: undefined };
      mockPrisma.rescueTeam.findUnique.mockResolvedValue(DB_TEAM_AVAILABLE);
      mockPrisma.$transaction.mockResolvedValue([{ ...DB_DISPATCH, missionDetails: undefined }, DB_TEAM_DISPATCHED]);

      const result = await rescueService.dispatchTeam(dtoWithoutDetails, OFFICER_ID);

      expect(result).toBeDefined();
    });
  });

  describe('team not found', () => {
    it('throws NOT_FOUND error when teamId does not exist', async () => {
      mockPrisma.rescueTeam.findUnique.mockResolvedValue(null);

      await expect(rescueService.dispatchTeam(DISPATCH_DTO, OFFICER_ID)).rejects.toMatchObject({
        code: 'NOT_FOUND',
        status: 404,
        message: 'Rescue team not found',
      });
    });

    it('does not call $transaction when team lookup fails', async () => {
      mockPrisma.rescueTeam.findUnique.mockResolvedValue(null);

      await expect(rescueService.dispatchTeam(DISPATCH_DTO, OFFICER_ID)).rejects.toBeDefined();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('team unavailable', () => {
    it('throws TEAM_UNAVAILABLE when team status is DISPATCHED', async () => {
      mockPrisma.rescueTeam.findUnique.mockResolvedValue(DB_TEAM_DISPATCHED);

      await expect(rescueService.dispatchTeam(DISPATCH_DTO, OFFICER_ID)).rejects.toMatchObject({
        code: 'TEAM_UNAVAILABLE',
        status: 409,
      });
    });

    it('includes team code and current status in the error message', async () => {
      mockPrisma.rescueTeam.findUnique.mockResolvedValue(DB_TEAM_DISPATCHED);

      await expect(rescueService.dispatchTeam(DISPATCH_DTO, OFFICER_ID)).rejects.toMatchObject({
        message: expect.stringContaining('RT-001'),
      });
    });

    it('throws TEAM_UNAVAILABLE when team status is ON_MISSION', async () => {
      const onMissionTeam = { ...DB_TEAM_AVAILABLE, status: RescueTeamStatus.ON_MISSION };
      mockPrisma.rescueTeam.findUnique.mockResolvedValue(onMissionTeam);

      await expect(rescueService.dispatchTeam(DISPATCH_DTO, OFFICER_ID)).rejects.toMatchObject({
        code: 'TEAM_UNAVAILABLE',
        status: 409,
      });
    });

    it('throws TEAM_UNAVAILABLE when team status is RETURNING', async () => {
      const returningTeam = { ...DB_TEAM_AVAILABLE, status: RescueTeamStatus.RETURNING };
      mockPrisma.rescueTeam.findUnique.mockResolvedValue(returningTeam);

      await expect(rescueService.dispatchTeam(DISPATCH_DTO, OFFICER_ID)).rejects.toMatchObject({
        code: 'TEAM_UNAVAILABLE',
        status: 409,
      });
    });

    it('does not call $transaction when team is unavailable', async () => {
      mockPrisma.rescueTeam.findUnique.mockResolvedValue(DB_TEAM_DISPATCHED);

      await expect(rescueService.dispatchTeam(DISPATCH_DTO, OFFICER_ID)).rejects.toBeDefined();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });
});

// ─── updateDispatchStatus() ───────────────────────────────────────────────────────

describe('updateDispatchStatus()', () => {
  describe('status mapping', () => {
    const statusMappings: Array<{ input: string; expectedTeamStatus: RescueTeamStatus }> = [
      { input: 'dispatched', expectedTeamStatus: RescueTeamStatus.DISPATCHED },
      { input: 'on_mission', expectedTeamStatus: RescueTeamStatus.ON_MISSION },
      { input: 'returning', expectedTeamStatus: RescueTeamStatus.RETURNING },
      { input: 'completed', expectedTeamStatus: RescueTeamStatus.AVAILABLE },
    ];

    it.each(statusMappings)(
      'maps dispatch status "$input" to team status $expectedTeamStatus',
      async ({ input, expectedTeamStatus }) => {
        const updatedDispatch = { ...DB_DISPATCH, status: input };
        const updatedTeam = { ...DB_TEAM_AVAILABLE, status: expectedTeamStatus };
        mockPrisma.rescueDispatch.findUnique.mockResolvedValue(DB_DISPATCH);
        mockPrisma.$transaction.mockResolvedValue([updatedDispatch, updatedTeam]);

        const result = await rescueService.updateDispatchStatus(DISPATCH_ID, input);

        expect(mockPrisma.rescueDispatch.findUnique).toHaveBeenCalledWith({
          where: { id: DISPATCH_ID },
        });
        expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
        expect(result).toEqual([updatedDispatch, updatedTeam]);
      },
    );

    it('is case-insensitive: "DISPATCHED" maps same as "dispatched"', async () => {
      const updatedDispatch = { ...DB_DISPATCH, status: 'DISPATCHED' };
      const updatedTeam = { ...DB_TEAM_AVAILABLE, status: RescueTeamStatus.DISPATCHED };
      mockPrisma.rescueDispatch.findUnique.mockResolvedValue(DB_DISPATCH);
      mockPrisma.$transaction.mockResolvedValue([updatedDispatch, updatedTeam]);

      await rescueService.updateDispatchStatus(DISPATCH_ID, 'DISPATCHED');

      const txArg = (mockPrisma.$transaction as jest.Mock).mock.calls[0][0] as unknown[];
      expect(txArg).toHaveLength(2);
    });

    it('falls back to AVAILABLE for an unrecognised status string', async () => {
      const updatedDispatch = { ...DB_DISPATCH, status: 'unknown_status' };
      const updatedTeam = { ...DB_TEAM_AVAILABLE, status: RescueTeamStatus.AVAILABLE };
      mockPrisma.rescueDispatch.findUnique.mockResolvedValue(DB_DISPATCH);
      mockPrisma.$transaction.mockResolvedValue([updatedDispatch, updatedTeam]);

      const result = await rescueService.updateDispatchStatus(DISPATCH_ID, 'unknown_status');

      // Transaction was still called – result contains the mocked response
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result).toBeDefined();
    });

    it('returns the full transaction result array', async () => {
      const updatedDispatch = { ...DB_DISPATCH, status: 'completed' };
      const updatedTeam = { ...DB_TEAM_AVAILABLE, status: RescueTeamStatus.AVAILABLE };
      mockPrisma.rescueDispatch.findUnique.mockResolvedValue(DB_DISPATCH);
      mockPrisma.$transaction.mockResolvedValue([updatedDispatch, updatedTeam]);

      const result = await rescueService.updateDispatchStatus(DISPATCH_ID, 'completed');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
    });
  });

  describe('not found', () => {
    it('throws NOT_FOUND when dispatch id does not exist', async () => {
      mockPrisma.rescueDispatch.findUnique.mockResolvedValue(null);

      await expect(
        rescueService.updateDispatchStatus('nonexistent-id', 'completed'),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
        status: 404,
        message: 'Dispatch not found',
      });
    });

    it('does not call $transaction when dispatch lookup fails', async () => {
      mockPrisma.rescueDispatch.findUnique.mockResolvedValue(null);

      await expect(
        rescueService.updateDispatchStatus('nonexistent-id', 'dispatched'),
      ).rejects.toBeDefined();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });
});

// ─── getCoordinationSummary() ─────────────────────────────────────────────────────

describe('getCoordinationSummary()', () => {
  describe('without district filter', () => {
    it('returns aggregated counts across all districts', async () => {
      mockPrisma.rescueTeam.count
        .mockResolvedValueOnce(5)  // teamsDeployed
        .mockResolvedValueOnce(12); // teamsTotal
      mockPrisma.shelter.count.mockResolvedValue(8);      // activeShelters
      mockPrisma.reliefSupply.count.mockResolvedValue(3); // supplyHubs

      const result = await rescueService.getCoordinationSummary();

      expect(result).toEqual({
        teamsDeployed: 5,
        teamsTotal: 12,
        activeShelters: 8,
        supplyHubsActive: 3,
      });
    });

    it('queries deployed teams with DISPATCHED, EN_ROUTE and ON_MISSION statuses', async () => {
      mockPrisma.rescueTeam.count.mockResolvedValue(0);
      mockPrisma.shelter.count.mockResolvedValue(0);
      mockPrisma.reliefSupply.count.mockResolvedValue(0);

      await rescueService.getCoordinationSummary();

      const firstCountCall = (mockPrisma.rescueTeam.count as jest.Mock).mock.calls[0][0];
      expect(firstCountCall).toMatchObject({
        where: { status: { in: ['DISPATCHED', 'EN_ROUTE', 'ON_MISSION'] } },
      });
    });

    it('queries total teams with no status restriction', async () => {
      mockPrisma.rescueTeam.count.mockResolvedValue(0);
      mockPrisma.shelter.count.mockResolvedValue(0);
      mockPrisma.reliefSupply.count.mockResolvedValue(0);

      await rescueService.getCoordinationSummary();

      const secondCountCall = (mockPrisma.rescueTeam.count as jest.Mock).mock.calls[1][0];
      expect(secondCountCall).toEqual({ where: {} });
    });

    it('queries active shelters with OPEN and FULL statuses', async () => {
      mockPrisma.rescueTeam.count.mockResolvedValue(0);
      mockPrisma.shelter.count.mockResolvedValue(0);
      mockPrisma.reliefSupply.count.mockResolvedValue(0);

      await rescueService.getCoordinationSummary();

      const shelterCountCall = (mockPrisma.shelter.count as jest.Mock).mock.calls[0][0];
      expect(shelterCountCall).toMatchObject({
        where: { status: { in: ['OPEN', 'FULL'] } },
      });
    });

    it('queries supply hubs with status "available"', async () => {
      mockPrisma.rescueTeam.count.mockResolvedValue(0);
      mockPrisma.shelter.count.mockResolvedValue(0);
      mockPrisma.reliefSupply.count.mockResolvedValue(0);

      await rescueService.getCoordinationSummary();

      expect(mockPrisma.reliefSupply.count).toHaveBeenCalledWith({
        where: { status: 'available' },
      });
    });

    it('runs all four count queries in parallel (Promise.all)', async () => {
      mockPrisma.rescueTeam.count.mockResolvedValue(0);
      mockPrisma.shelter.count.mockResolvedValue(0);
      mockPrisma.reliefSupply.count.mockResolvedValue(0);

      await rescueService.getCoordinationSummary();

      expect(mockPrisma.rescueTeam.count).toHaveBeenCalledTimes(2);
      expect(mockPrisma.shelter.count).toHaveBeenCalledTimes(1);
      expect(mockPrisma.reliefSupply.count).toHaveBeenCalledTimes(1);
    });

    it('returns zero counts when nothing is active', async () => {
      mockPrisma.rescueTeam.count.mockResolvedValue(0);
      mockPrisma.shelter.count.mockResolvedValue(0);
      mockPrisma.reliefSupply.count.mockResolvedValue(0);

      const result = await rescueService.getCoordinationSummary();

      expect(result).toEqual({
        teamsDeployed: 0,
        teamsTotal: 0,
        activeShelters: 0,
        supplyHubsActive: 0,
      });
    });
  });

  describe('with district filter', () => {
    it('scopes rescueTeam and shelter counts to the given district', async () => {
      mockPrisma.rescueTeam.count.mockResolvedValue(2);
      mockPrisma.shelter.count.mockResolvedValue(3);
      mockPrisma.reliefSupply.count.mockResolvedValue(1);

      const result = await rescueService.getCoordinationSummary('Colombo');

      expect(result).toEqual({
        teamsDeployed: 2,
        teamsTotal: 2,
        activeShelters: 3,
        supplyHubsActive: 1,
      });
    });

    it('includes district in the teams deployed query', async () => {
      mockPrisma.rescueTeam.count.mockResolvedValue(0);
      mockPrisma.shelter.count.mockResolvedValue(0);
      mockPrisma.reliefSupply.count.mockResolvedValue(0);

      await rescueService.getCoordinationSummary('Galle');

      const firstCountCall = (mockPrisma.rescueTeam.count as jest.Mock).mock.calls[0][0];
      expect(firstCountCall).toMatchObject({
        where: expect.objectContaining({ district: 'Galle' }),
      });
    });

    it('includes district in the teams total query', async () => {
      mockPrisma.rescueTeam.count.mockResolvedValue(0);
      mockPrisma.shelter.count.mockResolvedValue(0);
      mockPrisma.reliefSupply.count.mockResolvedValue(0);

      await rescueService.getCoordinationSummary('Galle');

      const secondCountCall = (mockPrisma.rescueTeam.count as jest.Mock).mock.calls[1][0];
      expect(secondCountCall).toMatchObject({
        where: { district: 'Galle' },
      });
    });

    it('includes district in the shelter count query', async () => {
      mockPrisma.rescueTeam.count.mockResolvedValue(0);
      mockPrisma.shelter.count.mockResolvedValue(0);
      mockPrisma.reliefSupply.count.mockResolvedValue(0);

      await rescueService.getCoordinationSummary('Matara');

      const shelterCountCall = (mockPrisma.shelter.count as jest.Mock).mock.calls[0][0];
      expect(shelterCountCall).toMatchObject({
        where: expect.objectContaining({ district: 'Matara' }),
      });
    });

    it('does NOT scope reliefSupply count to district', async () => {
      mockPrisma.rescueTeam.count.mockResolvedValue(0);
      mockPrisma.shelter.count.mockResolvedValue(0);
      mockPrisma.reliefSupply.count.mockResolvedValue(0);

      await rescueService.getCoordinationSummary('Colombo');

      // Supply hubs are always global — no district key in the where clause
      expect(mockPrisma.reliefSupply.count).toHaveBeenCalledWith({
        where: { status: 'available' },
      });
    });
  });
});

// ─── getMyMissions() ──────────────────────────────────────────────────────────────

describe('getMyMissions()', () => {
  const USER_ID = 'user-uuid-1';

  const DB_USER = {
    id: USER_ID,
    email: 'rt001@dmc.gov.lk',
    name: 'Team Leader Alpha',
    district: 'Colombo',
  };

  const DB_TEAM = {
    id: 'team-uuid-1',
    teamCode: 'RT001',
    teamName: 'Alpha Rescue',
    district: 'Colombo',
    status: 'AVAILABLE',
  };

  const DB_MISSIONS = [
    {
      id: 'dispatch-uuid-1',
      teamId: 'team-uuid-1',
      targetDistrict: 'Colombo',
      status: 'completed',
      dispatchedAt: new Date('2026-09-15T10:00:00Z'),
    },
    {
      id: 'dispatch-uuid-2',
      teamId: 'team-uuid-1',
      targetDistrict: 'Gampaha',
      status: 'EN_ROUTE',
      dispatchedAt: new Date('2026-09-20T08:00:00Z'),
    },
  ];

  beforeEach(() => {
    resetMockPrisma();
  });

  it('returns team and missions when user and team are found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(DB_USER);
    mockPrisma.rescueTeam.findFirst.mockResolvedValue(DB_TEAM);
    mockPrisma.rescueDispatch.findMany.mockResolvedValue(DB_MISSIONS);

    const result = await rescueService.getMyMissions(USER_ID);

    expect(result.team).toEqual(DB_TEAM);
    expect(result.missions).toEqual(DB_MISSIONS);
  });

  it('throws NOT_FOUND when user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(rescueService.getMyMissions('bad-user-id')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  it('does not query rescueTeam when user is not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(rescueService.getMyMissions(USER_ID)).rejects.toBeDefined();
    expect(mockPrisma.rescueTeam.findFirst).not.toHaveBeenCalled();
  });

  it('returns null team and empty missions when no team is associated with user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(DB_USER);
    mockPrisma.rescueTeam.findFirst.mockResolvedValue(null);

    const result = await rescueService.getMyMissions(USER_ID);

    expect(result).toEqual({ team: null, missions: [] });
    expect(mockPrisma.rescueDispatch.findMany).not.toHaveBeenCalled();
  });

  it('queries dispatches ordered by dispatchedAt descending', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(DB_USER);
    mockPrisma.rescueTeam.findFirst.mockResolvedValue(DB_TEAM);
    mockPrisma.rescueDispatch.findMany.mockResolvedValue(DB_MISSIONS);

    await rescueService.getMyMissions(USER_ID);

    expect(mockPrisma.rescueDispatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { teamId: DB_TEAM.id },
        orderBy: { dispatchedAt: 'desc' },
      }),
    );
  });

  it('returns empty missions array when team has no dispatches', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(DB_USER);
    mockPrisma.rescueTeam.findFirst.mockResolvedValue(DB_TEAM);
    mockPrisma.rescueDispatch.findMany.mockResolvedValue([]);

    const result = await rescueService.getMyMissions(USER_ID);

    expect(result.team).toEqual(DB_TEAM);
    expect(result.missions).toEqual([]);
  });

  it('looks up user by the provided userId', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(DB_USER);
    mockPrisma.rescueTeam.findFirst.mockResolvedValue(DB_TEAM);
    mockPrisma.rescueDispatch.findMany.mockResolvedValue([]);

    await rescueService.getMyMissions(USER_ID);

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { id: USER_ID } });
  });
});
