/**
 * Application-wide constants and type definitions
 */

// Activity Status
export const ActivityStatus = {
    PLANNED: 'PLANNED',
    ACTIVE: 'ACTIVE',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
} as const;

export type ActivityStatus = typeof ActivityStatus[keyof typeof ActivityStatus];

// System Roles
export const SystemRole = {
    ADMINISTRATOR: 'ADMINISTRATOR',
    EDITOR: 'EDITOR',
    READ_ONLY: 'READ_ONLY',
} as const;

export type SystemRole = typeof SystemRole[keyof typeof SystemRole];

// Venue Types
export const VenueType = {
    PUBLIC_BUILDING: 'PUBLIC_BUILDING',
    PRIVATE_RESIDENCE: 'PRIVATE_RESIDENCE',
} as const;

export type VenueType = typeof VenueType[keyof typeof VenueType];

// Geographic Area Types
export const GeographicAreaType = {
    NEIGHBOURHOOD: 'NEIGHBOURHOOD',
    COMMUNITY: 'COMMUNITY',
    CITY: 'CITY',
    CLUSTER: 'CLUSTER',
    COUNTY: 'COUNTY',
    PROVINCE: 'PROVINCE',
    STATE: 'STATE',
    COUNTRY: 'COUNTRY',
    CONTINENT: 'CONTINENT',
    HEMISPHERE: 'HEMISPHERE',
    WORLD: 'WORLD',
} as const;

export type GeographicAreaType = typeof GeographicAreaType[keyof typeof GeographicAreaType];

// Time Periods for Growth Metrics
export const TimePeriod = {
    DAY: 'DAY',
    WEEK: 'WEEK',
    MONTH: 'MONTH',
    YEAR: 'YEAR',
} as const;

export type TimePeriod = typeof TimePeriod[keyof typeof TimePeriod];

// Date Granularity for Engagement Grouping
export const DateGranularity = {
    WEEKLY: 'WEEKLY',
    MONTHLY: 'MONTHLY',
    QUARTERLY: 'QUARTERLY',
    YEARLY: 'YEARLY',
} as const;

export type DateGranularity = typeof DateGranularity[keyof typeof DateGranularity];

// Grouping Dimensions for Analytics
export const GroupingDimension = {
    ACTIVITY_TYPE: 'activityType',
    ACTIVITY_CATEGORY: 'activityCategory',
    VENUE: 'venue',
    GEOGRAPHIC_AREA: 'geographicArea',
    DATE: 'date',
} as const;

export type GroupingDimension = typeof GroupingDimension[keyof typeof GroupingDimension];

// Dimension key mappings for grouped results
export const DimensionKeys = {
    ACTIVITY_TYPE: {
        name: 'activityType',
        id: 'activityTypeId',
    },
    ACTIVITY_CATEGORY: {
        name: 'activityCategory',
        id: 'activityCategoryId',
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
        id: 'dateId', // Date doesn't have an ID
    },
} as const;

// Error Codes
export const ErrorCode = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
    INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
    NOT_FOUND: 'NOT_FOUND',
    VERSION_CONFLICT: 'VERSION_CONFLICT',
    CIRCULAR_REFERENCE: 'CIRCULAR_REFERENCE',
    REFERENCED_ENTITY: 'REFERENCED_ENTITY',
    DUPLICATE_EMAIL: 'DUPLICATE_EMAIL',
    DUPLICATE_NAME: 'DUPLICATE_NAME',
    DUPLICATE_ASSIGNMENT: 'DUPLICATE_ASSIGNMENT',
    INVALID_REFERENCE: 'INVALID_REFERENCE',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];

// HTTP Status Codes
export const HttpStatus = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
} as const;

export type HttpStatus = typeof HttpStatus[keyof typeof HttpStatus];

// Pagination Defaults
export const PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 50,
    MAX_LIMIT: 100,
} as const;

// Date Formatting
export const DATE_FORMAT = {
    ISO_DATE: 'YYYY-MM-DD',
    ISO_DATETIME: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
} as const;

// Local Storage Keys
export const STORAGE_KEYS = {
    ACCESS_TOKEN: 'accessToken',
    REFRESH_TOKEN: 'refreshToken',
    GLOBAL_GEOGRAPHIC_FILTER: 'globalGeographicAreaFilter',
} as const;

// Query Parameter Keys
export const QUERY_PARAMS = {
    GEOGRAPHIC_AREA: 'geographicArea',
    PAGE: 'page',
    LIMIT: 'limit',
} as const;
