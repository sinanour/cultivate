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
    /**
     * Optional transform applied to a field value when the staged change set
     * is serialized into a POST /{entity}/bulk request (see
     * {@link serializeBulkValue}). The editors keep display-friendly values in
     * the staged state (e.g. a CloudScape DatePicker stores `YYYY-MM-DD`, a
     * cleared text Input stores `''`); this hook converts them to exactly what
     * the backend Zod schema expects on the wire (e.g. a full ISO 8601
     * date-time, or `null` for a cleared optional field).
     *
     * When omitted, a type-based default is applied: `date` columns are
     * converted to a full ISO 8601 string, and an empty string is converted to
     * `null`. Return `undefined` to omit the field from the request entirely.
     */
    serialize?: (value: unknown) => unknown;
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

/**
 * Convert a date-only (`YYYY-MM-DD`) or already-ISO string to a full ISO 8601
 * date-time string, matching the convention the single-record forms use
 * (`new Date(value).toISOString()`). The backend bulk schemas validate every
 * date field with Zod `z.string().datetime()`, which rejects a bare
 * `YYYY-MM-DD`, so this normalization is required before sending.
 *
 * `null`/`undefined`/`''` pass through as `null` (a cleared optional date).
 * An unparseable value is returned unchanged so the backend produces its
 * normal validation error rather than this helper masking it.
 */
export function toIsoDateTime(value: unknown): string | null {
    if (value === null || value === undefined || value === '') return null;
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? (value as unknown as string) : value.toISOString();
    }
    if (typeof value === 'string') {
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? value : d.toISOString();
    }
    return value as string;
}

/**
 * Serialize a single staged field value to its wire representation, honoring
 * the column's explicit `serialize` hook first and otherwise applying a
 * type-based default:
 *   - `date` columns  -> full ISO 8601 date-time (or `null`/omitted when empty)
 *   - everything else -> an empty string becomes `null` (update) or is
 *     omitted (create)
 *
 * `mode` reflects the backend's two schema shapes: create fields are
 * `optional()` and generally NOT nullable (so a cleared optional field must be
 * omitted), while update fields are `union([..., null])` (so a cleared field
 * is sent as `null` to null it out). Return `undefined` to omit the field.
 *
 * Keeping this at the serialization boundary means the staged state and the
 * editors continue to hold display-friendly values; only the outbound request
 * is normalized to what the backend schema expects.
 */
export function serializeBulkValue<T>(
    col: BulkColumnDef<T>,
    value: unknown,
    mode: 'create' | 'update'
): unknown {
    if (col.serialize) return col.serialize(value);
    const isEmpty = value === '' || value === null || value === undefined;
    if (col.type === 'date') {
        if (isEmpty) return mode === 'create' ? undefined : null;
        return toIsoDateTime(value);
    }
    if (isEmpty) return mode === 'create' ? undefined : value === '' ? null : value;
    return value;
}

/**
 * Serialize a partial row (a staged create's `values` or an update's
 * `changes`) into the shape the backend bulk endpoint expects. Only fields
 * present on the input are emitted; a field whose serialized value is
 * `undefined` is dropped so it is not sent at all. `mode` selects create vs
 * update null/omit semantics (see {@link serializeBulkValue}).
 */
export function serializeBulkRow<T>(
    columns: BulkColumnDef<T>[],
    row: Partial<T>,
    mode: 'create' | 'update'
): Record<string, unknown> {
    const byField = new Map<string, BulkColumnDef<T>>(
        columns.map((c) => [c.field as string, c])
    );
    const out: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(row)) {
        const col = byField.get(field);
        const serialized = col
            ? serializeBulkValue(col, value, mode)
            : value === ''
            ? mode === 'create'
                ? undefined
                : null
            : value;
        if (serialized !== undefined) out[field] = serialized;
    }
    return out;
}
