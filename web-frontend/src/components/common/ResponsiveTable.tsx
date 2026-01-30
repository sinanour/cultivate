import { type ReactNode } from 'react';
import Table, { type TableProps } from '@cloudscape-design/components/table';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { BREAKPOINTS } from '../../utils/responsive';
import styles from './ResponsiveTable.mobile.module.css';

interface ResponsiveTableProps<T> extends Omit<TableProps<T>, 'items'> {
  items: T[];
  mobileCardRenderer?: (item: T, index: number) => ReactNode;
  onItemClick?: (item: T) => void;
}

/**
 * Responsive table component that renders as a table on desktop/tablet
 * and as cards on mobile devices
 */
export function ResponsiveTable<T>({
  items,
  mobileCardRenderer,
  onItemClick,
  ...tableProps
}: ResponsiveTableProps<T>) {
  const isMobile = useMediaQuery(BREAKPOINTS.mobile);

  // Render mobile card layout
  if (isMobile && mobileCardRenderer) {
    return (
      <div className={styles.mobileCardList}>
        {items.map((item, index) => (
          <div
            key={index}
            className={styles.mobileCard}
            onClick={() => onItemClick?.(item)}
            role={onItemClick ? 'button' : undefined}
            tabIndex={onItemClick ? 0 : undefined}
            onKeyDown={(e) => {
              if (onItemClick && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onItemClick(item);
              }
            }}
          >
            {mobileCardRenderer(item, index)}
          </div>
        ))}
      </div>
    );
  }

  // Render desktop/tablet table layout
  return <Table {...tableProps} items={items} />;
}
