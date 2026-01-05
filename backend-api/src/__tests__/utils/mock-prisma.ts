import { PrismaClient } from '@prisma/client';
import { DeepMockProxy, mockDeep, mockReset } from 'jest-mock-extended';

/**
 * Mock Prisma Client for unit tests
 * This ensures tests don't touch the real database
 */
export type MockPrismaClient = DeepMockProxy<PrismaClient>;

let mockPrisma: MockPrismaClient;

/**
 * Get a mocked Prisma client instance
 * Call this in your test setup to get a fully mocked Prisma client
 */
export function getMockPrismaClient(): MockPrismaClient {
    if (!mockPrisma) {
        mockPrisma = mockDeep<PrismaClient>();
    }
    return mockPrisma;
}

/**
 * Reset the mock Prisma client
 * Call this in beforeEach to ensure clean state between tests
 */
export function resetMockPrismaClient(): void {
    if (mockPrisma) {
        mockReset(mockPrisma);
    }
}

/**
 * Create a fresh mock Prisma client
 * Useful when you need a completely new instance
 */
export function createMockPrismaClient(): MockPrismaClient {
    return mockDeep<PrismaClient>();
}
