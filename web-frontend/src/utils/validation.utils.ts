export interface ValidationResult {
    isValid: boolean;
    error?: string;
}

export class ValidationUtils {
    static validateRequired(value: string, fieldName: string): ValidationResult {
        const trimmed = value.trim();
        if (!trimmed) {
            return {
                isValid: false,
                error: `${fieldName} is required`,
            };
        }
        return { isValid: true };
    }

    static validateEmail(email: string): ValidationResult {
        const trimmed = email.trim();
        if (!trimmed) {
            return {
                isValid: false,
                error: 'Email is required',
            };
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmed)) {
            return {
                isValid: false,
                error: 'Please enter a valid email address',
            };
        }

        return { isValid: true };
    }

    static validateNumber(
        value: string,
        fieldName: string,
        min?: number,
        max?: number
    ): ValidationResult {
        if (!value) {
            return { isValid: true }; // Optional
        }

        const num = parseFloat(value);
        if (isNaN(num)) {
            return {
                isValid: false,
                error: `${fieldName} must be a valid number`,
            };
        }

        if (min !== undefined && num < min) {
            return {
                isValid: false,
                error: `${fieldName} must be at least ${min}`,
            };
        }

        if (max !== undefined && num > max) {
            return {
                isValid: false,
                error: `${fieldName} must be at most ${max}`,
            };
        }

        return { isValid: true };
    }

    static validateDate(value: string, fieldName: string, required = true): ValidationResult {
        if (!value) {
            if (required) {
                return {
                    isValid: false,
                    error: `${fieldName} is required`,
                };
            }
            return { isValid: true };
        }

        const date = new Date(value);
        if (isNaN(date.getTime())) {
            return {
                isValid: false,
                error: `${fieldName} must be a valid date`,
            };
        }

        return { isValid: true };
    }

    static validateDateRange(
        startDate: string,
        endDate: string,
        startFieldName = 'Start date',
        endFieldName = 'End date'
    ): ValidationResult {
        if (!startDate || !endDate) {
            return { isValid: true }; // Let individual validators handle required checks
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (start > end) {
            return {
                isValid: false,
                error: `${endFieldName} must be after ${startFieldName}`,
            };
        }

        return { isValid: true };
    }
}
