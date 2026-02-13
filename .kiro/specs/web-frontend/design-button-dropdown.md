# Design Document: Consolidated Header Actions with ButtonDropdown

## Overview

This design document describes the consolidation of action buttons in the CloudScape Header `actions` property on entity detail pages. The current implementation uses multiple separate buttons (Edit, Delete/Remove, Merge, and activity lifecycle actions) which creates visual clutter and can cause header overflow on smaller screens. This design replaces those separate buttons with a single CloudScape ButtonDropdown component that provides a cleaner interface while maintaining all existing functionality.

## Design Rationale

**Why ButtonDropdown:**
- Reduces visual clutter in detail page headers
- Prevents header overflow on smaller screens when multiple actions are available
- Follows CloudScape design patterns for action consolidation
- Maintains Edit as the primary action through mainAction property
- Provides better mobile/tablet experience with consolidated menu
- Makes it easier to add new actions in the future without layout concerns

**Why Edit as mainAction:**
- Edit is the most common action users perform on detail pages
- Maintains Edit's prominence as a primary action
- Allows one-click access to edit without opening dropdown
- Follows CloudScape patterns where mainAction is the most frequent operation

**Why "Back" Button Stays Separate:**
- Navigation actions should be visually distinct from entity actions
- "Back" is not an action on the entity itself, but a navigation control
- Keeps navigation consistent and predictable
- Prevents accidental navigation when trying to access entity actions

## Component Structure

### Header Actions Layout

**Before (Current Implementation):**
```tsx
<Header
  variant="h2"
  actions={
    <SpaceBetween direction="horizontal" size="xs">
      {canEdit() && (
        <SpaceBetween direction="horizontal" size="xs">
          {/* Multiple separate buttons */}
          <Button onClick={handleLifecycleAction1}>Action 1</Button>
          <Button onClick={handleLifecycleAction2}>Action 2</Button>
          <Button variant="primary" onClick={handleEdit}>Edit</Button>
          <Button onClick={handleMerge}>Merge</Button>
          <Button onClick={handleDelete}>Remove</Button>
        </SpaceBetween>
      )}
      <Button onClick={handleBack}>Back to List</Button>
    </SpaceBetween>
  }
>
  {entity.name}
</Header>
```

**After (New Implementation):**
```tsx
<Header
  variant="h2"
  actions={
    <SpaceBetween direction="horizontal" size="xs">
      {canEdit() && (
        <ButtonDropdown
          variant="primary"
          mainAction={{
            text: "Edit",
            onClick: handleEdit
          }}
          items={buildDropdownItems(entity)}
          onItemClick={({ detail }) => handleItemClick(detail.id)}
          ariaLabel={`${entityType} actions`}
        >
          Actions
        </ButtonDropdown>
      )}
      <Button onClick={handleBack}>Back to {entityType}s</Button>
    </SpaceBetween>
  }
>
  {entity.name}
</Header>
```

## ButtonDropdown Configuration

### Common Pattern for All Entity Types

**Props:**
- `variant="primary"` - Maintains visual hierarchy with Edit as primary action
- `mainAction` - Edit action for one-click access
- `items` - Array of dropdown menu items (dynamically filtered)
- `onItemClick` - Handler for dropdown item selection
- `ariaLabel` - Accessibility label (e.g., "Activity actions")
- Button text: "Actions"

### Dropdown Items Structure

**Item Properties:**
- `id` - Unique identifier for the action (used in onItemClick handler)
- `text` - Display label for the menu item
- `disabled` - Optional boolean to disable items based on entity state
- `iconName` - Optional CloudScape icon name

### Entity-Specific Dropdown Items

#### ParticipantDetail
```typescript
const items = [
  { id: "merge", text: "Merge", iconName: "shrink" },
  { id: "delete", text: "Remove", iconName: "remove" }
];
```

#### ActivityDetail
```typescript
const items = [
  // Lifecycle actions (conditionally included based on status)
  ...(activity.status !== 'COMPLETED' ? [{ id: "complete", text: "Mark Complete", iconName: "status-positive" }] : []),
  ...(activity.status !== 'CANCELLED' ? [{ id: "cancel", text: "Cancel Activity", iconName: "status-negative" }] : []),
  ...(activity.status !== 'ACTIVE' ? [{ id: "active", text: "Set Active", iconName: "status-in-progress" }] : []),
  // Standard actions
  { id: "merge", text: "Merge", iconName: "shrink" },
  { id: "delete", text: "Remove", iconName: "remove" }
];
```

#### VenueDetail
```typescript
const items = [
  { id: "merge", text: "Merge", iconName: "shrink" },
  { id: "delete", text: "Remove", iconName: "remove" }
];
```

#### GeographicAreaDetail
```typescript
const items = [
  { id: "delete", text: "Remove", iconName: "remove" }
];
// Note: Geographic areas don't have merge functionality
```

## Implementation Details

### Item Click Handler

Each detail component needs a unified handler for dropdown item clicks:

```typescript
const handleItemClick = (itemId: string) => {
  switch (itemId) {
    case "complete":
      handleUpdateStatus("COMPLETED");
      break;
    case "cancel":
      handleUpdateStatus("CANCELLED");
      break;
    case "active":
      handleUpdateStatus("ACTIVE");
      break;
    case "merge":
      setShowMergeModal(true);
      break;
    case "delete":
      setConfirmDelete(true);
      break;
    default:
      console.warn(`Unknown action: ${itemId}`);
  }
};
```

