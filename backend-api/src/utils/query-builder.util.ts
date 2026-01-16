import { isHighCardinalityField, isArrayField } from './field-classification.util';

/**
 * Utility for building dynamic Prisma where clauses from flexible filter objects
 */

export interface FlexibleFilter {
    [fieldName: string]: any;
}

/**
 * Build a Prisma where clause from a flexible filter object
 * 
 * @param entityType - The entity type (participant, venue, activity, geographicArea)
 * @param filter - The filter object with field names as keys
 * @param existingWhere - Existing where clause to merge with (for legacy filters)
 * @returns Prisma where clause object
 */
export function buildWhereClause(
    entityType: string,
    filter?: FlexibleFilter,
    existingWhere?: any
): any {
    if (!filter || Object.keys(filter).length === 0) {
        return existingWhere || {};
    }

    const dynamicWhere: any = {};

    for (const [fieldName, value] of Object.entries(filter)) {
        if (value === undefined || value === null) {
            continue; // Skip undefined/null values
        }

        if (isHighCardinalityField(entityType, fieldName)) {
            // High-cardinality text field: partial matching
            if (typeof value === 'string') {
                dynamicWhere[fieldName] = {
                    contains: value,
                    mode: 'insensitive',
                };
            }
        } else if (isArrayField(entityType, fieldName)) {
            // Low-cardinality array field: exact matching with IN
            const arrayValue = Array.isArray(value) ? value : [value];
            dynamicWhere[fieldName] = { in: arrayValue };
        } else {
            // Other fields: exact matching
            dynamicWhere[fieldName] = value;
        }
    }

    // Merge with existing where clause using AND logic
    if (existingWhere && Object.keys(existingWhere).length > 0) {
        return {
            AND: [existingWhere, dynamicWhere],
        };
    }

    return dynamicWhere;
}

/**
 * Merge legacy filter parameters with flexible filter object
 * 
 * @param legacyFilters - Object containing legacy filter parameters
 * @param flexibleFilter - Object containing flexible filter parameters
 * @returns Merged filter object
 */
export function mergeLegacyAndFlexibleFilters(
    legacyFilters: Record<string, any>,
    flexibleFilter?: FlexibleFilter
): Record<string, any> {
    if (!flexibleFilter || Object.keys(flexibleFilter).length === 0) {
        return legacyFilters;
    }

    // Merge both filter objects
    // If same field exists in both, flexible filter takes precedence
    return {
        ...legacyFilters,
        ...flexibleFilter,
    };
}


/**
 * Build a Prisma select clause from an array of field names
 * Supports dot notation for nested relations (e.g., "activityType.name")
 * 
 * @param fields - Array of field names to select
 * @param validFields - Optional array of valid field names for validation
 * @returns Prisma select object or undefined (undefined = select all fields)
 */
export function buildSelectClause(
    fields?: string[],
    validFields?: string[]
): any | undefined {
    if (!fields || fields.length === 0) {
        return undefined; // Return all fields by default
    }

    // Validate field names if validFields provided
    if (validFields) {
        const invalidFields = fields.filter(field => {
            const rootField = field.split('.')[0];
            return !validFields.includes(rootField);
        });

        if (invalidFields.length > 0) {
            throw new Error(`Invalid field names: ${invalidFields.join(', ')}`);
        }
    }

    const select: any = {};

    for (const field of fields) {
        if (field.includes('.')) {
            // Nested relation field (e.g., "activityType.name" or "activityType.activityCategory.name")
            const parts = field.split('.');
            const relationName = parts[0];
            const nestedFields = parts.slice(1);

            if (!select[relationName]) {
                select[relationName] = { select: {} };
            }

            // Build nested select recursively
            addNestedFieldToSelect(select[relationName].select, nestedFields);
        } else {
            // Direct field
            select[field] = true;
        }
    }

    return select;
}

/**
 * Helper function to add nested fields to a select object recursively
 */
function addNestedFieldToSelect(selectObj: any, fieldPath: string[]): void {
    if (fieldPath.length === 0) {
        return;
    }

    const [currentField, ...remainingPath] = fieldPath;

    if (remainingPath.length === 0) {
        // Leaf field
        selectObj[currentField] = true;
    } else {
        // Nested relation
        if (!selectObj[currentField]) {
            selectObj[currentField] = { select: {} };
        }
        addNestedFieldToSelect(selectObj[currentField].select, remainingPath);
    }
}

/**
 * Get valid field names for an entity type (for validation)
 */
export function getValidFieldNames(entityType: string): string[] {
    const fieldMap: Record<string, string[]> = {
        participant: [
            'id',
            'name',
            'email',
            'phone',
            'notes',
            'dateOfBirth',
            'dateOfRegistration',
            'nickname',
            'createdAt',
            'updatedAt',
            'addressHistory',
            'assignments',
            'participantPopulations',
        ],
        venue: [
            'id',
            'name',
            'address',
            'geographicAreaId',
            'latitude',
            'longitude',
            'venueType',
            'createdAt',
            'updatedAt',
            'geographicArea',
            'activityVenueHistory',
            'participantAddressHistory',
        ],
        activity: [
            'id',
            'name',
            'activityTypeId',
            'startDate',
            'endDate',
            'status',
            'createdAt',
            'updatedAt',
            'activityType',
            'assignments',
            'activityVenueHistory',
        ],
        geographicArea: [
            'id',
            'name',
            'areaType',
            'parentGeographicAreaId',
            'createdAt',
            'updatedAt',
            'parent',
            'children',
            'venues',
            'childCount',
        ],
    };

    return fieldMap[entityType] || [];
}
