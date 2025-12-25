import { describe, it, expect } from 'vitest';
import { buildGeographicAreaTree, findDescendants, isCircularRelationship } from '../tree.utils';
import type { GeographicArea } from '../../types';

describe('Tree Utils', () => {
    const mockAreas: GeographicArea[] = [
        {
            id: '1',
            name: 'Country',
            areaType: 'COUNTRY',
            createdAt: '2024-01-01',
        },
        {
            id: '2',
            name: 'State',
            areaType: 'STATE',
            parentGeographicAreaId: '1',
            createdAt: '2024-01-01',
        },
        {
            id: '3',
            name: 'City',
            areaType: 'CITY',
            parentGeographicAreaId: '2',
            createdAt: '2024-01-01',
        },
        {
            id: '4',
            name: 'Neighbourhood',
            areaType: 'NEIGHBOURHOOD',
            parentGeographicAreaId: '3',
            createdAt: '2024-01-01',
        },
    ];

    describe('buildGeographicAreaTree', () => {
        it('should build tree with root nodes', () => {
            const tree = buildGeographicAreaTree(mockAreas);

            expect(tree).toHaveLength(1);
            expect(tree[0].id).toBe('1');
            expect(tree[0].text).toBe('Country');
        });

        it('should build nested children', () => {
            const tree = buildGeographicAreaTree(mockAreas);

            expect(tree[0].children).toHaveLength(1);
            expect(tree[0].children![0].id).toBe('2');
            expect(tree[0].children![0].children).toHaveLength(1);
            expect(tree[0].children![0].children![0].id).toBe('3');
        });

        it('should handle multiple root nodes', () => {
            const areas: GeographicArea[] = [
                { id: '1', name: 'Root1', areaType: 'COUNTRY', createdAt: '2024-01-01' },
                { id: '2', name: 'Root2', areaType: 'COUNTRY', createdAt: '2024-01-01' },
            ];

            const tree = buildGeographicAreaTree(areas);
            expect(tree).toHaveLength(2);
        });

        it('should handle orphaned nodes (parent not found)', () => {
            const areas: GeographicArea[] = [
                { id: '1', name: 'Child', areaType: 'CITY', parentGeographicAreaId: '999', createdAt: '2024-01-01' },
            ];

            const tree = buildGeographicAreaTree(areas);
            expect(tree).toHaveLength(1); // Treated as root
        });

        it('should handle empty array', () => {
            const tree = buildGeographicAreaTree([]);
            expect(tree).toHaveLength(0);
        });
    });

    describe('findDescendants', () => {
        it('should find all descendants', () => {
            const descendants = findDescendants('1', mockAreas);

            expect(descendants).toContain('2');
            expect(descendants).toContain('3');
            expect(descendants).toContain('4');
            expect(descendants).toHaveLength(3);
        });

        it('should find direct children only', () => {
            const descendants = findDescendants('3', mockAreas);

            expect(descendants).toContain('4');
            expect(descendants).toHaveLength(1);
        });

        it('should return empty array for leaf nodes', () => {
            const descendants = findDescendants('4', mockAreas);

            expect(descendants).toHaveLength(0);
        });

        it('should return empty array for non-existent id', () => {
            const descendants = findDescendants('999', mockAreas);

            expect(descendants).toHaveLength(0);
        });
    });

    describe('isCircularRelationship', () => {
        it('should detect self-reference', () => {
            const result = isCircularRelationship('1', '1', mockAreas);
            expect(result).toBe(true);
        });

        it('should detect circular relationship with descendant', () => {
            const result = isCircularRelationship('1', '3', mockAreas);
            expect(result).toBe(true);
        });

        it('should detect circular relationship with direct child', () => {
            const result = isCircularRelationship('2', '3', mockAreas);
            expect(result).toBe(true);
        });

        it('should allow valid parent relationship', () => {
            const result = isCircularRelationship('4', '2', mockAreas);
            expect(result).toBe(false);
        });

        it('should allow sibling relationship', () => {
            const areas: GeographicArea[] = [
                { id: '1', name: 'Parent', areaType: 'STATE', createdAt: '2024-01-01' },
                { id: '2', name: 'Child1', areaType: 'CITY', parentGeographicAreaId: '1', createdAt: '2024-01-01' },
                { id: '3', name: 'Child2', areaType: 'CITY', parentGeographicAreaId: '1', createdAt: '2024-01-01' },
            ];

            const result = isCircularRelationship('2', '3', areas);
            expect(result).toBe(false);
        });
    });
});
