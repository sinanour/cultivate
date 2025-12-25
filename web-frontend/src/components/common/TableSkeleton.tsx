import Box from '@cloudscape-design/components/box';

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 5, columns = 4 }: TableSkeletonProps) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <Box key={rowIndex} padding="s">
          <div style={{ display: 'flex', gap: '16px' }}>
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div
                key={colIndex}
                style={{
                  flex: 1,
                  height: '20px',
                  backgroundColor: '#e9ebed',
                  borderRadius: '4px',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              />
            ))}
          </div>
        </Box>
      ))}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
