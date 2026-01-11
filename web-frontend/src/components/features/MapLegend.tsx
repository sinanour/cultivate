import Table from '@cloudscape-design/components/table';

interface LegendItem {
  id: string;
  name: string;
  color: string;
}

interface MapLegendProps {
  title: string;
  items: LegendItem[];
}

export function MapLegend({ title, items }: MapLegendProps) {
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
      maxWidth: '200px',
      maxHeight: 'calc(100% - 20px)', // Fit within map container with margins
      backgroundColor: 'rgba(255, 255, 255, 0.625)',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      overflow: 'auto', // Prevent content from spilling out
    }}>
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
    </div>
  );
}
