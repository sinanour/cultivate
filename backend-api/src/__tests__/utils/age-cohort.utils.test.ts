import { calculateAgeCohort, convertCohortToDateRange, buildAgeCohortFilter, AgeCohort, validateAgeCohorts } from '../../utils/age-cohort.utils';

describe('Age Cohort Utils', () => {
    describe('calculateAgeCohort', () => {
        const referenceDate = new Date('2026-02-14'); // Fixed reference date for consistent tests

        it('should return Unknown for null dateOfBirth', () => {
            expect(calculateAgeCohort(null, referenceDate)).toBe(AgeCohort.UNKNOWN);
            expect(calculateAgeCohort(undefined, referenceDate)).toBe(AgeCohort.UNKNOWN);
        });

        it('should calculate Child cohort for age < 11', () => {
            const dob = new Date('2016-01-01'); // 10 years old
            expect(calculateAgeCohort(dob, referenceDate)).toBe(AgeCohort.CHILD);
        });

        it('should calculate Junior Youth cohort for age >= 11 and < 15', () => {
            const dob11 = new Date('2015-01-01'); // 11 years old
            const dob14 = new Date('2012-01-01'); // 14 years old
            expect(calculateAgeCohort(dob11, referenceDate)).toBe(AgeCohort.JUNIOR_YOUTH);
            expect(calculateAgeCohort(dob14, referenceDate)).toBe(AgeCohort.JUNIOR_YOUTH);
        });

        it('should calculate Youth cohort for age >= 15 and < 21', () => {
            const dob15 = new Date('2011-01-01'); // 15 years old
            const dob20 = new Date('2006-01-01'); // 20 years old
            expect(calculateAgeCohort(dob15, referenceDate)).toBe(AgeCohort.YOUTH);
            expect(calculateAgeCohort(dob20, referenceDate)).toBe(AgeCohort.YOUTH);
        });

        it('should calculate Young Adult cohort for age >= 21 and < 30', () => {
            const dob21 = new Date('2005-01-01'); // 21 years old
            const dob29 = new Date('1997-01-01'); // 29 years old
            expect(calculateAgeCohort(dob21, referenceDate)).toBe(AgeCohort.YOUNG_ADULT);
            expect(calculateAgeCohort(dob29, referenceDate)).toBe(AgeCohort.YOUNG_ADULT);
        });

        it('should calculate Adult cohort for age >= 30', () => {
            const dob30 = new Date('1996-01-01'); // 30 years old
            const dob50 = new Date('1976-01-01'); // 50 years old
            expect(calculateAgeCohort(dob30, referenceDate)).toBe(AgeCohort.ADULT);
            expect(calculateAgeCohort(dob50, referenceDate)).toBe(AgeCohort.ADULT);
        });

        it('should handle birthday not yet occurred this year', () => {
            const dobBeforeBirthday = new Date('2015-12-31'); // Birthday hasn't occurred yet in 2026
            const dobAfterBirthday = new Date('2015-01-01'); // Birthday already occurred in 2026

            // On Feb 14, person born Dec 31, 2015 is still 10 (birthday not yet)
            expect(calculateAgeCohort(dobBeforeBirthday, referenceDate)).toBe(AgeCohort.CHILD);

            // On Feb 14, person born Jan 1, 2015 is already 11 (birthday passed)
            expect(calculateAgeCohort(dobAfterBirthday, referenceDate)).toBe(AgeCohort.JUNIOR_YOUTH);
        });

        it('should use current date when referenceDate not provided', () => {
            const dob = new Date('2000-01-01'); // Will be 26 years old in 2026
            const result = calculateAgeCohort(dob);
            // Should be Young Adult or Adult depending on current date
            expect([AgeCohort.YOUNG_ADULT, AgeCohort.ADULT]).toContain(result);
        });
    });

    describe('convertCohortToDateRange', () => {
        const referenceDate = new Date('2026-02-14');

        it('should return null for Unknown cohort', () => {
            expect(convertCohortToDateRange(AgeCohort.UNKNOWN, referenceDate)).toBeNull();
        });

        it('should return min date for Child cohort', () => {
            const range = convertCohortToDateRange(AgeCohort.CHILD, referenceDate);
            expect(range).toHaveProperty('min');
            expect(range).not.toHaveProperty('max');
            expect(range?.min?.getFullYear()).toBe(2015); // 2026 - 11
        });

        it('should return min and max dates for Junior Youth cohort', () => {
            const range = convertCohortToDateRange(AgeCohort.JUNIOR_YOUTH, referenceDate);
            expect(range).toHaveProperty('min');
            expect(range).toHaveProperty('max');
            expect(range?.min?.getFullYear()).toBe(2011); // 2026 - 15
            expect(range?.max?.getFullYear()).toBe(2015); // 2026 - 11
        });

        it('should return min and max dates for Youth cohort', () => {
            const range = convertCohortToDateRange(AgeCohort.YOUTH, referenceDate);
            expect(range).toHaveProperty('min');
            expect(range).toHaveProperty('max');
            expect(range?.min?.getFullYear()).toBe(2005); // 2026 - 21
            expect(range?.max?.getFullYear()).toBe(2011); // 2026 - 15
        });

        it('should return min and max dates for Young Adult cohort', () => {
            const range = convertCohortToDateRange(AgeCohort.YOUNG_ADULT, referenceDate);
            expect(range).toHaveProperty('min');
            expect(range).toHaveProperty('max');
            expect(range?.min?.getFullYear()).toBe(1996); // 2026 - 30
            expect(range?.max?.getFullYear()).toBe(2005); // 2026 - 21
        });

        it('should return max date for Adult cohort', () => {
            const range = convertCohortToDateRange(AgeCohort.ADULT, referenceDate);
            expect(range).not.toHaveProperty('min');
            expect(range).toHaveProperty('max');
            expect(range?.max?.getFullYear()).toBe(1996); // 2026 - 30
        });
    });

    describe('buildAgeCohortFilter', () => {
        it('should return empty object for empty cohorts array', () => {
            expect(buildAgeCohortFilter([])).toEqual({});
        });

        it('should build filter for single cohort', () => {
            const filter = buildAgeCohortFilter([AgeCohort.CHILD]);
            expect(filter).toHaveProperty('dateOfBirth');
        });

        it('should build filter for Unknown cohort', () => {
            const filter = buildAgeCohortFilter([AgeCohort.UNKNOWN]);
            expect(filter).toEqual({ dateOfBirth: null });
        });

        it('should build OR filter for multiple cohorts', () => {
            const filter = buildAgeCohortFilter([AgeCohort.CHILD, AgeCohort.YOUTH]);
            expect(filter).toHaveProperty('OR');
            expect(Array.isArray(filter.OR)).toBe(true);
            expect(filter.OR.length).toBe(2);
        });

        it('should handle cohorts with both min and max boundaries', () => {
            const filter = buildAgeCohortFilter([AgeCohort.JUNIOR_YOUTH]);
            expect(filter).toHaveProperty('AND');
        });
    });

    describe('validateAgeCohorts', () => {
        it('should return true for valid cohort names', () => {
            expect(validateAgeCohorts(['Child', 'Youth', 'Adult'])).toBe(true);
            expect(validateAgeCohorts(['Junior Youth', 'Young Adult'])).toBe(true);
            expect(validateAgeCohorts(['Unknown'])).toBe(true);
        });

        it('should return false for invalid cohort names', () => {
            expect(validateAgeCohorts(['InvalidCohort'])).toBe(false);
            expect(validateAgeCohorts(['Child', 'InvalidCohort'])).toBe(false);
        });

        it('should return true for empty array', () => {
            expect(validateAgeCohorts([])).toBe(true);
        });
    });
});
