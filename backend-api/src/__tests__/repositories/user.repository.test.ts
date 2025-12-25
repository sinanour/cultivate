import { UserRepository } from '../../repositories/user.repository';
import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client');

describe('UserRepository', () => {
    let repository: UserRepository;
    let mockPrisma: jest.Mocked<PrismaClient>;

    beforeEach(() => {
        mockPrisma = {
            user: {
                findUnique: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
                delete: jest.fn(),
            },
        } as any;

        repository = new UserRepository(mockPrisma);
        jest.clearAllMocks();
    });

    describe('findByEmail', () => {
        it('should find user by email', async () => {
            const mockUser = { id: '1', email: 'test@example.com', passwordHash: 'hash', role: 'EDITOR', createdAt: new Date(), updatedAt: new Date() };
            mockPrisma.user.findUnique = jest.fn().mockResolvedValue(mockUser);

            const result = await repository.findByEmail('test@example.com');

            expect(result).toEqual(mockUser);
            expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
                where: { email: 'test@example.com' },
            });
        });

        it('should return null for non-existent email', async () => {
            mockPrisma.user.findUnique = jest.fn().mockResolvedValue(null);

            const result = await repository.findByEmail('nonexistent@example.com');

            expect(result).toBeNull();
        });
    });

    describe('findById', () => {
        it('should find user by ID', async () => {
            const mockUser = { id: '1', email: 'test@example.com', passwordHash: 'hash', role: 'EDITOR', createdAt: new Date(), updatedAt: new Date() };
            mockPrisma.user.findUnique = jest.fn().mockResolvedValue(mockUser);

            const result = await repository.findById('1');

            expect(result).toEqual(mockUser);
            expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
                where: { id: '1' },
            });
        });

        it('should return null for non-existent ID', async () => {
            mockPrisma.user.findUnique = jest.fn().mockResolvedValue(null);

            const result = await repository.findById('invalid-id');

            expect(result).toBeNull();
        });
    });
});
