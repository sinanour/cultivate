import type { IconProps } from '@cloudscape-design/components';

/**
 * Mapping of button text to CloudScape icon names for mobile icon-only buttons.
 * Used to automatically convert text buttons to icon-only buttons on mobile viewports.
 */
export const MOBILE_BUTTON_ICONS: Record<string, IconProps['name']> = {
  // Create/Add actions
  'create': 'add-plus',
  'add': 'add-plus',
  'new': 'add-plus',
  'create participant': 'add-plus',
  'create activity': 'add-plus',
  'create venue': 'add-plus',
  'create geographic area': 'add-plus',
  
  // Filter actions
  'cancel': 'close',
  'update': 'check',
  'apply': 'filter',
  'clear all': 'undo',
  'reset': 'undo',
  
  // CSV actions (already have icons, just hide text)
  'import csv': 'upload',
  'export csv': 'download',
  
  // Activity actions
  'mark complete': 'status-positive',
  'cancel activity': 'status-negative',
  'edit': 'edit',
  'remove': 'remove',
  
  // Navigation actions
  'back': 'arrow-left',
  'back to participants': 'arrow-left',
  'back to activities': 'arrow-left',
  'back to venues': 'arrow-left',
  'back to geographic areas': 'arrow-left',
  
  // Report actions
  'run report': 'redo',
} as const;

/**
 * Get the appropriate CloudScape icon name for a button based on its text content.
 * 
 * @param buttonText - The text content of the button
 * @returns The CloudScape icon name, or undefined if no mapping exists
 * 
 * @example
 * ```typescript
 * getMobileButtonIcon('Create Participant') // Returns 'add-plus'
 * getMobileButtonIcon('Update') // Returns 'filter'
 * getMobileButtonIcon('Back to Activities') // Returns 'arrow-left'
 * ```
 */
export function getMobileButtonIcon(buttonText: string): IconProps['name'] | undefined {
  const normalizedText = buttonText.toLowerCase().trim();
  return MOBILE_BUTTON_ICONS[normalizedText];
}
