import type { ReactNode } from 'react';
import type { RecordKey, TempKey } from '../../../hooks/useStagedChangeSet';

/**
 * Per-entity description used by the generic BulkEditTable / BulkEditPage.
 *
 * The config captures everything that varies per entity (editable fields, the
 * editor control for each, client-side validation, defaults for a new row,
 * and how to render a reference-field label) so the components themselves
 * stay generic.
 */

export type BulkFieldType = 'text' | 'number' | 'date' | 'enum' | 'reference';

export interface BulkEnumChoice {
    value: string;
    label: string;
}

export interface BulkReferenceConfig {
    /**
     * Entity type passed to AsyncEntitySelect. Must match one of the
     * AsyncEntitySelect entityType choices.
     */
    entityType: 'venue' | 'participant' | 'geographic-area' | 'activity-type';
    /**
     * Function used by AsyncEntitySelect to fetch paginated options.
     */
    fetchFunction: (params: {
        page?: number;
        limit?: number;
        geographicAreaId?: string;
        filter?: Record<string, unknown>;
        fields?: string[];
    }) => Promise<{ data: unknown[]; pagination?: unknown }>;
    /**
     * Fetch a single reference entity by ID so AsyncEntitySelect can
     * display the current value even if it is not in the top page.
     */
    fetchByIdFunction?: (id: string) => Promise<unknown>;
    /**
     * Turn a reference entity into an option { value, label, description? }.
     */
    formatOption: (entity: unknown) => { value: string; label: string; description?: string };
    /**
     * Render the current reference label from a row (used in read-only mode
     * and when the cell is not being edited).
     */
    renderLabel: (row: Record<string, unknown>) => ReactNode;
}

export interface BulkColumnDef<T> {
    /** Row data field. Must be one of the entity's editable fields. */
    field: keyof T;
    header: string;
    type: BulkFieldType;
    /** Required for `type === 'enum'`. */
    choices?: BulkEnumChoice[];
    /** Required for `type === 'reference'`. */
    reference?: BulkReferenceConfig;
    /** Optional per-field validator; returns an error message or null. */
    validate?: (value: unknown, row: Partial<T>) => string | null;
    /** Mark this field as required on a staged create. */
    required?: boolean;
    /** Minimum column width in CloudScape Table (defaults to 160). */
    minWidth?: number;
}

export interface BulkEntityConfig<T> {
    entityName: string;
    entityPath: 'venues' | 'participants' | 'activities';
    columns: BulkColumnDef<T>[];
    emptyRow: () => Partial<T>;
    /**
     * Row-level validation to run across all columns at once. Returns a map
     * of field -> error message. Called by the toolbar to decide whether to
     * enable "Apply Changes".
     */
    clientValidate?: (row: Partial<T>) => Record<string, string>;
}

/**
 * Helper reused by every entity config - checks required fields with a
 * uniform message. Entity-specific validators call this first and then add
 * extra rules (e.g. geographic area reference must be present).
 */
export function validateRequiredFields<T>(
    columns: BulkColumnDef<T>[],
    row: Partial<T>
): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const col of columns) {
        if (col.required) {
            const value = row[col.field];
            if (value === undefined || value === null || value === '') {
                errors[col.field as string] = `${col.header} is required`;
            }
        }
        if (col.validate) {
            const value = row[col.field];
            const err = col.validate(value, row);
            if (err) errors[col.field as string] = err;
        }
    }
    return errors;
}

/**
 * Union of row shapes the generic table operates on. For existing records
 * `data` is the fetched row; for staged creates it starts from `emptyRow()`
 * and may be partially populated.
 */
export interface BulkTableRow<T> {
    key: RecordKey;
    /** Present for existing rows; undefined for staged creates. */
    id?: string;
    tempKey?: TempKey;
    version?: number;
    data: Partial<T>;
}
