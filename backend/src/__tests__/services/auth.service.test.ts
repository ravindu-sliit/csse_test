import '../../config/database'; // ensure module resolution order

// ─── Module mocks (must be before any imports that pull in the mocked modules) ────

jest.mock('../../config/database', () => ({
  prisma: require('../mocks/prisma.mock').mockPrisma,
}));

jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

// ─── Imports ─────────────────────────────────────────────────────────────────────

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { mockPrisma, resetMockPrisma } from '../mocks/prisma.mock';
import * as authService from '../../services/auth.service';

// ─── Typed helpers ───────────────────────────────────────────────────────────────

const mockBcryptHash = bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>;
const mockBcryptCompare = bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>;
const mockJwtSign = jwt.sign as jest.MockedFunction<typeof jwt.sign>;
const mockJwtVerify = jwt.verify as jest.MockedFunction<typeof jwt.verify>;

// ─── Shared fixtures ─────────────────────────────────────────────────────────────

const BASE_REGISTER_DTO = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  password: 'Password1!',
  phoneNumber: '0771234567',
  role: 'CITIZEN' as const,
  district: 'Colombo',
  nic: '987654321V',
};

const DB_USER_SELECT = {
  id: 'user-uuid-1',
  name: 'Jane Doe',
  email: 'jane@example.com',
  role: 'CITIZEN',
  district: 'Colombo',
};

const DB_USER_WITH_HASH = {
  ...DB_USER_SELECT,
  passwordHash: 'hashed-pw',
  status: 'active',
};

const STORED_REFRESH_TOKEN = {
  id: 'rt-uuid-1',
  token: 'valid-refresh-token',
  userId: 'user-uuid-1',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
};

// ─── Setup / teardown ────────────────────────────────────────────────────────────

beforeEach(() => {
  resetMockPrisma();

  // Default JWT stubs – individual tests override as needed
  mockJwtSign.mockReturnValue('mock-access-token' as any);
  mockJwtVerify.mockReturnValue({ id: 'user-uuid-1' } as any);

  // Default bcrypt stubs
  mockBcryptHash.mockResolvedValue('hashed-pw' as never);
  mockBcryptCompare.mockResolvedValue(true as never);
});

// ─── register() ──────────────────────────────────────────────────────────────────

describe('register()', () => {
  describe('successful registration', () => {
    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue(null);          // no existing user
      mockPrisma.user.create.mockResolvedValue(DB_USER_SELECT);
      mockPrisma.citizen.create.mockResolvedValue({ id: 'citizen-1', userId: 'user-uuid-1', nic: '987654321V', district: 'Colombo' });
      mockPrisma.refreshToken.create.mockResolvedValue(STORED_REFRESH_TOKEN);
    });

    it('returns user, accessToken, and refreshToken', async () => {
      const result = await authService.register(BASE_REGISTER_DTO);

      expect(result).toMatchObject({
        user: DB_USER_SELECT,
        accessToken: 'mock-access-token',
        refreshToken: 'mock-access-token', // sign is mocked to always return same string
      });
    });

    it('hashes the password before persisting', async () => {
      await authService.register(BASE_REGISTER_DTO);

      expect(mockBcryptHash).toHaveBeenCalledWith(BASE_REGISTER_DTO.password, 12);
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ passwordHash: 'hashed-pw' }),
        }),
      );
    });

    it('creates a citizen profile when role is CITIZEN', async () => {
      await authService.register(BASE_REGISTER_DTO);

      expect(mockPrisma.citizen.create).toHaveBeenCalledWith({
        data: {
          userId: DB_USER_SELECT.id,
          nic: BASE_REGISTER_DTO.nic,
          district: BASE_REGISTER_DTO.district,
        },
      });
    });

    it('does NOT create a citizen profile for non-CITIZEN roles', async () => {
      const officerDto = { ...BASE_REGISTER_DTO, role: 'DMC_OFFICER' as any, nic: undefined };
      mockPrisma.user.create.mockResolvedValue({ ...DB_USER_SELECT, role: 'DMC_OFFICER' });

      await authService.register(officerDto);

      expect(mockPrisma.citizen.create).not.toHaveBeenCalled();
    });

    it('stores a refresh token in the database', async () => {
      await authService.register(BASE_REGISTER_DTO);

      expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: DB_USER_SELECT.id,
            expiresAt: expect.any(Date),
          }),
        }),
      );
    });

    it('signs the access token with the correct user payload', async () => {
      await authService.register(BASE_REGISTER_DTO);

      expect(mockJwtSign).toHaveBeenCalledWith(
        expect.objectContaining({
          id: DB_USER_SELECT.id,
          email: DB_USER_SELECT.email,
          role: DB_USER_SELECT.role,
        }),
        process.env.JWT_SECRET,
        expect.any(Object),
      );
    });
  });

  describe('duplicate email', () => {
    it('throws DUPLICATE_ENTRY with status 409 when email is already registered', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(DB_USER_WITH_HASH);

      await expect(authService.register(BASE_REGISTER_DTO)).rejects.toMatchObject({
        code: 'DUPLICATE_ENTRY',
        status: 409,
      });

      // Should not reach user creation
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('does not expose passwordHash in the returned user object', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(DB_USER_SELECT); // no passwordHash field
      mockPrisma.citizen.create.mockResolvedValue({});
      mockPrisma.refreshToken.create.mockResolvedValue(STORED_REFRESH_TOKEN);

      const result = await authService.register(BASE_REGISTER_DTO);

      expect((result.user as any).passwordHash).toBeUndefined();
    });
  });
});

