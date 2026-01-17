import { useState, useEffect, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Select from '@cloudscape-design/components/select';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Alert from '@cloudscape-design/components/alert';
import type { ActivityType } from '../../types';
import { ActivityTypeService } from '../../services/api/activity-type.service';
import { activityCategoryService } from '../../services/api/activity-category.service';
import { VersionConflictModal } from '../common/VersionConflictModal';
import { EntitySelectorWithActions } from '../common/EntitySelectorWithActions';
import { useAuth } from '../../hooks/useAuth';
import {
    isVersionConflict,
    extractVersionConflictInfo,
    getEntityVersion,
    type VersionConflictInfo,
} from '../../utils/version-conflict.utils';

interface ActivityTypeFormProps {
  activityType: ActivityType | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ActivityTypeForm({ activityType, onSuccess, onCancel }: ActivityTypeFormProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [activityCategoryId, setActivityCategoryId] = useState('');
  const [nameError, setNameError] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [error, setError] = useState('');
  const [conflictInfo, setConflictInfo] = useState<VersionConflictInfo | null>(null);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [isRefreshingCategories, setIsRefreshingCategories] = useState(false);

  const canAddCategory = user?.role === 'ADMINISTRATOR' || user?.role === 'EDITOR';

  // Fetch activity categories for dropdown
  const { data: categories = [], refetch: refetchCategories } = useQuery({
    queryKey: ['activityCategories'],
    queryFn: () => activityCategoryService.getActivityCategories(),
  });

  const handleRefreshCategories = async () => {
    setIsRefreshingCategories(true);
    try {
      await refetchCategories();
    } finally {
      setIsRefreshingCategories(false);
    }
  };

  // Update form state when activityType prop changes
  useEffect(() => {
    if (activityType) {
      setName(activityType.name || '');
      setActivityCategoryId(activityType.activityCategoryId || '');
    } else {
      // Reset to defaults for create mode
      setName('');
      setActivityCategoryId('');
    }
    // Clear errors when switching modes
    setNameError('');
    setCategoryError('');
    setError('');
  }, [activityType]);

  const createMutation = useMutation({
    mutationFn: (data: { name: string; activityCategoryId: string }) => ActivityTypeService.createActivityType(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activityTypes'] });
      onSuccess();
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to create activity type');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; name?: string; activityCategoryId?: string; version?: number }) =>
      ActivityTypeService.updateActivityType(data.id, { name: data.name, activityCategoryId: data.activityCategoryId, version: data.version }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activityTypes'] });
      onSuccess();
    },
    onError: (err: Error) => {
      if (isVersionConflict(err)) {
        const info = extractVersionConflictInfo(err);
        setConflictInfo(info);
        setShowConflictModal(true);
        console.error('Version conflict:', info);
      } else {
        setError(err.message || 'Failed to update activity type');
      }
    },
  });

  const validateName = (value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed) {
      setNameError('Name is required and cannot be empty or whitespace');
      return false;
    }
    setNameError('');
    return true;
  };

  const validateCategory = (value: string): boolean => {
    if (!value) {
      setCategoryError('Activity category is required');
      return false;
    }
    setCategoryError('');
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const isNameValid = validateName(name);
    const isCategoryValid = validateCategory(activityCategoryId);

    if (!isNameValid || !isCategoryValid) {
      return;
    }

    if (activityType) {
      updateMutation.mutate({
        id: activityType.id,
        name: name.trim(),
        activityCategoryId,
        version: getEntityVersion(activityType),
      });
    } else {
      createMutation.mutate({ name: name.trim(), activityCategoryId });
    }
  };

  const handleRetryWithLatest = async () => {
    setShowConflictModal(false);
    setConflictInfo(null);
    // Refetch the latest data
    await queryClient.invalidateQueries({ queryKey: ['activityTypes'] });
    // The parent component should refetch and pass the latest activityType
    onCancel(); // Close the form so user can reopen with latest data
  };

  const handleDiscardChanges = () => {
    setShowConflictModal(false);
    setConflictInfo(null);
    onCancel();
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  const categoryOptions = categories.map((cat) => ({
    label: cat.name,
    value: cat.id,
  }));

  const selectedCategory = categoryOptions.find((opt) => opt.value === activityCategoryId) || null;

  return (
    <>
      <form onSubmit={handleSubmit}>
        <Form
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={onCancel} disabled={isLoading}>
                Cancel
              </Button>
              <Button variant="primary" loading={isLoading} disabled={isLoading} formAction="submit">
                {activityType ? 'Update' : 'Create'}
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            {error && (
              <Alert type="error" dismissible onDismiss={() => setError('')}>
                {error}
              </Alert>
            )}
            <FormField label="Name" errorText={nameError}>
              <Input
                value={name}
                onChange={({ detail }) => {
                  setName(detail.value);
                  if (nameError) validateName(detail.value);
                }}
                onBlur={() => validateName(name)}
                placeholder="Enter activity type name"
                disabled={isLoading}
              />
            </FormField>
            <FormField label="Activity Category" errorText={categoryError}>
              <EntitySelectorWithActions
                onRefresh={handleRefreshCategories}
                addEntityType="activityCategory"
                canAdd={canAddCategory}
                isRefreshing={isRefreshingCategories}
                entityTypeName="activity category"
              >
                <Select
                  selectedOption={selectedCategory}
                  onChange={({ detail }) => {
                    setActivityCategoryId(detail.selectedOption.value || '');
                    if (categoryError) validateCategory(detail.selectedOption.value || '');
                  }}
                  options={categoryOptions}
                  placeholder="Select activity category"
                  disabled={isLoading}
                  empty="No categories available"
                />
              </EntitySelectorWithActions>
            </FormField>
          </SpaceBetween>
        </Form>
      </form>

      <VersionConflictModal
        visible={showConflictModal}
        conflictInfo={conflictInfo}
        onRetryWithLatest={handleRetryWithLatest}
        onDiscardChanges={handleDiscardChanges}
      />
    </>
  );
}
