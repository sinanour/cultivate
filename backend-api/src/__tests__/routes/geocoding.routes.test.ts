import request from 'supertest';
import express, { Application } from 'express';
import { GeocodingRoutes } from '../../routes/geocoding.routes';
import { GeocodingService } from '../../services/geocoding.service';
import { AuthMiddleware } from '../../middleware/auth.middleware';
import { AuthorizationMiddleware } from '../../middleware/authorization.middleware';
import { ErrorHandlerMiddleware } from '../../middleware/error-handler.middleware';

jest.mock('../../services/geocoding.service');

describe('GeocodingRoutes', () => {
    let app: Application;
    let mockGeocodingService: jest.Mocked<GeocodingService>;
    let mockAuthMiddleware: jest.Mocked<AuthMiddleware>;
    let mockAuthorizationMiddleware: jest.Mocked<AuthorizationMiddleware>;

    beforeEach(() => {
        app = express();
        app.use(express.json());

        mockGeocodingService = new GeocodingService() as jest.Mocked<GeocodingService>;
        mockAuthMiddleware = {
            authenticate: jest.fn().mockReturnValue((_req: any, _res: any, next: any) => next()),
        } as any;
        mockAuthorizationMiddleware = {
            requireAuthenticated: jest.fn().mockReturnValue((_req: any, _res: any, next: any) => next()),
        } as any;

        const routes = new GeocodingRoutes(
            mockGeocodingService,
            mockAuthMiddleware,
            mockAuthorizationMiddleware
        );

        app.use('/api/v1/geocoding', routes.getRouter());
        app.use(ErrorHandlerMiddleware.handle());

        jest.clearAllMocks();
    });

    describe('GET /search', () => {
        it('should return geocoding results', async () => {
            const mockResults = [
                {
                    latitude: 40.7128,
                    longitude: -74.0060,
                    displayName: 'New York, NY, USA',
                    address: {
                        city: 'New York',
                        state: 'New York',
                        country: 'USA',
                        postcode: '10001'
                    },
                    boundingBox: [40.7, 40.8, -74.1, -74.0] as [number, number, number, number]
                }
            ];

            mockGeocodingService.geocodeAddress = jest.fn().mockResolvedValue(mockResults);

            const response = await request(app)
                .get('/api/v1/geocoding/search')
                .query({ q: 'New York, NY' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(mockResults);
            expect(mockGeocodingService.geocodeAddress).toHaveBeenCalledWith('New York, NY');
        });

        it('should return 400 for missing query parameter', async () => {
            const response = await request(app)
                .get('/api/v1/geocoding/search');

            expect(response.status).toBe(400);
            expect(response.body.code).toBe('VALIDATION_ERROR');
        });

        it('should return 400 for empty query parameter', async () => {
            const response = await request(app)
                .get('/api/v1/geocoding/search')
                .query({ q: '' });

            expect(response.status).toBe(400);
            expect(response.body.code).toBe('VALIDATION_ERROR');
        });

        it('should return 502 for external API errors', async () => {
            mockGeocodingService.geocodeAddress = jest.fn().mockRejectedValue(
                new Error('Geocoding failed: 500 Internal Server Error')
            );

            const response = await request(app)
                .get('/api/v1/geocoding/search')
                .query({ q: 'Invalid Address' });

            expect(response.status).toBe(502);
            expect(response.body.code).toBe('EXTERNAL_API_ERROR');
        });

        it('should return 500 for unexpected errors', async () => {
            mockGeocodingService.geocodeAddress = jest.fn().mockRejectedValue(
                new Error('Unexpected error')
            );

            const response = await request(app)
                .get('/api/v1/geocoding/search')
                .query({ q: 'Test Address' });

            expect(response.status).toBe(500);
            expect(response.body.code).toBe('INTERNAL_ERROR');
        });

        it('should return empty array when no results found', async () => {
            mockGeocodingService.geocodeAddress = jest.fn().mockResolvedValue([]);

            const response = await request(app)
                .get('/api/v1/geocoding/search')
                .query({ q: 'Nonexistent Place' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual([]);
        });
    });
});
