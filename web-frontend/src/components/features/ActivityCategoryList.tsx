import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Table from '@cloudscape-design/components/table';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import Badge from '@cloudscape-design/components/badge';
import Link from '@cloudscape-design/components/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { activityCategoryService } from '../../services/api/activity-category.service';
import type { ActivityCategory } from '../../types';
import { ActivityCategoryForm } from './ActivityCategoryForm';
import { ResponsiveButton } from '../common/ResponsiveButton';
import { useNotification } from '../../hooks/useNotification';
import { usePermissions } from '../../hooks/usePermissions';
import { ConfirmationDialog } from '../common/ConfirmationDialog';

export function ActivityCategoryList() {
    const navigate = useNavigate();
    const [selectedCategory, setSelectedCategory] = useState<ActivityCategory | null>(null);
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<ActivityCategory | null>(null);
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
            const message = error.response?.data?.message || 'Failed to remove activity category';
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

    const handleDelete = (category: ActivityCategory) => {
        setConfirmDelete(category);
    };

    const handleConfirmDelete = () => {
        if (confirmDelete) {
            deleteMutation.mutate(confirmDelete.id);
            setConfirmDelete(null);
        }
    };

    const handleFormClose = () => {
        setIsFormVisible(false);
        setSelectedCategory(null);
    };

    return (
        <>
            <Table
                wrapLines={false}
                columnDefinitions={[
                    {
                        id: 'name',
                        header: 'Name',
                        cell: (item) => (
                            <Link
                                onFollow={(e) => {
                                    e.preventDefault();
                                    const encodedName = encodeURIComponent(item.name).replace(/%20/g, '+');
                                    navigate(`/activities?filter_activityCategory=${encodedName}`);
                                }}
                            >
                                {item.name}
                            </Link>
                        ),
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
                                <Box>
                                    <Button 
                                        variant="inline-link" 
                                        iconName="edit"
                                        onClick={() => handleEdit(item)}
                                        ariaLabel={`Edit ${item.name}`}
                                    />
                                    {!item.isPredefined && (
                                        <Button 
                                            variant="inline-link" 
                                            iconName="remove"
                                            onClick={() => handleDelete(item)}
                                            ariaLabel={`Remove ${item.name}`}
                                        />
                                    )}
                                </Box>
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
                                <ResponsiveButton 
                                    onClick={handleCreate}
                                    mobileIcon="add-plus"
                                    mobileAriaLabel="Create new activity category"
                                >
                                    Create category
                                </ResponsiveButton>
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

            <ConfirmationDialog
                visible={confirmDelete !== null}
                title="Remove Activity Category"
                message={`Are you sure you want to remove "${confirmDelete?.name}"? This action cannot be undone.`}
                confirmLabel="Remove"
                variant="destructive"
                onConfirm={handleConfirmDelete}
                onCancel={() => setConfirmDelete(null)}
            />
        </>
    );
}
