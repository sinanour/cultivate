# Implementation Plan: Mobile Responsive Design

## Overview

This implementation plan adds mobile responsiveness to the Web Frontend package, supporting smartphone devices in portrait orientation (320px to 767px width). The implementation uses CSS media queries, responsive React components, and custom hooks to provide a mobile-optimized experience while preserving the existing desktop and tablet layouts.

## Tasks

- [x] 1. Set up mobile responsive foundation
  - [x] 1.1 Add viewport meta tag to index.html
    - Add `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">`
    - Verify proper mobile rendering in browser dev tools
    - _Requirements: 1.6_

  - [x] 1.2 Create useMediaQuery custom hook
    - Create `web-frontend/src/hooks/useMediaQuery.ts`
    - Implement hook with window.matchMedia API
    - Add event listener for media query changes
    - Clean up listener on unmount
    - Export hook for use in components
    - _Requirements: 1.5_

  - [x] 1.3 Create responsive utilities and constants
    - Create `web-frontend/src/utils/responsive.ts`
    - Define BREAKPOINTS constant with mobile, tablet, desktop, tabletAndUp queries
    - Export breakpoint constants for consistent usage
    - _Requirements: 1.5_

  - [ ]* 1.4 Write property tests for useMediaQuery hook
    - **Property 270: Media Query Hook Reactivity**
    - **Property 271: Media Query Hook Cleanup**
    - **Validates: Requirements 1.5**

- [x] 2. Implement mobile navigation pattern
  - [x] 2.1 Update AppLayout component for mobile navigation
    - Import useMediaQuery hook
    - Detect mobile viewport using BREAKPOINTS.mobile
    - Set navigationOpen to false by default on mobile
    - Set navigationWidth to 280px on mobile, 320px on desktop
    - Implement auto-close navigation after menu item selection on mobile
    - Preserve existing always-visible navigation on desktop/tablet
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 2.2 Create mobile navigation styles
    - Create `web-frontend/src/components/layout/AppLayout.mobile.module.css`
    - Add mobile nav toggle button styles (min 44x44px touch target)
    - Add navigation overlay styles for mobile
    - Use @media (max-width: 767px) for mobile-specific styles
    - _Requirements: 2.2, 2.6_

  - [ ]* 2.3 Write property tests for mobile navigation
    - **Property 272: Mobile Navigation Collapsed by Default**
    - **Property 273: Mobile Navigation Auto-Close on Selection**
    - **Property 274: Mobile Navigation Touch Target Size**
    - **Property 275: Desktop Navigation Always Visible**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**

- [x] 3. Implement mobile header and filter layout
  - [x] 3.1 Create mobile header styles
    - Create mobile styles in `AppLayout.mobile.module.css`
    - Stack header elements vertically on mobile
    - Make filter container full-width with appropriate padding
    - Ensure all header buttons meet 44x44px touch target size
    - Maintain sticky header behavior on mobile
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 Update GeographicAreaFilterSelector for mobile
    - Import useMediaQuery hook
    - Apply mobile-specific container class on mobile viewports
    - Make selector full-width on mobile
    - Preserve existing horizontal layout on desktop/tablet
    - _Requirements: 3.2, 3.6_

  - [ ]* 3.3 Write property tests for mobile header
    - **Property 276: Mobile Header Vertical Stacking**
    - **Property 277: Mobile Filter Full Width**
    - **Property 278: Mobile Header Touch Targets**
    - **Property 279: Mobile Header Sticky Behavior**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

