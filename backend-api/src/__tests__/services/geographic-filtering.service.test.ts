import { GeographicFilteringService } from '../../services/geographic-filtering.service';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { PrismaClient } from '@prisma/client';

// Mock the GeographicAreaRepository
jest.mock('../../repositories/geographic-area.repository');

describe('GeographicFilteringService', () => {
    let service: GeographicFilteringService;
    let mockRepository: jest.Mocked<GeographicAreaRepository>;
    let mockPrisma: PrismaClient;

    beforeEach(() => {
        mockPrisma = {} as PrismaClient;
        service = new GeographicFilteringService(mockPrisma);
        mockRepository = (service as any).geographicAreaRepository;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getEffectiveGeographicAreaIds', () => {
        describe('explicit filter with authorization', () => {
            it('should expand explicit filter to include descendants when user has no restrictions', async () => {
                const explicitAreaId = 'area-1';
                const descendantIds = ['area-2', 'area-3'];
                mockRepository.findBatchDescendants = jest.fn().mockResolvedValue(descendantIds);

                const result = await service.getEffectiveGeographicAreaIds(
                    explicitAreaId,
                    [],
                    false
                );

                expect(result).toEqual(['area-1', 'area-2', 'area-3']);
                expect(mockRepository.findBatchDescendants).toHaveBeenCalledWith(['area-1']);
            });

            it('should expand explicit filter and filter to authorized areas when user has restrictions', async () => {
                const explicitAreaId = 'area-1';
                const descendantIds = ['area-2', 'area-3', 'area-4'];
                const authorizedAreaIds = ['area-1', 'area-2', 'area-4'];
                mockRepository.findBatchDescendants = jest.fn().mockResolvedValue(descendantIds);

                const result = await service.getEffectiveGeographicAreaIds(
                    explicitAreaId,
                    authorizedAreaIds,
                    true
                );

                expect(result).toEqual(['area-1', 'area-2', 'area-4']);
                expect(mockRepository.findBatchDescendants).toHaveBeenCalledWith(['area-1']);
            });

            it('should throw error when user lacks permission for explicit filter', async () => {
                const explicitAreaId = 'area-1';
                const authorizedAreaIds = ['area-2', 'area-3'];

                await expect(
                    service.getEffectiveGeographicAreaIds(explicitAreaId, authorizedAreaIds, true)
                ).rejects.toThrow(
                    'GEOGRAPHIC_AUTHORIZATION_DENIED: You do not have permission to access this geographic area'
                );

                expect(mockRepository.findBatchDescendants).not.toHaveBeenCalled();
            });

            it('should allow explicit filter when user has permission', async () => {
                const explicitAreaId = 'area-1';
                const authorizedAreaIds = ['area-1', 'area-2'];
                const descendantIds = ['area-2'];
                mockRepository.findBatchDescendants = jest.fn().mockResolvedValue(descendantIds);

                const result = await service.getEffectiveGeographicAreaIds(
                    explicitAreaId,
                    authorizedAreaIds,
                    true
                );

                expect(result).toEqual(['area-1', 'area-2']);
                expect(mockRepository.findBatchDescendants).toHaveBeenCalledWith(['area-1']);
            });
        });

        describe('implicit filtering with restrictions', () => {
            it('should return authorized areas when user has restrictions and no explicit filter', async () => {
                const authorizedAreaIds = ['area-1', 'area-2', 'area-3'];

                const result = await service.getEffectiveGeographicAreaIds(
                    undefined,
                    authorizedAreaIds,
                    true
                );

                expect(result).toEqual(['area-1', 'area-2', 'area-3']);
                expect(mockRepository.findBatchDescendants).not.toHaveBeenCalled();
            });

            it('should not expand descendants for implicit filtering', async () => {
                const authorizedAreaIds = ['area-1', 'area-2'];

                const result = await service.getEffectiveGeographicAreaIds(
                    undefined,
                    authorizedAreaIds,
                    true
                );

                expect(result).toEqual(['area-1', 'area-2']);
                expect(mockRepository.findBatchDescendants).not.toHaveBeenCalled();
            });
        });

        describe('no filtering without restrictions', () => {
            it('should return undefined when user has no restrictions and no explicit filter', async () => {
                const result = await service.getEffectiveGeographicAreaIds(undefined, [], false);

                expect(result).toBeUndefined();
                expect(mockRepository.findBatchDescendants).not.toHaveBeenCalled();
            });

            it('should return undefined when authorized areas are empty and no restrictions', async () => {
                const result = await service.getEffectiveGeographicAreaIds(undefined, [], false);

                expect(result).toBeUndefined();
            });
        });

        describe('descendant expansion', () => {
            it('should include original area and all descendants', async () => {
                const explicitAreaId = 'area-1';
                const descendantIds = ['area-2', 'area-3', 'area-4'];
                mockRepository.findBatchDescendants = jest.fn().mockResolvedValue(descendantIds);

                const result = await service.getEffectiveGeographicAreaIds(
                    explicitAreaId,
                    [],
                    false
                );

                expect(result).toEqual(['area-1', 'area-2', 'area-3', 'area-4']);
            });

            it('should handle area with no descendants', async () => {
                const explicitAreaId = 'area-1';
                mockRepository.findBatchDescendants = jest.fn().mockResolvedValue([]);

                const result = await service.getEffectiveGeographicAreaIds(
                    explicitAreaId,
                    [],
                    false
                );

                expect(result).toEqual(['area-1']);
            });
        });
    });

    describe('getEffectiveGeographicAreaIdsForAnalytics', () => {
        describe('with array input', () => {
            it('should expand multiple explicit filters to include descendants', async () => {
                const explicitAreaIds = ['area-1', 'area-2'];
                const descendantIds = ['area-3', 'area-4', 'area-5'];
                mockRepository.findBatchDescendants = jest.fn().mockResolvedValue(descendantIds);

                const result = await service.getEffectiveGeographicAreaIdsForAnalytics(
                    explicitAreaIds,
                    [],
                    false
                );

                expect(result).toEqual(['area-1', 'area-2', 'area-3', 'area-4', 'area-5']);
                expect(mockRepository.findBatchDescendants).toHaveBeenCalledWith(['area-1', 'area-2']);
            });

            it('should validate all areas when user has restrictions', async () => {
                const explicitAreaIds = ['area-1', 'area-2'];
                const authorizedAreaIds = ['area-1', 'area-3'];

                await expect(
                    service.getEffectiveGeographicAreaIdsForAnalytics(
                        explicitAreaIds,
                        authorizedAreaIds,
                        true
                    )
                ).rejects.toThrow(
                    'GEOGRAPHIC_AUTHORIZATION_DENIED: You do not have permission to access this geographic area'
                );
            });

            it('should filter descendants to authorized areas when user has restrictions', async () => {
                const explicitAreaIds = ['area-1', 'area-2'];
                const authorizedAreaIds = ['area-1', 'area-2', 'area-3', 'area-5'];
                const descendantIds = ['area-3', 'area-4', 'area-5'];
                mockRepository.findBatchDescendants = jest.fn().mockResolvedValue(descendantIds);

                const result = await service.getEffectiveGeographicAreaIdsForAnalytics(
                    explicitAreaIds,
                    authorizedAreaIds,
                    true
                );

                expect(result).toEqual(['area-1', 'area-2', 'area-3', 'area-5']);
            });
        });

        describe('with single string input', () => {
            it('should normalize single string to array', async () => {
                const explicitAreaId = 'area-1';
                const descendantIds = ['area-2', 'area-3'];
                mockRepository.findBatchDescendants = jest.fn().mockResolvedValue(descendantIds);

                const result = await service.getEffectiveGeographicAreaIdsForAnalytics(
                    explicitAreaId,
                    [],
                    false
                );

                expect(result).toEqual(['area-1', 'area-2', 'area-3']);
                expect(mockRepository.findBatchDescendants).toHaveBeenCalledWith(['area-1']);
            });
        });

        describe('with undefined input', () => {
            it('should return authorized areas when user has restrictions', async () => {
                const authorizedAreaIds = ['area-1', 'area-2'];

                const result = await service.getEffectiveGeographicAreaIdsForAnalytics(
                    undefined,
                    authorizedAreaIds,
                    true
                );

                expect(result).toEqual(['area-1', 'area-2']);
                expect(mockRepository.findBatchDescendants).not.toHaveBeenCalled();
            });

            it('should return undefined when user has no restrictions', async () => {
                const result = await service.getEffectiveGeographicAreaIdsForAnalytics(
                    undefined,
                    [],
                    false
                );

                expect(result).toBeUndefined();
            });
        });

        describe('with empty array input', () => {
            it('should return authorized areas when user has restrictions', async () => {
                const authorizedAreaIds = ['area-1', 'area-2'];

                const result = await service.getEffectiveGeographicAreaIdsForAnalytics(
                    [],
                    authorizedAreaIds,
                    true
                );

                expect(result).toEqual(['area-1', 'area-2']);
            });

            it('should return undefined when user has no restrictions', async () => {
                const result = await service.getEffectiveGeographicAreaIdsForAnalytics([], [], false);

                expect(result).toBeUndefined();
            });
        });
    });
});
