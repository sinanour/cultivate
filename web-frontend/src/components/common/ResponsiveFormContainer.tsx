import { type ReactNode } from 'react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { BREAKPOINTS } from '../../utils/responsive';
import styles from './ResponsiveFormContainer.mobile.module.css';

interface ResponsiveFormContainerProps {
  children: ReactNode;
  className?: string;
}

/**
 * Responsive form container that adapts layout for mobile devices
 * - Mobile: Vertical stacking with full-width inputs
 * - Desktop/Tablet: Existing side-by-side layouts
 */
export function ResponsiveFormContainer({ children, className }: ResponsiveFormContainerProps) {
  const isMobile = useMediaQuery(BREAKPOINTS.mobile);
  
  const containerClass = isMobile ? styles.mobileForm : styles.desktopForm;
  const combinedClass = className ? `${containerClass} ${className}` : containerClass;
  
  return (
    <div className={combinedClass}>
      {children}
    </div>
  );
}
