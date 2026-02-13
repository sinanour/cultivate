# Implementation Plan: Consolidated Header Actions with ButtonDropdown

## Overview

This implementation plan covers the consolidation of action buttons in the CloudScape Header `actions` property on entity detail pages. The change replaces multiple separate buttons with a single ButtonDropdown component for a cleaner interface.

## Tasks

- [x] 1. Update ActivityDetail component with ButtonDropdown
  - [x] 1.1 Import ButtonDropdown component from CloudScape
    - Add import statement: `import ButtonDropdown from "@cloudscape-design/components/button-dropdown";`
    - _Requirements: 24B.2_

  - [x] 1.2 Create buildDropdownItems helper function
    - Create function that accepts activity object and returns items array
    - Conditionally include "Mark Complete" when status !== 'COMPLETED'
    - Conditionally include "Cancel Activity" when status !== 'CANCELLED'
    - Conditionally include "Set Active" when status !== 'ACTIVE'
    - Always include "Merge" item
    - Always include "Remove" item
    - Add appropriate iconName for each item (status-positive, status-negative, status-in-progress, shrink, remove)
    - Return array of item objects with id, text, and iconName properties
    - _Requirements: 24B.7, 24B.8, 24B.9, 24B.10, 24B.11, 24B.22, 24B.23_

  - [x] 1.3 Create handleItemClick handler function
    - Create function that accepts itemId string parameter
    - Implement switch statement for item handling:
      - case "complete": call handleUpdateStatus("COMPLETED")
      - case "cancel": call handleUpdateStatus("CANCELLED")
      - case "active": call handleUpdateStatus("ACTIVE")
      - case "merge": call setShowMergeModal(true)
      - case "delete": call setConfirmDeleteActivity(true)
      - default: log warning for unknown action
    - _Requirements: 24B.17, 24B.18, 24B.19, 24B.20, 24B.21, 24B.24, 24B.25, 24B.26_

  - [x] 1.4 Replace Header actions with ButtonDropdown
    - Locate the Header component's actions prop in ActivityDetail
    - Replace the nested SpaceBetween with multiple buttons
    - Create new SpaceBetween with direction="horizontal" size="xs"
    - Add ButtonDropdown as first child (when canEdit() is true):
      - Set variant="primary"
      - Set mainAction={{ text: "Edit", onClick: () => navigate(`/activities/${id}/edit`) }}
      - Set items={buildDropdownItems(activity)}
      - Set onItemClick={({ detail }) => handleItemClick(detail.id)}
      - Set ariaLabel="Activity actions"
      - Set button text to "Actions"
    - Add "Back to Activities" Button as second child
    - Remove all individual action buttons (Mark Complete, Cancel Activity, Set Active, Edit, Merge, Remove)
    - _Requirements: 24B.1, 24B.2, 24B.3, 24B.4, 24B.5, 24B.6, 24B.12, 24B.13, 24B.16, 24B.27, 24B.31, 24B.32, 24B.33, 24B.34_

  - [x] 1.5 Test ActivityDetail ButtonDropdown
    - Verify Edit mainAction navigates to edit page
    - Verify dropdown opens when arrow is clicked
    - Verify all lifecycle actions appear/disappear based on status
    - Verify "Mark Complete" updates status correctly
    - Verify "Cancel Activity" updates status correctly
    - Verify "Set Active" updates status correctly
    - Verify "Merge" opens merge modal
    - Verify "Remove" shows confirmation dialog
    - Verify "Back" button still works
    - Test keyboard navigation (Tab, Enter, Arrow keys, Escape)
    - Test on mobile viewport
    - _Requirements: 24B.17, 24B.18, 24B.19, 24B.20, 24B.21, 24B.22, 24B.23, 24B.24, 24B.25, 24B.26, 24B.28, 24B.29, 24B.30_

