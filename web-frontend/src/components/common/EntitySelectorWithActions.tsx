import React, { useState } from 'react';
import { Button, SpaceBetween, Modal, Box } from '@cloudscape-design/components';
import { ActivityCategoryForm } from '../features/ActivityCategoryForm';
import { ActivityTypeForm } from '../features/ActivityTypeForm';
import { ParticipantRoleForm } from '../features/ParticipantRoleForm';
import { PopulationForm } from '../configuration/PopulationForm';

type ConfigurableEntityType = 'activityCategory' | 'activityType' | 'participantRole' | 'population';

interface EntitySelectorWithActionsProps {
  children: React.ReactNode;
  onRefresh: () => void;
  addEntityUrl?: string;
  addEntityType?: ConfigurableEntityType;
  canAdd: boolean;
  isRefreshing: boolean;
  entityTypeName: string;
  onEntityCreated?: (entityId: string) => void;
  additionalFormProps?: Record<string, any>;
}

/**
 * Wrapper component that adds refresh and add action buttons to entity reference selectors.
 * Provides consistent UX for reloading entity options and creating new entities without losing form context.
 * 
 * For major entities (Geographic Areas, Venues, Participants): opens creation page in new tab
 * For configurable entities (Activity Categories, Activity Types, Participant Roles, Populations): opens inline modal
 */
export const EntitySelectorWithActions: React.FC<EntitySelectorWithActionsProps> = ({
  children,
  onRefresh,
  addEntityUrl,
  addEntityType,
  canAdd,
  isRefreshing,
  entityTypeName,
  onEntityCreated,
  additionalFormProps: _additionalFormProps = {},
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleAddClick = () => {
    if (addEntityType) {
      // Open inline modal for configurable entities
      setIsModalOpen(true);
    } else if (addEntityUrl) {
      // Open new tab for major entities
      window.open(addEntityUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
  };

  const handleEntityCreated = async () => {
    setIsModalOpen(false);
    // Refresh the selector options
    await onRefresh();
    // Notify parent if callback provided (for auto-selection)
    if (onEntityCreated) {
      // Note: The actual entity ID would need to be passed from the form component
      // For now, the parent will handle re-selection after refresh
      onEntityCreated(''); // Empty string as placeholder - parent handles via refresh
    }
  };

  const renderInlineForm = () => {
    if (!addEntityType) return null;

    switch (addEntityType) {
      case 'activityCategory':
        return (
          <ActivityCategoryForm
            category={null}
            onClose={handleModalClose}
            onSuccess={handleEntityCreated}
          />
        );
      
      case 'activityType':
        return (
          <Modal
            onDismiss={handleModalClose}
            visible={true}
            header="Create Activity Type"
          >
            <Box padding={{ vertical: 'm' }}>
              <ActivityTypeForm
                activityType={null}
                onSuccess={handleEntityCreated}
                onCancel={handleModalClose}
              />
            </Box>
          </Modal>
        );
      
      case 'participantRole':
        return (
          <Modal
            onDismiss={handleModalClose}
            visible={true}
            header="Create Participant Role"
          >
            <Box padding={{ vertical: 'm' }}>
              <ParticipantRoleForm
                role={null}
                onSuccess={handleEntityCreated}
                onCancel={handleModalClose}
              />
            </Box>
          </Modal>
        );
      
      case 'population':
        return (
          <PopulationForm
            population={null}
            isCreating={true}
            onClose={handleEntityCreated}
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <>
      <SpaceBetween direction="horizontal" size="xs">
        <div style={{ flexGrow: 1 }}>
          {children}
        </div>
        <Button
          iconName="refresh"
          onClick={onRefresh}
          loading={isRefreshing}
          ariaLabel={`Refresh ${entityTypeName} list`}
          formAction="none"
        />
        <Button
          iconName="add-plus"
          onClick={handleAddClick}
          disabled={!canAdd}
          ariaLabel={`Add new ${entityTypeName}`}
          formAction="none"
        />
      </SpaceBetween>

      {isModalOpen && renderInlineForm()}
    </>
  );
};
