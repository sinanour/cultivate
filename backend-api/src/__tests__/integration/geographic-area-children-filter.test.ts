/**
 * Integration tests for geographic area children endpoint with filter context
 * 
 * Tests that when a global geographic area filter is active and the user expands
 * a node to fetch its children, only children in the direct ancestral lineage of
 * the filtered area are returned.
 */

import { PrismaClient } from '@prisma/client';
import { GeographicAreaService } from '../../services/geographic-area.service';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { GeographicAuthorizationService } from '../../services/geographic-authorization.service';
import { UserGeographicAuthorizationRepository } from '../../repositories/user-geographic-authorization.repository';
import { UserRepository } from '../../repositories/user.repository';
import { getPrismaClient } from '../../utils/prisma.client';

describe('Geographic Area Children Endpoint with Filter Context', () => {
    let prisma: PrismaClient;
    let geographicAreaService: GeographicAreaService;
    const testSuffix = Date.now();
    let testAreaIds: {
        world: string;
        northAmerica: string;
        europe: string;
        asia: string;
        canada: string;
        usa: string;
        bc: string;
        ontario: string;
        vancouver: string;
        downtown: string;
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
        // World → North America, Europe, Asia
        // North America → Canada, USA
        // Canada → BC, Ontario
        // BC → Vancouver
        // Vancouver → Downtown

        const world = await prisma.geographicArea.create({
            data: {
                name: `ChildrenFilterTest World ${testSuffix}`,
                areaType: 'WORLD',
                parentGeographicAreaId: null,
            },
        });

        const northAmerica = await prisma.geographicArea.create({
            data: {
                name: `ChildrenFilterTest North America ${testSuffix}`,
                areaType: 'CONTINENT',
                parentGeographicAreaId: world.id,
            },
        });

        const europe = await prisma.geographicArea.create({
            data: {
                name: `ChildrenFilterTest Europe ${testSuffix}`,
                areaType: 'CONTINENT',
                parentGeographicAreaId: world.id,
            },
        });

        const asia = await prisma.geographicArea.create({
            data: {
                name: `ChildrenFilterTest Asia ${testSuffix}`,
                areaType: 'CONTINENT',
                parentGeographicAreaId: world.id,
            },
        });

        const canada = await prisma.geographicArea.create({
            data: {
                name: `ChildrenFilterTest Canada ${testSuffix}`,
                areaType: 'COUNTRY',
                parentGeographicAreaId: northAmerica.id,
            },
        });

        const usa = await prisma.geographicArea.create({
            data: {
                name: `ChildrenFilterTest USA ${testSuffix}`,
                areaType: 'COUNTRY',
                parentGeographicAreaId: northAmerica.id,
            },
        });

        const bc = await prisma.geographicArea.create({
            data: {
                name: `ChildrenFilterTest British Columbia ${testSuffix}`,
                areaType: 'PROVINCE',
                parentGeographicAreaId: canada.id,
            },
        });

        const ontario = await prisma.geographicArea.create({
            data: {
                name: `ChildrenFilterTest Ontario ${testSuffix}`,
                areaType: 'PROVINCE',
                parentGeographicAreaId: canada.id,
            },
        });

        const vancouver = await prisma.geographicArea.create({
            data: {
                name: `ChildrenFilterTest Vancouver ${testSuffix}`,
                areaType: 'CITY',
                parentGeographicAreaId: bc.id,
            },
        });

        const downtown = await prisma.geographicArea.create({
            data: {
                name: `ChildrenFilterTest Downtown ${testSuffix}`,
                areaType: 'NEIGHBOURHOOD',
                parentGeographicAreaId: vancouver.id,
            },
        });

        testAreaIds = {
            world: world.id,
            northAmerica: northAmerica.id,
            europe: europe.id,
            asia: asia.id,
            canada: canada.id,
            usa: usa.id,
            bc: bc.id,
            ontario: ontario.id,
            vancouver: vancouver.id,
            downtown: downtown.id,
        };
    });

    afterAll(async () => {
        // Clean up test data
        await prisma.geographicArea.deleteMany({
            where: {
                name: {
                    contains: `ChildrenFilterTest`,
                },
            },
        });

        await prisma.$disconnect();
    });

    describe('getChildren with geographic area filter', () => {
        it('should return only the child that is an ancestor of the filtered area', async () => {
            // Filter by Downtown, expand World
            // Should return ONLY North America (ancestor of Downtown)
            // Should NOT return Europe or Asia (not in Downtown's lineage)
            const children = await geographicAreaService.getChildren(
                testAreaIds.world,
                undefined, // no userId (unrestricted)
                undefined, // no userRole
                testAreaIds.downtown // filter by Downtown
            );

            const childIds = children.map(c => c.id);
            const childNames = children.map(c => c.name);

            // Should include ONLY North America
            expect(childIds).toContain(testAreaIds.northAmerica);
            expect(childNames).toContain(`ChildrenFilterTest North America ${testSuffix}`);

            // Should NOT include Europe or Asia
            expect(childIds).not.toContain(testAreaIds.europe);
            expect(childIds).not.toContain(testAreaIds.asia);

            // Verify exact count (1 child)
            expect(childIds.length).toBe(1);

            console.log('✓ Returned children:', childNames);
        });

        it('should return only the child that is an ancestor when filtering by intermediate node', async () => {
            // Filter by Vancouver, expand North America
            // Should return ONLY Canada (ancestor of Vancouver)
            // Should NOT return USA (not in Vancouver's lineage)
            const children = await geographicAreaService.getChildren(
                testAreaIds.northAmerica,
                undefined,
                undefined,
                testAreaIds.vancouver // filter by Vancouver
            );

            const childIds = children.map(c => c.id);
            const childNames = children.map(c => c.name);

            // Should include ONLY Canada
            expect(childIds).toContain(testAreaIds.canada);
            expect(childNames).toContain(`ChildrenFilterTest Canada ${testSuffix}`);

            // Should NOT include USA
            expect(childIds).not.toContain(testAreaIds.usa);

            // Verify exact count (1 child)
            expect(childIds.length).toBe(1);

            console.log('✓ Returned children:', childNames);
        });

        it('should return only the child that is an ancestor when filtering by leaf and expanding intermediate', async () => {
            // Filter by Downtown, expand Canada
            // Should return ONLY BC (ancestor of Downtown)
            // Should NOT return Ontario (not in Downtown's lineage)
            const children = await geographicAreaService.getChildren(
                testAreaIds.canada,
                undefined,
                undefined,
                testAreaIds.downtown // filter by Downtown
            );

            const childIds = children.map(c => c.id);
            const childNames = children.map(c => c.name);

            // Should include ONLY BC
            expect(childIds).toContain(testAreaIds.bc);
            expect(childNames).toContain(`ChildrenFilterTest British Columbia ${testSuffix}`);

            // Should NOT include Ontario
            expect(childIds).not.toContain(testAreaIds.ontario);

            // Verify exact count (1 child)
            expect(childIds.length).toBe(1);

            console.log('✓ Returned children:', childNames);
        });

        it('should return all children when no filter is provided', async () => {
            // No filter, expand World
            // Should return ALL children: North America, Europe, Asia
            const children = await geographicAreaService.getChildren(
                testAreaIds.world,
                undefined,
                undefined,
                undefined // no filter
            );

            const childIds = children.map(c => c.id);

            // Should include all three continents
            expect(childIds).toContain(testAreaIds.northAmerica);
            expect(childIds).toContain(testAreaIds.europe);
            expect(childIds).toContain(testAreaIds.asia);

            // Verify exact count (3 children)
            expect(childIds.length).toBe(3);
        });

        it('should return all children when filter equals the parent being expanded', async () => {
            // Filter by Canada, expand Canada
            // Should return ALL children of Canada: BC, Ontario
            const children = await geographicAreaService.getChildren(
                testAreaIds.canada,
                undefined,
                undefined,
                testAreaIds.canada // filter equals parent
            );

            const childIds = children.map(c => c.id);

            // Should include both provinces
            expect(childIds).toContain(testAreaIds.bc);
            expect(childIds).toContain(testAreaIds.ontario);

            // Verify exact count (2 children)
            expect(childIds.length).toBe(2);
        });

        it('should work correctly with pagination', async () => {
            // Filter by Downtown, expand World with pagination
            const result = await geographicAreaService.getChildrenPaginated(
                testAreaIds.world,
                1, // page
                10, // limit
                undefined,
                undefined,
                testAreaIds.downtown // filter by Downtown
            );

            const childIds = result.data.map(c => c.id);

            // Should include ONLY North America
            expect(childIds).toContain(testAreaIds.northAmerica);
            expect(childIds).not.toContain(testAreaIds.europe);
            expect(childIds).not.toContain(testAreaIds.asia);

            // Verify pagination metadata
            expect(result.pagination.total).toBe(1);
            expect(result.pagination.totalPages).toBe(1);
        });

        it('should include the filtered area itself if it is a direct child', async () => {
            // Filter by Vancouver, expand BC
            // Should return Vancouver (the filtered area itself, which is a child of BC)
            const children = await geographicAreaService.getChildren(
                testAreaIds.bc,
                undefined,
                undefined,
                testAreaIds.vancouver // filter by Vancouver
            );

            const childIds = children.map(c => c.id);
            const childNames = children.map(c => c.name);

            // Should include Vancouver (the filtered area itself)
            expect(childIds).toContain(testAreaIds.vancouver);
            expect(childNames).toContain(`ChildrenFilterTest Vancouver ${testSuffix}`);

            // Verify exact count (1 child - just Vancouver, not other cities)
            expect(childIds.length).toBe(1);

            console.log('✓ Returned children:', childNames);
        });

        it('should return all children when filter is above the parent being expanded', async () => {
            // Filter by Canada (country), expand BC (province, child of Canada)
            // Should return ALL children of BC: Vancouver
            // This is because BC is a descendant of the filter (Canada)
            const children = await geographicAreaService.getChildren(
                testAreaIds.bc,
                undefined,
                undefined,
                testAreaIds.canada // filter by Canada (ancestor of BC)
            );

            const childIds = children.map(c => c.id);
            const childNames = children.map(c => c.name);

            // Should include Vancouver (all children of BC)
            expect(childIds).toContain(testAreaIds.vancouver);
            expect(childNames).toContain(`ChildrenFilterTest Vancouver ${testSuffix}`);

            // Verify we get all children, not filtered
            expect(childIds.length).toBe(1); // BC only has 1 child in our test data

            console.log('✓ Returned children when filter is above parent:', childNames);
        });

        it('should return all children when filter is at top level and expanding descendants', async () => {
            // Filter by World, expand North America
            // Should return ALL children of North America: Canada, USA
            const children = await geographicAreaService.getChildren(
                testAreaIds.northAmerica,
                undefined,
                undefined,
                testAreaIds.world // filter by World (ancestor of North America)
            );

            const childIds = children.map(c => c.id);

            // Should include both Canada and USA
            expect(childIds).toContain(testAreaIds.canada);
            expect(childIds).toContain(testAreaIds.usa);

            // Verify exact count (2 children)
            expect(childIds.length).toBe(2);
        });
    });
});
