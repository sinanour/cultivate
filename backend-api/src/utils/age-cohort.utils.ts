/**
 * Age Cohort Utilities
 * 
 * Provides functions for calculating age cohorts from date of birth
 * and converting cohort filters to database query conditions.
 */

import { AgeCohort } from './constants';

export { AgeCohort } from './constants';

export const AGE_COHORT_VALUES = Object.values(AgeCohort);

/**
 * Calculate age cohort from date of birth
 * @param dateOfBirth - The participant's date of birth (null for unknown)
 * @param referenceDate - The date to calculate age against (defaults to current date)
 * @returns The age cohort category
 */
export function calculateAgeCohort(
    dateOfBirth: Date | null | undefined,
    referenceDate?: Date
): AgeCohort {
    if (!dateOfBirth) {
        return AgeCohort.UNKNOWN;
    }

    const refDate = referenceDate || new Date();
    const ageInYears = refDate.getFullYear() - dateOfBirth.getFullYear();
    const monthDiff = refDate.getMonth() - dateOfBirth.getMonth();
    const dayDiff = refDate.getDate() - dateOfBirth.getDate();

    // Adjust age if birthday hasn't occurred yet in the reference year
    const adjustedAge =
        monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)
            ? ageInYears - 1
            : ageInYears;

    if (adjustedAge < 11) return AgeCohort.CHILD;
    if (adjustedAge < 15) return AgeCohort.JUNIOR_YOUTH;
    if (adjustedAge < 21) return AgeCohort.YOUTH;
    if (adjustedAge < 30) return AgeCohort.YOUNG_ADULT;
    return AgeCohort.ADULT;
}

interface DateRange {
    min?: Date;
    max?: Date;
}

/**
 * Convert age cohort to date range for database filtering
 * @param cohort - The age cohort to convert
 * @param referenceDate - The reference date for calculations (defaults to current date)
 * @returns Date range boundaries or null for Unknown cohort
 */
export function convertCohortToDateRange(
    cohort: AgeCohort,
    referenceDate?: Date
): DateRange | null {
    if (cohort === AgeCohort.UNKNOWN) {
        return null;
    }

    const refDate = referenceDate || new Date();
    const currentYear = refDate.getFullYear();
    const currentMonth = refDate.getMonth();
    const currentDay = refDate.getDate();

    switch (cohort) {
        case AgeCohort.CHILD:
            // < 11 years old: dateOfBirth > (reference date - 11 years)
            return {
                min: new Date(currentYear - 11, currentMonth, currentDay),
            };

        case AgeCohort.JUNIOR_YOUTH:
            // >= 11 and < 15 years old
            return {
                min: new Date(currentYear - 15, currentMonth, currentDay),
                max: new Date(currentYear - 11, currentMonth, currentDay),
            };

        case AgeCohort.YOUTH:
            // >= 15 and < 21 years old
            return {
                min: new Date(currentYear - 21, currentMonth, currentDay),
                max: new Date(currentYear - 15, currentMonth, currentDay),
            };

        case AgeCohort.YOUNG_ADULT:
            // >= 21 and < 30 years old
            return {
                min: new Date(currentYear - 30, currentMonth, currentDay),
                max: new Date(currentYear - 21, currentMonth, currentDay),
            };

        case AgeCohort.ADULT:
            // >= 30 years old: dateOfBirth < (reference date - 30 years)
            return {
                max: new Date(currentYear - 30, currentMonth, currentDay),
            };

        default:
            throw new Error(`Invalid age cohort: ${cohort}`);
    }
}

/**
 * Build Prisma WHERE clause for age cohort filtering
 * @param cohorts - Array of age cohorts to filter by
 * @param referenceDate - The reference date for calculations (defaults to current date)
 * @returns Prisma WHERE clause object
 */
export function buildAgeCohortFilter(
    cohorts: AgeCohort[],
    referenceDate?: Date
): any {
    if (cohorts.length === 0) {
        return {};
    }

    const conditions = cohorts.map((cohort) => {
        if (cohort === AgeCohort.UNKNOWN) {
            return { dateOfBirth: null };
        }

        const range = convertCohortToDateRange(cohort, referenceDate);
        if (!range) {
            return { dateOfBirth: null };
        }

        const condition: any = {};

        if (range.min && range.max) {
            // Range with both boundaries
            return {
                AND: [
                    { dateOfBirth: { gte: range.min } },
                    { dateOfBirth: { lt: range.max } },
                ],
            };
        } else if (range.min) {
            // Only minimum boundary (Child cohort)
            condition.gte = range.min;
        } else if (range.max) {
            // Only maximum boundary (Adult cohort)
            condition.lt = range.max;
        }

        return { dateOfBirth: condition };
    });

    // Apply OR logic for multiple cohorts
    return conditions.length === 1 ? conditions[0] : { OR: conditions };
}

/**
 * Validate age cohort names
 * @param cohorts - Array of cohort names to validate
 * @returns True if all cohorts are valid
 */
export function validateAgeCohorts(cohorts: string[]): boolean {
    return cohorts.every((cohort) => AGE_COHORT_VALUES.includes(cohort as AgeCohort));
}
