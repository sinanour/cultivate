import type { User, UserRole } from '../../types';
import { ApiClient } from './api.client';

interface AuthorizationRuleInput {
    geographicAreaId: string;
    ruleType: 'ALLOW' | 'DENY';
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
    static async getUsers(): Promise<User[]> {
        return ApiClient.get<User[]>('/users');
    }

    static async getUser(id: string): Promise<User> {
        return ApiClient.get<User>(`/users/${id}`);
    }

    static async createUser(data: CreateUserData): Promise<User> {
        return ApiClient.post<User>('/users', data);
    }

    static async updateUser(id: string, data: UpdateUserData): Promise<User> {
        return ApiClient.put<User>(`/users/${id}`, data);
    }

    static async deleteUser(id: string): Promise<void> {
        return ApiClient.delete<void>(`/users/${id}`);
    }

    // Profile management (self-service for all users)
    static async getCurrentUserProfile(): Promise<User> {
        return ApiClient.get<User>('/users/me/profile');
    }

    static async updateCurrentUserProfile(data: UpdateProfileData): Promise<User> {
        return ApiClient.put<User>('/users/me/profile', data);
    }
}
