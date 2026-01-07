import { useState, useEffect } from 'react';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import Box from '@cloudscape-design/components/box';
import SegmentedControl from '@cloudscape-design/components/segmented-control';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AnalyticsService, type ActivityLifecycleData } from '../../services/api/analytics.service';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useDebouncedLoading } from '../../hooks/useDebouncedLoading';
import { InteractiveLegend, useInteractiveLegend, type LegendItem } from '../common/InteractiveLegend';

// Bar chart styling constants
const BAR_CHART_MAX_BAR_SIZE = 60;
const BAR_CHART_GAP = 0;
const BAR_CHART_CATEGORY_GAP = '20%';

// LocalStorage key for lifecycle chart view mode
const LIFECYCLE_CHART_VIEW_MODE_KEY = 'lifecycleChartViewMode';

// View mode options
type LifecycleViewMode = 'type' | 'category';

interface ActivityLifecycleChartProps {
  startDate?: Date;
  endDate?: Date;
  geographicAreaIds?: string[];
  activityCategoryIds?: string[];
  activityTypeIds?: string[];
  venueIds?: string[];
  populationIds?: string[];
}

export function ActivityLifecycleChart({
  startDate,
  endDate,
  geographicAreaIds,
  activityCategoryIds,
  activityTypeIds,
  venueIds,
  populationIds,
}: ActivityLifecycleChartProps) {
  // View mode state with localStorage persistence
  const [viewMode, setViewMode] = useState<LifecycleViewMode>(() => {
    try {
      const stored = localStorage.getItem(LIFECYCLE_CHART_VIEW_MODE_KEY);
      return (stored === 'category' || stored === 'type') ? stored : 'type';
    } catch {
      return 'type';
    }
  });

  const [data, setData] = useState<ActivityLifecycleData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Persist view mode to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LIFECYCLE_CHART_VIEW_MODE_KEY, viewMode);
    } catch {
      // Ignore localStorage errors
    }
  }, [viewMode]);

  // Prepare legend items for interactive legend
  const legendItems: LegendItem[] = [
    { name: 'Started', color: '#0088FE', dataKey: 'Started' },
    { name: 'Completed', color: '#00C49F', dataKey: 'Completed' },
  ];

  // Use interactive legend hook
  const legend = useInteractiveLegend('activity-lifecycle', legendItems);

  // Debounce loading state to prevent flicker from quick requests (500ms delay)
  const debouncedLoading = useDebouncedLoading(isLoading, 500);

  // Fetch data when parameters change
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await AnalyticsService.getActivityLifecycleEvents({
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString(),
          groupBy: viewMode,
          geographicAreaIds,
          activityCategoryIds,
          activityTypeIds,
          venueIds,
          populationIds,
        });

        setData(result);
      } catch (err) {
        console.error('Error fetching activity lifecycle data:', err);
        setError('Failed to load activity lifecycle data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [startDate, endDate, viewMode, geographicAreaIds, activityCategoryIds, activityTypeIds, venueIds, populationIds]);

  // Transform data for chart
  const chartData = data
    .filter(item => item.started > 0 || item.completed > 0) // Filter out items with no activity
    .map(item => ({
      name: item.groupName,
      Started: item.started,
      Completed: item.completed,
    }));

  return (
    <Container
      header={
        <Header
          variant="h3"
          actions={
            <SegmentedControl
              selectedId={viewMode}
              onChange={({ detail }) => setViewMode(detail.selectedId as LifecycleViewMode)}
              label="Activity lifecycle chart view mode"
              options={[
                { text: 'By Type', id: 'type' },
                { text: 'By Category', id: 'category' },
              ]}
            />
          }
        >
          Activity Lifecycle Events
        </Header>
      }
    >
      {/* Always render the chart structure to prevent unmounting */}
      {/* Screen reader announcement for view mode changes */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        style={{ position: 'absolute', left: '-10000px', width: '1px', height: '1px', overflow: 'hidden' }}
      >
        {viewMode === 'type' ? 'By Type view selected' : 'By Category view selected'}
      </div>
      
      {/* Show loading indicator inline without unmounting - debounced to prevent flicker */}
      {debouncedLoading && (
        <Box textAlign="center" padding="s">
          <LoadingSpinner text="Updating lifecycle events..." />
        </Box>
      )}
      
      {/* Show error state inline without unmounting */}
      {error && !isLoading && (
        <Box textAlign="center" padding="l" color="text-status-error">
          <b>{error}</b>
        </Box>
      )}
      
      {/* Always render legend and chart container */}
      {!error && (
        <>
          <InteractiveLegend
            chartId="activity-lifecycle"
            series={legendItems}
            onVisibilityChange={legend.handleVisibilityChange}
          />
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData} barGap={BAR_CHART_GAP} barCategoryGap={BAR_CHART_CATEGORY_GAP} maxBarSize={BAR_CHART_MAX_BAR_SIZE}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                {legend.isSeriesVisible('Started') && (
                  <Bar dataKey="Started" fill="#0088FE" name="Started" />
                )}
                {legend.isSeriesVisible('Completed') && (
                  <Bar dataKey="Completed" fill="#00C49F" name="Completed" />
                )}
              </BarChart>
            </ResponsiveContainer>
          ) : !isLoading && (
            <Box textAlign="center" padding="l">
              <b>No activity lifecycle events for the selected {viewMode === 'type' ? 'activity types' : 'activity categories'}</b>
            </Box>
          )}
        </>
      )}
    </Container>
  );
}
