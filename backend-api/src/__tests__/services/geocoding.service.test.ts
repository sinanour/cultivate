import { GeocodingService } from '../../services/geocoding.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GeocodingService', () => {
    let service: GeocodingService;

    beforeEach(() => {
        service = new GeocodingService();
        service.clearCache();
        jest.clearAllMocks();
    });

    describe('geocodeAddress', () => {
        it('should geocode address successfully', async () => {
            const mockResponse = {
                data: [
                    {
                        lat: '40.7128',
                        lon: '-74.0060',
                        display_name: 'New York, NY, USA',
                        address: {
                            city: 'New York',
                            state: 'New York',
                            country: 'USA',
                            postcode: '10001'
                        },
                        boundingbox: ['40.7', '40.8', '-74.1', '-74.0']
                    }
                ],
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {} as any
            };

            mockedAxios.get.mockResolvedValue(mockResponse);

            const result = await service.geocodeAddress('New York, NY');

            expect(result).toHaveLength(1);
            expect(result[0].latitude).toBe(40.7128);
            expect(result[0].longitude).toBe(-74.0060);
            expect(result[0].displayName).toBe('New York, NY, USA');
            expect(mockedAxios.get).toHaveBeenCalledWith(
                expect.stringContaining('nominatim.openstreetmap.org/search'),
                expect.objectContaining({
                    headers: {
                        'User-Agent': 'Cultivate/1.0'
                    }
                })
            );
        });

        it('should throw error for empty address', async () => {
            await expect(service.geocodeAddress('')).rejects.toThrow('Address is required');
        });

        it('should return cached results on subsequent calls', async () => {
            const mockResponse = {
                data: [
                    {
                        lat: '40.7128',
                        lon: '-74.0060',
                        display_name: 'New York, NY, USA',
                        address: {},
                        boundingbox: []
                    }
                ],
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {} as any
            };

            mockedAxios.get.mockResolvedValue(mockResponse);

            // First call
            await service.geocodeAddress('New York, NY');

            // Second call should use cache
            const result = await service.geocodeAddress('New York, NY');

            expect(result).toHaveLength(1);
            expect(mockedAxios.get).toHaveBeenCalledTimes(1); // Only called once
        });

        it('should handle API errors gracefully', async () => {
            mockedAxios.get.mockRejectedValue({
                response: {
                    status: 500,
                    statusText: 'Internal Server Error'
                }
            });

            await expect(service.geocodeAddress('Invalid Address')).rejects.toThrow('Geocoding failed');
        });

        it('should handle network errors', async () => {
            mockedAxios.get.mockRejectedValue(new Error('Network error'));

            await expect(service.geocodeAddress('Test Address')).rejects.toThrow('Geocoding failed: Network error');
        });
    });

    describe('clearCache', () => {
        it('should clear the cache', async () => {
            const mockResponse = {
                data: [
                    {
                        lat: '40.7128',
                        lon: '-74.0060',
                        display_name: 'New York, NY, USA',
                        address: {},
                        boundingbox: []
                    }
                ],
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {} as any
            };

            mockedAxios.get.mockResolvedValue(mockResponse);

            // Add to cache
            await service.geocodeAddress('New York, NY');
            expect(service.getCacheSize()).toBe(1);

            // Clear cache
            service.clearCache();
            expect(service.getCacheSize()).toBe(0);
        });
    });
});