- [-] 4. Implement mobile table layouts (card-based)
  - [x] 4.1 Create ResponsiveTable component
    - Create `web-frontend/src/components/common/ResponsiveTable.tsx`
    - Accept items, columns, mobileCardRenderer, onItemClick props
    - Use useMediaQuery to detect mobile viewport
    - Render CloudScape Table on desktop/tablet
    - Render card-based layout on mobile using mobileCardRenderer
    - _Requirements: 4.1, 4.2, 4.3, 4.5_

  - [x] 4.2 Create mobile card styles
    - Create `web-frontend/src/components/common/ResponsiveTable.mobile.module.css`
    - Style mobile card list with vertical stacking
    - Style individual cards with proper spacing and borders
    - Add card header, details, and actions sections
    - Ensure action buttons meet 44x44px touch target size
    - Add active state for touch feedback
    - _Requirements: 4.2, 4.3, 4.6_

  - [ ] 4.3 Update ParticipantList with mobile cards
    - Import ResponsiveTable component
    - Create renderMobileCard function for participants
    - Display name, email, phone, populations in card
    - Add View and Edit action buttons
    - Replace existing Table with ResponsiveTable
    - _Requirements: 4.7_

  - [ ] 4.4 Update ActivityList with mobile cards
    - Import ResponsiveTable component
    - Create renderMobileCard function for activities
    - Display name, type, category, dates, status in card
    - Add View and Edit action buttons
    - Replace existing Table with ResponsiveTable
    - _Requirements: 4.7_

  - [ ] 4.5 Update VenueList with mobile cards
    - Import ResponsiveTable component
    - Create renderMobileCard function for venues
    - Display name, address, geographic area in card
    - Add View and Edit action buttons
    - Replace existing Table with ResponsiveTable
    - _Requirements: 4.7_

  - [ ] 4.6 Update GeographicAreaList with mobile cards
    - Import ResponsiveTable or create custom mobile tree view
    - Adapt hierarchical tree view for mobile
    - Ensure expansion affordances are touch-friendly
    - Maintain tree structure on mobile
    - _Requirements: 4.7_

  - [ ]* 4.7 Write property tests for mobile tables
    - **Property 280: Mobile Card Layout Rendering**
    - **Property 281: Desktop Table Layout Preservation**
    - **Property 282: Mobile Card Touch Targets**
    - **Property 283: Mobile Card Content Display**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7**

- [-] 5. Implement mobile form layouts
  - [x] 5.1 Create ResponsiveFormContainer component
    - Create `web-frontend/src/components/common/ResponsiveFormContainer.tsx`
    - Use useMediaQuery to detect mobile viewport
    - Apply mobile or desktop class based on viewport
    - Wrap form content with appropriate container
    - _Requirements: 5.1, 5.7_

  - [x] 5.2 Create mobile form styles
    - Create `web-frontend/src/components/common/ResponsiveFormContainer.mobile.module.css`
    - Stack form fields vertically on mobile
    - Make all inputs full-width on mobile
    - Style form sections with appropriate spacing
    - Create sticky form actions bar at bottom on mobile
    - Make form buttons full-width on mobile (min 44px height)
    - Add venue form specific styles (map below fields on mobile)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ] 5.3 Update ParticipantFormPage with mobile layout
    - Wrap form content with ResponsiveFormContainer
    - Verify all fields stack vertically on mobile
    - Test address history section on mobile
    - Test population membership section on mobile
    - _Requirements: 5.8_

  - [ ] 5.4 Update ActivityFormPage with mobile layout
    - Wrap form content with ResponsiveFormContainer
    - Verify all fields stack vertically on mobile
    - Test venue history section on mobile
    - Test participant assignments section on mobile
    - _Requirements: 5.8_

  - [x] 5.5 Update VenueFormPage with mobile layout
    - Wrap form content with ResponsiveFormContainer
    - Verify form fields stack vertically on mobile
    - Ensure map displays full-width below fields on mobile
    - Test geocoding controls on mobile
    - _Requirements: 5.4, 5.5, 5.8_

  - [ ] 5.6 Update GeographicAreaFormPage with mobile layout
    - Wrap form content with ResponsiveFormContainer
    - Verify all fields stack vertically on mobile
    - Test parent area selector on mobile
    - _Requirements: 5.8_

  - [ ] 5.7 Update UserFormPage with mobile layout
    - Wrap form content with ResponsiveFormContainer
    - Verify all fields stack vertically on mobile
    - Test geographic authorization section on mobile
    - _Requirements: 5.8_

  - [ ]* 5.8 Write property tests for mobile forms
    - **Property 284: Mobile Form Vertical Stacking**
    - **Property 285: Mobile Form Full-Width Inputs**
    - **Property 286: Mobile Form Button Touch Targets**
    - **Property 287: Mobile Venue Form Map Positioning**
    - **Property 288: Desktop Form Layout Preservation**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8**