- [x] 2. Update ParticipantDetail component with ButtonDropdown
  - [x] 2.1 Import ButtonDropdown component
    - Add import statement for ButtonDropdown
    - _Requirements: 24B.2_

  - [x] 2.2 Create buildDropdownItems helper function
    - Create function that returns items array
    - Include "Merge" item with iconName="shrink"
    - Include "Remove" item with iconName="remove"
    - Return array of item objects
    - _Requirements: 24B.7, 24B.8, 24B.9, 24B.10_

  - [x] 2.3 Create handleItemClick handler function
    - Create function that accepts itemId string parameter
    - Implement switch statement:
      - case "merge": call setShowMergeModal(true)
      - case "delete": call setConfirmDelete(true)
      - default: log warning
    - _Requirements: 24B.19, 24B.21_

  - [x] 2.4 Replace Header actions with ButtonDropdown
    - Locate the Header component's actions prop in ParticipantDetail
    - Replace multiple buttons with ButtonDropdown pattern
    - Set mainAction to Edit
    - Set items to buildDropdownItems() result
    - Set ariaLabel="Participant actions"
    - Keep "Back to Participants" button separate
    - _Requirements: 24B.1, 24B.2, 24B.3, 24B.4, 24B.5, 24B.6, 24B.16, 24B.27, 24B.34_

  - [x] 2.5 Test ParticipantDetail ButtonDropdown
    - Verify Edit mainAction works
    - Verify Merge opens modal
    - Verify Remove shows confirmation
    - Test keyboard navigation
    - Test on mobile viewport
    - _Requirements: 24B.17, 24B.18, 24B.19, 24B.21, 24B.28, 24B.29, 24B.30_

- [x] 3. Update VenueDetail component with ButtonDropdown
  - [x] 3.1 Import ButtonDropdown component
    - Add import statement for ButtonDropdown
    - _Requirements: 24B.2_

  - [x] 3.2 Create buildDropdownItems helper function
    - Create function that returns items array
    - Include "Merge" item with iconName="shrink"
    - Include "Remove" item with iconName="remove"
    - Return array of item objects
    - _Requirements: 24B.7, 24B.8, 24B.9, 24B.10_

  - [x] 3.3 Create handleItemClick handler function
    - Create function that accepts itemId string parameter
    - Implement switch statement:
      - case "merge": call setShowMergeModal(true)
      - case "delete": call setConfirmDelete(true)
      - default: log warning
    - _Requirements: 24B.19, 24B.21_

  - [x] 3.4 Replace Header actions with ButtonDropdown
    - Locate the Header component's actions prop in VenueDetail
    - Replace multiple buttons with ButtonDropdown pattern
    - Set mainAction to Edit
    - Set items to buildDropdownItems() result
    - Set ariaLabel="Venue actions"
    - Keep "Back to Venues" button separate
    - _Requirements: 24B.1, 24B.2, 24B.3, 24B.4, 24B.5, 24B.6, 24B.16, 24B.27, 24B.34_

  - [x] 3.5 Test VenueDetail ButtonDropdown
    - Verify Edit mainAction works
    - Verify Merge opens modal
    - Verify Remove shows confirmation
    - Test keyboard navigation
    - Test on mobile viewport
    - _Requirements: 24B.17, 24B.18, 24B.19, 24B.21, 24B.28, 24B.29, 24B.30_

- [x] 4. Update GeographicAreaDetail component with ButtonDropdown
  - [x] 4.1 Import ButtonDropdown component
    - Add import statement for ButtonDropdown
    - _Requirements: 24B.2_

  - [x] 4.2 Create buildDropdownItems helper function
    - Create function that returns items array
    - Include only "Remove" item with iconName="remove"
    - Return array with single item object
    - Note: Geographic areas don't have merge functionality
    - _Requirements: 24B.7, 24B.8, 24B.9, 24B.10_

  - [x] 4.3 Create handleItemClick handler function
    - Create function that accepts itemId string parameter
    - Implement switch statement:
      - case "delete": call setConfirmDelete(true)
      - default: log warning
    - _Requirements: 24B.19_

  - [x] 4.4 Replace Header actions with ButtonDropdown
    - Locate the Header component's actions prop in GeographicAreaDetail
    - Replace multiple buttons with ButtonDropdown pattern
    - Set mainAction to Edit
    - Set items to buildDropdownItems() result
    - Set ariaLabel="Geographic area actions"
    - Keep "Back to Geographic Areas" button separate
    - _Requirements: 24B.1, 24B.2, 24B.3, 24B.4, 24B.5, 24B.6, 24B.16, 24B.27, 24B.34_

  - [x] 4.5 Test GeographicAreaDetail ButtonDropdown
    - Verify Edit mainAction works
    - Verify Remove shows confirmation
    - Test keyboard navigation
    - Test on mobile viewport
    - _Requirements: 24B.17, 24B.18, 24B.19, 24B.28, 24B.29, 24B.30_

