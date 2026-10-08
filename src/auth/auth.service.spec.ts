import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../common/audit/audit.service';

describe('AuthService', () => {
  const userRecord = {
    id: 'user-1',
    email: 'person@example.com',
    role: 'USER',
    status: 'ACTIVE',
    passwordHash: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    emailVerified: false,
  };
  const users = {
    createUser: jest.fn(),
    findByEmail: jest.fn(),
  } as unknown as UsersService;
  const jwt = {
    signAsync: jest.fn(async (payload: { type?: string }) =>
      payload.type === 'refresh' ? 'refresh-token-value' : 'access-token-value',
    ),
  } as never;
  const refreshTokenCreateMock = jest.fn().mockResolvedValue({});
  const prisma = {
    refreshToken: {
      create: refreshTokenCreateMock,
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaService;
  const config = {
    getOrThrow: jest.fn((key: string) => key),
    get: jest.fn((_key: string, fallback: string) => fallback),
  } as never;
  const audit = {
    record: jest.fn().mockResolvedValue({}),
  } as unknown as AuditService;
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(users, jwt, prisma, config, audit);
  });

  it('registers with an Argon2id hash and returns only public user fields', async () => {
    const passwordHash = await argon2.hash('a-long-safe-password', {
      type: argon2.argon2id,
    });
    (users.createUser as jest.Mock).mockResolvedValue({
      ...userRecord,
      passwordHash,
    });
    const result = await service.register(
      'person@example.com',
      'a-long-safe-password',
    );
    expect(await argon2.verify(passwordHash, 'a-long-safe-password')).toBe(
      true,
    );
    expect(result.user).toEqual({
      id: 'user-1',
      email: 'person@example.com',
      role: 'USER',
    });
    expect(result).not.toHaveProperty('passwordHash');
    expect(refreshTokenCreateMock).toHaveBeenCalledTimes(1);
  });

  it('rejects duplicate email and invalid passwords', async () => {
    (users.createUser as jest.Mock).mockRejectedValue({ code: 'P2002' });
    await expect(
      service.register('person@example.com', 'a-long-safe-password'),
    ).rejects.toBeInstanceOf(ConflictException);
    const passwordHash = await argon2.hash('correct-password');
    (users.findByEmail as jest.Mock).mockResolvedValue({
      ...userRecord,
      passwordHash,
    });
    await expect(
      service.login('person@example.com', 'incorrect-password'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects suspended users', async () => {
    (users.findByEmail as jest.Mock).mockResolvedValue({
      ...userRecord,
      status: 'SUSPENDED',
    });
    await expect(
      service.login('person@example.com', 'some-password'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
