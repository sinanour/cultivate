import { Modal, Box, SpaceBetween, Button, Alert } from '@cloudscape-design/components';
import type { VersionConflictInfo } from '../../utils/version-conflict.utils';

interface VersionConflictModalProps {
    visible: boolean;
    conflictInfo: VersionConflictInfo | null;
    onRetryWithLatest: () => void;
    onDiscardChanges: () => void;
    onViewDetails?: () => void;
}

export function VersionConflictModal({
    visible,
    conflictInfo,
    onRetryWithLatest,
    onDiscardChanges,
    onViewDetails,
}: VersionConflictModalProps) {
    if (!conflictInfo) return null;

    return (
        <Modal
            visible={visible}
            onDismiss={onDiscardChanges}
            header="Version Conflict Detected"
            footer={
                <Box float="right">
                    <SpaceBetween direction="horizontal" size="xs">
                        <Button variant="link" onClick={onDiscardChanges}>
                            Discard My Changes
                        </Button>
                        {onViewDetails && (
                            <Button variant="normal" onClick={onViewDetails}>
                                View Details
                            </Button>
                        )}
                        <Button variant="primary" onClick={onRetryWithLatest}>
                            Retry with Latest Version
                        </Button>
                    </SpaceBetween>
                </Box>
            }
        >
            <SpaceBetween size="m">
                <Alert type="warning" header="Your changes conflict with another user's changes">
                    {conflictInfo.errorMessage}
                </Alert>

                <Box>
                    <SpaceBetween size="xs">
                        <div>
                            <Box variant="awsui-key-label">Entity Type</Box>
                            <div>{conflictInfo.entityType}</div>
                        </div>
                        <div>
                            <Box variant="awsui-key-label">Your Version</Box>
                            <div>{conflictInfo.clientVersion}</div>
                        </div>
                        {conflictInfo.serverVersion && (
                            <div>
                                <Box variant="awsui-key-label">Current Server Version</Box>
                                <div>{conflictInfo.serverVersion}</div>
                            </div>
                        )}
                    </SpaceBetween>
                </Box>

                <Box>
                    <strong>What happened?</strong>
                    <Box variant="p">
                        Another user modified this {conflictInfo.entityType.toLowerCase()} while you were
                        editing it. You can either retry your changes with the latest version from the
                        server, or discard your changes.
                    </Box>
                </Box>
            </SpaceBetween>
        </Modal>
    );
}
