import { useEffect, useState, useCallback } from 'react';
import { useBlocker } from 'react-router-dom';

interface UseFormNavigationGuardOptions<T> {
    formValues: T;
    initialValues: T;
    enabled?: boolean;
}

interface UseFormNavigationGuardReturn {
    isDirty: boolean;
    setInitialValues: (values: any) => void;
    clearDirtyState: () => void;
    showConfirmation: boolean;
    confirmNavigation: () => void;
    cancelNavigation: () => void;
}

/**
 * Custom hook for implementing navigation guards on form pages.
 * Prevents accidental navigation away from forms with unsaved changes.
 * 
 * @param options - Configuration options
 * @param options.formValues - Current form state
 * @param options.initialValues - Baseline values for comparison
 * @param options.enabled - Whether the guard is active (default: true)
 * @returns Navigation guard state and methods
 */
export function useFormNavigationGuard<T extends Record<string, any>>({
    formValues,
    initialValues,
    enabled = true,
}: UseFormNavigationGuardOptions<T>): UseFormNavigationGuardReturn {
    const [baselineValues, setBaselineValues] = useState<T>(initialValues);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

    // Deep equality comparison for form values
    const isDirty = useCallback(() => {
        if (!enabled) return false;
        return !deepEqual(formValues, baselineValues);
    }, [formValues, baselineValues, enabled]);

    const dirty = isDirty();

    // Use React Router's useBlocker to intercept navigation
    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) =>
            enabled && dirty && currentLocation.pathname !== nextLocation.pathname
    );

    // Show confirmation dialog when navigation is blocked
    useEffect(() => {
        if (blocker.state === 'blocked') {
            setShowConfirmation(true);
            setPendingNavigation(() => blocker.proceed);
        }
    }, [blocker.state, blocker.proceed]);

    // Confirm navigation - allow it to proceed
    const confirmNavigation = useCallback(() => {
        setShowConfirmation(false);
        if (pendingNavigation) {
            pendingNavigation();
            setPendingNavigation(null);
        }
    }, [pendingNavigation]);

    // Cancel navigation - stay on current page
    const cancelNavigation = useCallback(() => {
        setShowConfirmation(false);
        setPendingNavigation(null);
        if (blocker.state === 'blocked') {
            blocker.reset();
        }
    }, [blocker]);

    // Set new baseline values
    const setInitialValues = useCallback((values: T) => {
        setBaselineValues(values);
    }, []);

    // Clear dirty state (typically after successful submission)
    const clearDirtyState = useCallback(() => {
        setBaselineValues(formValues);
    }, [formValues]);

    return {
        isDirty: dirty,
        setInitialValues,
        clearDirtyState,
        showConfirmation,
        confirmNavigation,
        cancelNavigation,
    };
}

/**
 * Deep equality comparison for objects.
 * Ignores non-user-editable fields like timestamps and IDs.
 */
function deepEqual(obj1: any, obj2: any): boolean {
    if (obj1 === obj2) return true;
    if (obj1 == null || obj2 == null) return false;
    if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;

    // Ignore certain fields that shouldn't affect dirty state
    const ignoreFields = ['id', 'createdAt', 'updatedAt', 'version'];

    const keys1 = Object.keys(obj1).filter(k => !ignoreFields.includes(k));
    const keys2 = Object.keys(obj2).filter(k => !ignoreFields.includes(k));

    if (keys1.length !== keys2.length) return false;

    for (const key of keys1) {
        if (!keys2.includes(key)) return false;

        const val1 = obj1[key];
        const val2 = obj2[key];

        // Handle arrays
        if (Array.isArray(val1) && Array.isArray(val2)) {
            if (val1.length !== val2.length) return false;
            for (let i = 0; i < val1.length; i++) {
                if (!deepEqual(val1[i], val2[i])) return false;
            }
            continue;
        }

        // Handle nested objects
        if (typeof val1 === 'object' && typeof val2 === 'object') {
            if (!deepEqual(val1, val2)) return false;
            continue;
        }

        // Handle primitives
        if (val1 !== val2) return false;
    }

    return true;
}
