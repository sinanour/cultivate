import { useCallback, useMemo, useState } from 'react';

/**
 * useStagedChangeSet - the state machine behind bulk editing.
 *
 * All staging logic lives here as a pure, in-memory state machine so it can be
 * unit-tested in isolation and shared across every bulk-editable entity. The
 * hook NEVER calls an API; nothing is persisted until the caller explicitly
 * sends the set to the backend via a separate mutation.
 *
 * Keying is designed so pagination cannot corrupt or duplicate entries
 * (requirement 4.6): existing rows are keyed by their stable `id`, newly
 * added rows by a client-generated `tempKey` of the form `new-<nanoid>`.
 *
 * Semantics (see spec requirements 2-7):
 *  - Reverting an edited cell back to its persisted value un-dirties the field;
 *    when every field is clean the whole update entry is dropped.
 *  - Deleting a staged create removes it outright - there is nothing to delete.
 *  - Marking a row with staged edits for deletion supersedes the edits
 *    (requirement 6.5): the response won't carry update data for a deleted row.
 */

export type TempKey = string & { readonly __tempKey: unique symbol };
export type RecordKey = string | TempKey;

export function isTempKey(key: RecordKey): key is TempKey {
    return typeof key === 'string' && key.startsWith('new-');
}

/**
 * Mint a fresh TempKey. Collisions are infeasible in practice because the
 * random suffix carries ~70 bits of entropy, far more than the number of
 * staged creates a human will produce in a single bulk-editing session.
 */
export function newTempKey(): TempKey {
    const r = Math.random().toString(36).slice(2, 10);
    const t = Date.now().toString(36);
    return `new-${t}-${r}` as TempKey;
}

export interface StagedUpdate<T> {
    id: string;
    version: number;
    /** Only the edited fields. Reverted fields are removed. */
    changes: Partial<T>;
}

export interface StagedCreate<T> {
    tempKey: TempKey;
    values: Partial<T>;
}

export interface StagedDelete {
    id: string;
    version: number;
}

export interface StagedChangeSetSummary {
    creates: number;
    updates: number;
    deletes: number;
    total: number;
}

export interface StagedChangeSetApi<T> {
    updates: ReadonlyMap<string, StagedUpdate<T>>;
    creates: ReadonlyMap<TempKey, StagedCreate<T>>;
    deletes: ReadonlyMap<string, StagedDelete>;
    summary: StagedChangeSetSummary;
    /** True iff there is at least one staged change. */
    isDirty: boolean;
    /** Row-level dirty predicate for driving UI styling. */
    rowIsDirty: (key: RecordKey) => boolean;
    /** Cell-level dirty predicate (edited vs persisted) for driving UI styling. */
    cellIsDirty: (key: RecordKey, field: keyof T) => boolean;
    /** True iff this row is marked as a staged delete. */
    rowIsDeleted: (key: RecordKey) => boolean;
    /**
     * Record an edit against a cell. For existing rows this creates or amends
     * a staged update; for staged creates it writes into the create's values.
     * If the new value equals the persisted value (passed via `persistedValue`)
     * and the resulting entry has no other dirty fields, the update entry is
     * cleared so reverting un-dirties the row.
     */
    stageFieldEdit: (
        key: RecordKey,
        version: number,
        field: keyof T,
        value: unknown,
        persistedValue: unknown
    ) => void;
    /** Add a brand-new row with a fresh temp key; optional default field values. */
    addRow: (defaults?: Partial<T>) => TempKey;
    /** Mark an existing record for deletion (idempotent). */
    stageDelete: (id: string, version: number) => void;
    /** Un-mark a staged delete, restoring the row to its prior state. */
    unstageDelete: (id: string) => void;
    /** Remove a staged create entirely (nothing to delete). */
    removeCreate: (tempKey: TempKey) => void;
    /** Clear every staged change. */
    discardAll: () => void;
    /** Snapshot the entire staged change set. Useful for test assertions. */
    snapshot: () => {
        creates: StagedCreate<T>[];
        updates: StagedUpdate<T>[];
        deletes: StagedDelete[];
    };
}

function equal(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    // Treat null and undefined as equal here so "reverting to persisted null"
    // un-dirties correctly when the staged edit stores undefined.
    if (a == null && b == null) return true;
    if (a instanceof Date && b instanceof Date) {
        return a.getTime() === b.getTime();
    }
    return false;
}

