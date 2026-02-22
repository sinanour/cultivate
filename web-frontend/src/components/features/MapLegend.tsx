import { ExpandableSection } from '@cloudscape-design/components';
import Table from '@cloudscape-design/components/table';

interface LegendItem {
  id: string;
  name: string;
  color: string;
}

interface MapLegendProps {
  title: string;
  items: LegendItem[];
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

export function MapLegend({ title, items, expanded, onExpandedChange }: MapLegendProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div style={{
      position: 'absolute',
      top: '10px',
      right: '10px',
      zIndex: 1000,
      pointerEvents: 'auto',
      maxWidth: '240px',
      maxHeight: 'calc(100% - 20px)', // Fit within map container with margins
      overflow: 'auto', // Prevent content from spilling out
    }}>
      <div style={{
        opacity: 0.75,
        padding: '0px',
      }}>
        <ExpandableSection
          headerText="Legend"
          variant="stacked"
          expanded={expanded}
          onChange={({ detail }) => onExpandedChange?.(detail.expanded)}
        >
      <Table
        columnDefinitions={[
          {
            id: 'legend',
            header: (
              <div style={{ paddingLeft: '8px' }}>
                {title}
              </div>
            ),
            cell: (item) => (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                paddingLeft: '8px',
              }}>
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    border: '1px solid rgba(0, 0, 0, 0.2)',
                    backgroundColor: item.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: '13px', color: '#333' }}>
                  {item.name}
                </span>
              </div>
            ),
          },
        ]}
        items={items}
        stickyHeader={true}
        variant="embedded"
        contentDensity="compact"
        stripedRows={false}
        wrapLines={false}
      />
      </ExpandableSection>
      </div>
    </div>
  );
}
