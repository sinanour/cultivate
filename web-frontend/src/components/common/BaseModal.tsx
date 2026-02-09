import { Modal, Box, Button, type ModalProps } from '@cloudscape-design/components';
import { type ReactNode } from 'react';

export interface BaseModalProps {
    visible: boolean;
    onDismiss: () => void;
    header: string;
    children: ReactNode;
    footer?: ReactNode;
    size?: ModalProps.Size;
}

export function BaseModal({
    visible,
    onDismiss,
    header,
    children,
    footer,
    size = 'medium',
}: BaseModalProps) {
    const defaultFooter = (
        <Box float="right">
            <Button variant="primary" onClick={onDismiss}>
                Close
            </Button>
        </Box>
    );

    return (
        <Modal
            visible={visible}
            onDismiss={onDismiss}
            header={header}
            footer={footer || defaultFooter}
            size={size}
        >
            {children}
        </Modal>
    );
}
