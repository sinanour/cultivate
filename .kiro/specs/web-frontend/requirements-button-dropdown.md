# Requirements Update: Consolidated Action Buttons on Detail Pages

## Overview

This document specifies the consolidation of action buttons in the CloudScape Header `actions` property on entity detail pages into a single ButtonDropdown component for improved UX and consistent layout.

## Related Requirements

This requirement updates and extends:
- **Requirement 23**: Hyperlinked Primary Columns in Tables
- **Requirement 24**: Edit Action Buttons on Detail Pages  
- **Requirement 24A**: Delete Action Buttons on Detail Pages

## New Requirement: Consolidated Action Buttons with ButtonDropdown

### Requirement 24B: Consolidated Header Actions on Detail Pages

**User Story:** As a user, I want all entity actions consolidated into a single dropdown button in the detail page header, so that I have a cleaner interface with all actions easily accessible in one place.

#### Acceptance Criteria

**Header Actions Property:**

1. THE Web_App SHALL replace the multiple separate buttons in the CloudScape Header `actions` property on entity detail pages with a single consolidated layout
2. THE Web_App SHALL use CloudScape ButtonDropdown component with variant="primary" for the consolidated actions dropdown
3. THE Web_App SHALL specify the Edit action as the mainAction property of the ButtonDropdown, making it the primary clickable action
4. THE Web_App SHALL position the "Back to <Entity> List" button to the left of the ButtonDropdown within the Header actions
5. THE Web_App SHALL position the ButtonDropdown as the right-most element within the Header actions
6. THE Web_App SHALL maintain consistent button positioning across all entity detail pages (participants, activities, venues, geographic areas)

**Dropdown Menu Items:**

7. THE Web_App SHALL include the following actions in the ButtonDropdown items array (when applicable to the entity type):
   - Edit (as mainAction, not in items)
   - Delete/Remove
   - Merge (for participants, activities, venues)
   - Activity lifecycle actions (for activities only: Mark Complete, Cancel Activity, Set Active)
8. THE Web_App SHALL order dropdown items logically: lifecycle actions first (if applicable), then Merge, then Delete/Remove
9. THE Web_App SHALL use CloudScape ButtonDropdown's items prop to define all dropdown menu items
10. THE Web_App SHALL provide clear, action-oriented labels for all dropdown items (e.g., "Remove", "Merge", "Mark Complete")
11. THE Web_App SHALL dynamically filter dropdown items based on entity state (e.g., hide "Mark Complete" if activity is already COMPLETED)

**Role-Based Visibility:**

12. THE Web_App SHALL hide the entire ButtonDropdown when the user has READ_ONLY role
13. THE Web_App SHALL display the ButtonDropdown when the user has EDITOR or ADMINISTRATOR role
14. THE Web_App SHALL filter dropdown items based on user permissions (e.g., only ADMINISTRATOR can merge records)
15. WHEN all dropdown items are filtered out due to permissions, THE Web_App SHALL still display the ButtonDropdown with only the mainAction (Edit) available
16. THE Web_App SHALL display the "Back to <Entity> List" button for all users regardless of role

**Interaction Behavior:**

17. WHEN a user clicks the ButtonDropdown primary button area (mainAction), THE Web_App SHALL execute the Edit action and navigate to the edit page
18. WHEN a user clicks the dropdown arrow on the ButtonDropdown, THE Web_App SHALL display the dropdown menu with all available actions
19. WHEN a user selects "Remove" or "Delete" from the dropdown, THE Web_App SHALL display a confirmation dialog before proceeding
20. WHEN a user selects a lifecycle action (e.g., "Mark Complete"), THE Web_App SHALL execute the action and update the entity status
21. WHEN a user selects "Merge", THE Web_App SHALL open the merge initiation modal with the current entity pre-selected

**Activity-Specific Actions:**

22. THE ActivityDetail page SHALL include activity lifecycle actions in the ButtonDropdown items:
    - "Mark Complete" (when status is not COMPLETED)
    - "Cancel Activity" (when status is not CANCELLED)  
    - "Set Active" (when status is not ACTIVE)
23. THE Web_App SHALL dynamically show/hide lifecycle actions based on the current activity status
24. WHEN "Mark Complete" is selected, THE Web_App SHALL update status to COMPLETED and implicitly set endDate to today if null
25. WHEN "Cancel Activity" is selected, THE Web_App SHALL update status to CANCELLED, set endDate to today if null, and set startDate to today if startDate is in the future
26. WHEN "Set Active" is selected, THE Web_App SHALL update status to ACTIVE

**Accessibility:**

27. THE Web_App SHALL provide appropriate ARIA labels for the ButtonDropdown (e.g., "Activity actions", "Participant actions")
28. THE Web_App SHALL ensure keyboard navigation works correctly for the ButtonDropdown and all menu items
29. THE Web_App SHALL provide visual focus indicators for keyboard navigation
30. THE Web_App SHALL announce dropdown menu state changes to screen readers

**Visual Design:**

