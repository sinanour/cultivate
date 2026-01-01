/**
 * Trigger browser download of a blob
 */
export function downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}

/**
 * Validate CSV file before upload
 */
export function validateCSVFile(file: File): { valid: boolean; error?: string } {
    if (!file.name.endsWith('.csv')) {
        return { valid: false, error: 'File must be a CSV (.csv extension)' };
    }

    if (file.size > 10 * 1024 * 1024) {
        return { valid: false, error: 'File size must be less than 10MB' };
    }

    return { valid: true };
}

/**
 * Escape CSV special characters
 */
function escapeCSVCell(value: string | number): string {
    const stringValue = String(value);
    // Escape double quotes by doubling them
    const escaped = stringValue.replace(/"/g, '""');
    // Wrap in quotes if contains comma, newline, or quote
    if (escaped.includes(',') || escaped.includes('\n') || escaped.includes('"')) {
        return `"${escaped}"`;
    }
    return escaped;
}

/**
 * Generate CSV from Engagement Summary table data
 */
export function generateEngagementSummaryCSV(
    metrics: any, // EngagementMetrics type
    groupingDimensions: string[]
): Blob {
    const rows: string[][] = [];

    // Build header row
    const headers: string[] = [];

    // Add dimension column headers
    for (const dimension of groupingDimensions) {
        // Convert dimension keys to human-friendly headers
        const headerMap: Record<string, string> = {
            'activityCategory': 'Activity Category',
            'activityType': 'Activity Type',
            'venue': 'Venue',
            'geographicArea': 'Geographic Area'
        };
        headers.push(headerMap[dimension] || dimension);
    }

    // Add metric column headers
    headers.push(
        'Activities at Start',
        'Activities at End',
        'Activities Started',
        'Activities Completed',
        'Activities Cancelled',
        'Participants at Start',
        'Participants at End'
    );
    rows.push(headers);

    // Add Total row
    const totalRow: string[] = [];

    // First cell is "Total", rest of dimension cells are blank
    totalRow.push('Total');
    for (let i = 1; i < groupingDimensions.length; i++) {
        totalRow.push('');
    }

    // Add metric values
    totalRow.push(
        String(metrics.activitiesAtStart),
        String(metrics.activitiesAtEnd),
        String(metrics.activitiesStarted),
        String(metrics.activitiesCompleted),
        String(metrics.activitiesCancelled),
        String(metrics.participantsAtStart),
        String(metrics.participantsAtEnd)
    );
    rows.push(totalRow);

    // Add dimensional breakdown rows if grouping is active
    if (metrics.groupedResults && metrics.groupedResults.length > 0) {
        for (const group of metrics.groupedResults) {
            const row: string[] = [];

            // Add dimension values (human-friendly labels from dimensions object)
            for (const dimension of groupingDimensions) {
                row.push(group.dimensions[dimension] || '');
            }

            // Add metric values
            row.push(
                String(group.metrics.activitiesAtStart),
                String(group.metrics.activitiesAtEnd),
                String(group.metrics.activitiesStarted),
                String(group.metrics.activitiesCompleted),
                String(group.metrics.activitiesCancelled),
                String(group.metrics.participantsAtStart),
                String(group.metrics.participantsAtEnd)
            );

            rows.push(row);
        }
    }

    // Convert to CSV string with proper escaping
    const csvContent = rows
        .map(row => row.map(cell => escapeCSVCell(cell)).join(','))
        .join('\n');

    // Create blob
    return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
}