// ─── login() ─────────────────────────────────────────────────────────────────────

describe('login()', () => {
  const LOGIN_DTO = { email: 'jane@example.com', password: 'Password1!' };

  describe('successful login', () => {
    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue(DB_USER_WITH_HASH);
      mockPrisma.refreshToken.create.mockResolvedValue(STORED_REFRESH_TOKEN);
    });

    it('returns user (without passwordHash), accessToken, and refreshToken', async () => {
      const result = await authService.login(LOGIN_DTO);

      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('compares the supplied password against the stored hash', async () => {
      await authService.login(LOGIN_DTO);

      expect(mockBcryptCompare).toHaveBeenCalledWith(LOGIN_DTO.password, DB_USER_WITH_HASH.passwordHash);
    });

    it('stores a new refresh token after successful login', async () => {
      await authService.login(LOGIN_DTO);

      expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: DB_USER_WITH_HASH.id }),
        }),
      );
    });
  });

  describe('invalid credentials', () => {
    it('throws INVALID_CREDENTIALS when user email is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(authService.login(LOGIN_DTO)).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
        status: 401,
      });
    });

    it('throws INVALID_CREDENTIALS when password does not match', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(DB_USER_WITH_HASH);
      mockBcryptCompare.mockResolvedValue(false as never);

      await expect(authService.login(LOGIN_DTO)).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
        status: 401,
      });

      // Should not create a refresh token
      expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
    });
  });

  describe('suspended account', () => {
    it('throws ACCOUNT_SUSPENDED with status 403 before checking the password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...DB_USER_WITH_HASH,
        status: 'suspended',
      });

      // Track bcrypt calls only within this test
      mockBcryptCompare.mockClear();

      await expect(authService.login(LOGIN_DTO)).rejects.toMatchObject({
        code: 'ACCOUNT_SUSPENDED',
        status: 403,
      });

      // bcrypt.compare must NOT be invoked for a suspended account
      expect(mockBcryptCompare).not.toHaveBeenCalled();
      // No refresh token should be persisted either
      expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('does not leak passwordHash through the returned user object', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(DB_USER_WITH_HASH);
      mockPrisma.refreshToken.create.mockResolvedValue(STORED_REFRESH_TOKEN);

      const result = await authService.login(LOGIN_DTO);

      expect((result.user as any).passwordHash).toBeUndefined();
    });
  });
});

// ─── refresh() ───────────────────────────────────────────────────────────────────

