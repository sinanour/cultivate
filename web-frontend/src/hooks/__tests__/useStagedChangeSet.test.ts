import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
    useStagedChangeSet,
    isTempKey,
} from '../useStagedChangeSet';

/**
 * Unit tests for useStagedChangeSet (the staged-change state machine).
 *
 * The hook is pure in-memory state: no I/O, no API calls. These tests cover
 * every operation and the pagination-preservation invariant (R4.6 - staged
 * edits remain across page navigation because the state lives above the page).
 */

interface Row {
    id: string;
    name: string;
    version: number;
}

describe('useStagedChangeSet', () => {
    it('starts empty and not dirty', () => {
        const { result } = renderHook(() => useStagedChangeSet<Row>());
        expect(result.current.isDirty).toBe(false);
        expect(result.current.summary).toEqual({ creates: 0, updates: 0, deletes: 0, total: 0 });
    });

    it('stages a field edit for an existing row and un-dirties on revert', () => {
        const { result } = renderHook(() => useStagedChangeSet<Row>());

        // Edit name from "A" to "B"
        act(() => {
            result.current.stageFieldEdit('id1', 1, 'name', 'B', 'A');
        });
        expect(result.current.summary.updates).toBe(1);
        expect(result.current.cellIsDirty('id1', 'name')).toBe(true);

        // Revert back to original value - the whole update should drop
        act(() => {
            result.current.stageFieldEdit('id1', 1, 'name', 'A', 'A');
        });
        expect(result.current.summary.updates).toBe(0);
        expect(result.current.isDirty).toBe(false);
    });

    it('addRow produces a temp key and tracks the create', () => {
        const { result } = renderHook(() => useStagedChangeSet<Row>());
        let key = '';
        act(() => {
            key = result.current.addRow({ name: 'draft' });
        });
        expect(isTempKey(key)).toBe(true);
        expect(result.current.summary.creates).toBe(1);
        expect(result.current.rowIsDirty(key)).toBe(true);
    });

    it('stageDelete + unstageDelete toggles pending deletes', () => {
        const { result } = renderHook(() => useStagedChangeSet<Row>());
        act(() => result.current.stageDelete('id1', 5));
        expect(result.current.summary.deletes).toBe(1);
        expect(result.current.rowIsDeleted('id1')).toBe(true);

        act(() => result.current.unstageDelete('id1'));
        expect(result.current.summary.deletes).toBe(0);
        expect(result.current.rowIsDeleted('id1')).toBe(false);
    });

    it('deleting a staged-create row via removeCreate drops it (R6.4)', () => {
        const { result } = renderHook(() => useStagedChangeSet<Row>());
        let key = '';
        act(() => {
            key = result.current.addRow();
        });
        act(() => result.current.removeCreate(key as any));
        expect(result.current.summary.creates).toBe(0);
    });

    it('update + delete on same row: snapshot carries both (service enforces delete-supersedes)', () => {
        // The hook keeps both entries; the service treats delete as superseding
        // field updates per R6.5. The test asserts the hook state is preserved so
        // the service can see both.
        const { result } = renderHook(() => useStagedChangeSet<Row>());
        act(() => {
            result.current.stageFieldEdit('id1', 1, 'name', 'B', 'A');
            result.current.stageDelete('id1', 1);
        });
        const snap = result.current.snapshot();
        expect(snap.updates.find((u) => u.id === 'id1')).toBeDefined();
        expect(snap.deletes.find((d) => d.id === 'id1')).toBeDefined();
    });

    it('discardAll clears every bucket', () => {
        const { result } = renderHook(() => useStagedChangeSet<Row>());
        act(() => {
            result.current.stageFieldEdit('id1', 1, 'name', 'B', 'A');
            result.current.addRow();
            result.current.stageDelete('id2', 1);
        });
        expect(result.current.summary.total).toBe(3);

        act(() => result.current.discardAll());
        expect(result.current.summary.total).toBe(0);
        expect(result.current.isDirty).toBe(false);
    });

    it('pagination preservation invariant: edits on different pages all survive', () => {
        // Simulate paginating: edit a row on "page 1", then edit another on
        // "page 2" without unmounting the hook. Both edits must remain.
        const { result } = renderHook(() => useStagedChangeSet<Row>());

        act(() => {
            result.current.stageFieldEdit('p1-row', 1, 'name', 'new1', 'old1');
        });
        act(() => {
            result.current.stageFieldEdit('p2-row', 2, 'name', 'new2', 'old2');
        });

        const snap = result.current.snapshot();
        expect(snap.updates.map((u) => u.id).sort()).toEqual(['p1-row', 'p2-row']);
        expect(result.current.cellIsDirty('p1-row', 'name')).toBe(true);
        expect(result.current.cellIsDirty('p2-row', 'name')).toBe(true);
    });

    it('amending multiple fields of the same update row is tracked field-by-field', () => {
        const { result } = renderHook(() => useStagedChangeSet<Row>());
        act(() => {
            result.current.stageFieldEdit('id1', 1, 'name', 'B', 'A');
            result.current.stageFieldEdit('id1', 1, 'version', 2, 1);
        });
        expect(result.current.cellIsDirty('id1', 'name')).toBe(true);
        expect(result.current.cellIsDirty('id1', 'version')).toBe(true);
        // Reverting ONE field leaves the other dirty.
        act(() => {
            result.current.stageFieldEdit('id1', 1, 'name', 'A', 'A');
        });
        expect(result.current.cellIsDirty('id1', 'name')).toBe(false);
        expect(result.current.cellIsDirty('id1', 'version')).toBe(true);
        expect(result.current.summary.updates).toBe(1);
    });

    it('equality is tolerant of null/undefined (reverting an edit that was null un-dirties)', () => {
        const { result } = renderHook(() => useStagedChangeSet<Row>());
        act(() => {
            result.current.stageFieldEdit('id1', 1, 'name', undefined, null);
        });
        expect(result.current.summary.updates).toBe(0);
    });
});
