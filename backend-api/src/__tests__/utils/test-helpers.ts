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
     * @param uniqueSuffix - Optional unique suffix (default: Date.now())
     * @returns Created user object
     * 
     * @example
     * const user = await TestHelpers.createTestUser(prisma, 'ADMINISTRATOR', Date.now());
     */
    static async createTestUser(
        prisma: PrismaClient,
        role: UserRole = 'EDITOR',
        uniqueSuffix?: string | number
    ): Promise<User> {
        const suffix = uniqueSuffix || Date.now();
        return prisma.user.create({
            data: {
                email: `test-user-${suffix}@example.com`,
                passwordHash: 'hashed',
                role,
            },
        });
    }
    /**
     * Create a standard geographic hierarchy for testing
     * Creates a 4-level hierarchy: country → province → city → neighbourhood
     *
     * @param prisma - Prisma client instance
     * @param uniqueSuffix - Optional unique suffix (default: Date.now())
     * @returns Object with all created geographic area IDs
     *
     * @example
     * const { countryId, provinceId, cityId, neighbourhoodId } =
     *   await TestHelpers.createTestGeographicHierarchy(prisma, Date.now());
     */
    static async createTestGeographicHierarchy(
        prisma: PrismaClient,
        uniqueSuffix?: string | number
    ): Promise<{
        countryId: string;
        provinceId: string;
        cityId: string;
        neighbourhoodId: string;
    }> {
        const suffix = uniqueSuffix || Date.now();

        const country = await prisma.geographicArea.create({
            data: {
                name: `Test Country ${suffix}`,
                areaType: 'COUNTRY',
            },
        });

        const province = await prisma.geographicArea.create({
            data: {
                name: `Test Province ${suffix}`,
                areaType: 'PROVINCE',
                parentGeographicAreaId: country.id,
            },
        });

        const city = await prisma.geographicArea.create({
            data: {
                name: `Test City ${suffix}`,
                areaType: 'CITY',
                parentGeographicAreaId: province.id,
            },
        });

        const neighbourhood = await prisma.geographicArea.create({
            data: {
                name: `Test Neighbourhood ${suffix}`,
                areaType: 'NEIGHBOURHOOD',
                parentGeographicAreaId: city.id,
            },
        });

        return {
            countryId: country.id,
            provinceId: province.id,
            cityId: city.id,
            neighbourhoodId: neighbourhood.id,
        };
    }
    /**
     * Get a predefined activity type by name
     * Throws descriptive error if not found
     *
     * @param prisma - Prisma client instance
     * @param name - Name of the predefined activity type
     * @returns The activity type object
     * @throws Error if activity type not found
     *
     * @example
     * const activityType = await TestHelpers.getPredefinedActivityType(prisma, 'Ruhi Book 01');
     */
    static async getPredefinedActivityType(
        prisma: PrismaClient,
        name: string
    ) {
        const activityType = await prisma.activityType.findFirst({
            where: { name, isPredefined: true },
        });

        if (!activityType) {
            throw new Error(`Predefined activity type "${name}" not found. Run prisma db seed first.`);
        }

        return activityType;
    }
    /**
     * Get a predefined role by name
     * Throws descriptive error if not found
     *
     * @param prisma - Prisma client instance
     * @param name - Name of the predefined role
     * @returns The role object
     * @throws Error if role not found
     *
     * @example
     * const tutorRole = await TestHelpers.getPredefinedRole(prisma, 'Tutor');
     */
    static async getPredefinedRole(
        prisma: PrismaClient,
        name: string
    ) {
        const role = await prisma.role.findFirst({
            where: { name },
        });

        if (!role) {
            throw new Error(`Predefined role "${name}" not found. Run prisma db seed first.`);
        }

        return role;
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
    /**
         * Clean up test data in correct order (respecting foreign keys)
         * Deletes entities in the proper order to avoid foreign key constraint violations
         * Handles errors gracefully without throwing
         * 
         * @param prisma - Prisma client instance
         * @param options - Object containing arrays of IDs to delete
         * 
         * @example
         * await TestHelpers.cleanupTestData(prisma, {
         *   assignmentIds: [assignmentId],
         *   activityIds: [activityId],
         *   participantIds: [participantId],
         *   venueIds: [venueId],
         *   geographicAreaIds: [areaId1, areaId2],
         *   activityTypeIds: [typeId],
         *   activityCategoryIds: [categoryId],
         *   roleIds: [roleId],
         *   userIds: [userId],
         *   populationIds: [populationId]
         * });
         */
    static async cleanupTestData(
        prisma: PrismaClient,
            options: {
                assignmentIds?: string[];
                activityIds?: string[];
                participantIds?: string[];
                venueIds?: string[];
                geographicAreaIds?: string[];
                activityTypeIds?: string[];
                activityCategoryIds?: string[];
                roleIds?: string[];
                userIds?: string[];
                populationIds?: string[];
            }
        ): Promise<void> {
            try {
            // Delete in reverse dependency order (children before parents)

                // 1. Assignments (references activities, participants, roles)
                if (options.assignmentIds?.length) {
                    await prisma.assignment.deleteMany({
                        where: { id: { in: options.assignmentIds } },
                    });
                }

                // 2. Activity venue history (references activities, venues)
                if (options.activityIds?.length) {
                    await prisma.activityVenueHistory.deleteMany({
                        where: { activityId: { in: options.activityIds } },
                    });
                }

                // 3. Participant address history (references participants, venues)
                if (options.participantIds?.length) {
                    await prisma.participantAddressHistory.deleteMany({
                        where: { participantId: { in: options.participantIds } },
                    });
                }

                // 4. Participant populations (references participants, populations)
                if (options.participantIds?.length) {
                    await prisma.participantPopulation.deleteMany({
                        where: { participantId: { in: options.participantIds } },
                    });
                }

                // 5. Activities (references activity types)
                if (options.activityIds?.length) {
                    await prisma.activity.deleteMany({
                        where: { id: { in: options.activityIds } },
                    });
                }

                // 6. Participants
                if (options.participantIds?.length) {
                    await prisma.participant.deleteMany({
                        where: { id: { in: options.participantIds } },
                    });
                }

                // 7. Venues (references geographic areas)
                if (options.venueIds?.length) {
                    await prisma.venue.deleteMany({
                        where: { id: { in: options.venueIds } },
                    });
                }

                // 8. Activity types (references activity categories)
                if (options.activityTypeIds?.length) {
                    await prisma.activityType.deleteMany({
                        where: { id: { in: options.activityTypeIds } },
                    });
                }

                // 9. Activity categories
                if (options.activityCategoryIds?.length) {
                    await prisma.activityCategory.deleteMany({
                        where: { id: { in: options.activityCategoryIds } },
                    });
                }

                // 10. Roles
                if (options.roleIds?.length) {
                    await prisma.role.deleteMany({
                        where: { id: { in: options.roleIds } },
                    });
                }

                // 11. Populations
                if (options.populationIds?.length) {
                    await prisma.population.deleteMany({
                        where: { id: { in: options.populationIds } },
                    });
                }

                // 12. User geographic authorizations (references users, geographic areas)
                if (options.userIds?.length || options.geographicAreaIds?.length) {
                    const where: any = {};
                    if (options.userIds?.length) {
                        where.userId = { in: options.userIds };
                    }
                    if (options.geographicAreaIds?.length) {
                        where.geographicAreaId = { in: options.geographicAreaIds };
                    }
                    await prisma.userGeographicAuthorization.deleteMany({ where });
                }

                // 13. Geographic areas (delete children before parents)
                if (options.geographicAreaIds?.length) {
                    // Sort by depth (deepest first) - assumes IDs are in creation order
                    const sortedIds = [...options.geographicAreaIds].reverse();
                    for (const id of sortedIds) {
                        await prisma.geographicArea.deleteMany({
                            where: { id },
                        });
                    }
                }

                // 14. Users
                if (options.userIds?.length) {
                    await prisma.user.deleteMany({
                        where: { id: { in: options.userIds } },
                    });
                }
            } catch (error) {
                console.error('Cleanup error:', error);
                // Don't throw - allow other cleanup to proceed
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
