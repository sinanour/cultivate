import { useState, useEffect } from 'react';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import Box from '@cloudscape-design/components/box';
import SegmentedControl from '@cloudscape-design/components/segmented-control';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AnalyticsService, type ActivityLifecycleData } from '../../services/api/analytics.service';
import { LoadingSpinner } from '../common/LoadingSpinner';

// LocalStorage key for lifecycle chart view mode
const LIFECYCLE_CHART_VIEW_MODE_KEY = 'lifecycleChartViewMode';

// View mode options
type LifecycleViewMode = 'type' | 'category';

interface ActivityLifecycleChartProps {
  startDate?: Date;
  endDate?: Date;
  geographicAreaIds?: string[];
  activityTypeIds?: string[];
  venueIds?: string[];
}

export function ActivityLifecycleChart({
  startDate,
  endDate,
  geographicAreaIds,
  activityTypeIds,
  venueIds,
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
          activityTypeIds,
          venueIds,
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
  }, [startDate, endDate, viewMode, geographicAreaIds, activityTypeIds, venueIds]);

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
      {isLoading ? (
        <Box textAlign="center" padding="l">
          <LoadingSpinner />
        </Box>
      ) : error ? (
        <Box textAlign="center" padding="l" color="text-status-error">
          <b>{error}</b>
        </Box>
      ) : chartData.length > 0 ? (
        <>
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
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend 
                itemSorter={(item: any) => {
                  // Custom sort order: "Started" first, then "Completed"
                  const order: { [key: string]: number } = {
                    'Started': 0,
                    'Completed': 1
                  };
                  return order[item.value] ?? 999;
                }}
              />
              <Bar dataKey="Started" fill="#0088FE" name="Started" />
              <Bar dataKey="Completed" fill="#00C49F" name="Completed" />
            </BarChart>
          </ResponsiveContainer>
        </>
      ) : (
        <Box textAlign="center" padding="l">
          <b>No activity lifecycle events for the selected {viewMode === 'type' ? 'activity types' : 'activity categories'}</b>
        </Box>
      )}
    </Container>
  );
}
