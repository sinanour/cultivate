/**
 * Age Cohort Utilities
 * 
 * Client-side utilities for calculating and displaying age cohorts
 */

export type AgeCohort = 'Child' | 'Junior Youth' | 'Youth' | 'Young Adult' | 'Adult' | 'Unknown';

/**
 * Calculate age cohort from date of birth
 * @param dateOfBirth - ISO 8601 date string or null
 * @param referenceDate - Optional reference date (defaults to current date)
 * @returns The age cohort category
 */
export function calculateAgeCohort(
    dateOfBirth: string | null | undefined,
    referenceDate?: Date
): AgeCohort {
    if (!dateOfBirth) {
        return 'Unknown';
    }

    const dob = new Date(dateOfBirth);
    const refDate = referenceDate || new Date();

    const ageInYears = refDate.getFullYear() - dob.getFullYear();
    const monthDiff = refDate.getMonth() - dob.getMonth();
    const dayDiff = refDate.getDate() - dob.getDate();

    // Adjust age if birthday hasn't occurred yet in the reference year
    const adjustedAge =
        monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)
            ? ageInYears - 1
            : ageInYears;

    if (adjustedAge < 11) return 'Child';
    if (adjustedAge < 15) return 'Junior Youth';
    if (adjustedAge < 21) return 'Youth';
    if (adjustedAge < 30) return 'Young Adult';
    return 'Adult';
}
