// Color palette for activity types and categories
const COLORS = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#14b8a6', // teal
    '#f97316', // orange
    '#6366f1', // indigo
    '#84cc16', // lime
];

// Cache for consistent color assignment
const activityTypeColorCache = new Map<string, string>();
const activityCategoryColorCache = new Map<string, string>();

/**
 * Get consistent color for an activity type
 */
export function getActivityTypeColor(activityTypeId: string): string {
    if (!activityTypeColorCache.has(activityTypeId)) {
        const index = activityTypeColorCache.size % COLORS.length;
        activityTypeColorCache.set(activityTypeId, COLORS[index]);
    }
    return activityTypeColorCache.get(activityTypeId)!;
}

/**
 * Get consistent color for an activity category
 */
export function getActivityCategoryColor(activityCategoryId: string): string {
    if (!activityCategoryColorCache.has(activityCategoryId)) {
        const index = activityCategoryColorCache.size % COLORS.length;
        activityCategoryColorCache.set(activityCategoryId, COLORS[index]);
    }
    return activityCategoryColorCache.get(activityCategoryId)!;
}

/**
 * Clear color caches (useful for testing)
 */
export function clearColorCaches() {
    activityTypeColorCache.clear();
    activityCategoryColorCache.clear();
}
