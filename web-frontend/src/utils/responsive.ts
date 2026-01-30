/**
 * Responsive breakpoint constants for media queries
 * 
 * Mobile: 320px - 767px (portrait smartphones)
 * Tablet: 768px - 1024px (tablets and small laptops)
 * Desktop: 1025px+ (desktop monitors)
 */
export const BREAKPOINTS = {
    /** Mobile viewport: max-width 767px */
    mobile: '(max-width: 767px)',

    /** Tablet viewport: 768px to 1024px */
    tablet: '(min-width: 768px) and (max-width: 1024px)',

    /** Desktop viewport: 1025px and above */
    desktop: '(min-width: 1025px)',

    /** Tablet and desktop combined: 768px and above */
    tabletAndUp: '(min-width: 768px)',
} as const;

/**
 * Pixel width breakpoints for programmatic use
 */
export const BREAKPOINT_VALUES = {
    mobile: 767,
    tablet: 768,
    desktop: 1025,
} as const;

/**
 * Minimum touch target size for mobile devices (in pixels)
 * Based on WCAG 2.1 AA guidelines and mobile platform standards
 */
export const MIN_TOUCH_TARGET_SIZE = 44;

/**
 * Check if current viewport is mobile
 * @returns true if viewport width is 767px or less
 */
export function isMobileViewport(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }
    return window.innerWidth <= BREAKPOINT_VALUES.mobile;
}

/**
 * Check if current viewport is tablet
 * @returns true if viewport width is between 768px and 1024px
 */
export function isTabletViewport(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }
    return window.innerWidth >= BREAKPOINT_VALUES.tablet && window.innerWidth < BREAKPOINT_VALUES.desktop;
}

/**
 * Check if current viewport is desktop
 * @returns true if viewport width is 1025px or more
 */
export function isDesktopViewport(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }
    return window.innerWidth >= BREAKPOINT_VALUES.desktop;
}
