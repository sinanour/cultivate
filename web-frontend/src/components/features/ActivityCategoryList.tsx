import { useState } from 'react';
import Table from '@cloudscape-design/components/table';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Badge from '@cloudscape-design/components/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { activityCategoryService } from '../../services/api/activity-category.service';
import type { ActivityCategory } from '../../types';
import { ActivityCategoryForm } from './ActivityCategoryForm';
import { useNotification } from '../../hooks/useNotification';
import { usePermissions } from '../../hooks/usePermissions';

export function ActivityCategoryList() {
    const [selectedCategory, setSelectedCategory] = useState<ActivityCategory | null>(null);
    const [isFormVisible, setIsFormVisible] = useState(false);
    const { showNotification } = useNotification();
    const { canEdit } = usePermissions();
    const queryClient = useQueryClient();

    const { data: categories = [], isLoading } = useQuery({
        queryKey: ['activityCategories'],
        queryFn: () => activityCategoryService.getActivityCategories(),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => activityCategoryService.deleteActivityCategory(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['activityCategories'] });
            showNotification('success', 'Activity category deleted successfully');
        },
        onError: (error: any) => {
            const message = error.response?.data?.message || 'Failed to delete activity category';
            showNotification('error', message);
        },
    });

    const handleCreate = () => {
        setSelectedCategory(null);
        setIsFormVisible(true);
    };

    const handleEdit = (category: ActivityCategory) => {
        setSelectedCategory(category);
        setIsFormVisible(true);
    };

    const handleDelete = async (category: ActivityCategory) => {
        if (window.confirm(`Are you sure you want to delete "${category.name}"?`)) {
            deleteMutation.mutate(category.id);
        }
    };

    const handleFormClose = () => {
        setIsFormVisible(false);
        setSelectedCategory(null);
    };

    return (
        <>
            <Table
                columnDefinitions={[
                    {
                        id: 'name',
                        header: 'Name',
                        cell: (item) => item.name,
                        sortingField: 'name',
                    },
                    {
                        id: 'type',
                        header: 'Type',
                        cell: (item) =>
                            item.isPredefined ? (
                                <Badge color="blue">Predefined</Badge>
                            ) : (
                                <Badge>Custom</Badge>
                            ),
                    },
                    {
                        id: 'actions',
                        header: 'Actions',
                        cell: (item) =>
                            canEdit() ? (
                                <SpaceBetween direction="horizontal" size="xs">
                                    <Button variant="inline-link" onClick={() => handleEdit(item)}>
                                        Edit
                                    </Button>
                                    {!item.isPredefined && (
                                        <Button variant="inline-link" onClick={() => handleDelete(item)}>
                                            Delete
                                        </Button>
                                    )}
                                </SpaceBetween>
                            ) : null,
                    },
                ]}
                items={categories}
                loading={isLoading}
                loadingText="Loading activity categories"
                sortingDisabled={false}
                empty={
                    <Box textAlign="center" color="inherit">
                        <b>No activity categories</b>
                        <Box padding={{ bottom: 's' }} variant="p" color="inherit">
                            No activity categories to display.
                        </Box>
                    </Box>
                }
                header={
                    <Header
                        variant="h2"
                        actions={
                            canEdit() ? (
                                <Button variant="primary" onClick={handleCreate}>
                                    Create category
                                </Button>
                            ) : undefined
                        }
                    >
                        Activity Categories
                    </Header>
                }
            />

            {isFormVisible && (
                <ActivityCategoryForm
                    category={selectedCategory}
                    onClose={handleFormClose}
                    onSuccess={() => {
                        handleFormClose();
                        queryClient.invalidateQueries({ queryKey: ['activityCategories'] });
                    }}
                />
            )}
        </>
    );
}