- [x] 6. Implement mobile FilterGroupingPanel layout
  - [x] 6.1 Update FilterGroupingPanel component for mobile
    - Import useMediaQuery hook
    - Detect mobile viewport
    - Apply mobile or desktop layout class
    - Stack all filter components vertically on mobile
    - Make DateRangePicker full-width on mobile
    - Make PropertyFilter full-width on mobile
    - Make grouping controls full-width on mobile
    - Stack action buttons vertically on mobile
    - Make action buttons full-width on mobile
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 6.2 Create mobile FilterGroupingPanel styles
    - Create `web-frontend/src/components/common/FilterGroupingPanel.mobile.module.css`
    - Style mobile layout with vertical flex direction
    - Add appropriate gaps between sections
    - Style filter row, grouping row, action row for mobile
    - Ensure all buttons meet 44px minimum height
    - Preserve existing horizontal layout on desktop/tablet
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [ ]* 6.3 Write property tests for mobile FilterGroupingPanel
    - **Property 289: Mobile FilterGroupingPanel Vertical Layout**
    - **Property 290: Mobile FilterGroupingPanel Full-Width Components**
    - **Property 291: Mobile FilterGroupingPanel Button Stacking**
    - **Property 292: Desktop FilterGroupingPanel Layout Preservation**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7**

- [ ] 7. Implement mobile dashboard layouts
  - [ ] 7.1 Create ResponsiveDashboard component
    - Create `web-frontend/src/components/common/ResponsiveDashboard.tsx`
    - Use useMediaQuery to detect mobile viewport
    - Apply mobile or desktop class based on viewport
    - Wrap dashboard content with appropriate container
    - _Requirements: 7.6_

  - [ ] 7.2 Create mobile dashboard styles
    - Create `web-frontend/src/components/common/ResponsiveDashboard.mobile.module.css`
    - Stack charts vertically on mobile
    - Make all charts full-width on mobile
    - Style metrics grid as single column on mobile
    - Add horizontal scroll for summary table on mobile
    - Reduce legend font size on mobile
    - Preserve multi-column layout on desktop/tablet
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [ ] 7.3 Update EngagementDashboard with mobile layout
    - Wrap dashboard content with ResponsiveDashboard
    - Verify charts stack vertically on mobile
    - Test FilterGroupingPanel on mobile
    - Test Engagement Summary table on mobile
    - Test all charts render correctly on mobile
    - _Requirements: 7.7_

  - [ ] 7.4 Update GrowthDashboard with mobile layout
    - Wrap dashboard content with ResponsiveDashboard
    - Verify charts stack vertically on mobile
    - Test FilterGroupingPanel on mobile
    - Test time-series charts on mobile
    - _Requirements: 7.7_

  - [ ]* 7.5 Write property tests for mobile dashboards
    - **Property 293: Mobile Dashboard Vertical Chart Stacking**
    - **Property 294: Mobile Dashboard Full-Width Charts**
    - **Property 295: Mobile Dashboard Table Scrolling**
    - **Property 296: Desktop Dashboard Layout Preservation**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7**

- [ ] 8. Implement mobile map view
  - [ ] 8.1 Update MapView component for mobile
    - Import useMediaQuery hook
    - Detect mobile viewport
    - Apply mobile or desktop container class
    - Stack map filters vertically on mobile
    - Make map full-width on mobile
    - Position legend appropriately for mobile
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ] 8.2 Create mobile map styles
    - Create `web-frontend/src/components/features/MapView.mobile.module.css`
    - Style mobile map container with flex column layout
    - Make map wrapper fill available height
    - Position legend as overlay at bottom on mobile
    - Style map controls for touch interaction
    - Ensure map markers are appropriately sized for touch
    - Preserve existing map layout on desktop/tablet
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ]* 8.3 Write property tests for mobile map
    - **Property 297: Mobile Map Full-Width Layout**
    - **Property 298: Mobile Map Filter Vertical Stacking**
    - **Property 299: Mobile Map Legend Positioning**
    - **Property 300: Mobile Map Touch Target Sizes**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6**

