# Implementation Plan: Map Loading Indeterminate Mode

## Overview

This implementation enhances the ProgressIndicator component to support both indeterminate and determinate loading modes. The component will display a Spinner when the total count is unknown and transition to a ProgressBar once the total count becomes available. All existing pause/resume functionality will be preserved in both modes.

## Tasks

- [x] 1. Update ProgressIndicator component imports and structure
  - Add Spinner and Box imports from CloudScape components
  - Update component to handle mode determination logic
  - _Requirements: 1.1, 5.2_

- [x] 2. Implement indeterminate mode rendering
  - [x] 2.1 Add mode determination logic based on totalCount
    - Implement function to determine 'indeterminate' vs 'determinate' mode
    - Update component logic to use mode for conditional rendering
    - _Requirements: 1.1, 5.2, 5.3, 5.4_
  
  - [x] 2.2 Implement indeterminate mode UI with Spinner
    - Render Spinner component when in indeterminate mode and not paused
    - Display "Loading {entityName}..." text when active
    - Display "Loading paused" text when paused
    - Hide Spinner when paused
    - _Requirements: 1.2, 1.3, 3.3, 3.4_
  
  - [x]* 2.3 Write property test for mode determination
    - **Property 1: Mode determination based on total count**
    - **Validates: Requirements 1.1, 2.1, 5.2, 5.3, 5.4**
  
  - [x]* 2.4 Write property test for indeterminate mode display
    - **Property 2: Indeterminate mode displays animation without counts**
    - **Validates: Requirements 1.2, 1.3**
  
  - [x]* 2.5 Write property test for animation state
    - **Property 6: Animation state reflects pause status**
    - **Validates: Requirements 3.3, 3.4**

- [x] 3. Update determinate mode rendering
  - [x] 3.1 Ensure determinate mode uses existing ProgressBar logic
    - Verify ProgressBar renders when totalCount > 0
    - Ensure percentage calculation remains correct
    - Maintain existing count display format
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [x]* 3.2 Write property test for determinate mode display
    - **Property 3: Determinate mode displays progress with counts**
    - **Validates: Requirements 2.2, 2.3**

- [x] 4. Implement component lifecycle logic
  - [x] 4.1 Update unmount condition to handle both modes
    - Ensure component unmounts when loadedCount >= totalCount AND totalCount > 0
    - Ensure component renders when totalCount = 0 (indeterminate mode)
    - Update render condition to support immediate display
    - _Requirements: 1.4, 4.1, 4.3, 4.4_
  
  - [x]* 4.2 Write property test for component rendering
    - **Property 4: Component renders during active loading**
    - **Validates: Requirements 1.4**
  
  - [x]* 4.3 Write property test for component unmounting
    - **Property 8: Component unmounts on completion**
    - **Validates: Requirements 4.1, 4.4**

- [x] 5. Ensure pause/resume functionality works in both modes
  - [x] 5.1 Verify pause/resume buttons work in indeterminate mode
    - Ensure button renders with correct icon in both modes
    - Ensure onCancel callback fires when pause clicked
    - Ensure onResume callback fires when resume clicked
    - Update button aria-labels for both modes
    - _Requirements: 3.1, 3.2, 3.5_
  
  - [x]* 5.2 Write property test for pause/resume buttons
    - **Property 5: Pause and resume buttons present in both modes**
    - **Validates: Requirements 3.1, 3.2, 3.5**
  
  - [x]* 5.3 Write property test for paused state UI
    - **Property 7: Paused state displays appropriate UI**
    - **Validates: Requirements 4.2**

- [x] 6. Ensure consistent layout and styling
  - [x] 6.1 Verify SpaceBetween container structure in both modes
    - Ensure both modes use SpaceBetween with direction="horizontal" and size="xs"
    - Verify Box component usage for proper alignment in indeterminate mode
    - Maintain consistent spacing between button and progress indicator
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [x]* 6.2 Write property test for layout consistency
    - **Property 9: Consistent layout structure across modes**
    - **Validates: Requirements 6.3**

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Update existing unit tests
  - [x] 8.1 Update test for totalCount = 0 behavior
    - Change expectation from "should not render" to "should render in indeterminate mode"
    - Add assertions for Spinner presence
    - Add assertions for indeterminate mode text
    - _Requirements: 1.1, 1.2_
  
  - [x] 8.2 Add unit tests for mode transitions
    - Test transition from indeterminate to determinate mode
    - Test that transition is smooth without flickering
    - Test edge case of totalCount changing from positive to zero
    - _Requirements: 2.1, 2.4_
  
  - [x] 8.3 Add unit tests for pause/resume in indeterminate mode
    - Test pause button click in indeterminate mode
    - Test resume button click in indeterminate mode
    - Test Spinner visibility based on pause state
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  
  - [x] 8.4 Add unit tests for edge cases
    - Test negative counts (treat as 0)
    - Test loadedCount exceeding totalCount
    - Test completion during indeterminate mode
    - _Requirements: 4.1, 4.3_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties across all possible loading states
- Unit tests validate specific examples, mode transitions, and edge cases
- The design uses TypeScript with React and CloudScape components
- No changes required to MapViewPage or MapView.optimized components