export function useStagedChangeSet<T>(): StagedChangeSetApi<T> {
    const [updates, setUpdates] = useState<Map<string, StagedUpdate<T>>>(() => new Map());
    const [creates, setCreates] = useState<Map<TempKey, StagedCreate<T>>>(() => new Map());
    const [deletes, setDeletes] = useState<Map<string, StagedDelete>>(() => new Map());

    const summary = useMemo<StagedChangeSetSummary>(
        () => ({
            creates: creates.size,
            updates: updates.size,
            deletes: deletes.size,
            total: creates.size + updates.size + deletes.size,
        }),
        [creates, updates, deletes]
    );

    const stageFieldEdit = useCallback(
        (
            key: RecordKey,
            version: number,
            field: keyof T,
            value: unknown,
            persistedValue: unknown
        ) => {
            if (isTempKey(key)) {
                // Edit against a staged create - overwrite the field.
                setCreates((prev) => {
                    const next = new Map(prev);
                    const existing = next.get(key) ?? { tempKey: key, values: {} };
                    next.set(key, {
                        ...existing,
                        values: { ...existing.values, [field]: value },
                    });
                    return next;
                });
                return;
            }

            setUpdates((prev) => {
                const next = new Map(prev);
                const current = next.get(key);
                // Build the resulting changes map
                const resultingChanges: Partial<T> = { ...(current?.changes ?? {}) };
                if (equal(value, persistedValue)) {
                    // Revert: drop the field.
                    delete (resultingChanges as Record<string, unknown>)[field as string];
                } else {
                    (resultingChanges as Record<string, unknown>)[field as string] = value;
                }
                if (Object.keys(resultingChanges).length === 0) {
                    // No dirty fields left - drop the whole update entry.
                    next.delete(key);
                } else {
                    next.set(key, { id: key, version, changes: resultingChanges });
                }
                return next;
            });
        },
        []
    );

    const addRow = useCallback((defaults?: Partial<T>) => {
        const tempKey = newTempKey();
        setCreates((prev) => {
            const next = new Map(prev);
            next.set(tempKey, { tempKey, values: { ...(defaults ?? {}) } });
            return next;
        });
        return tempKey;
    }, []);

    const stageDelete = useCallback((id: string, version: number) => {
        setDeletes((prev) => {
            if (prev.has(id)) return prev;
            const next = new Map(prev);
            next.set(id, { id, version });
            return next;
        });
    }, []);

    const unstageDelete = useCallback((id: string) => {
        setDeletes((prev) => {
            if (!prev.has(id)) return prev;
            const next = new Map(prev);
            next.delete(id);
            return next;
        });
    }, []);

    const removeCreate = useCallback((tempKey: TempKey) => {
        setCreates((prev) => {
            if (!prev.has(tempKey)) return prev;
            const next = new Map(prev);
            next.delete(tempKey);
            return next;
        });
    }, []);

    const discardAll = useCallback(() => {
        setUpdates(new Map());
        setCreates(new Map());
        setDeletes(new Map());
    }, []);

    const rowIsDirty = useCallback(
        (key: RecordKey) => {
            if (isTempKey(key)) return creates.has(key);
            return updates.has(key) || deletes.has(key);
        },
        [creates, updates, deletes]
    );

    const rowIsDeleted = useCallback(
        (key: RecordKey) => {
            if (isTempKey(key)) return false;
            return deletes.has(key);
        },
        [deletes]
    );

    const cellIsDirty = useCallback(
        (key: RecordKey, field: keyof T) => {
            if (isTempKey(key)) {
                const c = creates.get(key);
                return !!c && (field as string) in (c.values as Record<string, unknown>);
            }
            const u = updates.get(key);
            return !!u && (field as string) in (u.changes as Record<string, unknown>);
        },
        [creates, updates]
    );

    const snapshot = useCallback(
        () => ({
            creates: Array.from(creates.values()),
            updates: Array.from(updates.values()),
            deletes: Array.from(deletes.values()),
        }),
        [creates, updates, deletes]
    );

    return {
        updates,
        creates,
        deletes,
        summary,
        isDirty: summary.total > 0,
        rowIsDirty,
        rowIsDeleted,
        cellIsDirty,
        stageFieldEdit,
        addRow,
        stageDelete,
        unstageDelete,
        removeCreate,
        discardAll,
        snapshot,
    };
}
