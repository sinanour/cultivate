/**
 * End-to-end test for filter parsing through HTTP requests
 */

import request from 'supertest';
import express, { Application } from 'express';
import { parseFilterParameters, ParsedFilterRequest } from '../../middleware/filter-parser.middleware';

describe('Filter Parsing E2E', () => {
    let app: Application;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));

        app.get('/test', parseFilterParameters, (req, res) => {
            const parsedReq = req as ParsedFilterRequest;
            res.json({
                parsedFilter: parsedReq.parsedFilter,
                parsedFields: parsedReq.parsedFields,
                rawQuery: req.query
            });
        });
    });

    it('should parse filter[name] from URL-encoded request', async () => {
        const response = await request(app)
            .get('/test?filter%5Bname%5D=john&fields=id%2Cname')
            .expect(200);

        expect(response.body.parsedFilter).toEqual({ name: 'john' });
        expect(response.body.parsedFields).toEqual(['id', 'name']);
    });

    it('should parse multiple filter parameters', async () => {
        const response = await request(app)
            .get('/test?filter%5Bname%5D=john&filter%5Bemail%5D=gmail')
            .expect(200);

        expect(response.body.parsedFilter).toEqual({
            name: 'john',
            email: 'gmail'
        });
    });

    it('should handle unencoded brackets', async () => {
        const response = await request(app)
            .get('/test?filter[name]=john&fields=id,name')
            .expect(200);

        expect(response.body.parsedFilter).toEqual({ name: 'john' });
        expect(response.body.parsedFields).toEqual(['id', 'name']);
    });
});
