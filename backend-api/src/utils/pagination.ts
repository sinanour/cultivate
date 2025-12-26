export interface PaginationParams {
    page?: number;
    limit?: number;
}

export interface PaginationMetadata {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: PaginationMetadata;
}

export class PaginationHelper {
    static readonly DEFAULT_PAGE = 1;
    static readonly DEFAULT_LIMIT = 50;
    static readonly MAX_LIMIT = 100;

    static validateAndNormalize(params: PaginationParams): { page: number; limit: number; skip: number } {
        let page = params.page || this.DEFAULT_PAGE;
        let limit = params.limit || this.DEFAULT_LIMIT;

        // Validate page
        if (page < 1) {
            throw new Error('Page must be greater than or equal to 1');
        }

        // Validate and cap limit
        if (limit < 1) {
            throw new Error('Limit must be greater than or equal to 1');
        }
        if (limit > this.MAX_LIMIT) {
            limit = this.MAX_LIMIT;
        }

        const skip = (page - 1) * limit;

        return { page, limit, skip };
    }

    static createMetadata(page: number, limit: number, total: number): PaginationMetadata {
        const totalPages = Math.ceil(total / limit);
        return {
            page,
            limit,
            total,
            totalPages,
        };
    }

    static createResponse<T>(data: T[], page: number, limit: number, total: number): PaginatedResponse<T> {
        return {
            data,
            pagination: this.createMetadata(page, limit, total),
        };
    }
}