- [ ] 9. Implement mobile detail views
  - [ ] 9.1 Create ResponsiveDetailView component
    - Create `web-frontend/src/components/common/ResponsiveDetailView.tsx`
    - Use useMediaQuery to detect mobile viewport
    - Apply mobile or desktop class based on viewport
    - Wrap detail view content with appropriate container
    - _Requirements: 9.4_

  - [ ] 9.2 Create mobile detail view styles
    - Create `web-frontend/src/components/common/ResponsiveDetailView.mobile.module.css`
    - Stack detail sections vertically on mobile
    - Style action buttons for mobile (full-width or appropriate touch size)
    - Style related entity lists for mobile
    - Add appropriate padding and spacing
    - Preserve existing detail layout on desktop/tablet
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ] 9.3 Update ParticipantDetail with mobile layout
    - Wrap content with ResponsiveDetailView
    - Verify sections stack vertically on mobile
    - Test action buttons on mobile
    - Test activity list on mobile
    - Test address history on mobile
    - _Requirements: 9.5_

  - [ ] 9.4 Update ActivityDetail with mobile layout
    - Wrap content with ResponsiveDetailView
    - Verify sections stack vertically on mobile
    - Test action buttons on mobile
    - Test participant list on mobile
    - Test venue history on mobile
    - _Requirements: 9.5_

  - [ ] 9.5 Update VenueDetail with mobile layout
    - Wrap content with ResponsiveDetailView
    - Verify sections stack vertically on mobile
    - Test action buttons on mobile
    - Test activity list on mobile
    - Test participant list on mobile
    - _Requirements: 9.5_

  - [ ] 9.6 Update GeographicAreaDetail with mobile layout
    - Wrap content with ResponsiveDetailView
    - Verify sections stack vertically on mobile
    - Test action buttons on mobile
    - Test child areas list on mobile
    - Test venue list on mobile
    - _Requirements: 9.5_

  - [ ]* 9.7 Write property tests for mobile detail views
    - **Property 301: Mobile Detail View Vertical Stacking**
    - **Property 302: Mobile Detail View Action Button Sizing**
    - **Property 303: Mobile Detail View List Readability**
    - **Property 304: Desktop Detail View Layout Preservation**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5**

- [x] 10. Implement mobile typography and spacing
  - [x] 10.1 Create global mobile typography styles
    - Create `web-frontend/src/styles/mobile-typography.css`
    - Set minimum 16px font size for body text on mobile
    - Adjust heading sizes for mobile readability
    - Ensure text doesn't overflow containers
    - Import in main index.css
    - _Requirements: 10.1, 10.5_

  - [x] 10.2 Create global mobile spacing utilities
    - Create `web-frontend/src/styles/mobile-spacing.css`
    - Define minimum 8px spacing between interactive elements
    - Define minimum 16px padding around content
    - Create utility classes for common spacing patterns
    - Import in main index.css
    - _Requirements: 10.2, 10.3_

  - [x] 10.3 Apply mobile spacing to all components
    - Review all components for adequate mobile spacing
    - Apply spacing utilities where needed
    - Ensure consistent spacing across application
    - Preserve existing spacing on desktop/tablet
    - _Requirements: 10.2, 10.3, 10.4_

  - [ ]* 10.4 Write property tests for mobile typography and spacing
    - **Property 305: Mobile Typography Minimum Font Size**
    - **Property 306: Mobile Interactive Element Spacing**
    - **Property 307: Mobile Content Padding**
    - **Property 308: Mobile Text Overflow Prevention**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5**

