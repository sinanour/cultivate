import { type ReactNode } from 'react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { BREAKPOINTS } from '../../utils/responsive';
import styles from './ResponsiveDashboard.mobile.module.css';

interface ResponsiveDashboardProps {
  children: ReactNode;
  className?: string;
}

/**
 * Responsive dashboard container that adapts layout for mobile devices
 * - Mobile: Single-column vertical stacking
 * - Desktop/Tablet: Multi-column grid layouts
 */
export function ResponsiveDashboard({ children, className }: ResponsiveDashboardProps) {
  const isMobile = useMediaQuery(BREAKPOINTS.mobile);
  
  const containerClass = isMobile ? styles.mobileDashboard : styles.desktopDashboard;
  const combinedClass = className ? `${containerClass} ${className}` : containerClass;
  
  return (
    <div className={combinedClass}>
      {children}
    </div>
  );
}
