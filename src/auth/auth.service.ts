import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../database/prisma.service';
import { UsersService } from '../users/users.service';
import { AuditService } from '../common/audit/audit.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async register(email: string, password: string) {
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    let user;
    try {
      user = await this.users.createUser(email, passwordHash);
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002')
        throw new ConflictException('Email is already registered');
      throw error;
    }
    await this.audit.record('auth.registered', 'user', user.id, user.id);
    return this.issueTokens(user);
  }

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (
      !user ||
      user.status !== 'ACTIVE' ||
      !(await argon2.verify(user.passwordHash, password))
    ) {
      await this.audit.record('auth.login_failed', 'authentication');
      throw new UnauthorizedException('Invalid email or password');
    }
    await this.audit.record('auth.login_succeeded', 'user', user.id, user.id);
    return this.issueTokens(user);
  }

  async refresh(token: string) {
    const hash = this.hash(token);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
      include: { user: true },
    });
    if (
      !record ||
      record.revokedAt ||
      record.expiresAt <= new Date() ||
      record.user.status !== 'ACTIVE'
    ) {
      if (record?.revokedAt)
        await this.prisma.refreshToken.updateMany({
          where: { familyId: record.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }
    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id: record.id, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { revokedAt: new Date() },
    });
    if (!claimed.count)
      throw new UnauthorizedException('Refresh token is invalid or expired');
    const accessToken = await this.accessToken(record.user);
    const nextRefresh = await this.refreshToken(
      record.user.id,
      record.familyId,
    );
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { replacedBy: this.hash(nextRefresh.token) },
    });
    await this.audit.record(
      'auth.refresh_rotated',
      'refresh_token',
      record.user.id,
      record.id,
    );
    return {
      accessToken,
      refreshToken: nextRefresh.token,
      user: this.publicUser(record.user),
    };
  }

  async logout(token: string): Promise<{ success: true }> {
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(token) },
      select: { id: true, userId: true },
    });
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hash(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (existing)
      await this.audit.record(
        'auth.logout',
        'refresh_token',
        existing.userId,
        existing.id,
      );
    return { success: true };
  }

  private async issueTokens(user: { id: string; email: string; role: string }) {
    const refresh = await this.refreshToken(user.id, randomUUID());
    return {
      accessToken: await this.accessToken(user),
      refreshToken: refresh.token,
      user: this.publicUser(user),
    };
  }
  private async accessToken(user: { id: string; email: string; role: string }) {
    return this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role },
      {
        secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN', '15m'),
      },
    );
  }
  private async refreshToken(userId: string, familyId: string) {
    const token = await this.jwt.signAsync(
      { sub: userId, type: 'refresh' },
      {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '30d'),
      },
    );
    const expiresAt = new Date(
      Date.now() +
        this.durationMs(this.config.get('JWT_REFRESH_EXPIRES_IN', '30d')),
    );
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: this.hash(token), familyId, expiresAt },
    });
    return { token };
  }
  private durationMs(input: string): number {
    const m = /^(\d+)([smhd])$/.exec(input);
    if (!m)
      throw new Error('JWT_REFRESH_EXPIRES_IN must use a duration such as 30d');
    return (
      Number(m[1]) *
      { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[
        m[2] as 's' | 'm' | 'h' | 'd'
      ]
    );
  }
  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
  private publicUser(user: { id: string; email: string; role: string }) {
    return { id: user.id, email: user.email, role: user.role };
  }
}
