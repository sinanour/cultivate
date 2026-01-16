/**
 * Utility for classifying entity fields as high-cardinality or low-cardinality
 * to determine the appropriate filtering strategy.
 * 
 * High-cardinality fields: Text fields with potentially millions of unique values
 * - Require partial matching (ILIKE '%text%')
 * - Examples: name, email, phone, address, nickname
 * 
 * Low-cardinality fields: Enumerated fields with limited predefined values
 * - Require exact matching (IN clause)
 * - Examples: activityType, activityCategory, role, population, areaType, venueType, status
 */

export enum FieldCardinality {
    HIGH = 'HIGH',
    LOW = 'LOW',
}

export interface FieldClassification {
    cardinality: FieldCardinality;
    isArray: boolean;  // Whether the field expects array values
}

// Define high-cardinality text fields by entity type
const HIGH_CARDINALITY_FIELDS: Record<string, string[]> = {
    participant: ['name', 'email', 'phone', 'nickname'],
    venue: ['name', 'address'],
    activity: ['name'],
    geographicArea: ['name'],
};

// Define low-cardinality enumerated fields by entity type
const LOW_CARDINALITY_FIELDS: Record<string, string[]> = {
    participant: ['populationIds'],
    venue: ['venueType', 'geographicAreaIds'],
    activity: ['activityTypeIds', 'activityCategoryIds', 'status', 'populationIds'],
    geographicArea: ['areaType', 'parentGeographicAreaId'],
};

// Define fields that expect array values
const ARRAY_FIELDS: Record<string, string[]> = {
    participant: ['populationIds'],
    venue: ['geographicAreaIds'],
    activity: ['activityTypeIds', 'activityCategoryIds', 'status', 'populationIds'],
    geographicArea: [],
};

/**
 * Classify a field for a given entity type
 */
export function classifyField(
    entityType: string,
    fieldName: string
): FieldClassification {
    const highCardFields = HIGH_CARDINALITY_FIELDS[entityType] || [];
    const lowCardFields = LOW_CARDINALITY_FIELDS[entityType] || [];
    const arrayFields = ARRAY_FIELDS[entityType] || [];

    if (highCardFields.includes(fieldName)) {
        return {
            cardinality: FieldCardinality.HIGH,
            isArray: arrayFields.includes(fieldName),
        };
    }

    if (lowCardFields.includes(fieldName)) {
        return {
            cardinality: FieldCardinality.LOW,
            isArray: arrayFields.includes(fieldName),
        };
    }

    // Default to high cardinality for unknown fields (safer for text matching)
    return {
        cardinality: FieldCardinality.HIGH,
        isArray: false,
    };
}

/**
 * Check if a field is a high-cardinality text field requiring partial matching
 */
export function isHighCardinalityField(
    entityType: string,
    fieldName: string
): boolean {
    const classification = classifyField(entityType, fieldName);
    return classification.cardinality === FieldCardinality.HIGH;
}

/**
 * Check if a field is a low-cardinality enumerated field requiring exact matching
 */
export function isLowCardinalityField(
    entityType: string,
    fieldName: string
): boolean {
    const classification = classifyField(entityType, fieldName);
    return classification.cardinality === FieldCardinality.LOW;
}

/**
 * Check if a field expects array values
 */
export function isArrayField(entityType: string, fieldName: string): boolean {
    const classification = classifyField(entityType, fieldName);
    return classification.isArray;
}
