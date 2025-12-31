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

- [x] 8. Fix broken links for Activity Category and Activity Type on Engagement Dashboard
  - Issue: When grouping by activity category or activity type, the hyperlinked names in the Engagement Summary table are broken
  - Root cause: No detail pages exist for activity categories or activity types
  - Solution: Updated links to navigate to /configuration (Activity Configuration page) instead
  - Provides consistent navigation experience
  - Users can view and edit categories/types on the Configuration page

- [x] 9. Filter map view legend to show only visible items
  - Issue: Map legend shows all activity categories/types, even those not currently displayed on the map
  - Problem: Legend becomes verbose and colors may not match actual map pins when filters are applied
  - Solution: Dynamically generate legend based on activities/categories actually rendered on the map
  - Filter legend items to match current map data after applying all filters
  - Ensures legend colors accurately correspond to visible map pins
  - Improves map readability and user experience
  - Implementation: Added filtering logic to extract visible type/category IDs from markers, then filter legend items accordingly

## Navigation & UI Organization

- [x] 10. Reorder management views in navigation
  - Update order in main dashboard quick links
  - Update order in side-panel navigation
  - New order: Geographic Areas, Venues, Activities, Participants

## Filtering & Search

- [x] 11. Replace Engagement Dashboard filters with PropertyFilter component
  - Current activity type and venue filters are not working/populating
  - Replace with single CloudScape PropertyFilter component
  - Include Activity Category as a filterable property
  - Implement lazy loading of property values (similar to AsyncEntitySelect)

## Data Entry & Forms

- [x] 12. Fix venue name rendering in create modals
  - Issue: When assigning venue to address history (create participant) or venue history (create activity), newly-associated venue name doesn't render
  - Root cause: Parent entity not fully created when venue association occurs
  - Solution: Fetch venue details when venue is selected and store in temporary record for display

## User Administration

- [x] 13. Fix User Administration page integration
  - Page doesn't list any users
  - Create workflow fails
  - Backend integration appears broken
  - Solution: Created missing backend user service, routes, and repository methods
  - Implemented GET /api/v1/users, POST /api/v1/users, and PUT /api/v1/users/:id endpoints
  - All endpoints restricted to ADMINISTRATOR role only

## Entity Management

- [x] 14. Add Delete button to all entity detail pages
  - Applies to: Participants, Venues, Activities, Geographic Areas
  - Position: Next to Edit button
  - Solution: Added delete buttons to all detail page headers
  - Buttons show confirmation dialog before deletion
  - Navigate to list page on success, display error on failure
  - Hidden from READ_ONLY users, visible to EDITOR and ADMINISTRATOR

- [x] 15. Filter venue participants to show only current residents
  - Issue: Venue detail page shows all participants who have ever lived at the venue (historical)
  - Expected: Should only show participants whose current home address is at this venue
  - Solution: Updated backend VenueRepository.findParticipants() to filter by most recent address history record
  - Implementation: Fetches all participants with address history, filters to those whose most recent record matches the venue
  - Ensures participant list reflects current residents only, not historical residents
  - Improves data accuracy and relevance on venue detail pages

## Import/Export

- [x] 16. Implement CSV import/export functionality
  - Applies to: Participants, Venues, Activities, Geographic Areas
  - Import CTA should be available on each entity list page
  - Export CTA should be available on each entity list page
  - Export should generate empty CSV with proper column structure when no records exist
  - Helps users understand required format for imports

## Data Model Enhancements

- [x] 17. Enhance Participant entity with additional optional fields
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

- [x] 18. Make Activity Category names clickable in Activity Categories list
  - On the Activity Configuration page, the Activity Category names in the Activity Categories list should be clickable
  - Clicking an activity category name should open the edit form for that category
  - Provides quick access to edit categories directly from the name column
  - Use CloudScape Link component for consistent styling
  - Similar to how primary columns are hyperlinked in other tables

---

## Notes

- Items are numbered sequentially based on document order
- Priority and dependencies should be assessed before implementation
- Some items may require spec updates before implementation
