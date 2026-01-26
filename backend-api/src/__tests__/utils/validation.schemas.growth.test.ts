import { GrowthQuerySchema } from '../../utils/validation.schemas';
import { TimePeriod, GroupingDimension } from '../../utils/constants';

describe('GrowthQuerySchema - groupBy transformation', () => {
    it('should transform "type" to GroupingDimension.ACTIVITY_TYPE', () => {
        const input = {
            period: TimePeriod.MONTH,
            groupBy: 'type',
        };

        const result = GrowthQuerySchema.parse(input);
        expect(result.groupBy).toBe(GroupingDimension.ACTIVITY_TYPE);
    });

    it('should transform "category" to GroupingDimension.ACTIVITY_CATEGORY', () => {
        const input = {
            period: TimePeriod.MONTH,
            groupBy: 'category',
        };

        const result = GrowthQuerySchema.parse(input);
        expect(result.groupBy).toBe(GroupingDimension.ACTIVITY_CATEGORY);
    });

    it('should reject invalid groupBy values', () => {
        const input = {
            period: TimePeriod.MONTH,
            groupBy: 'invalid',
        };

        expect(() => GrowthQuerySchema.parse(input)).toThrow();
    });

    it('should accept undefined groupBy', () => {
        const input = {
            period: TimePeriod.MONTH,
        };

        const result = GrowthQuerySchema.parse(input);
        expect(result.groupBy).toBeUndefined();
    });

    it('should accept valid query with all parameters', () => {
        const input = {
            period: TimePeriod.MONTH,
            startDate: '2024-01-01T00:00:00.000Z',
            endDate: '2024-12-31T23:59:59.999Z',
            activityCategoryIds: '550e8400-e29b-41d4-a716-446655440001,550e8400-e29b-41d4-a716-446655440002',
            activityTypeIds: '550e8400-e29b-41d4-a716-446655440003,550e8400-e29b-41d4-a716-446655440004',
            geographicAreaIds: '550e8400-e29b-41d4-a716-446655440005',
            venueIds: '550e8400-e29b-41d4-a716-446655440006,550e8400-e29b-41d4-a716-446655440007',
            populationIds: '550e8400-e29b-41d4-a716-446655440008',
            groupBy: 'type',
        };

        const result = GrowthQuerySchema.parse(input);
        expect(result.period).toBe(TimePeriod.MONTH);
        expect(result.groupBy).toBe(GroupingDimension.ACTIVITY_TYPE);
        expect(result.activityCategoryIds).toEqual(['550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002']);
        expect(result.activityTypeIds).toEqual(['550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440004']);
    });

    it('should only accept "type" or "category" as user input values', () => {
        // These should be rejected because preprocessing doesn't transform them
        // and they don't match the allowed enum values (ACTIVITY_TYPE, ACTIVITY_CATEGORY)
        const invalidValues = ['venue', 'geographicArea', 'date', 'invalid'];

        invalidValues.forEach(value => {
            const input = {
                period: TimePeriod.MONTH,
                groupBy: value,
            };

            expect(() => GrowthQuerySchema.parse(input)).toThrow();
        });
    });

    it('should accept GroupingDimension.ACTIVITY_TYPE directly (post-transformation value)', () => {
        const input = {
            period: TimePeriod.MONTH,
            groupBy: GroupingDimension.ACTIVITY_TYPE,
        };

        const result = GrowthQuerySchema.parse(input);
        expect(result.groupBy).toBe(GroupingDimension.ACTIVITY_TYPE);
    });

    it('should accept GroupingDimension.ACTIVITY_CATEGORY directly (post-transformation value)', () => {
        const input = {
            period: TimePeriod.MONTH,
            groupBy: GroupingDimension.ACTIVITY_CATEGORY,
        };

        const result = GrowthQuerySchema.parse(input);
        expect(result.groupBy).toBe(GroupingDimension.ACTIVITY_CATEGORY);
    });
});
