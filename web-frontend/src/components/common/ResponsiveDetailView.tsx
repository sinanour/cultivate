import { type ReactNode } from 'react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { BREAKPOINTS } from '../../utils/responsive';
import styles from './ResponsiveDetailView.mobile.module.css';

interface ResponsiveDetailViewProps {
  children: ReactNode;
  className?: string;
}

/**
 * Responsive detail view container that adapts layout for mobile devices
 * - Mobile: Vertical stacking with full-width action buttons
 * - Desktop/Tablet: Existing optimized layouts
 */
export function ResponsiveDetailView({ children, className }: ResponsiveDetailViewProps) {
  const isMobile = useMediaQuery(BREAKPOINTS.mobile);
  
  const containerClass = isMobile ? styles.mobileDetail : styles.desktopDetail;
  const combinedClass = className ? `${containerClass} ${className}` : containerClass;
  
  return (
    <div className={combinedClass}>
      {children}
    </div>
  );
}
