import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
    invalidatePageCaches,
    getListPageQueryKeys,
    getDetailPageQueryKeys,
    getDashboardQueryKeys,
    getMapQueryKeys
} from '../cache-invalidation.utils';

describe('cache-invalidation.utils', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient();
    });

    describe('invalidatePageCaches', () => {
        it('should invalidate specific query keys when provided', async () => {
            const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

            await invalidatePageCaches(queryClient, {
                queryKeys: [['participants'], ['activities']]
            });

            expect(invalidateSpy).toHaveBeenCalledTimes(2);
            expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['participants'] });
            expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['activities'] });
        });

        it('should invalidate all queries when empty queryKeys array provided', async () => {
            const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

            await invalidatePageCaches(queryClient, {
                queryKeys: []
            });

            expect(invalidateSpy).toHaveBeenCalledWith();
        });
    });

    describe('getListPageQueryKeys', () => {
        it('should return correct query keys for participants', () => {
            const keys = getListPageQueryKeys('participants');
            expect(keys).toEqual([
                ['participants'],
                ['participants-count'],
                ['participants-filters']
            ]);
        });

        it('should return correct query keys for activities', () => {
            const keys = getListPageQueryKeys('activities');
            expect(keys).toEqual([
                ['activities'],
                ['activities-count'],
                ['activities-filters']
            ]);
        });

        it('should return correct query keys for venues', () => {
            const keys = getListPageQueryKeys('venues');
            expect(keys).toEqual([
                ['venues'],
                ['venues-count'],
                ['venues-filters']
            ]);
        });

        it('should return correct query keys for geographic-areas', () => {
            const keys = getListPageQueryKeys('geographic-areas');
            expect(keys).toEqual([
                ['geographic-areas'],
                ['geographic-areas-count'],
                ['geographic-areas-filters']
            ]);
        });
    });

    describe('getDetailPageQueryKeys', () => {
        it('should return correct query keys for participant detail', () => {
            const keys = getDetailPageQueryKeys('participant', '123');
            expect(keys).toContainEqual(['participant', '123']);
            expect(keys).toContainEqual(['participant-123-related']);
        });

        it('should return correct query keys for activity detail', () => {
            const keys = getDetailPageQueryKeys('activity', '456');
            expect(keys).toContainEqual(['activity', '456']);
            expect(keys).toContainEqual(['activity-456-related']);
        });
    });

    describe('getDashboardQueryKeys', () => {
        it('should return correct query keys for engagement dashboard', () => {
            const keys = getDashboardQueryKeys('engagement');
            expect(keys).toContainEqual(['engagement-metrics']);
            expect(keys).toContainEqual(['engagement-charts']);
            expect(keys).toContainEqual(['analytics']);
        });

        it('should return correct query keys for growth dashboard', () => {
            const keys = getDashboardQueryKeys('growth');
            expect(keys).toContainEqual(['growth-metrics']);
            expect(keys).toContainEqual(['growth-charts']);
            expect(keys).toContainEqual(['analytics']);
        });
    });

    describe('getMapQueryKeys', () => {
        it('should return correct query keys for map view', () => {
            const keys = getMapQueryKeys();
            expect(keys).toContainEqual(['map-markers']);
            expect(keys).toContainEqual(['map-activities']);
            expect(keys).toContainEqual(['map-participant-homes']);
            expect(keys).toContainEqual(['map-venues']);
            expect(keys).toContainEqual(['map-popup']);
        });
    });
});
