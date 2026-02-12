import { Modal, Box, SpaceBetween, Button, Alert } from '@cloudscape-design/components';

export interface MergeConfirmationDialogProps {
  entityType: string;
  sourceName: string;
  destinationName: string;
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Final confirmation dialog before executing merge
 * Displays warning about irreversible action
 */
export function MergeConfirmationDialog({
  entityType,
  sourceName,
  destinationName,
  isOpen,
  onConfirm,
  onCancel,
}: MergeConfirmationDialogProps) {
  return (
    <Modal
      visible={isOpen}
      onDismiss={onCancel}
      header={`Confirm ${entityType} Merge`}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="primary" onClick={onConfirm}>
              Confirm
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        <Box>
          Merge <strong>{sourceName}</strong> into <strong>{destinationName}</strong>?
        </Box>
        <Alert type="warning" header="Warning">
          This action cannot be undone. The source record will be deleted and all related
          entities will be moved to the destination record.
        </Alert>
      </SpaceBetween>
    </Modal>
  );
}
