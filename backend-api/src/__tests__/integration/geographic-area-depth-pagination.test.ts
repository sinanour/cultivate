import { PrismaClient } from '@prisma/client';
import { GeographicAreaService } from '../../services/geographic-area.service';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { GeographicAuthorizationService } from '../../services/geographic-authorization.service';
import { UserGeographicAuthorizationRepository } from '../../repositories/user-geographic-authorization.repository';
import { UserRepository } from '../../repositories/user.repository';

const prisma = new PrismaClient();

describe('Geographic Area Depth Pagination Integration Tests', () => {
    let service: GeographicAreaService;
    const testSuffix = Date.now();
    let countryId: string;
    let provinceIds: string[] = [];
    let cityIds: string[] = [];

    beforeAll(async () => {
        // Initialize services
        const repository = new GeographicAreaRepository(prisma);
        const userRepository = new UserRepository(prisma);
        const authRepository = new UserGeographicAuthorizationRepository(prisma);
        const authService = new GeographicAuthorizationService(authRepository, repository, userRepository);
        service = new GeographicAreaService(repository, prisma, authService);

        // Create test hierarchy: 1 country → 5 provinces → 3 cities each (15 cities total)
        const country = await prisma.geographicArea.create({
            data: {
                name: `Test Country Pagination ${testSuffix}`,
                areaType: 'COUNTRY',
                parentGeographicAreaId: null,
            },
        });
        countryId = country.id;

        // Create 5 provinces
        for (let i = 1; i <= 5; i++) {
            const province = await prisma.geographicArea.create({
                data: {
                    name: `Test Province ${i} ${testSuffix}`,
                    areaType: 'PROVINCE',
                    parentGeographicAreaId: countryId,
                },
            });
            provinceIds.push(province.id);

            // Create 3 cities per province
            for (let j = 1; j <= 3; j++) {
                const city = await prisma.geographicArea.create({
                    data: {
                        name: `Test City ${i}-${j} ${testSuffix}`,
                        areaType: 'CITY',
                        parentGeographicAreaId: province.id,
                    },
                });
                cityIds.push(city.id);
            }
        }
    });

    afterAll(async () => {
        // Clean up test data
        await prisma.geographicArea.deleteMany({
            where: {
                OR: [
                    { id: countryId },
                    { id: { in: provinceIds } },
                    { id: { in: cityIds } },
                ],
            },
        });
        await prisma.$disconnect();
    });

    describe('Pagination with depth parameter', () => {
        it('should paginate top-level areas when depth=1', async () => {
            const result = await service.getAllGeographicAreasPaginatedFlexible({
                page: 1,
                limit: 2,
                depth: 1,
                geographicAreaId: countryId,
                authorizedAreaIds: [],
                hasGeographicRestrictions: false,
                readOnlyAreaIds: []
            });

            // When geographicAreaId is provided, should return the filtered area itself
            // with its children paginated and nested inside
            expect(result.data).toHaveLength(1); // Should return the country

            const country = result.data[0] as any;
            expect(country.id).toBe(countryId);
            expect(country.children).toBeDefined();
            expect(country.children).toHaveLength(2); // First page: 2 provinces

            expect(result.pagination.page).toBe(1);
            expect(result.pagination.limit).toBe(2);
            expect(result.pagination.total).toBe(5); // Total of 5 provinces
            expect(result.pagination.totalPages).toBe(3); // 5 / 2 = 3 pages
        });

        it('should fetch children up to specified depth for paginated areas', async () => {
            const result = await service.getAllGeographicAreasPaginatedFlexible({
                page: 1,
                limit: 10,
                depth: 1,
                geographicAreaId: countryId,
                authorizedAreaIds: [],
                hasGeographicRestrictions: false,
                readOnlyAreaIds: []
            });

            expect(result.data.length).toBeGreaterThan(0);
            expect(result.data.length).toBeLessThanOrEqual(10);

            // Each province should have childCount
            result.data.forEach((province: any) => {
                expect(province.childCount).toBeDefined();
                expect(typeof province.childCount).toBe('number');
            });
        });

        it('should fetch nested children when depth=2', async () => {
            const result = await service.getAllGeographicAreasPaginatedFlexible({
                page: 1,
                limit: 3,
                depth: 2,
                geographicAreaId: countryId,
                authorizedAreaIds: [],
                hasGeographicRestrictions: false,
                readOnlyAreaIds: []
            });

            expect(result.data.length).toBeGreaterThan(0);
            expect(result.data.length).toBeLessThanOrEqual(3);

            // Each province should have children (cities) when depth=2
            result.data.forEach((province: any) => {
                if (province.childCount > 0) {
                    expect(province.children).toBeDefined();
                    expect(Array.isArray(province.children)).toBe(true);
                    expect(province.children.length).toBeGreaterThan(0);
                }
            });
        });

        it('should respect page parameter with depth', async () => {
            // Get first page
            const page1 = await service.getAllGeographicAreasPaginatedFlexible({
                page: 1,
                limit: 2,
                depth: 1,
                geographicAreaId: countryId,
                authorizedAreaIds: [],
                hasGeographicRestrictions: false,
                readOnlyAreaIds: []
            });

            // Get second page
            const page2 = await service.getAllGeographicAreasPaginatedFlexible({
                page: 2,
                limit: 2,
                depth: 1,
                geographicAreaId: countryId,
                authorizedAreaIds: [],
                hasGeographicRestrictions: false,
                readOnlyAreaIds: []
            });

            // When geographicAreaId is provided, both pages return the same country
            // but with different children paginated inside
            expect(page1.data.length).toBe(1); // Country
            expect(page2.data.length).toBe(1); // Same country

            const country1 = page1.data[0] as any;
            const country2 = page2.data[0] as any;

            expect(country1.id).toBe(countryId);
            expect(country2.id).toBe(countryId);

            // Children should be different across pages
            const page1ChildIds = country1.children?.map((c: any) => c.id) || [];
            const page2ChildIds = country2.children?.map((c: any) => c.id) || [];

            expect(page1ChildIds.length).toBe(2); // First 2 provinces
            expect(page2ChildIds.length).toBeGreaterThan(0); // Next provinces

            const overlap = page1ChildIds.filter((id: string) => page2ChildIds.includes(id));
            expect(overlap.length).toBe(0); // No duplicate provinces across pages
        });

        it('should return correct total count with depth', async () => {
            const result = await service.getAllGeographicAreasPaginatedFlexible({
                page: 1,
                limit: 2,
                depth: 1,
                geographicAreaId: countryId,
                authorizedAreaIds: [],
                hasGeographicRestrictions: false,
                readOnlyAreaIds: []
            });

            expect(result.pagination.total).toBe(5); // Should count all 5 provinces
            expect(result.pagination.totalPages).toBe(3); // 5 provinces / 2 per page = 3 pages
        });
    });
});
