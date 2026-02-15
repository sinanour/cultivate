import React from 'react';
import { Modal, SpaceBetween, Alert, Table, Box } from '@cloudscape-design/components';
import type { ImportResult } from '../../types/csv.types';

interface ImportResultsModalProps {
    visible: boolean;
    result: ImportResult | null;
    onDismiss: () => void;
}

export function ImportResultsModal({ visible, result, onDismiss }: ImportResultsModalProps) {
    if (!result) return null;

    const hasErrors = result.failureCount > 0;

    return (
        <Modal
            visible={visible}
            onDismiss={onDismiss}
            header="Import Results"
            footer={
                <Box float="right">
                    <button onClick={onDismiss}>Close</button>
                </Box>
            }
        >
            <SpaceBetween size="m">
                <Alert type={hasErrors ? 'warning' : 'success'}>
                    {result.successCount} record{result.successCount !== 1 ? 's' : ''} imported successfully
                    {hasErrors && `, ${result.failureCount} failed`}
                </Alert>

                {result.errors.length > 0 && (
                    <React.Fragment key="errors-section">
                        <Box variant="h3">Errors</Box>
                        <Table
                            columnDefinitions={[
                                {
                                    id: 'row',
                                    header: 'Row',
                                    cell: (item) => item.row,
                                    width: 80
                                },
                                {
                                    id: 'errors',
                                    header: 'Error Messages',
                                    cell: (item) => item.errors.join(', ')
                                }
                            ]}
                            items={result.errors}
                            variant="embedded"
                        />
                    </React.Fragment>
                )}
            </SpaceBetween>
        </Modal>
    );
}