### Dynamic Item Filtering

Items should be filtered based on:
1. **Entity State**: Hide lifecycle actions that don't apply (e.g., "Mark Complete" when already COMPLETED)
2. **User Permissions**: Filter items based on role (though currently all items require canEdit())
3. **Entity Type**: Only include applicable actions (e.g., no merge for geographic areas)

**Example for ActivityDetail:**
```typescript
const buildDropdownItems = (activity: Activity) => {
  const items = [];
  
  // Add lifecycle actions based on current status
  if (activity.status !== 'COMPLETED') {
    items.push({ id: "complete", text: "Mark Complete", iconName: "status-positive" });
  }
  if (activity.status !== 'CANCELLED') {
    items.push({ id: "cancel", text: "Cancel Activity", iconName: "status-negative" });
  }
  if (activity.status !== 'ACTIVE') {
    items.push({ id: "active", text: "Set Active", iconName: "status-in-progress" });
  }
  
  // Add standard actions
  items.push({ id: "merge", text: "Merge", iconName: "shrink" });
  items.push({ id: "delete", text: "Remove", iconName: "remove" });
  
  return items;
};
```

### Accessibility Considerations

**ARIA Labels:**
- ButtonDropdown: `ariaLabel="Activity actions"` (or "Participant actions", etc.)
- Dropdown items: CloudScape handles item accessibility automatically

**Keyboard Navigation:**
- Tab to focus ButtonDropdown
- Enter/Space to activate mainAction (Edit)
- Arrow keys to navigate dropdown items when menu is open
- Enter/Space to select dropdown item
- Escape to close dropdown

**Screen Reader Announcements:**
- ButtonDropdown announces "Actions, button with dropdown"
- When dropdown opens: "Menu expanded"
- When item is focused: Item text is announced
- When item is selected: Action result is announced (e.g., "Activity status updated")

### Visual Design

**Button Appearance:**
- Primary button styling (blue background, white text)
- "Actions" text with dropdown arrow icon
- Consistent with CloudScape primary button design

**Dropdown Menu:**
- Standard CloudScape dropdown menu styling
- Items appear below button
- Hover states on menu items
- Disabled items shown with reduced opacity
- Icons aligned to the left of item text

**Spacing:**
- `size="xs"` between "Back" button and ButtonDropdown
- Standard CloudScape dropdown menu spacing for items

## Error Handling

All existing error handling remains unchanged:
- Confirmation dialogs for destructive actions (Delete, Cancel Activity)
- Error alerts for failed operations
- Loading states during mutations
- Optimistic updates with rollback on failure

## State Management

No changes to state management:
- React Query for data fetching and cache invalidation
- Local component state for modal visibility
- Existing mutation hooks remain unchanged
- Confirmation dialog state remains unchanged

## Migration Strategy

### Step 1: Update ActivityDetail
- Replace multiple buttons with ButtonDropdown in Header actions
- Implement handleItemClick handler
- Build items array dynamically based on activity status
- Test all actions work correctly

### Step 2: Update ParticipantDetail
- Apply same pattern as ActivityDetail
- Simpler items array (no lifecycle actions)
- Test merge and delete actions

### Step 3: Update VenueDetail
- Apply same pattern as ActivityDetail
- Simpler items array (no lifecycle actions)
- Test merge and delete actions

### Step 4: Update GeographicAreaDetail
- Apply same pattern as ActivityDetail
- Simplest items array (only delete, no merge)
- Test delete action

### Step 5: Testing
- Verify all actions work on all detail pages
- Test keyboard navigation
- Test screen reader announcements
- Test on mobile/tablet viewports
- Verify role-based visibility

## Technical Considerations

### CloudScape ButtonDropdown API

**Required Props:**
- `items` - Array of menu items
- `onItemClick` - Handler receiving `{ detail: { id: string } }`

**Optional Props:**
- `variant` - "primary" for our use case
- `mainAction` - Object with `text` and `onClick` for primary action
- `ariaLabel` - Accessibility label
- `disabled` - Disable entire button
- `loading` - Show loading state

**Item Properties:**
- `id` - Required, unique identifier
- `text` - Required, display label
- `disabled` - Optional, disable specific item
- `iconName` - Optional, CloudScape icon name
- `description` - Optional, additional text below label

### Responsive Behavior

The ButtonDropdown component is already responsive:
- Automatically adjusts dropdown position based on viewport
- Menu items stack vertically in dropdown
- Touch-friendly on mobile devices
- No additional responsive logic needed

### Performance

No performance impact:
- ButtonDropdown is a lightweight component
- No additional API calls
- No additional state management
- Same number of event handlers (consolidated into one)

## Future Enhancements

This pattern makes it easy to add new actions in the future:
- Add new item to items array
- Add case to handleItemClick switch
- No layout concerns or header overflow issues
- Consistent UX across all entity types

**Potential Future Actions:**
- Export entity data
- Duplicate entity
- Archive entity
- Share entity
- Print entity details
- Add to favorites
