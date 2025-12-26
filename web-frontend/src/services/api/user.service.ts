import type { User, UserRole } from '../../types';
import { ApiClient } from './api.client';

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
    static async getUsers(): Promise<User[]> {
        return ApiClient.get<User[]>('/users');
    }

    static async createUser(data: CreateUserData): Promise<User> {
        return ApiClient.post<User>('/users', data);
    }

    static async updateUser(id: string, data: UpdateUserData): Promise<User> {
        return ApiClient.put<User>(`/users/${id}`, data);
    }
}
