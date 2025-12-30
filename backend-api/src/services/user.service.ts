import { User, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import { UserRepository } from '../repositories/user.repository';

interface CreateUserData {
  email: string;
  password: string;
  role: UserRole;
}

interface UpdateUserData {
  email?: string;
  password?: string;
  role?: UserRole;
}

export class UserService {
  constructor(private userRepository: UserRepository) {}

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

  async createUser(data: CreateUserData): Promise<Omit<User, 'passwordHash'>> {
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

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Create user
    const created = await this.userRepository.create({
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

    const updateData: { email?: string; passwordHash?: string; role?: UserRole } = {};

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
    }

    // Update role if provided
    if (data.role !== undefined) {
      updateData.role = data.role;
    }

    const updated = await this.userRepository.update(id, updateData);
    const { passwordHash: _, ...userWithoutPassword } = updated;
    return userWithoutPassword;
  }
}
