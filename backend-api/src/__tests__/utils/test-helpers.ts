import { PrismaClient, UserRole, User } from '@prisma/client';

/**
 * Test helper utilities for backend API tests
 * Provides functions for generating unique test data, safe cleanup, and common test operations
 */
export class TestHelpers {
    private static emailCounter = 0;

    /**
     * Generate a unique email address for testing
     * Uses timestamp and counter to ensure uniqueness across parallel tests
     * 
     * @param prefix - Optional prefix for the email (default: 'test')
     * @returns A unique email address in format: prefix-timestamp-counter@example.com
     * 
     * @example
     * const email1 = TestHelpers.generateUniqueEmail(); // test-1234567890-1@example.com
     * const email2 = TestHelpers.generateUniqueEmail('admin'); // admin-1234567890-2@example.com
     */
    static generateUniqueEmail(prefix = 'test'): string {
        const timestamp = Date.now();
        const counter = ++this.emailCounter;
        return `${prefix}-${timestamp}-${counter}@example.com`;
    }

    /**
     * Safely delete a record, handling the case where it doesn't exist
     * Catches Prisma P2025 error (record not found) and returns null instead of throwing
     * 
     * @param deleteOperation - A function that performs the delete operation
     * @returns The deleted record or null if it didn't exist
     * 
     * @example
     * await TestHelpers.safeDelete(() => 
     *   prisma.user.delete({ where: { id: userId } })
     * );
     */
    static async safeDelete<T>(deleteOperation: () => Promise<T>): Promise<T | null> {
        try {
            return await deleteOperation();
        } catch (error: any) {
            if (error.code === 'P2025') {
                // Record not found - this is OK during cleanup
                return null;
            }
            throw error;
        }
    }

    /**
     * Create a test user with unique email
     * 
     * @param prisma - Prisma client instance
     * @param role - User role (default: EDITOR)
     * @param displayName - Optional display name
     * @returns Created user object
     * 
     * @example
     * const user = await TestHelpers.createTestUser(prisma, 'ADMINISTRATOR', 'Test Admin');
     */
    static async createTestUser(
        prisma: PrismaClient,
        role: UserRole = 'EDITOR',
        displayName?: string
    ): Promise<User> {
        return prisma.user.create({
            data: {
                email: this.generateUniqueEmail('user'),
                passwordHash: 'hashed',
                role,
                displayName,
            },
        });
    }

    /**
     * Clean up test data in correct order (respecting foreign keys)
     * Deletes entities in the proper order to avoid foreign key constraint violations
     * 
     * @param prisma - Prisma client instance
     * @param data - Object containing arrays of IDs to delete
     * 
     * @example
     * await TestHelpers.cleanupTestData(prisma, {
     *   userIds: [userId1, userId2],
     *   activityIds: [activityId],
     *   venueIds: [venueId],
     *   areaIds: [areaId1, areaId2]
     * });
     */
    static async cleanupTestData(
        prisma: PrismaClient,
        data: {
            userIds?: string[];
            activityIds?: string[];
            participantIds?: string[];
            venueIds?: string[];
            areaIds?: string[];
            populationIds?: string[];
        }
    ): Promise<void> {
        // Delete in order: assignments, activities, participants, venues, areas, populations, users

        if (data.activityIds?.length) {
            await prisma.assignment.deleteMany({
                where: { activityId: { in: data.activityIds } },
            });
            await prisma.activityVenueHistory.deleteMany({
                where: { activityId: { in: data.activityIds } },
            });
            await prisma.activity.deleteMany({
                where: { id: { in: data.activityIds } },
            });
        }

        if (data.participantIds?.length) {
            await prisma.participantPopulation.deleteMany({
                where: { participantId: { in: data.participantIds } },
            });
            await prisma.participantAddressHistory.deleteMany({
                where: { participantId: { in: data.participantIds } },
            });
            await prisma.participant.deleteMany({
                where: { id: { in: data.participantIds } },
            });
        }

        if (data.venueIds?.length) {
            await prisma.venue.deleteMany({
                where: { id: { in: data.venueIds } },
            });
        }

        if (data.areaIds?.length) {
            // Delete authorization rules referencing these areas first
            await prisma.userGeographicAuthorization.deleteMany({
                where: { geographicAreaId: { in: data.areaIds } },
            });

            await prisma.geographicArea.deleteMany({
                where: { id: { in: data.areaIds } },
            });
        }

        if (data.populationIds?.length) {
            await prisma.population.deleteMany({
                where: { id: { in: data.populationIds } },
            });
        }

        if (data.userIds?.length) {
            await prisma.userGeographicAuthorization.deleteMany({
                where: { userId: { in: data.userIds } },
            });
            await this.safeDelete(() =>
                prisma.user.deleteMany({
                    where: { id: { in: data.userIds } },
                })
            );
        }
    }

    /**
     * Create minimal test data for common scenarios
     * 
     * @param prisma - Prisma client instance
     * @returns Object containing created entity IDs
     * 
     * @example
     * const { areaId, venueId, participantId } = await TestHelpers.createMinimalTestData(prisma);
     */
    static async createMinimalTestData(prisma: PrismaClient): Promise<{
        areaId: string;
        venueId: string;
        participantId: string;
        activityTypeId: string;
        roleId: string;
    }> {
        // Get predefined activity type and role
        const activityType = await prisma.activityType.findFirst();
        const role = await prisma.role.findFirst();

        if (!activityType || !role) {
            throw new Error('Seed data not found. Run prisma db seed first.');
        }

        // Create geographic area
        const area = await prisma.geographicArea.create({
            data: {
                name: `Test Area ${Date.now()}`,
                areaType: 'CITY',
            },
        });

        // Create venue
        const venue = await prisma.venue.create({
            data: {
                name: `Test Venue ${Date.now()}`,
                address: '123 Test St',
                geographicAreaId: area.id,
                latitude: 40.7128,
                longitude: -74.006,
            },
        });

        // Create participant
        const participant = await prisma.participant.create({
            data: {
                name: `Test Participant ${Date.now()}`,
                email: this.generateUniqueEmail('participant'),
            },
        });

        return {
            areaId: area.id,
            venueId: venue.id,
            participantId: participant.id,
            activityTypeId: activityType.id,
            roleId: role.id,
        };
    }
}
