/**
 * @file auth.service.ts
 * @description Authentication service for the Smart Disaster Early-Warning and Emergency
 * Coordination System. Handles user registration, login, JWT access/refresh token lifecycle,
 * logout, and current-user retrieval. All password storage uses bcrypt; tokens are signed
 * with environment-supplied secrets. Refresh tokens are persisted in the database so they
 * can be explicitly revoked on logout.
 *
 * @solid
 * - SRP: This service ONLY handles authentication concerns (login, register, logout, token refresh).
 *        User profile management would be in a separate user.service.ts.
 * - OCP: New authentication methods (OAuth, SSO) can be added without modifying existing password auth.
 * - LSP: All auth errors follow { code, message, status } contract.
 * - DIP: Uses bcrypt and jwt abstractions, not direct crypto implementations.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { RegisterDto, LoginDto } from '../schemas/auth.schema';

/**
 * @description Generates a short-lived JWT access token containing the user's id, email,
 * role, and optional district. Expiry is controlled by the `JWT_EXPIRES_IN` environment
 * variable (defaults to 15 minutes).
 *
 * @param user - Subset of user fields required for the token payload.
 * @param user.id - The user's unique identifier.
 * @param user.email - The user's email address.
 * @param user.role - The user's application role (e.g. `CITIZEN`, `DMC_OFFICER`).
 * @param user.district - The user's associated district, if any.
 * @returns A signed JWT access token string.
 */
function generateAccessToken(user: { id: string; email: string; role: string; district?: string | null }) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, district: user.district },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
}

/**
 * @description Generates a long-lived JWT refresh token (7-day expiry) containing only the
 * user's id. Used to obtain new access tokens without re-authentication.
 *
 * @param userId - The unique identifier of the user.
 * @returns A signed JWT refresh token string.
 */
function generateRefreshToken(userId: string) {
  return jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d' });
}

/**
 * @description Registers a new user account. Hashes the provided password with bcrypt
 * (12 salt rounds), creates the `User` record, and—when the role is `CITIZEN`—also creates
 * the associated `Citizen` profile. On success, issues a fresh access/refresh token pair and
 * persists the refresh token in the database.
 *
 * @param dto - Validated registration payload from the request body.
 * @param dto.name - The user's full name.
 * @param dto.email - The user's email address (must be unique).
 * @param dto.password - Plain-text password (will be hashed before storage).
 * @param dto.phoneNumber - The user's contact number.
 * @param dto.role - Application role to assign (e.g. `CITIZEN`, `RESCUE_TEAM`).
 * @param dto.district - District the user belongs to (required for some roles).
 * @param dto.nic - National Identity Card number (required when role is `CITIZEN`).
 * @returns An object containing the created `user` (without password hash), a JWT
 *   `accessToken`, and a JWT `refreshToken`.
 * @throws `{ code: 'DUPLICATE_ENTRY', status: 409 }` when the email is already registered.
 *
 * @example
 * const result = await register({
 *   name: 'Jane Doe',
 *   email: 'jane@example.com',
 *   password: 'Secret123!',
 *   phoneNumber: '+94771234567',
 *   role: 'CITIZEN',
 *   district: 'Colombo',
 *   nic: '199012345678',
 * });
 * // result.accessToken  → short-lived JWT
 * // result.refreshToken → long-lived JWT
 */
