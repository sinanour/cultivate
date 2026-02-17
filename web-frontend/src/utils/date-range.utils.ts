/**
 * Calculate absolute start and end dates from a relative period string
 * @param relativePeriod - Relative period string (e.g., "-30d", "-90d", "-6m", "-1y")
 * @returns Object with startDate and endDate as ISO-8601 strings (YYYY-MM-DD)
 */
export function calculateAbsoluteDates(relativePeriod: string): {
    startDate: string;
    endDate: string;
} {
    const today = new Date();
    const endDate = today.toISOString().split('T')[0]; // YYYY-MM-DD

    let startDate: Date;

    if (relativePeriod === '-30d') {
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 30);
    } else if (relativePeriod === '-90d') {
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 90);
    } else if (relativePeriod === '-6m') {
        startDate = new Date(today);
        startDate.setMonth(today.getMonth() - 6);
    } else if (relativePeriod === '-1y') {
        startDate = new Date(today);
        startDate.setFullYear(today.getFullYear() - 1);
    } else {
        throw new Error(`Invalid relative period: ${relativePeriod}`);
    }

    return {
        startDate: startDate.toISOString().split('T')[0],
        endDate,
    };
}

/**
 * Get human-readable label for a relative period
 * @param relativePeriod - Relative period string (e.g., "-30d", "-90d")
 * @returns Human-readable label (e.g., "Last 30 days")
 */
export function getRelativeDateLabel(relativePeriod: string): string {
    const labels: Record<string, string> = {
        '-30d': 'Last 30 days',
        '-90d': 'Last 90 days',
        '-6m': 'Last 6 months',
        '-1y': 'Last 1 year',
    };
    return labels[relativePeriod] || relativePeriod;
}
