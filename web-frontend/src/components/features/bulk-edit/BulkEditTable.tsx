import { useMemo } from 'react';
import Table from '@cloudscape-design/components/table';
import Button from '@cloudscape-design/components/button';
import Input from '@cloudscape-design/components/input';
import DatePicker from '@cloudscape-design/components/date-picker';
import Select from '@cloudscape-design/components/select';
import Box from '@cloudscape-design/components/box';
import Badge from '@cloudscape-design/components/badge';
import { AsyncEntitySelect } from '../../common/AsyncEntitySelect';
import type { BulkColumnDef, BulkEntityConfig, BulkTableRow } from './BulkEntityConfig';
import type { RecordKey, TempKey } from '../../../hooks/useStagedChangeSet';
import { isTempKey } from '../../../hooks/useStagedChangeSet';

export interface BulkEditTableRow<T> extends BulkTableRow<T> {
    rowErrors: Record<string, string>;
    rowStatus: 'clean' | 'dirty' | 'new' | 'deleted';
}

export interface BulkEditTableProps<T> {
    config: BulkEntityConfig<T>;
    rows: BulkEditTableRow<T>[];
    loading: boolean;
    onEditField: (row: BulkEditTableRow<T>, field: keyof T, nextValue: unknown) => void;
    onDeleteRow: (row: BulkEditTableRow<T>) => void;
    onUndeleteRow: (row: BulkEditTableRow<T>) => void;
    onRemoveCreate: (tempKey: TempKey) => void;
}

/**
 * BulkEditTable - CloudScape Table with per-cell inline editing driven by
 * the column config. Row-level visual state (new / dirty / deleted) is
 * rendered as a status badge in the leading column so the user always sees
 * which rows have pending changes (R3.1-R3.3).
 *
 * Editing is disabled on rows marked for deletion (R6.2). The user can
 * un-mark a staged delete to resume editing; for staged creates the delete
 * action removes the row outright (R6.4).
 */
export function BulkEditTable<T>({
    config,
    rows,
    loading,
    onEditField,
    onDeleteRow,
    onUndeleteRow,
    onRemoveCreate,
}: BulkEditTableProps<T>) {
    const columnDefinitions = useMemo(() => {
        const statusCol = {
            id: '_status',
            header: 'Status',
            minWidth: 110,
            cell: (row: BulkEditTableRow<T>) => renderStatusBadge(row),
        };
        const bodyCols = config.columns.map((col) => makeColumnDef<T>(col, onEditField));
        const actionCol = {
            id: '_actions',
            header: 'Actions',
            minWidth: 160,
            cell: (row: BulkEditTableRow<T>) =>
                renderRowActions(row, { onDeleteRow, onUndeleteRow, onRemoveCreate }),
        };
        return [statusCol, ...bodyCols, actionCol];
    }, [config, onEditField, onDeleteRow, onUndeleteRow, onRemoveCreate]);

    return (
        <Table
            items={rows}
            columnDefinitions={columnDefinitions}
            loading={loading}
            loadingText={`Loading ${config.entityName.toLowerCase()}`}
            wrapLines={false}
            trackBy={(row) => row.key as string}
            empty={
                <Box textAlign="center" color="inherit" padding="l">
                    <b>No {config.entityName.toLowerCase()} on this page</b>
                </Box>
            }
            data-testid="bulk-edit-table"
        />
    );
}

function renderStatusBadge<T>(row: BulkEditTableRow<T>) {
    if (row.rowStatus === 'new') return <Badge color="green">NEW</Badge>;
    if (row.rowStatus === 'deleted') return <Badge color="red">DELETE</Badge>;
    if (row.rowStatus === 'dirty') return <Badge color="blue">EDITED</Badge>;
    return <Box color="text-status-inactive">—</Box>;
}

interface ActionHandlers<T> {
    onDeleteRow: (row: BulkEditTableRow<T>) => void;
    onUndeleteRow: (row: BulkEditTableRow<T>) => void;
    onRemoveCreate: (tempKey: TempKey) => void;
}

function renderRowActions<T>(row: BulkEditTableRow<T>, h: ActionHandlers<T>) {
    const key: RecordKey = row.key;

    if (isTempKey(key)) {
        return (
            <Button
                iconName="remove"
                variant="icon"
                ariaLabel="Remove staged row"
                onClick={() => h.onRemoveCreate(key as TempKey)}
            />
        );
    }

    if (row.rowStatus === 'deleted') {
        return (
            <Button
                iconName="undo"
                variant="normal"
                onClick={() => h.onUndeleteRow(row)}
                data-testid="bulk-edit-undelete"
            >
                Restore
            </Button>
        );
    }

    return (
        <Button
            iconName="remove"
            variant="normal"
            onClick={() => h.onDeleteRow(row)}
            data-testid="bulk-edit-delete"
        >
            Delete
        </Button>
    );
}

