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

- [x] 4. Investigate and fix "Activities at Start" metric calculation
  - Issue with ongoing activities that started before the analysis period
  - Metric appears to be calculated incorrectly in these scenarios
  - Requires investigation and correction

- [x] 5. Simplify activities chart on Engagement Dashboard
  - Show only activity counts at start and end of period
  - Remove cancelled, started, and completed counts from this chart
  - Keep visualization focused on net change

- [x] 6. Add new chart for activity lifecycle events
  - Create separate chart showing activities started and completed
  - Include toggle to render by activity category or activity type
  - Similar pattern to existing activity chart

- [x] 7. Remove date-based grouping from Engagement Dashboard
  - Remove date grouping dimension from multi-dimensional grouping controls
  - Remove date granularity options (weekly, monthly, quarterly, yearly)
  - Keep date range picker for filtering only
  - Dates should only be used to filter the time period, not as a grouping dimension
  - Simplifies the UI and focuses on entity-based grouping (category, type, venue, geographic area)
  - Solution: Removed Date option from grouping dimensions multiselect, removed date granularity Select component, removed dateGranularity from state and API calls

- [ ] 8. Fix broken links for Activity Category and Activity Type on Engagement Dashboard
  - Issue: When grouping by activity category or activity type, the hyperlinked names in the Engagement Summary table are broken
  - Root cause: No detail pages exist for activity categories or activity types
  - Solution: Update links to navigate to /configuration (Activity Configuration page) instead
  - Provides consistent navigation experience
  - Users can view and edit categories/types on the Configuration page

## Navigation & UI Organization

- [x] 9. Reorder management views in navigation
  - Update order in main dashboard quick links
  - Update order in side-panel navigation
  - New order: Geographic Areas, Venues, Activities, Participants

## Filtering & Search

- [x] 10. Replace Engagement Dashboard filters with PropertyFilter component
  - Current activity type and venue filters are not working/populating
  - Replace with single CloudScape PropertyFilter component
  - Include Activity Category as a filterable property
  - Implement lazy loading of property values (similar to AsyncEntitySelect)

## Data Entry & Forms

- [x] 11. Fix venue name rendering in create modals
  - Issue: When assigning venue to address history (create participant) or venue history (create activity), newly-associated venue name doesn't render
  - Root cause: Parent entity not fully created when venue association occurs
  - Solution: Fetch venue details when venue is selected and store in temporary record for display

## User Administration

- [x] 12. Fix User Administration page integration
  - Page doesn't list any users
  - Create workflow fails
  - Backend integration appears broken
  - Solution: Created missing backend user service, routes, and repository methods
  - Implemented GET /api/v1/users, POST /api/v1/users, and PUT /api/v1/users/:id endpoints
  - All endpoints restricted to ADMINISTRATOR role only

## Entity Management

- [ ] 13. Add Delete button to all entity detail pages
  - Applies to: Participants, Venues, Activities, Geographic Areas, etc.
  - Position: Next to Edit button
  - Style: Red color to indicate destructive action

## Import/Export

- [ ] 14. Implement CSV import/export functionality
  - Applies to: Participants, Venues, Activities, Geographic Areas
  - Import CTA should be available on each entity list page
  - Export CTA should be available on each entity list page
  - Export should generate empty CSV with proper column structure when no records exist
  - Helps users understand required format for imports

## Data Model Enhancements

- [ ] 15. Enhance Participant entity with additional optional fields
  - Make email address optional/nullable (currently required)
  - Add dateOfBirth attribute (nullable/optional)
  - Add dateOfRegistration attribute (nullable/optional)
  - Add nickname attribute (nullable/optional)
  - Update database schema (Prisma migration)
  - Update backend validation schemas and service logic
  - Update frontend forms and display components
  - Update API contract documentation
  - Ensure backward compatibility with existing data

## UI/UX Improvements

- [ ] 16. Make Activity Categories clickable in Activity Type list
  - On the Activity Configuration page, the Activity Category column in the Activity Type list should be clickable
  - Clicking an activity category name should open the edit form for that category
  - Provides quick access to edit categories without scrolling to the categories section
  - Use CloudScape Link component for consistent styling
  - Similar to how primary columns are hyperlinked in other tables

---

## Notes

- Items are numbered sequentially based on document order
- Priority and dependencies should be assessed before implementation
- Some items may require spec updates before implementation
