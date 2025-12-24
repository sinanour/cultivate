import { Role } from '@prisma/client';
import { RoleRepository } from '../repositories/role.repository';

export class RoleService {
  constructor(private roleRepository: RoleRepository) {}

  async getAllRoles(): Promise<Role[]> {
    return this.roleRepository.findAll();
  }

  async getRoleById(id: string): Promise<Role> {
    const role = await this.roleRepository.findById(id);
    if (!role) {
      throw new Error('Role not found');
    }
    return role;
  }

  async createRole(data: { name: string }): Promise<Role> {
    const existing = await this.roleRepository.findByName(data.name);
    if (existing) {
      throw new Error('Role with this name already exists');
    }

    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Role name is required');
    }

    return this.roleRepository.create(data);
  }

  async updateRole(id: string, data: { name: string }): Promise<Role> {
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

    return this.roleRepository.update(id, data);
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
