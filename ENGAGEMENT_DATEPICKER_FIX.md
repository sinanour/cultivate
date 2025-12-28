# Engagement DateRangePicker Fix

## Issues Identified

1. **Uninitialized DateRangePicker**: The component was initialized with `null`, showing only placeholder text instead of a default date range
2. **Date Format Mismatch**: The DateRangePicker returns dates in `YYYY-MM-DD` format, but the backend API expects ISO 8601 datetime format (e.g., `2025-12-27T00:00:00.000Z`)
3. **Missing Relative Options**: The DateRangePicker had no relative date options for quick selection

## Changes Made

### 1. Default Date Range Initialization
- Added `getDefaultDateRange()` function that initializes the picker with the last 30 days
- Changed state type from `{ startDate: string; endDate: string } | null` to `DateRangePickerProps.Value`
- Component now displays a pre-selected date range on load

### 2. Date Format Conversion
- Added `toISODateTime()` helper function to convert `YYYY-MM-DD` to ISO datetime strings
- Start dates are set to beginning of day (00:00:00.000)
- End dates are set to end of day (23:59:59.999)
- Conversion happens in the `queryFn` before making API calls

### 3. Enhanced DateRangePicker Configuration
- Added relative date options: Last 7, 30, and 90 days
- Added comprehensive i18n strings for better UX
- Simplified onChange handler to directly use `detail.value`

## Result

The DateRangePicker now:
- ✅ Displays a default date range (last 30 days) on page load
- ✅ Properly converts dates to ISO datetime format for backend API calls
- ✅ Filters engagement metrics based on the selected date range
- ✅ Provides quick relative date options for common use cases
- ✅ Works seamlessly with the existing geographic area filter
