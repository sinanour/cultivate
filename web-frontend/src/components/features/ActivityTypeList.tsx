import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Table from '@cloudscape-design/components/table';
import Box from '@cloudscape-design/components/box';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import Badge from '@cloudscape-design/components/badge';
import Modal from '@cloudscape-design/components/modal';
import Alert from '@cloudscape-design/components/alert';
import Link from '@cloudscape-design/components/link';
import type { ActivityType } from '../../types';
import { ActivityTypeService } from '../../services/api/activity-type.service';
import { ActivityTypeForm } from './ActivityTypeForm';
import { ResponsiveButton } from '../common/ResponsiveButton';
import { usePermissions } from '../../hooks/usePermissions';
import { ConfirmationDialog } from '../common/ConfirmationDialog';
import { MergeInitiationModal } from '../merge/MergeInitiationModal';

export function ActivityTypeList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [selectedType, setSelectedType] = useState<ActivityType | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<ActivityType | null>(null);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeSourceType, setMergeSourceType] = useState<ActivityType | null>(null);

  const { data: activityTypes = [], isLoading } = useQuery({
    queryKey: ['activityTypes'],
    queryFn: () => ActivityTypeService.getActivityTypes(),
  });

  // Group activity types by category
  // const groupedTypes = activityTypes.reduce((acc, type) => {
  //   const categoryName = type.activityCategory?.name || 'Uncategorized';
  //   if (!acc[categoryName]) {
  //     acc[categoryName] = [];
  //   }
  //   acc[categoryName].push(type);
  //   return acc;
  // }, {} as Record<string, ActivityType[]>);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ActivityTypeService.deleteActivityType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activityTypes'] });
      setDeleteError('');
    },
    onError: (error: Error) => {
      setDeleteError(error.message || 'Failed to remove activity type. It may be referenced by activities.');
    },
  });

  const handleEdit = (type: ActivityType) => {
    setSelectedType(type);
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setSelectedType(null);
    setIsFormOpen(true);
  };

  const handleDelete = (type: ActivityType) => {
    setConfirmDelete(type);
  };

  const handleMerge = (type: ActivityType) => {
    setMergeSourceType(type);
    setShowMergeModal(true);
  };

  const handleConfirmDelete = () => {
    if (confirmDelete) {
      deleteMutation.mutate(confirmDelete.id);
      setConfirmDelete(null);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setSelectedType(null);
  };

  return (
    <SpaceBetween size="l">
      {deleteError && (
        <Alert
          type="error"
          dismissible
          onDismiss={() => setDeleteError('')}
        >
          {deleteError}
        </Alert>
      )}
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
                  navigate(`/activities?filter_activityType=${encodedName}`);
                }}
              >
                {item.name}
              </Link>
            ),
            sortingField: 'name',
          },
          {
            id: 'category',
            header: 'Category',
            cell: (item) => item.activityCategory?.name || 'Uncategorized',
            sortingField: 'activityCategory.name',
          },
          {
            id: 'type',
            header: 'Type',
            cell: (item) => (
              <Badge color={item.isPredefined ? 'blue' : 'grey'}>
                {item.isPredefined ? 'Predefined' : 'Custom'}
              </Badge>
            ),
          },
          {
            id: 'actions',
            header: 'Actions',
            cell: (item) => (
              <SpaceBetween direction="horizontal" size="xs">
                {canEdit() && (
                  <>
                    <Button
                      variant="normal"
                      iconName="edit"
                      onClick={() => handleEdit(item)}
                      ariaLabel={`Edit ${item.name}`}
                    />
                    <Button
                      variant="normal"
                      iconName="shrink"
                      onClick={() => handleMerge(item)}
                      ariaLabel={`Merge ${item.name}`}
                    />
                  </>
                )}
                {canDelete() && !item.isPredefined && (
                  <Button
                    variant="normal"
                    iconName="remove"
                    onClick={() => handleDelete(item)}
                    ariaLabel={`Remove ${item.name}`}
                  />
                )}
              </SpaceBetween>
            ),
          },
        ]}
        items={activityTypes}
        loading={isLoading}
        loadingText="Loading activity types"
        empty={
          <Box textAlign="center" color="inherit">
            <b>No activity types</b>
            <Box padding={{ bottom: 's' }} variant="p" color="inherit">
              No activity types to display.
            </Box>
            {canCreate() && (
              <ResponsiveButton 
                onClick={handleCreate}
                mobileIcon="add-plus"
                mobileAriaLabel="Create new activity type"
              >
                Create activity type
              </ResponsiveButton>
            )}
          </Box>
        }
        header={
          <Header
            counter={`(${activityTypes.length})`}
            actions={
              canCreate() && (
                <ResponsiveButton 
                  onClick={handleCreate}
                  mobileIcon="add-plus"
                  mobileAriaLabel="Create new activity type"
                >
                  Create activity type
                </ResponsiveButton>
              )
            }
          >
            Activity Types
          </Header>
        }
      />
      <Modal
        visible={isFormOpen}
        onDismiss={handleFormClose}
        header={selectedType ? 'Edit Activity Type' : 'Create Activity Type'}
      >
        {isFormOpen && (
          <ActivityTypeForm
            activityType={selectedType}
            onSuccess={handleFormClose}
            onCancel={handleFormClose}
          />
        )}
      </Modal>
      <ConfirmationDialog
        visible={confirmDelete !== null}
        title="Remove Activity Type"
        message={`Are you sure you want to remove "${confirmDelete?.name}"? This action cannot be undone.`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Merge Initiation Modal */}
      {mergeSourceType && (
        <MergeInitiationModal
          entityType="activityType"
          currentEntityId={mergeSourceType.id}
          currentEntityName={mergeSourceType.name}
          isOpen={showMergeModal}
          onDismiss={() => {
            setShowMergeModal(false);
            setMergeSourceType(null);
          }}
          onConfirm={() => {
            setShowMergeModal(false);
            setMergeSourceType(null);
            queryClient.invalidateQueries({ queryKey: ['activityTypes'] });
          }}
        />
      )}
    </SpaceBetween>
  );
}
