import { Button } from '@cloudscape-design/components';
import type { ButtonProps } from '@cloudscape-design/components';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { BREAKPOINTS } from '../../utils/responsive';
import { getMobileButtonIcon } from '../../utils/mobile-button-icons';

export interface ResponsiveButtonProps extends Omit<ButtonProps, 'children'> {
  children: React.ReactNode;
  /**
   * Icon to display on mobile viewports instead of text.
   * If not provided, will attempt to auto-detect from button text.
   */
  mobileIcon?: ButtonProps['iconName'];
  /**
   * Aria label for accessibility when button is icon-only on mobile.
   * If not provided, will use the button text as the aria-label.
   */
  mobileAriaLabel?: string;
}

/**
 * A responsive button component that displays text on desktop/tablet
 * and icon-only on mobile viewports.
 * 
 * Preserves the button variant (Primary, Default, Link) across all viewports.
 * Automatically detects appropriate icon from button text if mobileIcon not provided.
 * 
 * @example
 * ```tsx
 * // Auto-detect icon from text
 * <ResponsiveButton variant="primary" onClick={handleCreate}>
 *   Create Participant
 * </ResponsiveButton>
 * 
 * // Explicit icon and aria-label
 * <ResponsiveButton 
 *   variant="primary"
 *   mobileIcon="filter"
 *   mobileAriaLabel="Update filters"
 *   onClick={handleUpdate}
 * >
 *   Update
 * </ResponsiveButton>
 * ```
 */
export function ResponsiveButton({ 
  children, 
  mobileIcon, 
  mobileAriaLabel,
  iconName,
  ...props 
}: ResponsiveButtonProps) {
  const isMobile = useMediaQuery(BREAKPOINTS.mobile);
  
  // Auto-detect icon from button text if not provided
  const autoIcon = typeof children === 'string' 
    ? getMobileButtonIcon(children) 
    : undefined;
  
  const effectiveMobileIcon = mobileIcon || autoIcon;
  
  // On mobile with an icon, render icon-only button
  if (isMobile && effectiveMobileIcon) {
    return (
      <Button
        {...props}
        iconName={effectiveMobileIcon}
        ariaLabel={mobileAriaLabel || (typeof children === 'string' ? children : undefined)}
      />
    );
  }
  
  // On desktop/tablet, render text button with optional icon
  return (
    <Button {...props} iconName={iconName}>
      {children}
    </Button>
  );
}
