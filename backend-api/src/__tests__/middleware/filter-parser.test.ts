import { Request, Response, NextFunction } from 'express';
import { parseFilterParameters, ParsedFilterRequest } from '../../middleware/filter-parser.middleware';

describe('Filter Parser Middleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
        mockReq = {
            query: {}
        };
        mockRes = {};
        mockNext = jest.fn();
    });

    it('should parse filter as nested object (Express default behavior)', () => {
        mockReq.query = {
            filter: { name: 'john' } // Express parses filter[name]=john as nested object
        };

        parseFilterParameters(mockReq as Request, mockRes as Response, mockNext);

        const parsedReq = mockReq as ParsedFilterRequest;
        expect(parsedReq.parsedFilter).toEqual({ name: 'john' });
        expect(mockNext).toHaveBeenCalled();
    });

    it('should parse multiple filter fields from nested object', () => {
        mockReq.query = {
            filter: { name: 'john', email: 'gmail' }
        };

        parseFilterParameters(mockReq as Request, mockRes as Response, mockNext);

        const parsedReq = mockReq as ParsedFilterRequest;
        expect(parsedReq.parsedFilter).toEqual({
            name: 'john',
            email: 'gmail'
        });
    });

    it('should parse fields parameter', () => {
        mockReq.query = {
            fields: 'id,name,email'
        };

        parseFilterParameters(mockReq as Request, mockRes as Response, mockNext);

        const parsedReq = mockReq as ParsedFilterRequest;
        expect(parsedReq.parsedFields).toEqual(['id', 'name', 'email']);
    });

    it('should handle both filter and fields parameters', () => {
        mockReq.query = {
            filter: { name: 'john' },
            fields: 'id,name'
        };

        parseFilterParameters(mockReq as Request, mockRes as Response, mockNext);

        const parsedReq = mockReq as ParsedFilterRequest;
        expect(parsedReq.parsedFilter).toEqual({ name: 'john' });
        expect(parsedReq.parsedFields).toEqual(['id', 'name']);
    });

    it('should not set parsedFilter if no filters provided', () => {
        mockReq.query = {
            page: '1',
            limit: '20'
        };

        parseFilterParameters(mockReq as Request, mockRes as Response, mockNext);

        const parsedReq = mockReq as ParsedFilterRequest;
        expect(parsedReq.parsedFilter).toBeUndefined();
    });
});
