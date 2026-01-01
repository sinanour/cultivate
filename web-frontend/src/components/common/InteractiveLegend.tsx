import React, { useState, useEffect, useCallback } from 'react';

export interface LegendItem {
  name: string;
  color: string;
  dataKey?: string;
}

export interface InteractiveLegendProps {
  chartId: string;
  series: LegendItem[];
  onVisibilityChange?: (visibilityState: Record<string, boolean>) => void;
}

export interface LegendItemProps {
  item: LegendItem;
  isVisible: boolean;
  onClick: () => void;
}

const LegendItemComponent: React.FC<LegendItemProps> = ({ item, isVisible, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isVisible}
      aria-label={`Toggle ${item.name} series ${isVisible ? 'off' : 'on'}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        marginRight: '16px',
        marginBottom: '8px',
        cursor: 'pointer',
        opacity: isVisible ? 1 : 0.5,
        textDecoration: isVisible ? 'none' : 'line-through',
        transition: 'opacity 0.2s ease, background-color 0.2s ease',
        padding: '4px 8px',
        borderRadius: '4px',
        backgroundColor: isHovered ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
        outline: 'none',
      }}
      onFocus={(e) => {
        e.currentTarget.style.boxShadow = '0 0 0 2px #0972d3';
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div
        style={{
          width: '12px',
          height: '12px',
          backgroundColor: item.color,
          marginRight: '8px',
          borderRadius: '2px',
        }}
      />
      <span style={{ fontSize: '14px', userSelect: 'none' }}>{item.name}</span>
    </div>
  );
};

export const InteractiveLegend: React.FC<InteractiveLegendProps> = ({
  series,
  onVisibilityChange,
}) => {
  // Initialize visibility state - default to all visible
  const [visibilityState, setVisibilityState] = useState<Record<string, boolean>>(() => {
    // Default: all series visible
    return series.reduce((acc, item) => {
      acc[item.name] = true;
      return acc;
    }, {} as Record<string, boolean>);
  });

  // Notify parent component of visibility changes
  useEffect(() => {
    if (onVisibilityChange) {
      onVisibilityChange(visibilityState);
    }
  }, [visibilityState, onVisibilityChange]);

  const toggleSeries = useCallback((seriesName: string) => {
    setVisibilityState((prev) => {
      const newState = { ...prev, [seriesName]: !prev[seriesName] };
      
      // Ensure at least one series remains visible
      const visibleCount = Object.values(newState).filter((v) => v === true).length;
      if (visibleCount === 0) {
        // Don't allow hiding the last visible series
        return prev;
      }
      
      return newState;
    });
  }, []);

  return (
    <div
      role="group"
      aria-label="Chart legend"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        padding: '8px 0',
      }}
    >
      {series.map((item) => (
        <LegendItemComponent
          key={item.name}
          item={item}
          isVisible={visibilityState[item.name] !== false}
          onClick={() => toggleSeries(item.name)}
        />
      ))}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          left: '-10000px',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
        }}
      >
        {Object.entries(visibilityState)
          .filter(([_, visible]) => !visible)
          .map(([name]) => `${name} series hidden`)
          .join(', ')}
      </div>
    </div>
  );
};

// Hook to use the interactive legend with visibility state
export const useInteractiveLegend = (_chartId: string, series: LegendItem[]) => {
  const [visibilityState, setVisibilityState] = useState<Record<string, boolean>>({});

  const handleVisibilityChange = useCallback((newState: Record<string, boolean>) => {
    setVisibilityState(newState);
  }, []);

  const getVisibleSeries = useCallback(() => {
    return series.filter((item) => visibilityState[item.name] !== false);
  }, [series, visibilityState]);

  const isSeriesVisible = useCallback(
    (seriesName: string) => {
      return visibilityState[seriesName] !== false;
    },
    [visibilityState]
  );

  return {
    visibilityState,
    handleVisibilityChange,
    getVisibleSeries,
    isSeriesVisible,
  };
};