export async function register(dto: RegisterDto) {
  const existing = await prisma.user.findUnique({ where: { email: dto.email } });
  if (existing) throw { code: 'DUPLICATE_ENTRY', message: 'Email already registered', status: 409 };

  const passwordHash = await bcrypt.hash(dto.password, 12);
  const user = await prisma.user.create({
    data: {
      name: dto.name,
      email: dto.email,
      phoneNumber: dto.phoneNumber,
      passwordHash,
      role: dto.role as any,
      district: dto.district,
    },
    select: { id: true, name: true, email: true, role: true, district: true },
  });

  // Create citizen profile if role is CITIZEN
  if (dto.role === 'CITIZEN') {
    await prisma.citizen.create({
      data: { userId: user.id, nic: dto.nic, district: dto.district },
    });
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user.id);

  await prisma.refreshToken.create({
    data: { token: refreshToken, userId: user.id, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
  });

  return { user, accessToken, refreshToken };
}

/**
 * @description Authenticates an existing user with their email and password. Verifies the
 * bcrypt password hash, checks account status, then issues a new access/refresh token pair.
 * The refresh token is persisted in the database.
 *
 * @param dto - Validated login payload from the request body.
 * @param dto.email - The user's registered email address.
 * @param dto.password - The plain-text password to verify.
 * @returns An object containing the authenticated `user` (without password hash), a JWT
 *   `accessToken`, and a JWT `refreshToken`.
 * @throws `{ code: 'INVALID_CREDENTIALS', status: 401 }` when the email does not exist or
 *   the password does not match.
 * @throws `{ code: 'ACCOUNT_SUSPENDED', status: 403 }` when the account has been suspended.
 *
 * @example
 * const result = await login({ email: 'jane@example.com', password: 'Secret123!' });
 * // result.user.role → 'CITIZEN'
 * // Store result.refreshToken in an HttpOnly cookie for secure rotation.
 */
export async function login(dto: LoginDto) {
  const user = await prisma.user.findUnique({
    where: { email: dto.email },
    select: { id: true, name: true, email: true, passwordHash: true, role: true, district: true, status: true },
  });

  if (!user) throw { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password', status: 401 };
  if (user.status === 'suspended') throw { code: 'ACCOUNT_SUSPENDED', message: 'Account is suspended', status: 403 };

  const valid = await bcrypt.compare(dto.password, user.passwordHash);
  if (!valid) throw { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password', status: 401 };

  const { passwordHash: _ph, ...safeUser } = user;
  const accessToken = generateAccessToken(safeUser);
  const refreshToken = generateRefreshToken(user.id);

  await prisma.refreshToken.create({
    data: { token: refreshToken, userId: user.id, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
  });

  return { user: safeUser, accessToken, refreshToken };
}

/**
 * @description Exchanges a valid refresh token for a new JWT access token. Validates the
 * token against the database record (existence + expiry) and then verifies the JWT signature
 * before issuing the replacement. The refresh token itself is **not** rotated by this
 * operation—it remains valid until logout or natural expiry.
 *
 * @param token - The refresh token string previously issued by `register` or `login`.
 * @returns An object containing a new `accessToken` JWT string.
 * @throws `{ code: 'TOKEN_EXPIRED', status: 401 }` when the token does not exist in the
 *   database or its `expiresAt` timestamp has passed.
 * @throws `{ code: 'TOKEN_INVALID', status: 401 }` when the JWT signature verification
 *   fails (e.g. tampered token or wrong secret).
 * @throws `{ code: 'NOT_FOUND', status: 404 }` when the user referenced by the token no
 *   longer exists.
 *
 * @example
 * // Called automatically by the frontend when a 401 is received on an API request.
 * const { accessToken } = await refresh(storedRefreshToken);
 */
export async function refresh(token: string) {
  const stored = await prisma.refreshToken.findUnique({ where: { token } });
  if (!stored || stored.expiresAt < new Date()) {
    throw { code: 'TOKEN_EXPIRED', message: 'Refresh token expired or invalid', status: 401 };
  }

  let payload: { id: string };
  try {
    payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as { id: string };
  } catch {
    throw { code: 'TOKEN_INVALID', message: 'Invalid refresh token', status: 401 };
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { id: true, email: true, role: true, district: true },
  });
  if (!user) throw { code: 'NOT_FOUND', message: 'User not found', status: 404 };

  const newAccessToken = generateAccessToken(user);
  return { accessToken: newAccessToken };
}

/**
 * @description Logs the user out by deleting their refresh token from the database. Once
 * removed, the token can no longer be used to obtain new access tokens. Any currently valid
 * access tokens will continue to work until they naturally expire (up to 15 minutes).
 *
 * @param token - The refresh token string to invalidate.
 * @returns A promise that resolves when the deletion completes. Resolves silently even if
 *   the token was not found (idempotent behaviour).
 *
 * @example
 * await logout(req.cookies.refreshToken);
 * res.clearCookie('refreshToken');
 */
export async function logout(token: string) {
  await prisma.refreshToken.deleteMany({ where: { token } });
}

/**
 * @description Retrieves the full profile of the currently authenticated user by their
 * database id. Password hash and internal-only fields are excluded from the result.
 *
 * @param userId - The unique identifier of the user whose profile to fetch.
 * @returns A promise resolving to the user object (id, name, email, phoneNumber, role,
 *   district, status, createdAt), or `null` if no user with that id exists.
 *
 * @example
 * // Typically called from the /auth/me route handler after JWT verification.
 * const profile = await getMe(req.user.id);
 * if (!profile) return res.status(404).json({ message: 'User not found' });
 */
export async function getMe(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, phoneNumber: true, role: true, district: true, status: true, createdAt: true },
  });
}
