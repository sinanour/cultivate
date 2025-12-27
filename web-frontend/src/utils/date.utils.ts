/**
 * Date formatting utilities for consistent date display across the UI.
 * All dates are rendered in ISO-8601 format (YYYY-MM-DD).
 */

/**
 * Formats a date string to ISO-8601 date format (YYYY-MM-DD).
 * Handles both full ISO-8601 datetime strings and date-only strings.
 * 
 * @param dateString - ISO-8601 datetime string (e.g., "2024-03-15T10:30:00Z") or date string (e.g., "2024-03-15")
 * @returns Formatted date string in YYYY-MM-DD format, or empty string if input is invalid
 * 
 * @example
 * formatDate("2024-03-15T10:30:00Z") // Returns "2024-03-15"
 * formatDate("2024-03-15") // Returns "2024-03-15"
 * formatDate("") // Returns ""
 * formatDate(null) // Returns ""
 * formatDate(undefined) // Returns ""
 */
export function formatDate(dateString: string | null | undefined): string {
    if (!dateString) return '';

    // Extract date portion from ISO-8601 string (YYYY-MM-DD)
    // This handles both "2024-03-15T10:30:00Z" and "2024-03-15" formats
    return dateString.split('T')[0];
}
