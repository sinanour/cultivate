import { describe, it, expect } from 'vitest';
import { ValidationUtils } from '../validation.utils';

describe('ValidationUtils', () => {
    describe('validateRequired', () => {
        it('should return valid for non-empty string', () => {
            const result = ValidationUtils.validateRequired('test', 'Field');
            expect(result.isValid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('should return invalid for empty string', () => {
            const result = ValidationUtils.validateRequired('', 'Field');
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('Field is required');
        });

        it('should return invalid for whitespace-only string', () => {
            const result = ValidationUtils.validateRequired('   ', 'Field');
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('Field is required');
        });

        it('should trim and validate correctly', () => {
            const result = ValidationUtils.validateRequired('  test  ', 'Field');
            expect(result.isValid).toBe(true);
        });
    });

    describe('validateEmail', () => {
        it('should return valid for correct email format', () => {
            const result = ValidationUtils.validateEmail('test@example.com');
            expect(result.isValid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('should return invalid for empty email', () => {
            const result = ValidationUtils.validateEmail('');
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('Email is required');
        });

        it('should return invalid for email without @', () => {
            const result = ValidationUtils.validateEmail('testexample.com');
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('Please enter a valid email address');
        });

        it('should return invalid for email without domain', () => {
            const result = ValidationUtils.validateEmail('test@');
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('Please enter a valid email address');
        });

        it('should return invalid for email without TLD', () => {
            const result = ValidationUtils.validateEmail('test@example');
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('Please enter a valid email address');
        });

        it('should trim and validate correctly', () => {
            const result = ValidationUtils.validateEmail('  test@example.com  ');
            expect(result.isValid).toBe(true);
        });
    });

    describe('validateNumber', () => {
        it('should return valid for empty string (optional)', () => {
            const result = ValidationUtils.validateNumber('', 'Field');
            expect(result.isValid).toBe(true);
        });

        it('should return valid for valid number', () => {
            const result = ValidationUtils.validateNumber('42', 'Field');
            expect(result.isValid).toBe(true);
        });

        it('should return invalid for non-numeric string', () => {
            const result = ValidationUtils.validateNumber('abc', 'Field');
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('Field must be a valid number');
        });

        it('should validate minimum value', () => {
            const result = ValidationUtils.validateNumber('5', 'Field', 10);
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('Field must be at least 10');
        });

        it('should validate maximum value', () => {
            const result = ValidationUtils.validateNumber('100', 'Field', undefined, 50);
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('Field must be at most 50');
        });

        it('should validate within range', () => {
            const result = ValidationUtils.validateNumber('25', 'Field', 0, 100);
            expect(result.isValid).toBe(true);
        });

        it('should handle decimal numbers', () => {
            const result = ValidationUtils.validateNumber('3.14', 'Field');
            expect(result.isValid).toBe(true);
        });

        it('should handle negative numbers', () => {
            const result = ValidationUtils.validateNumber('-42', 'Field', -100, 0);
            expect(result.isValid).toBe(true);
        });
    });

    describe('validateDate', () => {
        it('should return valid for valid date', () => {
            const result = ValidationUtils.validateDate('2024-01-15', 'Date');
            expect(result.isValid).toBe(true);
        });

        it('should return invalid for empty required date', () => {
            const result = ValidationUtils.validateDate('', 'Date', true);
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('Date is required');
        });

        it('should return valid for empty optional date', () => {
            const result = ValidationUtils.validateDate('', 'Date', false);
            expect(result.isValid).toBe(true);
        });

        it('should return invalid for invalid date format', () => {
            const result = ValidationUtils.validateDate('not-a-date', 'Date');
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('Date must be a valid date');
        });

        it('should accept ISO date format', () => {
            const result = ValidationUtils.validateDate('2024-01-15T10:30:00Z', 'Date');
            expect(result.isValid).toBe(true);
        });
    });

    describe('validateDateRange', () => {
        it('should return valid when end date is after start date', () => {
            const result = ValidationUtils.validateDateRange('2024-01-01', '2024-01-31');
            expect(result.isValid).toBe(true);
        });

        it('should return invalid when end date is before start date', () => {
            const result = ValidationUtils.validateDateRange('2024-01-31', '2024-01-01');
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('End date must be after Start date');
        });

        it('should return valid when dates are equal', () => {
            const result = ValidationUtils.validateDateRange('2024-01-15', '2024-01-15');
            expect(result.isValid).toBe(true);
        });

        it('should return valid when either date is empty', () => {
            const result1 = ValidationUtils.validateDateRange('', '2024-01-31');
            expect(result1.isValid).toBe(true);

            const result2 = ValidationUtils.validateDateRange('2024-01-01', '');
            expect(result2.isValid).toBe(true);
        });

        it('should use custom field names in error message', () => {
            const result = ValidationUtils.validateDateRange('2024-12-31', '2024-01-01', 'From', 'To');
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('To must be after From');
        });
    });
});