describe('refresh()', () => {
  const VALID_TOKEN = 'valid-refresh-token';

  const DB_USER_MINIMAL = {
    id: 'user-uuid-1',
    email: 'jane@example.com',
    role: 'CITIZEN',
    district: 'Colombo',
  };

  describe('valid token refresh', () => {
    beforeEach(() => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(STORED_REFRESH_TOKEN);
      mockPrisma.user.findUnique.mockResolvedValue(DB_USER_MINIMAL);
      mockJwtVerify.mockReturnValue({ id: 'user-uuid-1' } as any);
    });

    it('returns a new accessToken', async () => {
      const result = await authService.refresh(VALID_TOKEN);

      expect(result).toHaveProperty('accessToken', 'mock-access-token');
    });

    it('signs the new access token with the user payload', async () => {
      await authService.refresh(VALID_TOKEN);

      expect(mockJwtSign).toHaveBeenCalledWith(
        expect.objectContaining({ id: DB_USER_MINIMAL.id }),
        process.env.JWT_SECRET,
        expect.any(Object),
      );
    });

    it('verifies the JWT using JWT_REFRESH_SECRET', async () => {
      await authService.refresh(VALID_TOKEN);

      expect(mockJwtVerify).toHaveBeenCalledWith(VALID_TOKEN, process.env.JWT_REFRESH_SECRET);
    });
  });

  describe('expired token', () => {
    it('throws TOKEN_EXPIRED when the stored token is past expiresAt', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        ...STORED_REFRESH_TOKEN,
        expiresAt: new Date(Date.now() - 1000), // 1 second in the past
      });

      await expect(authService.refresh(VALID_TOKEN)).rejects.toMatchObject({
        code: 'TOKEN_EXPIRED',
        status: 401,
      });
    });

    it('throws TOKEN_EXPIRED when the token record does not exist in the database', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(authService.refresh('unknown-token')).rejects.toMatchObject({
        code: 'TOKEN_EXPIRED',
        status: 401,
      });
    });
  });

  describe('invalid token', () => {
    it('throws TOKEN_INVALID when jwt.verify throws', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(STORED_REFRESH_TOKEN);
      mockJwtVerify.mockImplementation(() => { throw new Error('jwt malformed'); });

      await expect(authService.refresh(VALID_TOKEN)).rejects.toMatchObject({
        code: 'TOKEN_INVALID',
        status: 401,
      });
    });
  });

  describe('edge cases', () => {
    it('throws NOT_FOUND (404) when the JWT is valid but the user no longer exists', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(STORED_REFRESH_TOKEN);
      mockJwtVerify.mockReturnValue({ id: 'deleted-user-id' } as any);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(authService.refresh(VALID_TOKEN)).rejects.toMatchObject({
        code: 'NOT_FOUND',
        status: 404,
      });
    });
  });
});

// ─── logout() ────────────────────────────────────────────────────────────────────

describe('logout()', () => {
  const TOKEN = 'some-refresh-token';

  it('deletes the refresh token record matching the supplied token', async () => {
    mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

    await authService.logout(TOKEN);

    expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { token: TOKEN },
    });
  });

  it('resolves without error even when the token does not exist (deleteMany returns 0)', async () => {
    mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

    await expect(authService.logout('nonexistent-token')).resolves.toBeUndefined();
  });

  it('calls deleteMany exactly once', async () => {
    mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

    await authService.logout(TOKEN);

    expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledTimes(1);
  });
});

// ─── getMe() ─────────────────────────────────────────────────────────────────────

describe('getMe()', () => {
  const USER_ID = 'user-uuid-1';

  const FULL_USER = {
    id: USER_ID,
    name: 'Jane Doe',
    email: 'jane@example.com',
    phoneNumber: '0771234567',
    role: 'CITIZEN',
    district: 'Colombo',
    status: 'active',
    createdAt: new Date('2024-01-15T00:00:00.000Z'),
  };

  it('returns the user matching the supplied userId', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(FULL_USER);

    const result = await authService.getMe(USER_ID);

    expect(result).toEqual(FULL_USER);
  });

  it('queries with the correct userId and select fields', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(FULL_USER);

    await authService.getMe(USER_ID);

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: USER_ID },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        role: true,
        district: true,
        status: true,
        createdAt: true,
      },
    });
  });

  it('returns null when no user is found for the given id', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const result = await authService.getMe('nonexistent-id');

    expect(result).toBeNull();
  });

  it('calls user.findUnique exactly once', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(FULL_USER);

    await authService.getMe(USER_ID);

    expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(1);
  });
});
