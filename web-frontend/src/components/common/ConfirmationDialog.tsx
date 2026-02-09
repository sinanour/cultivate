import { Modal, Box, SpaceBetween, Button } from '@cloudscape-design/components';

export interface ConfirmationDialogProps {
    visible: boolean;
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'destructive' | 'normal';
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmationDialog({
    visible,
    title = 'Confirm Action',
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    onConfirm,
    onCancel,
}: ConfirmationDialogProps) {
    // Note: variant parameter available for future styling enhancements
    return (
        <Modal
            visible={visible}
            onDismiss={onCancel}
            header={title}
            footer={
                <Box float="right">
                    <SpaceBetween direction="horizontal" size="xs">
                        <Button variant="link" onClick={onCancel}>
                            {cancelLabel}
                        </Button>
                        <Button
                            variant="primary"
                            onClick={onConfirm}
                      >
                          {confirmLabel}
                      </Button>
                  </SpaceBetween>
              </Box>
          }
      >
          <Box variant="p">{message}</Box>
      </Modal>
  );
}
