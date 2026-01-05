import { PrismaClient, User, UserRole } from '@prisma/client';

export class UserRepository {
  constructor(private prisma: PrismaClient) {}

  async findAll(): Promise<User[]> {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async create(data: { displayName?: string | null; email: string; passwordHash: string; role: UserRole }): Promise<User> {
    return this.prisma.user.create({
      data,
    });
  }

  async update(
    id: string,
    data: { displayName?: string | null; email?: string; passwordHash?: string; role?: UserRole }
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async updatePassword(userId: string, passwordHash: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  async updateRole(userId: string, role: UserRole): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
    });
  }
}