- [x] 5. Verify consistent behavior across all detail pages
  - [x] 5.1 Test role-based visibility
    - Verify ButtonDropdown hidden for READ_ONLY role on all detail pages
    - Verify ButtonDropdown visible for EDITOR role on all detail pages
    - Verify ButtonDropdown visible for ADMINISTRATOR role on all detail pages
    - Verify "Back" button always visible regardless of role
    - _Requirements: 24B.12, 24B.13, 24B.16_

  - [x] 5.2 Test mainAction (Edit) on all detail pages
    - Click primary button area on ParticipantDetail → navigates to /participants/:id/edit
    - Click primary button area on ActivityDetail → navigates to /activities/:id/edit
    - Click primary button area on VenueDetail → navigates to /venues/:id/edit
    - Click primary button area on GeographicAreaDetail → navigates to /geographic-areas/:id/edit
    - _Requirements: 24B.3, 24B.17_

  - [x] 5.3 Test dropdown menu on all detail pages
    - Click dropdown arrow on each detail page
    - Verify menu opens with correct items
    - Verify items are ordered correctly (lifecycle, merge, delete)
    - Verify disabled states work correctly
    - _Requirements: 24B.8, 24B.11, 24B.18_

  - [x] 5.4 Test destructive actions with confirmation
    - Select "Remove" from dropdown on each detail page
    - Verify confirmation dialog appears
    - Confirm deletion → entity is deleted and navigates to list
    - Cancel deletion → dialog closes, no action taken
    - _Requirements: 24B.19_

  - [x] 5.5 Test merge action
    - Select "Merge" from dropdown on ParticipantDetail
    - Verify merge modal opens with participant pre-selected
    - Select "Merge" from dropdown on ActivityDetail
    - Verify merge modal opens with activity pre-selected
    - Select "Merge" from dropdown on VenueDetail
    - Verify merge modal opens with venue pre-selected
    - _Requirements: 24B.21_

  - [x] 5.6 Test accessibility
    - Tab to ButtonDropdown on each detail page
    - Verify focus indicator is visible
    - Press Enter → Edit action executes
    - Tab to ButtonDropdown, press Space → dropdown opens
    - Use Arrow keys to navigate items
    - Press Enter on item → action executes
    - Press Escape → dropdown closes
    - Test with screen reader (VoiceOver/NVDA)
    - Verify ARIA labels are announced correctly
    - _Requirements: 24B.27, 24B.28, 24B.29, 24B.30_

  - [x] 5.7 Test responsive behavior
    - Test on desktop viewport (1920px)
    - Test on tablet viewport (768px)
    - Test on mobile viewport (375px)
    - Verify ButtonDropdown doesn't overflow header
    - Verify dropdown menu is accessible on all viewports
    - Verify touch interactions work on mobile
    - _Requirements: 24B.32, 24B.33_

- [ ]* 6. Write property tests for ButtonDropdown on detail pages
  - **Property 279: ButtonDropdown in Header Actions**
  - **Property 280: ButtonDropdown MainAction Edit**
  - **Property 281: ButtonDropdown Items Dynamic Filtering**
  - **Property 282: ButtonDropdown Item Click Handling**
  - **Property 283: ButtonDropdown Role-Based Visibility**
  - **Property 284: ButtonDropdown Accessibility**
  - **Property 285: ButtonDropdown Back Button Positioning**
  - **Validates: Requirements 24B.1, 24B.2, 24B.3, 24B.4, 24B.5, 24B.6, 24B.7, 24B.8, 24B.9, 24B.10, 24B.11, 24B.12, 24B.13, 24B.14, 24B.15, 24B.16, 24B.17, 24B.18, 24B.19, 24B.20, 24B.21, 24B.22, 24B.23, 24B.24, 24B.25, 24B.26, 24B.27, 24B.28, 24B.29, 24B.30, 24B.31, 24B.32, 24B.33, 24B.34_
