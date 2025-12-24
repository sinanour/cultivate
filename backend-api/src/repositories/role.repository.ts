import { PrismaClient, Role } from '@prisma/client';

export class RoleRepository {
  constructor(private prisma: PrismaClient) {}

  async findAll(): Promise<Role[]> {
    return this.prisma.role.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string): Promise<Role | null> {
    return this.prisma.role.findUnique({
      where: { id },
    });
  }

  async findByName(name: string): Promise<Role | null> {
    return this.prisma.role.findUnique({
      where: { name },
    });
  }

  async create(data: { name: string }): Promise<Role> {
    return this.prisma.role.create({
      data,
    });
  }

  async update(id: string, data: { name: string }): Promise<Role> {
    return this.prisma.role.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Role> {
    return this.prisma.role.delete({
      where: { id },
    });
  }

  async countReferences(id: string): Promise<number> {
    return this.prisma.assignment.count({
      where: { roleId: id },
    });
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.role.count({
      where: { id },
    });
    return count > 0;
  }
}
