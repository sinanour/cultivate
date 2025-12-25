import { AuthService } from '../../services/auth.service';
import { UserRepository } from '../../repositories/user.repository';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('../../repositories/user.repository');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

describe('AuthService', () => {
    let authService: AuthService;
    let mockUserRepository: jest.Mocked<UserRepository>;

    beforeEach(() => {
        mockUserRepository = new UserRepository(null as any) as jest.Mocked<UserRepository>;
        authService = new AuthService(mockUserRepository);
        jest.clearAllMocks();
    });

    describe('login', () => {
        it('should successfully login with valid credentials', async () => {
            const mockUser = {
                id: 'user-123',
                email: 'test@example.com',
                password: 'hashedPassword',
                role: 'EDITOR',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            mockUserRepository.findByEmail = jest.fn().mockResolvedValue(mockUser);
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);
            (jwt.sign as jest.Mock).mockReturnValue('mock-token');

            const result = await authService.login({
                email: 'test@example.com',
                password: 'password123',
            });

            expect(result).toHaveProperty('accessToken');
            expect(result).toHaveProperty('refreshToken');
            expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
        });

        it('should throw error for invalid email', async () => {
            mockUserRepository.findByEmail = jest.fn().mockResolvedValue(null);

            await expect(
                authService.login({
                    email: 'invalid@example.com',
                    password: 'password123',
                })
            ).rejects.toThrow('Invalid credentials');
        });

        it('should throw error for invalid password', async () => {
            const mockUser = {
                id: 'user-123',
                email: 'test@example.com',
                password: 'hashedPassword',
                role: 'EDITOR',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            mockUserRepository.findByEmail = jest.fn().mockResolvedValue(mockUser);
            (bcrypt.compare as jest.Mock).mockResolvedValue(false);

            await expect(
                authService.login({
                    email: 'test@example.com',
                    password: 'wrongpassword',
                })
            ).rejects.toThrow('Invalid credentials');
        });
    });

    describe('refreshAccessToken', () => {
        it('should successfully refresh access token', async () => {
            const mockUser = {
                id: 'user-123',
                email: 'test@example.com',
                password: 'hashedPassword',
                role: 'EDITOR',
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            const mockPayload = { userId: 'user-123' };

            (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
            mockUserRepository.findById = jest.fn().mockResolvedValue(mockUser);
            (jwt.sign as jest.Mock).mockReturnValue('new-access-token');

            const result = await authService.refreshAccessToken('valid-refresh-token');

            expect(result).toHaveProperty('accessToken');
            expect(result).toHaveProperty('refreshToken');
            expect(jwt.verify).toHaveBeenCalled();
            expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123');
        });

        it('should throw error for invalid refresh token', async () => {
            (jwt.verify as jest.Mock).mockImplementation(() => {
                throw new Error('Invalid token');
            });

            await expect(authService.refreshAccessToken('invalid-token')).rejects.toThrow();
        });
    });

    describe('getUserInfo', () => {
        it('should return user info for valid user ID', async () => {
            const mockUser = {
                id: 'user-123',
                email: 'test@example.com',
                password: 'hashedPassword',
                role: 'EDITOR',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            mockUserRepository.findById = jest.fn().mockResolvedValue(mockUser);

            const result = await authService.getUserInfo('user-123');

            expect(result).toHaveProperty('id', 'user-123');
            expect(result).toHaveProperty('email', 'test@example.com');
            expect(result).not.toHaveProperty('password');
        });

        it('should throw error for non-existent user', async () => {
            mockUserRepository.findById = jest.fn().mockResolvedValue(null);

            await expect(authService.getUserInfo('invalid-id')).rejects.toThrow('User not found');
        });
    });

    describe('verifyToken', () => {
        it('should successfully verify valid token', () => {
            const mockPayload = { userId: 'user-123', email: 'test@example.com', role: 'EDITOR' };
            (jwt.verify as jest.Mock).mockReturnValue(mockPayload);

            const result = authService.verifyToken('valid-token');

            expect(result).toEqual(mockPayload);
        });

        it('should throw error for invalid token', () => {
            (jwt.verify as jest.Mock).mockImplementation(() => {
                throw new Error('Invalid token');
            });

            expect(() => authService.verifyToken('invalid-token')).toThrow();
        });
    });
});
