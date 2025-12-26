import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
    isVersionConflict,
    extractVersionConflictInfo,
    type VersionConflictInfo,
} from '../utils/version-conflict.utils';

interface UseVersionConflictOptions {
    queryKey: string[];
    onRetry?: () => void;
    onDiscard?: () => void;
}

export function useVersionConflict({ queryKey, onRetry, onDiscard }: UseVersionConflictOptions) {
    const queryClient = useQueryClient();
    const [conflictInfo, setConflictInfo] = useState<VersionConflictInfo | null>(null);
    const [showConflictModal, setShowConflictModal] = useState(false);

    const handleError = (error: Error & { response?: { status: number; data?: { code?: string } } }): boolean => {
        if (isVersionConflict(error)) {
            const info = extractVersionConflictInfo(error);
            setConflictInfo(info);
            setShowConflictModal(true);
            console.error('Version conflict:', info);
            return true;
        }
        return false;
    };

    const handleRetryWithLatest = async () => {
        setShowConflictModal(false);
        setConflictInfo(null);
        await queryClient.invalidateQueries({ queryKey });
        onRetry?.();
    };

    const handleDiscardChanges = () => {
        setShowConflictModal(false);
        setConflictInfo(null);
        onDiscard?.();
    };

    return {
        conflictInfo,
        showConflictModal,
        handleError,
        handleRetryWithLatest,
        handleDiscardChanges,
    };
}
