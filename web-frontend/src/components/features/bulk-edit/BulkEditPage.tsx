import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Alert from '@cloudscape-design/components/alert';
import Pagination from '@cloudscape-design/components/pagination';
import Box from '@cloudscape-design/components/box';
import {
    useStagedChangeSet,
    isTempKey,
    type TempKey,
    type RecordKey,
} from '../../../hooks/useStagedChangeSet';
import { useBulkMutation } from '../../../hooks/useBulkMutation';
import { usePermissions } from '../../../hooks/usePermissions';
import { ConfirmationDialog } from '../../common/ConfirmationDialog';
import { BulkEditTable, type BulkEditTableRow } from './BulkEditTable';
import { BulkEditToolbar } from './BulkEditToolbar';
import type { BulkEntityConfig } from './BulkEntityConfig';
import { serializeBulkRow } from './BulkEntityConfig';
import type {
    BulkMutationFailureResponse,
    BulkMutationSuccessResponse,
} from '../../../services/api/bulk.service';

export interface BulkEditPageProps<T> {
    config: BulkEntityConfig<T>;
    /** Fetches a paginated page of records for this entity. */
    fetchPage: (args: { page: number; limit: number; geographicAreaId?: string | null }) => Promise<{
        data: T[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
    }>;
    /** React Query cache key prefix for the list - used to invalidate on apply. */
    listQueryKeyPrefix: string;
    /** How many rows per page in the bulk editor. Defaults to 50. */
    pageSize?: number;
    /**
     * The globally-selected geographic area filter. The bulk editor MUST
     * respect this exactly like the list views do: it scopes the fetched rows
     * to the active area (an unset value means "all authorized areas"). It is
     * also part of the query key so changing the filter refetches, and a
     * change discards the staged change set because staged edits are keyed to
     * rows that may no longer be in scope (a staged edit against a now-hidden
     * row must never be silently applied).
     */
    geographicAreaId?: string | null;
}

/**
 * BulkEditPage<T> - top-level route component. Owns:
 *  - the staged change set (via useStagedChangeSet)
 *  - the paginated React Query read against the existing list endpoint
 *  - current page state and client validation errors per row
 *  - the apply/discard confirmation dialogs
 *
 * The flow of staging edits -> Apply mirrors the spec exactly: no API call
 * is made until the user confirms Apply (R8.1). On navigation away with
 * unsaved staged changes we warn via `beforeunload` (R7.5).
 */
export function BulkEditPage<T extends { id: string; version: number }>({
    config,
    fetchPage,
    listQueryKeyPrefix,
    pageSize = 50,
    geographicAreaId = null,
}: BulkEditPageProps<T>) {
    const navigate = useNavigate();
    const { canEdit } = usePermissions();
    const [currentPage, setCurrentPage] = useState(1);
    const [showApplyConfirm, setShowApplyConfirm] = useState(false);
    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
    const [applyError, setApplyError] = useState<BulkMutationFailureResponse | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const staged = useStagedChangeSet<T>();

    const {
        data,
        isLoading,
        error,
    } = useQuery({
        queryKey: [listQueryKeyPrefix, 'bulk-page', currentPage, pageSize, geographicAreaId ?? null],
        queryFn: () => fetchPage({ page: currentPage, limit: pageSize, geographicAreaId }),
        staleTime: 10000,
    });

    const pageRows = useMemo(() => data?.data ?? [], [data]);
    const totalPages = data?.pagination.totalPages ?? 0;

    // When the global geographic filter changes, the set of visible rows
    // changes underneath us. Reset to page 1 and discard any staged change
    // set: staged edits are keyed to rows that may no longer be in scope, and
    // silently applying an edit to a now-hidden (out-of-boundary) row would
    // re-introduce the very authorization-boundary violation this scoping
    // fixes. We use React's "adjust state while rendering on a changed prop"
    // pattern (https://react.dev/reference/react/useState#storing-information-from-previous-renders)
    // rather than an effect, so the reset happens before paint without an
    // extra render and without a setState-in-effect.
    const geoKey = geographicAreaId ?? null;
    const [prevGeoKey, setPrevGeoKey] = useState<string | null>(geoKey);
    if (prevGeoKey !== geoKey) {
        setPrevGeoKey(geoKey);
        setCurrentPage(1);
        if (staged.isDirty) {
            staged.discardAll();
            setApplyError(null);
            setSuccessMessage(
                'The geographic area filter changed, so pending staged changes were discarded.'
            );
        }
    }

    // Warn before unload when there is a dirty staged change set.
    useEffect(() => {
        if (!staged.isDirty) return;
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [staged.isDirty]);

    // Build the rows to render:
    //   1. Server rows for the current page (overlaid with any staged edits).
    //   2. Staged creates (always visible across pages).
    const tableRows = useMemo<BulkEditTableRow<T>[]>(() => {
        const existingRows: BulkEditTableRow<T>[] = pageRows.map((row) => {
            const key: RecordKey = row.id;
            const stagedUpdate = staged.updates.get(row.id);
            const isDeleted = staged.deletes.has(row.id);

            // Merge staged edits over server data for display.
            const data = stagedUpdate
                ? { ...row, ...stagedUpdate.changes }
                : { ...row };

            const rowStatus: BulkEditTableRow<T>['rowStatus'] = isDeleted
                ? 'deleted'
                : stagedUpdate
                ? 'dirty'
                : 'clean';

            const rowErrors = computeRowErrors(config, data, false);

            // Expose which fields are dirty via a marker so the table can
            // highlight only the changed cells (R3.1).
            const dirtyFields: Record<string, boolean> = {};
            if (stagedUpdate) {
                for (const k of Object.keys(stagedUpdate.changes)) {
                    dirtyFields[k] = true;
                }
            }

            return {
                key,
                id: row.id,
                version: row.version,
                data,
                rowErrors,
                rowStatus,
                // internal marker consumed by the table
                _dirtyFields: dirtyFields,
            } as BulkEditTableRow<T> & { _dirtyFields: Record<string, boolean> };
        });

        const stagedCreateRows: BulkEditTableRow<T>[] = Array.from(staged.creates.values()).map(
            (c) => {
                const data = { ...config.emptyRow(), ...c.values } as Partial<T>;
                return {
                    key: c.tempKey,
                    tempKey: c.tempKey,
                    data,
                    rowErrors: computeRowErrors(config, data, true),
                    rowStatus: 'new',
                };
            }
        );

        // New rows render at the top for easy access during a session.
        return [...stagedCreateRows, ...existingRows];
    }, [pageRows, staged.creates, staged.updates, staged.deletes, config]);

    const hasValidationErrors = useMemo(
        () => tableRows.some((r) => Object.keys(r.rowErrors).length > 0),
        [tableRows]
    );

    const mutation = useBulkMutation<Partial<T>, Partial<T>>({
        entityPath: config.entityPath,
        listQueryKeyPrefix,
        onSuccess: (response: BulkMutationSuccessResponse<unknown>) => {
            staged.discardAll();
            setApplyError(null);
            setSuccessMessage(
                `Applied: ${response.applied.created} created, ${response.applied.updated} updated, ${response.applied.deleted} deleted.`
            );
        },
        onFailure: (failure) => {
            // Keep the staged set intact so the user can reconcile and retry.
            setApplyError(failure);
            setSuccessMessage(null);
        },
    });

    const onApply = useCallback(() => {
        setShowApplyConfirm(false);
        const snapshot = staged.snapshot();
        const request = {
            creates: snapshot.creates.map((c) => ({
                clientKey: c.tempKey,
                data: serializeBulkRow(config.columns, c.values, 'create') as Partial<T>,
            })),
            updates: snapshot.updates.map((u) => ({
                id: u.id,
                version: u.version,
                data: serializeBulkRow(config.columns, u.changes, 'update') as Partial<T>,
            })),
            deletes: snapshot.deletes.map((d) => ({ id: d.id, version: d.version })),
        };
        mutation.mutate(request);
    }, [staged, mutation, config]);

    const onEditField = useCallback(
        (row: BulkEditTableRow<T>, field: keyof T, nextValue: unknown) => {
            if (row.tempKey) {
                staged.stageFieldEdit(row.tempKey, 0, field, nextValue, undefined);
                return;
            }
            const persisted = (pageRows.find((r) => r.id === row.id) as T | undefined)?.[field];
            staged.stageFieldEdit(row.id!, row.version!, field, nextValue, persisted);
        },
        [staged, pageRows]
    );

    const onDeleteRow = useCallback(
        (row: BulkEditTableRow<T>) => {
            if (!row.id || row.version === undefined) return;
            staged.stageDelete(row.id, row.version);
        },
        [staged]
    );

    const onUndeleteRow = useCallback(
        (row: BulkEditTableRow<T>) => {
            if (!row.id) return;
            staged.unstageDelete(row.id);
        },
        [staged]
    );

    const onRemoveCreate = useCallback(
        (tempKey: TempKey) => staged.removeCreate(tempKey),
        [staged]
    );

    return (
        <ContentLayout
            header={
                <Header
                    variant="h1"
                    description={
                        `Bulk edit ${config.entityName.toLowerCase()}. Changes are staged until you apply them.` +
                        (geographicAreaId
                            ? ' Scoped to the selected geographic area.'
                            : '')
                    }
                    actions={
                        <BulkEditToolbar
                            summary={staged.summary}
                            hasValidationErrors={hasValidationErrors}
                            isApplying={mutation.isPending}
                            canEdit={canEdit()}
                            onAddRow={() => staged.addRow(config.emptyRow())}
                            onApply={() => setShowApplyConfirm(true)}
                            onDiscard={() => setShowDiscardConfirm(true)}
                        />
                    }
                >
                    Bulk edit {config.entityName}
                </Header>
            }
        >
            <SpaceBetween size="l">
                {!canEdit() && (
                    <Alert type="warning">
                        You do not have permission to edit {config.entityName.toLowerCase()}.
                    </Alert>
                )}

                {error && (
                    <Alert
                        type="error"
                        header="Failed to load page"
                        action={
                            <Box variant="span" padding={{ left: 's' }}>
                                <a onClick={() => navigate(0)}>Reload</a>
                            </Box>
                        }
                    >
                        {error instanceof Error ? error.message : 'Unexpected error loading data.'}
                    </Alert>
                )}

                {successMessage && (
                    <Alert type="success" dismissible onDismiss={() => setSuccessMessage(null)}>
                        {successMessage}
                    </Alert>
                )}

                {applyError && (
                    <Alert
                        type="error"
                        header={`Apply failed: ${applyError.code}`}
                        dismissible
                        onDismiss={() => setApplyError(null)}
                    >
                        <SpaceBetween size="xs">
                            <Box>{applyError.message}</Box>
                            <ul>
                                {applyError.errors.map((e, i) => (
                                    <li key={i}>
                                        <strong>{refLabel(e.ref)}</strong>: {e.code} — {e.message}
                                    </li>
                                ))}
                            </ul>
                        </SpaceBetween>
                    </Alert>
                )}

                <BulkEditTable
                    config={config}
                    rows={tableRows}
                    loading={isLoading}
                    onEditField={onEditField}
                    onDeleteRow={onDeleteRow}
                    onUndeleteRow={onUndeleteRow}
                    onRemoveCreate={onRemoveCreate}
                />

                {totalPages > 1 && (
                    <Pagination
                        currentPageIndex={currentPage}
                        pagesCount={totalPages}
                        onChange={({ detail }) => setCurrentPage(detail.currentPageIndex)}
                        ariaLabels={{
                            nextPageLabel: 'Next page',
                            previousPageLabel: 'Previous page',
                            pageLabel: (n: number) => `Page ${n}`,
                        }}
                    />
                )}
            </SpaceBetween>

            <ConfirmationDialog
                visible={showApplyConfirm}
                title="Apply changes?"
                message={`${staged.summary.creates} creates, ${staged.summary.updates} updates, and ${staged.summary.deletes} deletes will be applied in a single transaction.`}
                confirmLabel="Apply"
                cancelLabel="Cancel"
                onConfirm={onApply}
                onCancel={() => setShowApplyConfirm(false)}
            />

            <ConfirmationDialog
                visible={showDiscardConfirm}
                title="Discard all staged changes?"
                message="All pending creates, updates, and deletes will be lost."
                confirmLabel="Discard"
                cancelLabel="Cancel"
                variant="destructive"
                onConfirm={() => {
                    staged.discardAll();
                    setShowDiscardConfirm(false);
                }}
                onCancel={() => setShowDiscardConfirm(false)}
            />
        </ContentLayout>
    );
}

function refLabel(ref: { id?: string; clientKey?: string }): string {
    if (ref.id) return `row ${ref.id.slice(0, 8)}`;
    if (ref.clientKey) return `new row ${ref.clientKey.slice(0, 10)}`;
    return 'row';
}

/**
 * Compute per-field client validation errors for a row.
 */
function computeRowErrors<T>(config: BulkEntityConfig<T>, row: Partial<T>, isNew: boolean): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const col of config.columns) {
        const value = row[col.field];
        if (isNew && col.required && (value === undefined || value === null || value === '')) {
            errors[col.field as string] = `${col.header} is required`;
            continue;
        }
        if (col.validate) {
            const err = col.validate(value, row);
            if (err) errors[col.field as string] = err;
        }
    }
    return errors;
}

// Guard against unused-import warnings in test environments: isTempKey is used
// below to make sure the TempKey type remains exported.
void isTempKey;
