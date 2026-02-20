import { PrismaClient } from '@prisma/client';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';

const prisma = new PrismaClient();
const repository = new GeographicAreaRepository(prisma);

describe('Batch Descendants Integration Tests', () => {
    const testSuffix = Date.now();
    let testAreaIds: string[] = [];

    beforeAll(async () => {
        // Create a test hierarchy:
        // World -> Country -> Province -> City -> Neighbourhood
        const world = await prisma.geographicArea.create({
            data: {
                name: `BatchDescTest World ${testSuffix}`,
                areaType: 'WORLD',
            },
        });
        testAreaIds.push(world.id);

        const country = await prisma.geographicArea.create({
            data: {
                name: `BatchDescTest Country ${testSuffix}`,
                areaType: 'COUNTRY',
                parentGeographicAreaId: world.id,
            },
        });
        testAreaIds.push(country.id);

        const province = await prisma.geographicArea.create({
            data: {
                name: `BatchDescTest Province ${testSuffix}`,
                areaType: 'PROVINCE',
                parentGeographicAreaId: country.id,
            },
        });
        testAreaIds.push(province.id);

        const city = await prisma.geographicArea.create({
            data: {
                name: `BatchDescTest City ${testSuffix}`,
                areaType: 'CITY',
                parentGeographicAreaId: province.id,
            },
        });
        testAreaIds.push(city.id);

        const neighbourhood = await prisma.geographicArea.create({
            data: {
                name: `BatchDescTest Neighbourhood ${testSuffix}`,
                areaType: 'NEIGHBOURHOOD',
                parentGeographicAreaId: city.id,
            },
        });
        testAreaIds.push(neighbourhood.id);
    });

    afterAll(async () => {
        // Clean up in reverse order
        for (let i = testAreaIds.length - 1; i >= 0; i--) {
            await prisma.geographicArea.delete({ where: { id: testAreaIds[i] } });
        }
        await prisma.$disconnect();
    });

    describe('findBatchDescendants', () => {
        it('should return all descendants for a single area', async () => {
            const [worldId, countryId, provinceId, cityId, neighbourhoodId] = testAreaIds;

            const descendants = await repository.findBatchDescendants([worldId]);

            expect(descendants).toHaveLength(4);
            expect(descendants).toContain(countryId);
            expect(descendants).toContain(provinceId);
            expect(descendants).toContain(cityId);
            expect(descendants).toContain(neighbourhoodId);
            expect(descendants).not.toContain(worldId); // Should not include the parent itself
        });

        it('should return all descendants for multiple areas', async () => {
            const [, countryId, provinceId, cityId, neighbourhoodId] = testAreaIds;

            // Request descendants for both country and city
            const descendants = await repository.findBatchDescendants([countryId, cityId]);

            // Country descendants: province, city, neighbourhood
            // City descendants: neighbourhood
            // Combined (deduplicated): province, city, neighbourhood
            // But city is a parent, so it's excluded from the result
            // Actual result: province, neighbourhood (city is excluded because it's in the input)
            expect(descendants).toHaveLength(2);
            expect(descendants).toContain(provinceId);
            expect(descendants).toContain(neighbourhoodId);
            expect(descendants).not.toContain(countryId); // Should not include the parents
            expect(descendants).not.toContain(cityId); // City is in input, so excluded
        });

        it('should handle overlapping hierarchies correctly', async () => {
            const [worldId, countryId, provinceId, cityId, neighbourhoodId] = testAreaIds;

            // Request descendants for world and country (country is descendant of world)
            const descendants = await repository.findBatchDescendants([worldId, countryId]);

            // World descendants: country, province, city, neighbourhood
            // Country descendants: province, city, neighbourhood
            // Combined (deduplicated): country, province, city, neighbourhood
            // But country is in input, so excluded
            // Actual result: province, city, neighbourhood
            expect(descendants).toHaveLength(3);
            expect(descendants).not.toContain(worldId); // World is in input
            expect(descendants).not.toContain(countryId); // Country is in input
            expect(descendants).toContain(provinceId);
            expect(descendants).toContain(cityId);
            expect(descendants).toContain(neighbourhoodId);
        });

        it('should return empty array for leaf nodes', async () => {
            const [, , , , neighbourhoodId] = testAreaIds;

            const descendants = await repository.findBatchDescendants([neighbourhoodId]);

            expect(descendants).toHaveLength(0);
        });

        it('should return empty array for empty input', async () => {
            const descendants = await repository.findBatchDescendants([]);

            expect(descendants).toHaveLength(0);
        });

        it('should handle non-existent IDs gracefully', async () => {
            const descendants = await repository.findBatchDescendants([
                '00000000-0000-0000-0000-000000000000',
            ]);

            expect(descendants).toHaveLength(0);
        });
    });
});