31. THE Web_App SHALL use CloudScape's primary button styling for the ButtonDropdown to maintain visual hierarchy
32. THE Web_App SHALL ensure adequate spacing between the "Back" button and the ButtonDropdown within the Header actions SpaceBetween component
33. THE Web_App SHALL use CloudScape's standard dropdown menu styling for the items list
34. THE Web_App SHALL maintain the existing Header component structure and only modify the actions property content

#### Implementation Notes

**Affected Components:**
- ParticipantDetail
- ActivityDetail  
- VenueDetail
- GeographicAreaDetail

**CloudScape ButtonDropdown in Header Actions:**
```typescript
<Header
  variant="h2"
  actions={
    <SpaceBetween direction="horizontal" size="xs">
      {canEdit() && (
        <ButtonDropdown
          variant="primary"
          mainAction={{
            text: "Edit",
            onClick: () => navigate(`/activities/${id}/edit`)
          }}
          items={[
            { id: "complete", text: "Mark Complete", disabled: activity.status === 'COMPLETED' },
            { id: "cancel", text: "Cancel Activity", disabled: activity.status === 'CANCELLED' },
            { id: "active", text: "Set Active", disabled: activity.status === 'ACTIVE' },
            { id: "merge", text: "Merge" },
            { id: "delete", text: "Remove" }
          ]}
          onItemClick={({ detail }) => handleItemClick(detail.id)}
          ariaLabel="Activity actions"
        >
          Actions
        </ButtonDropdown>
      )}
      <Button onClick={() => navigate("/activities")}>
        Back to Activities
      </Button>
    </SpaceBetween>
  }
>
  {activity.name}
</Header>
```

**Migration from Current Implementation:**

Current state (multiple separate buttons in Header actions):
```tsx
<Header
  variant="h2"
  actions={
    <SpaceBetween direction="horizontal" size="xs">
      {canEdit() && (
        <SpaceBetween direction="horizontal" size="xs">
          <Button onClick={handleMarkComplete}>Mark Complete</Button>
          <Button onClick={handleCancel}>Cancel Activity</Button>
          <Button onClick={handleSetActive}>Set Active</Button>
          <Button variant="primary" onClick={handleEdit}>Edit</Button>
          <Button onClick={handleMerge}>Merge</Button>
          <Button onClick={handleDelete}>Remove</Button>
        </SpaceBetween>
      )}
      <Button onClick={handleBack}>Back to Activities</Button>
    </SpaceBetween>
  }
>
  {activity.name}
</Header>
```

New state (consolidated ButtonDropdown in Header actions):
```tsx
<Header
  variant="h2"
  actions={
    <SpaceBetween direction="horizontal" size="xs">
      {canEdit() && (
        <ButtonDropdown
          variant="primary"
          mainAction={{ text: "Edit", onClick: handleEdit }}
          items={[
            { id: "complete", text: "Mark Complete", disabled: activity.status === 'COMPLETED' },
            { id: "cancel", text: "Cancel Activity", disabled: activity.status === 'CANCELLED' },
            { id: "active", text: "Set Active", disabled: activity.status === 'ACTIVE' },
            { id: "merge", text: "Merge" },
            { id: "delete", text: "Remove" }
          ]}
          onItemClick={handleItemClick}
        >
          Actions
        </ButtonDropdown>
      )}
      <Button onClick={handleBack}>Back to Activities</Button>
    </SpaceBetween>
  }
>
  {activity.name}
</Header>
```

#### Backward Compatibility

This change updates the Header actions property but maintains all existing functionality:
- Edit action remains the primary action (now as mainAction)
- Delete/Remove action still shows confirmation dialog
- Activity lifecycle actions still update status correctly
- Merge action still opens merge modal
- Role-based permissions still apply
- Navigation behavior remains unchanged
- All other page content (tables, containers, data display) remains unchanged

#### Testing Considerations

Property-based tests should verify:
- ButtonDropdown displays correctly in Header actions on all entity detail pages
- mainAction (Edit) executes when primary button is clicked
- Dropdown menu displays all applicable items when arrow is clicked
- Role-based filtering works correctly
- Confirmation dialogs appear for destructive actions
- Activity lifecycle actions update status correctly
- Merge action opens merge modal correctly
- Keyboard navigation and accessibility features work
- Visual layout matches design specifications
- "Back" button remains to the left of ButtonDropdown

## Summary of Changes

**What's Changing:**
- Multiple separate buttons in Header actions → Single ButtonDropdown component in Header actions
- Edit button → mainAction property of ButtonDropdown
- Other action buttons → items array in ButtonDropdown
- Button order within Header actions → "Back" button first (left), ButtonDropdown second (right)

**What's Staying the Same:**
- CloudScape Header component structure
- Header variant and title
- Edit remains the primary action
- Delete/Remove still requires confirmation
- Role-based permissions still apply
- All functionality remains intact
- Navigation behavior unchanged
- All page content outside the Header actions property

**Benefits:**
- Cleaner, less cluttered detail page headers
- Consistent action pattern across all entity types
- Easier to add new actions in the future without header overflow
- Better mobile/tablet experience with consolidated menu
- Follows CloudScape design patterns for action consolidation
- Reduces visual noise in the header area
