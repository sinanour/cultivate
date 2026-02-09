/**
 * Application-wide constants and enums
 */

// Activity Status
export enum ActivityStatus {
    PLANNED = 'PLANNED',
    ACTIVE = 'ACTIVE',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
}

// System Roles
export enum SystemRole {
    ADMINISTRATOR = 'ADMINISTRATOR',
    EDITOR = 'EDITOR',
    READ_ONLY = 'READ_ONLY',
}

// Venue Types
export enum VenueType {
    PUBLIC_BUILDING = 'PUBLIC_BUILDING',
    PRIVATE_RESIDENCE = 'PRIVATE_RESIDENCE',
}

// Geographic Area Types
export enum GeographicAreaType {
    NEIGHBOURHOOD = 'NEIGHBOURHOOD',
    COMMUNITY = 'COMMUNITY',
    CITY = 'CITY',
    CLUSTER = 'CLUSTER',
    COUNTY = 'COUNTY',
    PROVINCE = 'PROVINCE',
    STATE = 'STATE',
    COUNTRY = 'COUNTRY',
    CONTINENT = 'CONTINENT',
    HEMISPHERE = 'HEMISPHERE',
    WORLD = 'WORLD',
}

// Sync Operation Types
export enum SyncOperation {
    CREATE = 'CREATE',
    UPDATE = 'UPDATE',
    DELETE = 'DELETE',
}

// Time Periods for Growth Metrics
export enum TimePeriod {
    DAY = 'DAY',
    WEEK = 'WEEK',
    MONTH = 'MONTH',
    YEAR = 'YEAR',
}

// Date Granularity for Engagement Grouping
export enum DateGranularity {
    WEEKLY = 'WEEKLY',
    MONTHLY = 'MONTHLY',
    QUARTERLY = 'QUARTERLY',
    YEARLY = 'YEARLY',
}

// Grouping Dimensions for Analytics
export enum GroupingDimension {
    ACTIVITY_CATEGORY = 'activityCategory',
    ACTIVITY_TYPE = 'activityType',
    VENUE = 'venue',
    GEOGRAPHIC_AREA = 'geographicArea',
    DATE = 'date',
}

// Dimension key constants for grouped results
export const DimensionKeys = {
    ACTIVITY_CATEGORY: {
        name: 'activityCategory',
        id: 'activityCategoryId',
    },
    ACTIVITY_TYPE: {
        name: 'activityType',
        id: 'activityTypeId',
    },
    VENUE: {
        name: 'venue',
        id: 'venueId',
    },
    GEOGRAPHIC_AREA: {
        name: 'geographicArea',
        id: 'geographicAreaId',
    },
    DATE: {
        name: 'date',
    },
} as const;

// Error Codes
export enum ErrorCode {
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    AUTHENTICATION_REQUIRED = 'AUTHENTICATION_REQUIRED',
    INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
    NOT_FOUND = 'NOT_FOUND',
    VERSION_CONFLICT = 'VERSION_CONFLICT',
    CIRCULAR_REFERENCE = 'CIRCULAR_REFERENCE',
    REFERENCED_ENTITY = 'REFERENCED_ENTITY',
    DUPLICATE_EMAIL = 'DUPLICATE_EMAIL',
    DUPLICATE_NAME = 'DUPLICATE_NAME',
    DUPLICATE_ASSIGNMENT = 'DUPLICATE_ASSIGNMENT',
    INVALID_REFERENCE = 'INVALID_REFERENCE',
    RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
    INTERNAL_ERROR = 'INTERNAL_ERROR',
}

// HTTP Status Codes
export enum HttpStatus {
    OK = 200,
    CREATED = 201,
    NO_CONTENT = 204,
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    CONFLICT = 409,
    TOO_MANY_REQUESTS = 429,
    INTERNAL_SERVER_ERROR = 500,
}

// Token Expiration Times
export const TOKEN_EXPIRATION = {
    ACCESS_TOKEN: '15m',
    REFRESH_TOKEN: '7d',
} as const;

// Pagination Defaults
export const PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 50,
    MAX_LIMIT: 100,
} as const;

// Rate Limiting
export const RATE_LIMITS = {
    AUTH_REQUESTS_PER_MINUTE: 5,
    MUTATION_REQUESTS_PER_MINUTE: 100,
    QUERY_REQUESTS_PER_MINUTE: 1000,
} as const;

// Date Formatting
export const DATE_FORMAT = {
    ISO_DATE: 'YYYY-MM-DD',
    ISO_DATETIME: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
} as const;

// Query Parameter Keys
export const QUERY_PARAMS = {
    // Pagination
    PAGE: 'page',
    LIMIT: 'limit',

    // Filtering
    GEOGRAPHIC_AREA_ID: 'geographicAreaId',
    DEPTH: 'depth',

    // Grouping and Analytics
    GROUP_BY: 'groupBy',
    START_DATE: 'startDate',
    END_DATE: 'endDate',
    TIME_PERIOD: 'timePeriod',
    GRANULARITY: 'granularity',

    // Sorting
    SORT_BY: 'sortBy',
    SORT_ORDER: 'sortOrder',
} as const;

// Type for query parameter keys
export type QueryParamKey = typeof QUERY_PARAMS[keyof typeof QUERY_PARAMS];
