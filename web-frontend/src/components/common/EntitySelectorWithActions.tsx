import React from 'react';
import { Button, SpaceBetween } from '@cloudscape-design/components';

interface EntitySelectorWithActionsProps {
  children: React.ReactNode;
  onRefresh: () => void;
  addEntityUrl: string;
  canAdd: boolean;
  isRefreshing: boolean;
  entityTypeName: string;
}

/**
 * Wrapper component that adds refresh and add action buttons to entity reference selectors.
 * Provides consistent UX for reloading entity options and creating new entities without losing form context.
 */
export const EntitySelectorWithActions: React.FC<EntitySelectorWithActionsProps> = ({
  children,
  onRefresh,
  addEntityUrl,
  canAdd,
  isRefreshing,
  entityTypeName,
}) => {
  const handleAddClick = () => {
    window.open(addEntityUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <SpaceBetween direction="horizontal" size="xs">
      <div style={{ flexGrow: 1 }}>
        {children}
      </div>
      <Button
        iconName="refresh"
        variant="icon"
        onClick={onRefresh}
        loading={isRefreshing}
        ariaLabel={`Refresh ${entityTypeName} list`}
        formAction="none"
      />
      <Button
        iconName="add-plus"
        variant="icon"
        onClick={handleAddClick}
        disabled={!canAdd}
        ariaLabel={`Add new ${entityTypeName}`}
        formAction="none"
      />
    </SpaceBetween>
  );
};
