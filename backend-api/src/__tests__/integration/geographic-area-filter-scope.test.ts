/**
 * Integration tests for geographic area filter scope limitation
 * 
 * Tests that when filtering by a non-top-level geographic area, the API returns:
 * - The selected area
 * - All descendants of the selected area (recursively)
 * - Direct ancestors of the selected area (parent chain to root)
 * 
 * And does NOT return:
 * - Siblings of the selected area
 * - Descendants of siblings
 * - Any other areas outside the direct tree
 */

import { PrismaClient } from '@prisma/client';
import { GeographicAreaService } from '../../services/geographic-area.service';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { GeographicAuthorizationService } from '../../services/geographic-authorization.service';
import { UserGeographicAuthorizationRepository } from '../../repositories/user-geographic-authorization.repository';
import { UserRepository } from '../../repositories/user.repository';
import { getPrismaClient } from '../../utils/prisma.client';

describe('Geographic Area Filter Scope Integration Tests', () => {
    let prisma: PrismaClient;
    let geographicAreaService: GeographicAreaService;
    const testSuffix = Date.now();
    let testAreaIds: {
        world: string;
        northAmerica: string;
        canada: string;
        bc: string;
        vancouver: string;
        downtown: string;
        kitsilano: string;
        victoria: string;
        jamesBay: string;
    };

    beforeAll(async () => {
        prisma = getPrismaClient();

        // Initialize repositories and services
        const geographicAreaRepository = new GeographicAreaRepository(prisma);
        const userGeographicAuthorizationRepository = new UserGeographicAuthorizationRepository(prisma);
        const userRepository = new UserRepository(prisma);
        const geographicAuthorizationService = new GeographicAuthorizationService(
            userGeographicAuthorizationRepository,
            geographicAreaRepository,
            userRepository
        );
        geographicAreaService = new GeographicAreaService(
            geographicAreaRepository,
            prisma,
            geographicAuthorizationService
        );

        // Create test hierarchy:
        // World → North America → Canada → BC → Vancouver, Victoria
        // Vancouver → Downtown, Kitsilano
        // Victoria → James Bay

        const world = await prisma.geographicArea.create({
            data: {
                name: `GeoFilterTest World ${testSuffix}`,
                areaType: 'WORLD',
                parentGeographicAreaId: null,
            },
        });

        const northAmerica = await prisma.geographicArea.create({
            data: {
                name: `GeoFilterTest North America ${testSuffix}`,
                areaType: 'CONTINENT',
                parentGeographicAreaId: world.id,
            },
        });

        const canada = await prisma.geographicArea.create({
            data: {
                name: `GeoFilterTest Canada ${testSuffix}`,
                areaType: 'COUNTRY',
                parentGeographicAreaId: northAmerica.id,
            },
        });

        const bc = await prisma.geographicArea.create({
            data: {
                name: `GeoFilterTest British Columbia ${testSuffix}`,
                areaType: 'PROVINCE',
                parentGeographicAreaId: canada.id,
            },
        });

        const vancouver = await prisma.geographicArea.create({
            data: {
                name: `GeoFilterTest Vancouver ${testSuffix}`,
                areaType: 'CITY',
                parentGeographicAreaId: bc.id,
            },
        });

        const downtown = await prisma.geographicArea.create({
            data: {
                name: `GeoFilterTest Downtown ${testSuffix}`,
                areaType: 'NEIGHBOURHOOD',
                parentGeographicAreaId: vancouver.id,
            },
        });

        const kitsilano = await prisma.geographicArea.create({
            data: {
                name: `GeoFilterTest Kitsilano ${testSuffix}`,
                areaType: 'NEIGHBOURHOOD',
                parentGeographicAreaId: vancouver.id,
            },
        });

        const victoria = await prisma.geographicArea.create({
            data: {
                name: `GeoFilterTest Victoria ${testSuffix}`,
                areaType: 'CITY',
                parentGeographicAreaId: bc.id,
            },
        });

        const jamesBay = await prisma.geographicArea.create({
            data: {
                name: `GeoFilterTest James Bay ${testSuffix}`,
                areaType: 'NEIGHBOURHOOD',
                parentGeographicAreaId: victoria.id,
            },
        });

        testAreaIds = {
            world: world.id,
            northAmerica: northAmerica.id,
            canada: canada.id,
            bc: bc.id,
            vancouver: vancouver.id,
            downtown: downtown.id,
            kitsilano: kitsilano.id,
            victoria: victoria.id,
            jamesBay: jamesBay.id,
        };
    });

    afterAll(async () => {
        // Clean up test data
        await prisma.geographicArea.deleteMany({
            where: {
                name: {
                    contains: 'GeoFilterTest',
                },
            },
        });

        await prisma.$disconnect();
    });

    describe('Geographic area filtering with explicit geographicAreaId', () => {
        it('should return only selected area, its descendants, and direct ancestors (not siblings)', async () => {
            const result = await geographicAreaService.getAllGeographicAreas(
                testAreaIds.vancouver,
                undefined, // no depth limit
                [], // no authorization restrictions
                false, // no geographic restrictions
                [] // no read-only areas
            );

            const returnedIds = result.map((area: any) => area.id);
            const returnedNames = result.map((area: any) => area.name);

            // Should include: Vancouver, Downtown, Kitsilano, BC, Canada, North America, World (7 areas)
            expect(returnedIds).toContain(testAreaIds.vancouver);
            expect(returnedIds).toContain(testAreaIds.downtown);
            expect(returnedIds).toContain(testAreaIds.kitsilano);
            expect(returnedIds).toContain(testAreaIds.bc);
            expect(returnedIds).toContain(testAreaIds.canada);
            expect(returnedIds).toContain(testAreaIds.northAmerica);
            expect(returnedIds).toContain(testAreaIds.world);

            // Should NOT include: Victoria, James Bay (siblings and their descendants)
            expect(returnedIds).not.toContain(testAreaIds.victoria);
            expect(returnedIds).not.toContain(testAreaIds.jamesBay);

            // Verify exact count (7 areas, no more, no less)
            expect(returnedIds.length).toBe(7);

            console.log('✓ Returned areas:', returnedNames);
        });

        it('should work correctly with depth parameter', async () => {
            const result = await geographicAreaService.getAllGeographicAreas(
                testAreaIds.vancouver,
                1, // Only immediate children
                [],
                false,
                []
            );

            const returnedIds = result.map((area: any) => area.id);

            // Should include: Vancouver, Downtown, Kitsilano (immediate children), and all ancestors
            expect(returnedIds).toContain(testAreaIds.vancouver);
            expect(returnedIds).toContain(testAreaIds.downtown);
            expect(returnedIds).toContain(testAreaIds.kitsilano);
            expect(returnedIds).toContain(testAreaIds.bc);
            expect(returnedIds).toContain(testAreaIds.canada);
            expect(returnedIds).toContain(testAreaIds.northAmerica);
            expect(returnedIds).toContain(testAreaIds.world);

            // Should NOT include siblings
            expect(returnedIds).not.toContain(testAreaIds.victoria);
            expect(returnedIds).not.toContain(testAreaIds.jamesBay);
        });

        it('should work correctly with flexible filtering', async () => {
            const result = await geographicAreaService.getAllGeographicAreasFlexible({
                geographicAreaId: testAreaIds.vancouver,
                filter: { name: 'Downtown' },
                authorizedAreaIds: [],
                hasGeographicRestrictions: false,
                readOnlyAreaIds: []
            });

            const returnedIds = result.map((area: any) => area.id);
            const returnedNames = result.map((area: any) => area.name);

            // Should only include Downtown (matches filter within Vancouver's tree)
            expect(returnedIds).toContain(testAreaIds.downtown);
            expect(returnedNames.some((name: string) => name.includes('Downtown'))).toBe(true);

            // Should NOT include Victoria or James Bay (siblings, even though James Bay contains "Bay")
            expect(returnedIds).not.toContain(testAreaIds.victoria);
            expect(returnedIds).not.toContain(testAreaIds.jamesBay);
        });

        it('should return only direct ancestors when filtering by leaf node', async () => {
            const result = await geographicAreaService.getAllGeographicAreas(
                testAreaIds.downtown,
                undefined,
                [],
                false,
                []
            );

            const returnedIds = result.map((area: any) => area.id);

            // Should include: Downtown (leaf), Vancouver, BC, Canada, North America, World
            expect(returnedIds).toContain(testAreaIds.downtown);
            expect(returnedIds).toContain(testAreaIds.vancouver);
            expect(returnedIds).toContain(testAreaIds.bc);
            expect(returnedIds).toContain(testAreaIds.canada);
            expect(returnedIds).toContain(testAreaIds.northAmerica);
            expect(returnedIds).toContain(testAreaIds.world);

            // Should NOT include: Kitsilano (sibling), Victoria, James Bay
            expect(returnedIds).not.toContain(testAreaIds.kitsilano);
            expect(returnedIds).not.toContain(testAreaIds.victoria);
            expect(returnedIds).not.toContain(testAreaIds.jamesBay);

            // Verify exact count (6 areas: leaf + 5 ancestors)
            expect(returnedIds.length).toBe(6);
        });

        it('should work correctly when filtering by province level', async () => {
            const result = await geographicAreaService.getAllGeographicAreas(
                testAreaIds.bc,
                undefined,
                [],
                false,
                []
            );

            const returnedIds = result.map((area: any) => area.id);

            // Should include: BC, Vancouver, Downtown, Kitsilano, Victoria, James Bay, Canada, North America, World
            expect(returnedIds).toContain(testAreaIds.bc);
            expect(returnedIds).toContain(testAreaIds.vancouver);
            expect(returnedIds).toContain(testAreaIds.downtown);
            expect(returnedIds).toContain(testAreaIds.kitsilano);
            expect(returnedIds).toContain(testAreaIds.victoria);
            expect(returnedIds).toContain(testAreaIds.jamesBay);
            expect(returnedIds).toContain(testAreaIds.canada);
            expect(returnedIds).toContain(testAreaIds.northAmerica);
            expect(returnedIds).toContain(testAreaIds.world);

            // Verify exact count (9 areas: BC + 6 descendants + 3 ancestors)
            expect(returnedIds.length).toBe(9);
        });
    });
});
