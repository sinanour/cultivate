# TODO List

This document tracks outstanding features, improvements, and bug fixes for the Community Activity Tracker application.

## Dashboard & Analytics

- [x] 1. Add activity category as a dimension for grouping statistics on the Engagement Dashboard
  - Activity category should be available alongside activity type for statistical analysis

- [x] 2. Rename and enhance "Activities by Type" chart on Engagement Dashboard
  - Rename chart from "Activities by Type" to "Activities"
  - Add segmented control to toggle between activity type and activity category views
  - Similar UX pattern to the map view toggle functionality

- [x] 3. Fix Geographic Breakdown chart to show only leaf nodes
  - Chart should only render leaf-node geographic areas (areas without child areas)
  - Prevents double-counting and provides clearer geographic distribution

- [ ] 4. Investigate and fix "Activities at Start" metric calculation
  - Issue with ongoing activities that started before the analysis period
  - Metric appears to be calculated incorrectly in these scenarios
  - Requires investigation and correction

- [ ] 5. Simplify activities chart on Engagement Dashboard
  - Show only activity counts at start and end of period
  - Remove cancelled, started, and completed counts from this chart
  - Keep visualization focused on net change

- [ ] 6. Add new chart for activity lifecycle events
  - Create separate chart showing activities started and completed
  - Include toggle to render by activity category or activity type
  - Similar pattern to existing activity chart

## Navigation & UI Organization

- [ ] 7. Reorder management views in navigation
  - Update order in main dashboard quick links
  - Update order in side-panel navigation
  - New order: Geographic Areas, Venues, Activities, Participants

## Filtering & Search

- [ ] 8. Replace Engagement Dashboard filters with PropertyFilter component
  - Current activity type and venue filters are not working/populating
  - Replace with single CloudScape PropertyFilter component
  - Include Activity Category as a filterable property
  - Implement lazy loading of property values (similar to AsyncEntitySelect)

## Data Entry & Forms

- [ ] 9. Fix venue name rendering in create modals
  - Issue: When assigning venue to address history (create participant) or venue history (create activity), newly-associated venue name doesn't render
  - Root cause: Parent entity not fully created when venue association occurs
  - Need solution to handle this scenario gracefully

## User Administration

- [ ] 10. Fix User Administration page integration
  - Page doesn't list any users
  - Create workflow fails
  - Backend integration appears broken
  - Investigate and fix both list and create functionality

## Entity Management

- [ ] 11. Add Delete button to all entity detail pages
  - Applies to: Participants, Venues, Activities, Geographic Areas, etc.
  - Position: Next to Edit button
  - Style: Red color to indicate destructive action

## Import/Export

- [ ] 12. Implement CSV import/export functionality
  - Applies to: Participants, Venues, Activities, Geographic Areas
  - Import CTA should be available on each entity list page
  - Export CTA should be available on each entity list page
  - Export should generate empty CSV with proper column structure when no records exist
  - Helps users understand required format for imports

---

## Notes

- Items are numbered sequentially based on document order
- Priority and dependencies should be assessed before implementation
- Some items may require spec updates before implementation