- [ ] 11. Testing and validation
  - [ ] 11.1 Set up device testing environment
    - Configure browser dev tools for mobile testing
    - Set up device emulators (iPhone SE, iPhone 12, Samsung Galaxy S21, Google Pixel 5)
    - Prepare real devices for testing if available
    - _Requirements: All_

  - [ ] 11.2 Test navigation on mobile devices
    - Test hamburger menu open/close
    - Test navigation between pages
    - Test auto-close after selection
    - Verify touch target sizes
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ] 11.3 Test forms on mobile devices
    - Test participant form creation and editing
    - Test activity form creation and editing
    - Test venue form with map interaction
    - Test geographic area form
    - Test user form
    - Verify no horizontal scrolling
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

  - [ ] 11.4 Test lists on mobile devices
    - Test participant list with mobile cards
    - Test activity list with mobile cards
    - Test venue list with mobile cards
    - Test geographic area list/tree
    - Verify card interactions
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ] 11.5 Test filters on mobile devices
    - Test FilterGroupingPanel on all pages
    - Test date range picker on mobile
    - Test property filter on mobile
    - Test grouping controls on mobile
    - Verify button interactions
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [ ] 11.6 Test dashboards on mobile devices
    - Test engagement dashboard on mobile
    - Test growth dashboard on mobile
    - Verify chart rendering
    - Test table scrolling
    - Verify filter interactions
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ] 11.7 Test map view on mobile devices
    - Test map rendering on mobile
    - Test map controls and interactions
    - Test marker clicks and popups
    - Test legend display
    - Test filter controls
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ] 11.8 Test detail views on mobile devices
    - Test participant detail on mobile
    - Test activity detail on mobile
    - Test venue detail on mobile
    - Test geographic area detail on mobile
    - Verify action buttons
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ] 11.9 Perform cross-browser testing
    - Test on Mobile Safari (iOS 14+)
    - Test on Chrome Mobile (Android 10+)
    - Test on Samsung Internet (14+)
    - Document any browser-specific issues
    - _Requirements: All_

  - [ ] 11.10 Validate accessibility on mobile
    - Test with screen readers on mobile
    - Verify keyboard navigation on mobile browsers
    - Check focus indicators
    - Validate WCAG 2.1 AA compliance
    - _Requirements: 1.7, All_

  - [ ] 11.11 Measure performance on mobile
    - Test page load times on 3G network
    - Measure bundle size increase
    - Profile rendering performance
    - Optimize if needed
    - _Requirements: Performance requirements_

- [ ] 12. Documentation and polish
  - [ ] 12.1 Update component documentation
    - Document mobile-specific props and behavior
    - Add mobile usage examples
    - Update component README files
    - _Requirements: All_

  - [ ] 12.2 Create mobile testing guide
    - Document mobile testing procedures
    - List supported devices and browsers
    - Provide troubleshooting tips
    - _Requirements: All_

  - [ ] 12.3 Update user documentation
    - Add mobile usage section to user guide
    - Include mobile screenshots
    - Document mobile-specific features
    - _Requirements: All_

  - [ ] 12.4 Final bug fixes and polish
    - Address any issues found during testing
    - Refine touch interactions
    - Optimize spacing and typography
    - Ensure consistent experience across devices
    - _Requirements: All_

## Testing Strategy

### Unit Tests
- Test useMediaQuery hook with different viewport sizes
- Test responsive component rendering logic
- Test mobile-specific event handlers

### Integration Tests
- Test navigation flow on mobile
- Test form submission on mobile
- Test filter application on mobile
- Test data loading and display on mobile

### Visual Regression Tests
- Capture screenshots at mobile breakpoints
- Compare against baseline images
- Detect unintended layout changes

### Manual Testing
- Test on real devices (iPhone, Android)
- Test with different screen sizes
- Test touch interactions
- Test in different browsers

### Accessibility Testing
- Test with mobile screen readers (VoiceOver, TalkBack)
- Test keyboard navigation on mobile browsers
- Validate touch target sizes
- Check color contrast ratios

## Success Criteria

- [ ] Zero horizontal scrolling on mobile viewports (320px to 767px)
- [ ] All interactive elements meet minimum 44x44px touch target size
- [ ] Mobile page load time under 3 seconds on 3G networks
- [ ] No regression in desktop/tablet experience
- [ ] WCAG 2.1 AA compliance maintained on mobile
- [ ] All automated tests passing
- [ ] Manual testing completed on target devices
- [ ] User acceptance testing completed with positive feedback
