export const openApiSpec = {
    openapi: '3.0.0',
    info: {
        title: 'Cultivate API',
        version: '1.0.0',
        description: 'RESTful API for managing community activities, participants, and analytics',
        contact: {
            name: 'API Support',
        },
    },
    servers: [
        {
            url: 'http://localhost:3000',
            description: 'Development server',
        },
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
            },
        },
        schemas: {
            Error: {
                type: 'object',
                properties: {
                    code: { type: 'string' },
                    message: { type: 'string' },
                    details: { type: 'object' },
                },
            },
            ActivityType: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    name: { type: 'string' },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                },
            },
            Role: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    name: { type: 'string' },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                },
            },
            Participant: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    name: { type: 'string' },
                    email: { type: 'string', format: 'email' },
                    phone: { type: 'string', nullable: true },
                    notes: { type: 'string', nullable: true },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                },
            },
            Activity: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    name: { type: 'string' },
                    activityTypeId: { type: 'string', format: 'uuid' },
                    startDate: { type: 'string', format: 'date-time' },
                    endDate: { type: 'string', format: 'date-time', nullable: true },
                    status: {
                        type: 'string',
                        enum: ['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED'],
                    },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                },
            },
            Venue: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    name: { type: 'string' },
                    address: { type: 'string' },
                    geographicAreaId: { type: 'string', format: 'uuid' },
                    latitude: { type: 'number', nullable: true },
                    longitude: { type: 'number', nullable: true },
                    venueType: {
                        type: 'string',
                        enum: ['PUBLIC_BUILDING', 'PRIVATE_RESIDENCE'],
                        nullable: true,
                    },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                },
            },
            GeographicArea: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    name: { type: 'string' },
                    areaType: {
                        type: 'string',
                        enum: [
                            'NEIGHBOURHOOD',
                            'COMMUNITY',
                            'CITY',
                            'CLUSTER',
                            'COUNTY',
                            'PROVINCE',
                            'STATE',
                            'COUNTRY',
                            'CUSTOM',
                        ],
                    },
                    parentGeographicAreaId: { type: 'string', format: 'uuid', nullable: true },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                },
            },
        },
    },
    paths: {
        '/api/auth/login': {
            post: {
                tags: ['Authentication'],
                summary: 'Authenticate user',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    email: { type: 'string', format: 'email' },
                                    password: { type: 'string', minLength: 8 },
                                },
                                required: ['email', 'password'],
                            },
                            example: {
                                email: 'user@example.com',
                                password: 'password123',
                            },
                        },
                    },
                },
                responses: {
                    '200': {
                        description: 'Authentication successful',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                accessToken: { type: 'string' },
                                                refreshToken: { type: 'string' },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    '401': {
                        description: 'Invalid credentials',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Error' },
                            },
                        },
                    },
                },
            },
        },
        '/api/v1/geocoding/search': {
            get: {
                tags: ['Geocoding'],
                summary: 'Geocode an address to coordinates',
                description: 'Proxies geocoding requests to Nominatim API with proper User-Agent header. Returns array of geocoding results with coordinates and address details.',
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: 'q',
                        in: 'query',
                        required: true,
                        description: 'Address string to geocode',
                        schema: {
                            type: 'string',
                            minLength: 1,
                            maxLength: 500
                        },
                        example: '123 Main Street, New York, NY'
                    }
                ],
                responses: {
                    '200': {
                        description: 'Geocoding results',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        data: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    latitude: { type: 'number' },
                                                    longitude: { type: 'number' },
                                                    displayName: { type: 'string' },
                                                    address: {
                                                        type: 'object',
                                                        properties: {
                                                            road: { type: 'string' },
                                                            city: { type: 'string' },
                                                            state: { type: 'string' },
                                                            country: { type: 'string' },
                                                            postcode: { type: 'string' }
                                                        }
                                                    },
                                                    boundingBox: {
                                                        type: 'array',
                                                        items: { type: 'number' },
                                                        minItems: 4,
                                                        maxItems: 4
                                                    }
                                                }
                                            }
                                        },
                                    },
                                },
                            },
                        },
                    },
                    '400': {
                        description: 'Validation error',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Error' },
                            },
                        },
                    },
                    '401': {
                        description: 'Authentication required',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Error' },
                            },
                        },
                    },
                    '502': {
                        description: 'External API error',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Error' },
                            },
                        },
                    },
                },
            },
        },
        '/api/activity-types': {
            get: {
                tags: ['Activity Types'],
                summary: 'List all activity types',
                security: [{ bearerAuth: [] }],
                responses: {
                    '200': {
                        description: 'List of activity types',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        data: {
                                            type: 'array',
                                            items: { $ref: '#/components/schemas/ActivityType' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    '401': {
                        description: 'Unauthorized',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Error' },
                            },
                        },
                    },
                },
            },
            post: {
                tags: ['Activity Types'],
                summary: 'Create activity type',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string', minLength: 1, maxLength: 100 },
                                },
                                required: ['name'],
                            },
                            example: {
                                name: 'Workshop',
                            },
                        },
                    },
                },
                responses: {
                    '201': {
                        description: 'Activity type created',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        data: { $ref: '#/components/schemas/ActivityType' },
                                    },
                                },
                            },
                        },
                    },
                    '400': {
                        description: 'Validation error',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Error' },
                            },
                        },
                    },
                    '401': {
                        description: 'Unauthorized',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Error' },
                            },
                        },
                    },
                    '403': {
                        description: 'Forbidden',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Error' },
                            },
                        },
                    },
                },
            },
        },
        '/health': {
            get: {
                tags: ['Health'],
                summary: 'Health check',
                responses: {
                    '200': {
                        description: 'API is running',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'string' },
                                        message: { type: 'string' },
                                    },
                                },
                                example: {
                                    status: 'ok',
                                    message: 'API is running',
                                },
                            },
                        },
                    },
                },
            },
        },
    },
    tags: [
        { name: 'Authentication', description: 'Authentication endpoints' },
        { name: 'Activity Types', description: 'Activity type management' },
        { name: 'Roles', description: 'Participant role management' },
        { name: 'Participants', description: 'Participant management' },
        { name: 'Activities', description: 'Activity management' },
        { name: 'Venues', description: 'Venue management' },
        { name: 'Geographic Areas', description: 'Geographic area management' },
        { name: 'Analytics', description: 'Analytics and reporting' },
        { name: 'Sync', description: 'Offline synchronization' },
        { name: 'Health', description: 'Health check' },
    ],
};
