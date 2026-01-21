import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MapDataService, BoundingBox } from '../map-data.service';
import * as ApiClientModule from '../api.client';

vi.mock('../api.client');

describe('MapDataService Coordinate Filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use ApiClient.get for token refresh support', async () => {
    const mockResponse = {
      data: [],
      pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
    };

    vi.mocked(ApiClientModule.ApiClient.get).mockResolvedValueOnce(mockResponse);

    await MapDataService.getActivityMarkers({}, undefined, 1, 100);

    expect(ApiClientModule.ApiClient.get).toHaveBeenCalledTimes(1);
  });

  it('should include bounding box parameters when provided', async () => {
    const mockResponse = {
      data: [],
      pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
    };

    vi.mocked(ApiClientModule.ApiClient.get).mockResolvedValueOnce(mockResponse);

    const boundingBox: BoundingBox = {
      minLat: 40.5,
      maxLat: 40.9,
      minLon: -74.2,
      maxLon: -73.8,
    };

    await MapDataService.getActivityMarkers({}, boundingBox, 1, 100);

    expect(ApiClientModule.ApiClient.get).toHaveBeenCalledTimes(1);
    const callEndpoint = vi.mocked(ApiClientModule.ApiClient.get).mock.calls[0][0];
    
    expect(callEndpoint).toContain('minLat=40.5');
    expect(callEndpoint).toContain('maxLat=40.9');
    expect(callEndpoint).toContain('minLon=-74.2');
    expect(callEndpoint).toContain('maxLon=-73.8');
  });

  it('should verify coordinates are within valid ranges', async () => {
    const mockResponse = {
      data: [],
      pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
    };

    vi.mocked(ApiClientModule.ApiClient.get).mockResolvedValueOnce(mockResponse);

    const normalizedBoundingBox: BoundingBox = {
      minLat: -78.69,
      maxLat: 84.08,
      minLon: -171.21,
      maxLon: -136.76,
    };

    await MapDataService.getActivityMarkers({}, normalizedBoundingBox, 1, 100);

    const callEndpoint = vi.mocked(ApiClientModule.ApiClient.get).mock.calls[0][0];
    
    const minLatMatch = callEndpoint.match(/minLat=(-?\d+(?:\.\d+)?)/);
    const maxLatMatch = callEndpoint.match(/maxLat=(-?\d+(?:\.\d+)?)/);
    const minLonMatch = callEndpoint.match(/minLon=(-?\d+(?:\.\d+)?)/);
    const maxLonMatch = callEndpoint.match(/maxLon=(-?\d+(?:\.\d+)?)/);
    
    const minLat = parseFloat(minLatMatch![1]);
    const maxLat = parseFloat(maxLatMatch![1]);
    const minLon = parseFloat(minLonMatch![1]);
    const maxLon = parseFloat(maxLonMatch![1]);
    
    expect(minLat).toBeGreaterThanOrEqual(-90);
    expect(minLat).toBeLessThanOrEqual(90);
    expect(maxLat).toBeGreaterThanOrEqual(-90);
    expect(maxLat).toBeLessThanOrEqual(90);
    expect(minLon).toBeGreaterThanOrEqual(-180);
    expect(minLon).toBeLessThanOrEqual(180);
    expect(maxLon).toBeGreaterThanOrEqual(-180);
    expect(maxLon).toBeLessThanOrEqual(180);
    expect(minLat).toBeLessThanOrEqual(maxLat);
  });
});
