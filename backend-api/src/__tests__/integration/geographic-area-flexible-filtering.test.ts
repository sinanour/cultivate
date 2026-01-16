/**
 * Integration tests for geographic area flexible filtering
 * Tests the filter[name] parameter and fields parameter for geographic areas
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Geographic Area Flexible Filtering Integration Tests', () => {
    let testAreaIds: string[] = [];

    beforeAll(async () => {
        // Create test geographic areas with various names
        const testAreas = [
            { name: 'Vancouver City', areaType: 'CITY' as const, parentGeographicAreaId: null },
            { name: 'Vancouver Island', areaType: 'CITY' as const, parentGeographicAreaId: null },
            { name: 'Downtown Vancouver', areaType: 'NEIGHBOURHOOD' as const, parentGeographicAreaId: null },
            { name: 'North Vancouver', areaType: 'CITY' as const, parentGeographicAreaId: null },
            { name: 'West Vancouver', areaType: 'CITY' as const, parentGeographicAreaId: null },
            { name: 'Toronto', areaType: 'CITY' as const, parentGeographicAreaId: null },
            { name: 'Montreal', areaType: 'CITY' as const, parentGeographicAreaId: null },
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
            const response = await fetch('http://localhost:3000/api/v1/geographic-areas?filter[name]=vancouver', {
                headers: {
                    'Authorization': `Bearer ${process.env.TEST_AUTH_TOKEN}`
                }
            });

            expect(response.status).toBe(200);
            const result = await response.json();

            expect(result.success).toBe(true);
            expect(Array.isArray(result.data)).toBe(true);

            // Should return all areas with "vancouver" in the name (case-insensitive)
            const vancouverAreas = result.data.filter((area: any) =>
                area.name.toLowerCase().includes('vancouver')
            );
            expect(vancouverAreas.length).toBeGreaterThanOrEqual(4); // Vancouver City, Vancouver Island, Downtown Vancouver, North Vancouver, West Vancouver

            // Should NOT return areas without "vancouver" in the name
            const nonVancouverAreas = result.data.filter((area: any) =>
                !area.name.toLowerCase().includes('vancouver')
            );
            expect(nonVancouverAreas.length).toBe(0);
        });

        it('should be case-insensitive', async () => {
            const response = await fetch('http://localhost:3000/api/v1/geographic-areas?filter[name]=VANCOUVER', {
                headers: {
                    'Authorization': `Bearer ${process.env.TEST_AUTH_TOKEN}`
                }
            });

            expect(response.status).toBe(200);
            const result = await response.json();

            expect(result.success).toBe(true);
            expect(result.data.length).toBeGreaterThanOrEqual(4);
        });

        it('should return empty array when no matches', async () => {
            const response = await fetch('http://localhost:3000/api/v1/geographic-areas?filter[name]=nonexistent', {
                headers: {
                    'Authorization': `Bearer ${process.env.TEST_AUTH_TOKEN}`
                }
            });

            expect(response.status).toBe(200);
            const result = await response.json();

            expect(result.success).toBe(true);
            expect(result.data).toEqual([]);
        });
    });

    describe('fields parameter', () => {
        it('should return only requested fields', async () => {
            const response = await fetch('http://localhost:3000/api/v1/geographic-areas?filter[name]=vancouver&fields=id,name,areaType', {
                headers: {
                    'Authorization': `Bearer ${process.env.TEST_AUTH_TOKEN}`
                }
            });

            expect(response.status).toBe(200);
            const result = await response.json();

            expect(result.success).toBe(true);
            expect(result.data.length).toBeGreaterThan(0);

            // Check that only requested fields are present
            const firstArea = result.data[0];
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
            const response = await fetch('http://localhost:3000/api/v1/geographic-areas?filter[name]=vancouver&filter[areaType]=CITY', {
                headers: {
                    'Authorization': `Bearer ${process.env.TEST_AUTH_TOKEN}`
                }
            });

            expect(response.status).toBe(200);
            const result = await response.json();

            expect(result.success).toBe(true);

            // All results should have "vancouver" in name AND be CITY type
            result.data.forEach((area: any) => {
                expect(area.name.toLowerCase()).toContain('vancouver');
                expect(area.areaType).toBe('CITY');
            });
        });

        it('should combine filter[name] with fields parameter', async () => {
            const response = await fetch('http://localhost:3000/api/v1/geographic-areas?filter[name]=toronto&fields=id,name', {
                headers: {
                    'Authorization': `Bearer ${process.env.TEST_AUTH_TOKEN}`
                }
            });

            expect(response.status).toBe(200);
            const result = await response.json();

            expect(result.success).toBe(true);
            expect(result.data.length).toBeGreaterThan(0);

            const firstArea = result.data[0];
            expect(firstArea.name.toLowerCase()).toContain('toronto');
            expect(Object.keys(firstArea)).toEqual(['id', 'name']);
        });
    });

    describe('Pagination with filtering', () => {
        it('should support pagination with filter[name]', async () => {
            const response = await fetch('http://localhost:3000/api/v1/geographic-areas?filter[name]=vancouver&page=1&limit=2', {
                headers: {
                    'Authorization': `Bearer ${process.env.TEST_AUTH_TOKEN}`
                }
            });

            expect(response.status).toBe(200);
            const result = await response.json();

            expect(result.success).toBe(true);
            expect(result.pagination).toBeDefined();
            expect(result.pagination.page).toBe(1);
            expect(result.pagination.limit).toBe(2);
            expect(result.pagination.total).toBeGreaterThanOrEqual(4);
            expect(result.data.length).toBeLessThanOrEqual(2);
        });
    });
});
