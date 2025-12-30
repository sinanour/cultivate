import { useState, useEffect } from 'react';
import Modal from '@cloudscape-design/components/modal';
import Box from '@cloudscape-design/components/box';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import { useMutation } from '@tanstack/react-query';
import { activityCategoryService } from '../../services/api/activity-category.service';
import type { ActivityCategory } from '../../types';
import { useNotification } from '../../hooks/useNotification';

interface ActivityCategoryFormProps {
    category: ActivityCategory | null;
    onClose: () => void;
    onSuccess: () => void;
}

export function ActivityCategoryForm({ category, onClose, onSuccess }: ActivityCategoryFormProps) {
    const [name, setName] = useState('');
    const [nameError, setNameError] = useState('');
    const { showNotification } = useNotification();

    useEffect(() => {
        if (category) {
            setName(category.name);
        }
    }, [category]);

    const createMutation = useMutation({
        mutationFn: (data: { name: string }) => activityCategoryService.createActivityCategory(data),
        onSuccess: () => {
            showNotification('success', 'Activity category created successfully');
            onSuccess();
        },
        onError: (error: any) => {
            const message = error.response?.data?.message || 'Failed to create activity category';
            showNotification('error', message);
        },
    });

    const updateMutation = useMutation({
        mutationFn: (data: { id: string; name: string; version: number }) =>
            activityCategoryService.updateActivityCategory(data.id, { name: data.name, version: data.version }),
        onSuccess: () => {
            showNotification('success', 'Activity category updated successfully');
            onSuccess();
        },
        onError: (error: any) => {
            const message = error.response?.data?.message || 'Failed to update activity category';
            showNotification('error', message);
        },
    });

    const handleSubmit = () => {
        // Validate
        if (!name.trim()) {
            setNameError('Name is required');
            return;
        }

        if (category) {
            updateMutation.mutate({ id: category.id, name, version: category.version });
        } else {
            createMutation.mutate({ name });
        }
    };

    const isLoading = createMutation.isPending || updateMutation.isPending;

    return (
        <Modal
            onDismiss={onClose}
            visible={true}
            header={category ? 'Edit Activity Category' : 'Create Activity Category'}
            footer={
                <Box float="right">
                    <SpaceBetween direction="horizontal" size="xs">
                        <Button variant="link" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button variant="primary" onClick={handleSubmit} loading={isLoading}>
                            {category ? 'Update' : 'Create'}
                        </Button>
                    </SpaceBetween>
                </Box>
            }
        >
            <SpaceBetween size="m">
                <FormField label="Name" errorText={nameError}>
                    <Input
                        value={name}
                        onChange={(e) => {
                            setName(e.detail.value);
                            setNameError('');
                        }}
                        placeholder="Enter category name"
                    />
                </FormField>
            </SpaceBetween>
        </Modal>
    );
}
