import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Box from '@cloudscape-design/components/box';
import type { StagedChangeSetSummary } from '../../../hooks/useStagedChangeSet';

export interface BulkEditToolbarProps {
    summary: StagedChangeSetSummary;
    hasValidationErrors: boolean;
    isApplying: boolean;
    onAddRow: () => void;
    onApply: () => void;
    onDiscard: () => void;
    canEdit: boolean;
}

/**
 * BulkEditToolbar - running change-set summary plus the three bulk actions.
 *
 * - Apply is disabled while any staged row has a validation error (R2.6),
 *   when the staged set is empty (R3.5), while a mutation is in flight (R8.6),
 *   or when the user is not an Editor (R1.2).
 * - Discard is disabled when the set is empty or a mutation is in flight.
 */
export function BulkEditToolbar({
    summary,
    hasValidationErrors,
    isApplying,
    onAddRow,
    onApply,
    onDiscard,
    canEdit,
}: BulkEditToolbarProps) {
    const isEmpty = summary.total === 0;

    return (
        <SpaceBetween size="s" direction="horizontal">
            <Box variant="p" data-testid="bulk-edit-summary">
                <strong>{summary.creates}</strong> creates, <strong>{summary.updates}</strong>{' '}
                updates, <strong>{summary.deletes}</strong> deletes
            </Box>

            <Button
                onClick={onAddRow}
                disabled={!canEdit || isApplying}
                iconName="add-plus"
                data-testid="bulk-edit-add-row"
            >
                Add Row
            </Button>

            <Button
                onClick={onDiscard}
                disabled={!canEdit || isEmpty || isApplying}
                data-testid="bulk-edit-discard"
            >
                Discard Changes
            </Button>

            <Button
                variant="primary"
                onClick={onApply}
                loading={isApplying}
                disabled={!canEdit || isEmpty || hasValidationErrors || isApplying}
                data-testid="bulk-edit-apply"
            >
                Apply Changes
            </Button>
        </SpaceBetween>
    );
}
