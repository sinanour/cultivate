import { Role } from '@prisma/client';
import { RoleRepository } from '../repositories/role.repository';

export class RoleService {
  // Predefined roles that are seeded
  private readonly PREDEFINED_ROLES = [
    'Facilitator',
    'Animator',
    'Host',
    'Teacher',
    'Participant',
    'Organizer',
    'Volunteer',
  ];

  constructor(private roleRepository: RoleRepository) {}

  private addComputedFields(role: Role) {
    return {
      ...role,
      isPredefined: this.PREDEFINED_ROLES.includes(role.name),
    };
  }

  async getAllRoles(): Promise<Role[]> {
    const roles = await this.roleRepository.findAll();
    return roles.map((r) => this.addComputedFields(r));
  }

  async getRoleById(id: string): Promise<Role> {
    const role = await this.roleRepository.findById(id);
    if (!role) {
      throw new Error('Role not found');
    }
    return this.addComputedFields(role);
  }

  async createRole(data: { name: string }): Promise<Role> {
    const existing = await this.roleRepository.findByName(data.name);
    if (existing) {
      throw new Error('Role with this name already exists');
    }

    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Role name is required');
    }

    const created = await this.roleRepository.create(data);
    return this.addComputedFields(created);
  }

  async updateRole(id: string, data: { name: string; version?: number }): Promise<Role> {
    const existing = await this.roleRepository.findById(id);
    if (!existing) {
      throw new Error('Role not found');
    }

    const duplicate = await this.roleRepository.findByName(data.name);
    if (duplicate && duplicate.id !== id) {
      throw new Error('Role with this name already exists');
    }

    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Role name is required');
    }

    try {
      const updated = await this.roleRepository.update(id, data);
      return this.addComputedFields(updated);
    } catch (error) {
      if (error instanceof Error && error.message === 'VERSION_CONFLICT') {
        throw new Error('VERSION_CONFLICT');
      }
      throw error;
    }
  }

  async deleteRole(id: string): Promise<void> {
    const existing = await this.roleRepository.findById(id);
    if (!existing) {
      throw new Error('Role not found');
    }

    const referenceCount = await this.roleRepository.countReferences(id);
    if (referenceCount > 0) {
      throw new Error(`Cannot delete role. It is referenced by ${referenceCount} assignment(s)`);
    }

    await this.roleRepository.delete(id);
  }
}
