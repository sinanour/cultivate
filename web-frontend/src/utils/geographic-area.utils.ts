import type { AreaType } from '../types';

/**
 * Maps geographic area types to CloudScape badge colors.
 * This ensures consistent visual representation across the application.
 * Uses all 9 available badge colors for maximum distinction.
 */
export const getAreaTypeBadgeColor = (
    areaType: AreaType
): 'blue' | 'grey' | 'green' | 'red' | 'severity-critical' | 'severity-high' | 'severity-medium' | 'severity-low' | 'severity-neutral' => {
    const colorMap: Record<
        AreaType,
        'blue' | 'grey' | 'green' | 'red' | 'severity-critical' | 'severity-high' | 'severity-medium' | 'severity-low' | 'severity-neutral'
    > = {
        // Smallest areas
        NEIGHBOURHOOD: 'blue',
        COMMUNITY: 'severity-low',

        // Municipal areas
        CITY: 'green',
        CLUSTER: 'severity-medium',

        // Regional areas
        COUNTY: 'severity-high',
        PROVINCE: 'red',
        STATE: 'severity-critical',

        // National and global areas
        COUNTRY: 'grey',
        CONTINENT: 'severity-neutral',
        HEMISPHERE: 'severity-neutral',
        WORLD: 'severity-neutral',
    };
    return colorMap[areaType];
};