function makeColumnDef<T>(
    col: BulkColumnDef<T>,
    onEditField: (row: BulkEditTableRow<T>, field: keyof T, nextValue: unknown) => void
) {
    return {
        id: col.field as string,
        header: col.header,
        minWidth: col.minWidth ?? 160,
        cell: (row: BulkEditTableRow<T>) => renderCell(col, row, onEditField),
    };
}

function renderCell<T>(
    col: BulkColumnDef<T>,
    row: BulkEditTableRow<T>,
    onEditField: (row: BulkEditTableRow<T>, field: keyof T, nextValue: unknown) => void
) {
    const value = row.data[col.field];
    const fieldError = row.rowErrors[col.field as string];
    const disabled = row.rowStatus === 'deleted';
    const highlight = row.rowStatus === 'new' || isCellDirty(row, col.field);

    const wrapperStyle: React.CSSProperties = {
        padding: 2,
        background: highlight ? 'rgba(0, 115, 187, 0.08)' : undefined,
        opacity: disabled ? 0.5 : undefined,
    };

    const onChange = (next: unknown) => onEditField(row, col.field, next);

    let control: React.ReactNode;
    switch (col.type) {
        case 'text':
            control = (
                <Input
                    value={(value as string | undefined) ?? ''}
                    onChange={(e) => onChange(e.detail.value)}
                    disabled={disabled}
                    invalid={!!fieldError}
                    ariaLabel={col.header}
                />
            );
            break;
        case 'number':
            control = (
                <Input
                    type="number"
                    value={value == null || value === '' ? '' : String(value)}
                    onChange={(e) => {
                        const raw = e.detail.value;
                        onChange(raw === '' ? null : Number(raw));
                    }}
                    disabled={disabled}
                    invalid={!!fieldError}
                    ariaLabel={col.header}
                />
            );
            break;
        case 'date':
            control = (
                <DatePicker
                    value={toDateString(value)}
                    onChange={(e) => onChange(e.detail.value || null)}
                    disabled={disabled}
                    invalid={!!fieldError}
                    ariaLabel={col.header}
                    placeholder="YYYY/MM/DD"
                />
            );
            break;
        case 'enum':
            control = (
                <Select
                    selectedOption={
                        value
                            ? col.choices?.find((c) => c.value === value)
                                ? { value: String(value), label: col.choices!.find((c) => c.value === value)!.label }
                                : null
                            : null
                    }
                    options={(col.choices ?? []).map((c) => ({ value: c.value, label: c.label }))}
                    onChange={(e) => onChange(e.detail.selectedOption?.value ?? null)}
                    disabled={disabled}
                    invalid={!!fieldError}
                    ariaLabel={col.header}
                    placeholder="Select"
                />
            );
            break;
        case 'reference':
            if (!col.reference) {
                control = <>-</>;
                break;
            }
            control = (
                <AsyncEntitySelect
                    value={(value as string | undefined) ?? ''}
                    onChange={(next) => onChange(next)}
                    entityType={col.reference.entityType}
                    fetchFunction={
                        col.reference.fetchFunction as (params: {
                            page?: number;
                            limit?: number;
                            geographicAreaId?: string;
                            filter?: Record<string, unknown>;
                            fields?: string[];
                        }) => Promise<{ data: unknown[]; pagination?: unknown }>
                    }
                    fetchByIdFunction={col.reference.fetchByIdFunction}
                    formatOption={col.reference.formatOption}
                    placeholder={`Select ${col.header}`}
                    disabled={disabled}
                    invalid={!!fieldError}
                    ariaLabel={col.header}
                />
            );
            break;
        default:
            control = <Box>{String(value ?? '')}</Box>;
    }

    return (
        <div style={wrapperStyle}>
            {control}
            {fieldError && (
                <Box color="text-status-error" fontSize="body-s" data-testid={`bulk-edit-error-${col.field as string}`}>
                    {fieldError}
                </Box>
            )}
        </div>
    );
}

function isCellDirty<T>(row: BulkEditTableRow<T>, field: keyof T): boolean {
    if (row.rowStatus === 'new') return true;
    const marker = (row as unknown as { _dirtyFields?: Record<string, boolean> })._dirtyFields;
    return !!marker && !!marker[field as string];
}

function toDateString(value: unknown): string {
    if (!value) return '';
    if (typeof value === 'string') {
        // CloudScape DatePicker expects "YYYY/MM/DD" or "YYYY-MM-DD".
        return value.slice(0, 10);
    }
    if (value instanceof Date) {
        return value.toISOString().slice(0, 10);
    }
    return String(value);
}
