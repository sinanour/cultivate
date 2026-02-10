import { User, UserRole, AuthorizationRuleType } from '@prisma/client';
import bcrypt from 'bcrypt';
import { UserRepository } from '../repositories/user.repository';
import { UserGeographicAuthorizationRepository } from '../repositories/user-geographic-authorization.repository';
import { PrismaClient } from '@prisma/client';

interface AuthorizationRuleInput {
  geographicAreaId: string;
  ruleType: AuthorizationRuleType;
}

interface CreateUserData {
  displayName?: string;
  email: string;
  password: string;
  role: UserRole;
  authorizationRules?: AuthorizationRuleInput[];
}

interface UpdateUserData {
  displayName?: string | null;
  email?: string;
  password?: string;
  role?: UserRole;
}

interface UpdateProfileData {
  displayName?: string | null;
  currentPassword?: string;
  newPassword?: string;
}

export class UserService {
  constructor(
    private userRepository: UserRepository,
    // @ts-expect-error - Reserved for future authorization rule management
    private authorizationRepository: UserGeographicAuthorizationRepository,
    private prisma: PrismaClient
  ) { }

  async getAllUsers(): Promise<Omit<User, 'passwordHash'>[]> {
    const users = await this.userRepository.findAll();
    // Remove password hash from response
    return users.map(({ passwordHash, ...user }) => user);
  }

  async getUserById(id: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async createUser(data: CreateUserData, createdBy: string): Promise<Omit<User, 'passwordHash'>> {
    // Validate required fields
    if (!data.email || data.email.trim().length === 0) {
      throw new Error('Email is required');
    }

    if (!data.password || data.password.trim().length === 0) {
      throw new Error('Password is required');
    }

    if (data.password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    if (!data.role) {
      throw new Error('Role is required');
    }

    // Check for duplicate email
    const existing = await this.userRepository.findByEmail(data.email);
    if (existing) {
      throw new Error('User with this email already exists');
    }

    // Validate createdBy user exists (required for authorization rules)
    if (data.authorizationRules && data.authorizationRules.length > 0) {
      const creatorUser = await this.userRepository.findById(createdBy);
      if (!creatorUser) {
        throw new Error('Creator user not found - cannot create authorization rules');
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);

    // If authorization rules provided, create user and rules in a transaction
    if (data.authorizationRules && data.authorizationRules.length > 0) {
      const result = await this.prisma.$transaction(async (tx) => {
        // Create user
        const created = await tx.user.create({
          data: {
            displayName: data.displayName?.trim() || null,
            email: data.email.trim(),
            passwordHash,
            role: data.role,
          },
        });

        // Create authorization rules
        await tx.userGeographicAuthorization.createMany({
          data: data.authorizationRules!.map(rule => ({
            userId: created.id,
            geographicAreaId: rule.geographicAreaId,
            ruleType: rule.ruleType,
            createdBy,
          })),
        });

        return created;
      });

      const { passwordHash: _, ...userWithoutPassword } = result;
      return userWithoutPassword;
    }

    // Create user without authorization rules
    const created = await this.userRepository.create({
      displayName: data.displayName?.trim() || null,
      email: data.email.trim(),
      passwordHash,
      role: data.role,
    });

    const { passwordHash: _, ...userWithoutPassword } = created;
    return userWithoutPassword;
  }

  async updateUser(id: string, data: UpdateUserData): Promise<Omit<User, 'passwordHash'>> {
    const existing = await this.userRepository.findById(id);
    if (!existing) {
      throw new Error('User not found');
    }

    const updateData: { displayName?: string | null; email?: string; passwordHash?: string; role?: UserRole; lastInvalidationTimestamp?: Date } = {};

    // Update displayName if provided (including null to clear)
    if ('displayName' in data) {
      updateData.displayName = data.displayName?.trim() || null;
    }

    // Validate and update email if provided
    if (data.email !== undefined) {
      if (!data.email || data.email.trim().length === 0) {
        throw new Error('Email is required');
      }

      // Check for duplicate email
      const duplicate = await this.userRepository.findByEmail(data.email);
      if (duplicate && duplicate.id !== id) {
        throw new Error('User with this email already exists');
      }

      updateData.email = data.email.trim();
    }

    // Hash and update password if provided
    if (data.password !== undefined && data.password.trim().length > 0) {
      if (data.password.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
      // Automatically invalidate all tokens when password changes
      updateData.lastInvalidationTimestamp = new Date();
    }

    // Update role if provided
    if (data.role !== undefined) {
      updateData.role = data.role;
    }

    const updated = await this.userRepository.update(id, updateData);
    const { passwordHash: _, ...userWithoutPassword } = updated;
    return userWithoutPassword;
  }

  async deleteUser(id: string): Promise<void> {
    // Validate user exists
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if this is the last administrator
    if (user.role === UserRole.ADMINISTRATOR) {
      const allUsers = await this.userRepository.findAll();
      const adminCount = allUsers.filter(u => u.role === UserRole.ADMINISTRATOR).length;

      if (adminCount <= 1) {
        throw new Error('Cannot delete the last administrator user');
      }
    }

    // Delete user and all associated authorization rules in a transaction
    await this.prisma.$transaction(async (tx) => {
      // Delete all geographic authorization rules for this user
      await tx.userGeographicAuthorization.deleteMany({
        where: { userId: id },
      });

      // Delete the user
      await tx.user.delete({
        where: { id },
      });
    });
  }

  // Profile management methods (self-service for all users)
  async getCurrentUserProfile(userId: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async updateCurrentUserProfile(userId: string, data: UpdateProfileData): Promise<Omit<User, 'passwordHash'>> {
    const existing = await this.userRepository.findById(userId);
    if (!existing) {
      throw new Error('User not found');
    }

    const updateData: { displayName?: string | null; passwordHash?: string; lastInvalidationTimestamp?: Date } = {};

    // Update displayName if provided (including null to clear)
    if ('displayName' in data) {
      updateData.displayName = data.displayName?.trim() || null;
    }

    // Handle password change with current password validation
    if (data.newPassword !== undefined && data.newPassword.trim().length > 0) {
      // Validate current password is provided
      if (!data.currentPassword) {
        const error = new Error('Current password is required when changing password');
        (error as any).code = 'INVALID_CURRENT_PASSWORD';
        throw error;
      }

      // Validate current password matches
      const isValidPassword = await bcrypt.compare(data.currentPassword, existing.passwordHash);
      if (!isValidPassword) {
        const error = new Error('Current password is incorrect');
        (error as any).code = 'INVALID_CURRENT_PASSWORD';
        throw error;
      }

      // Validate new password length
      if (data.newPassword.length < 8) {
        throw new Error('New password must be at least 8 characters');
      }

      // Hash new password
      updateData.passwordHash = await bcrypt.hash(data.newPassword, 10);
      // Automatically invalidate all tokens when password changes
      updateData.lastInvalidationTimestamp = new Date();
    }

    // Only update if there are changes
    if (Object.keys(updateData).length === 0) {
      const { passwordHash: _, ...userWithoutPassword } = existing;
      return userWithoutPassword;
    }

    const updated = await this.userRepository.update(userId, updateData);
    const { passwordHash: _, ...userWithoutPassword } = updated;
    return userWithoutPassword;
  }
}
