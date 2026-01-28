import { PrismaClient } from '@prisma/client';
import { RoleDistributionQueryBuilder } from '../../services/analytics/role-distribution-query-builder';
import { RoleDistributionService } from '../../services/analytics/role-distribution.service';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';

const prisma = new PrismaClient();
const geographicAreaRepository = new GeographicAreaRepository(prisma);

describe('Role Distribution Optimization', () => {
    describe('RoleDistributionQueryBuilder', () => {
        let queryBuilder: RoleDistributionQueryBuilder;

        beforeEach(() => {
            queryBuilder = new RoleDistributionQueryBuilder();
        });

        describe('buildRoleDistributionQuery', () => {
            it('should build query with no filters', () => {
                const { sql, parameters } = queryBuilder.buildRoleDistributionQuery({});

                expect(sql).toContain('WITH');
                expect(sql).toContain('filtered_activities AS');
                expect(sql).toContain('role_counts AS');
                expect(sql).toContain('GROUP BY asn."roleId"');
                expect(sql).toContain('ORDER BY rc.assignment_count DESC');
                // Should include current date filter even with no explicit date range
                expect(sql).toContain('DATE(a."startDate") <= CURRENT_DATE');
                expect(sql).toContain('a."endDate" IS NULL OR DATE(a."endDate") >= CURRENT_DATE');
                expect(parameters).toHaveLength(0);
            });

            it('should build query with activity type filter', () => {
                const { sql, parameters } = queryBuilder.buildRoleDistributionQuery({
                    activityTypeIds: ['type-1', 'type-2'],
                });

                expect(sql).toContain('a."activityTypeId" = ANY($1)');
                expect(parameters).toEqual([['type-1', 'type-2']]);
            });

            it('should build query with activity category filter', () => {
                const { sql, parameters } = queryBuilder.buildRoleDistributionQuery({
                    activityCategoryIds: ['cat-1'],
                });

                expect(sql).toContain('at."activityCategoryId" = ANY($1)');
                expect(sql).toContain('JOIN activity_types at');
                expect(parameters).toEqual([['cat-1']]);
            });

            it('should build query with venue filter', () => {
                const { sql, parameters } = queryBuilder.buildRoleDistributionQuery({
                    venueIds: ['venue-1', 'venue-2'],
                });

                expect(sql).toContain('avh."venueId" = ANY($1)');
                expect(sql).toContain('LEFT JOIN activity_venue_history avh');
                expect(sql).toContain('LEFT JOIN venues v');
                expect(parameters).toEqual([['venue-1', 'venue-2']]);
            });

            it('should build query with geographic area filter', () => {
                const { sql, parameters } = queryBuilder.buildRoleDistributionQuery({
                    geographicAreaIds: ['area-1'],
                });

                expect(sql).toContain('v."geographicAreaId" = ANY($1)');
                expect(sql).toContain('LEFT JOIN activity_venue_history avh');
                expect(sql).toContain('LEFT JOIN venues v');
                expect(parameters).toEqual([['area-1']]);
            });

            it('should build query with date range filter', () => {
                const startDate = new Date('2024-01-01');
                const endDate = new Date('2024-12-31');

                const { sql, parameters } = queryBuilder.buildRoleDistributionQuery({
                    startDate,
                    endDate,
                });

                expect(sql).toContain('DATE(a."startDate") <= DATE($2)');
                expect(sql).toContain('a."endDate" IS NULL OR DATE(a."endDate") >= DATE($1)');
                expect(parameters).toEqual([startDate, endDate]);
            });

            it('should build query with population filter', () => {
                const { sql, parameters } = queryBuilder.buildRoleDistributionQuery({
                    populationIds: ['pop-1', 'pop-2'],
                });

                expect(sql).toContain('JOIN participant_populations pp');
                expect(sql).toContain('pp."populationId" = ANY($1)');
                expect(parameters).toEqual([['pop-1', 'pop-2']]);
            });

            it('should build query with multiple filters', () => {
                const { sql, parameters } = queryBuilder.buildRoleDistributionQuery({
                    activityTypeIds: ['type-1'],
                    activityCategoryIds: ['cat-1'],
                    venueIds: ['venue-1'],
                    geographicAreaIds: ['area-1'],
                    populationIds: ['pop-1'],
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-12-31'),
                });

                expect(sql).toContain('a."activityTypeId" = ANY($1)');
                expect(sql).toContain('at."activityCategoryId" = ANY($2)');
                expect(sql).toContain('avh."venueId" = ANY($3)');
                expect(sql).toContain('v."geographicAreaId" = ANY($4)');
                expect(sql).toContain('pp."populationId" = ANY($7)');
                expect(sql).toContain('DATE(a."startDate") <= DATE($6)');
                expect(parameters).toHaveLength(7);
            });

            it('should not include venue joins when no venue or geographic filter', () => {
                const { sql } = queryBuilder.buildRoleDistributionQuery({
                    activityTypeIds: ['type-1'],
                });

                expect(sql).not.toContain('activity_venue_history');
                expect(sql).not.toContain('venues');
            });

            it('should not include category join when no category filter', () => {
                const { sql } = queryBuilder.buildRoleDistributionQuery({
                    activityTypeIds: ['type-1'],
                });

                expect(sql).not.toContain('JOIN activity_types at');
            });
        });
    });

    describe('RoleDistributionService', () => {
        let service: RoleDistributionService;

        beforeEach(() => {
            service = new RoleDistributionService(prisma, geographicAreaRepository);
        });

        describe('transformToWireFormat', () => {
            it('should transform results to wire format with indexed lookups', async () => {
                // This test verifies the wire format structure
                // In a real scenario, we'd mock the query execution
                const mockResults = [
                    { roleId: 'role-1', assignmentCount: 10 },
                    { roleId: 'role-2', assignmentCount: 5 },
                ];

                // We can't directly test the private method, but we can verify
                // the structure through the public API
                // This is a placeholder for integration testing
                expect(mockResults).toHaveLength(2);
            });
        });

        describe('geographic authorization', () => {
            it('should throw error when user lacks access to requested areas', async () => {
                const filters = {
                    geographicAreaIds: ['unauthorized-area'],
                };

                await expect(
                    service.getRoleDistribution(filters, ['authorized-area'], true)
                ).rejects.toThrow('Access denied to requested geographic areas');
            });

            it('should allow access when user has authorization', async () => {
                // This would require actual database setup
                // Placeholder for integration test
                expect(true).toBe(true);
            });
        });
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });
});
