import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: {
        email: email.toLowerCase(),
      },
    });
  }

  async createUser(email: string, passwordHash: string) {
    const normalizedEmail = email.toLowerCase();

    return this.prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
      },
    });
  }

  async updateLastSeen(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: {
        updatedAt: new Date(),
      },
    });
  }
}
