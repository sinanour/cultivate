import { PrismaClient } from '@prisma/client';
import { GeographicAreaService } from '../../services/geographic-area.service';
import { GeographicAuthorizationService } from '../../services/geographic-authorization.service';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { UserGeographicAuthorizationRepository } from '../../repositories/user-geographic-authorization.repository';
import { UserRepository } from '../../repositories/user.repository';
import { getPrismaClient } from '../../utils/prisma.client';

/**
 * Integration tests for geographic area flexible filtering
 * Tests the filter[name] parameter and fields parameter for geographic areas
 */
describe('Geographic Area Flexible Filtering Integration Tests', () => {
    let prisma: PrismaClient;
    let geographicAreaService: GeographicAreaService;
    let geoAuthService: GeographicAuthorizationService;
    const testSuffix = Date.now();
    let testAreaIds: string[] = [];

    beforeAll(async () => {
        prisma = getPrismaClient();

        // Initialize repositories
        const geoAreaRepo = new GeographicAreaRepository(prisma);
        const authRepo = new UserGeographicAuthorizationRepository(prisma);
        const userRepo = new UserRepository(prisma);

        geoAuthService = new GeographicAuthorizationService(authRepo, geoAreaRepo, userRepo);
        geographicAreaService = new GeographicAreaService(geoAreaRepo, prisma, geoAuthService);

        // Create test geographic areas with various names
        const testAreas = [
            { name: `Vancouver City ${testSuffix}`, areaType: 'CITY' as const, parentGeographicAreaId: null },
            { name: `Vancouver Island ${testSuffix}`, areaType: 'CITY' as const, parentGeographicAreaId: null },
            { name: `Downtown Vancouver ${testSuffix}`, areaType: 'NEIGHBOURHOOD' as const, parentGeographicAreaId: null },
            { name: `North Vancouver ${testSuffix}`, areaType: 'CITY' as const, parentGeographicAreaId: null },
            { name: `West Vancouver ${testSuffix}`, areaType: 'CITY' as const, parentGeographicAreaId: null },
            { name: `Toronto ${testSuffix}`, areaType: 'CITY' as const, parentGeographicAreaId: null },
            { name: `Montreal ${testSuffix}`, areaType: 'CITY' as const, parentGeographicAreaId: null },
        ];

        for (const areaData of testAreas) {
            const area = await prisma.geographicArea.create({ data: areaData });
            testAreaIds.push(area.id);
        }
    });

    afterAll(async () => {
        // Clean up test data
        if (testAreaIds.length > 0) {
            await prisma.geographicArea.deleteMany({
                where: { id: { in: testAreaIds } }
            });
        }
        await prisma.$disconnect();
    });

    describe('filter[name] parameter', () => {
        it('should filter geographic areas by name with partial matching', async () => {
            // Call service directly with filter parameter
            const areas = await geographicAreaService.getAllGeographicAreasFlexible({
                filter: { name: 'vancouver' },
                authorizedAreaIds: [],
                hasGeographicRestrictions: false,
                readOnlyAreaIds: []
            });

            // Should return all areas with "vancouver" in the name (case-insensitive)
            const vancouverAreas = areas.filter((area: any) =>
                area.name.toLowerCase().includes('vancouver')
            );
            expect(vancouverAreas.length).toBeGreaterThanOrEqual(4); // Vancouver City, Vancouver Island, Downtown Vancouver, North Vancouver, West Vancouver

            // Should NOT return areas without "vancouver" in the name
            const nonVancouverAreas = areas.filter((area: any) =>
                !area.name.toLowerCase().includes('vancouver')
            );
            expect(nonVancouverAreas.length).toBe(0);
        });

        it('should be case-insensitive', async () => {
            const areas = await geographicAreaService.getAllGeographicAreasFlexible({
                filter: { name: 'VANCOUVER' },
                authorizedAreaIds: [],
                hasGeographicRestrictions: false,
                readOnlyAreaIds: []
            });

            expect(areas.length).toBeGreaterThanOrEqual(4);
        });

        it('should return empty array when no matches', async () => {
            const areas = await geographicAreaService.getAllGeographicAreasFlexible({
                filter: { name: 'nonexistent' },
                authorizedAreaIds: [],
                hasGeographicRestrictions: false,
                readOnlyAreaIds: []
            });

            expect(areas).toEqual([]);
        });
    });

    describe('fields parameter', () => {
        it('should return only requested fields', async () => {
            const areas = await geographicAreaService.getAllGeographicAreasFlexible({
                filter: { name: 'vancouver' },
                fields: ['id', 'name', 'areaType'],
                authorizedAreaIds: [],
                hasGeographicRestrictions: false,
                readOnlyAreaIds: []
            });

            expect(areas.length).toBeGreaterThan(0);

            // Check that only requested fields are present
            const firstArea = areas[0] as any;
            expect(firstArea).toHaveProperty('id');
            expect(firstArea).toHaveProperty('name');
            expect(firstArea).toHaveProperty('areaType');

            // These fields should NOT be present
            expect(firstArea).not.toHaveProperty('createdAt');
            expect(firstArea).not.toHaveProperty('updatedAt');
            expect(firstArea).not.toHaveProperty('parentGeographicAreaId');
        });
    });

    describe('Combined filtering', () => {
        it('should combine filter[name] with filter[areaType]', async () => {
            const areas = await geographicAreaService.getAllGeographicAreasFlexible({
                filter: { name: 'vancouver', areaType: 'CITY' },
                authorizedAreaIds: [],
                hasGeographicRestrictions: false,
                readOnlyAreaIds: []
            });

            // All results should have "vancouver" in name AND be CITY type
            areas.forEach((area: any) => {
                expect(area.name.toLowerCase()).toContain('vancouver');
                expect(area.areaType).toBe('CITY');
            });
        });

        it('should combine filter[name] with fields parameter', async () => {
            const areas = await geographicAreaService.getAllGeographicAreasFlexible({
                filter: { name: 'toronto' },
                fields: ['id', 'name'],
                authorizedAreaIds: [],
                hasGeographicRestrictions: false,
                readOnlyAreaIds: []
            });

            expect(areas.length).toBeGreaterThan(0);

            const firstArea = areas[0] as any;
            expect(firstArea.name.toLowerCase()).toContain('toronto');
            expect(Object.keys(firstArea)).toEqual(['id', 'name']);
        });
    });

    describe('Pagination with filtering', () => {
        it('should support pagination with filter[name]', async () => {
            const result = await geographicAreaService.getAllGeographicAreasPaginatedFlexible({
                page: 1,
                limit: 2,
                filter: { name: 'vancouver' },
                authorizedAreaIds: [],
                hasGeographicRestrictions: false,
                readOnlyAreaIds: []
            });

            expect(result.pagination).toBeDefined();
            expect(result.pagination.page).toBe(1);
            expect(result.pagination.limit).toBe(2);
            expect(result.pagination.total).toBeGreaterThanOrEqual(4);
            expect(result.data.length).toBeLessThanOrEqual(2);
        });
    });
});
