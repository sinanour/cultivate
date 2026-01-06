import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Box from '@cloudscape-design/components/box';
import Select from '@cloudscape-design/components/select';
import Multiselect from '@cloudscape-design/components/multiselect';
import type { MultiselectProps } from '@cloudscape-design/components/multiselect';
import SegmentedControl from '@cloudscape-design/components/segmented-control';
import DateRangePicker from '@cloudscape-design/components/date-range-picker';
import type { DateRangePickerProps } from '@cloudscape-design/components/date-range-picker';
import Popover from '@cloudscape-design/components/popover';
import Icon from '@cloudscape-design/components/icon';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AnalyticsService, type GrowthMetricsParams } from '../../services/api/analytics.service';
import { PopulationService } from '../../services/api/population.service';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useGlobalGeographicFilter } from '../../hooks/useGlobalGeographicFilter';
import { InteractiveLegend, useInteractiveLegend, type LegendItem } from '../common/InteractiveLegend';
import type { TimePeriod } from '../../utils/constants';

// Helper function to convert YYYY-MM-DD to ISO datetime string
function toISODateTime(dateString: string, isEndOfDay = false): string {
  const date = new Date(dateString);
  if (isEndOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date.toISOString();
}

// Consistent color palette for activity types/categories
const COLOR_PALETTE = [
  '#0088FE', // Blue
  '#00C49F', // Green
  '#FFBB28', // Yellow
  '#FF8042', // Orange
  '#8884D8', // Purple
  '#82CA9D', // Light Green
  '#FFC658', // Light Orange
  '#8DD1E1', // Light Blue
  '#D084D0', // Pink
  '#A4DE6C', // Lime
];

// Get consistent color for a group name
function getColorForGroup(groupName: string, allGroups: string[]): string {
  const index = allGroups.indexOf(groupName);
  return COLOR_PALETTE[index % COLOR_PALETTE.length];
}

type ViewMode = 'all' | 'type' | 'category';

export function GrowthDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedGeographicAreaId } = useGlobalGeographicFilter();

  // Fetch all populations for filter
  const { data: allPopulations = [] } = useQuery({
    queryKey: ['populations'],
    queryFn: PopulationService.getPopulations,
  });

  // Initialize state from URL parameters
  const [period, setPeriod] = useState<TimePeriod>(() => {
    const urlPeriod = searchParams.get('period');
    return (urlPeriod as TimePeriod) || 'MONTH';
  });

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    // First check URL parameter
    const urlGroupBy = searchParams.get('groupBy');
    if (urlGroupBy === 'all' || urlGroupBy === 'type' || urlGroupBy === 'category') {
      return urlGroupBy;
    }
    
    // Then check localStorage
    const stored = localStorage.getItem('growthChartViewMode');
    if (stored === 'all' || stored === 'type' || stored === 'category') {
      return stored;
    }
    
    // Default to 'all'
    return 'all';
  });

  const [dateRange, setDateRange] = useState<DateRangePickerProps.Value | null>(() => {
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const relativePeriod = searchParams.get('relativePeriod');

    // Handle relative date range (e.g., "-90d", "-6m")
    if (relativePeriod) {
      const match = relativePeriod.match(/^-(\d+)([dwmy])$/);
      if (match) {
        const amount = parseInt(match[1], 10);
        const unitChar = match[2];

        let unit: 'day' | 'week' | 'month' | 'year';
        switch (unitChar) {
          case 'd':
            unit = 'day';
            break;
          case 'w':
            unit = 'week';
            break;
          case 'm':
            unit = 'month';
            break;
          case 'y':
            unit = 'year';
            break;
          default:
            return null;
        }

        return {
          type: 'relative',
          amount,
          unit,
        };
      }
    }

    // Handle absolute date range
    if (startDate && endDate) {
      return {
        type: 'absolute',
        startDate,
        endDate,
      };
    }

    return null;
  });

  // Population filter state
  const [selectedPopulations, setSelectedPopulations] = useState<MultiselectProps.Options>(() => {
    const urlPopIds = searchParams.getAll('populationIds');
    if (urlPopIds.length > 0) {
      // Will be populated with labels once populations are loaded
      return urlPopIds.map(id => ({ label: '', value: id }));
    }
    return [];
  });

  // Update population labels when populations are loaded
  useEffect(() => {
    if (allPopulations.length > 0 && selectedPopulations.some(opt => !opt.label)) {
      const updated = selectedPopulations.map(opt => {
        const pop = allPopulations.find(p => p.id === opt.value);
        return pop ? { label: pop.name, value: pop.id } : opt;
      }).filter(opt => opt.label); // Remove any that couldn't be found
      
      if (JSON.stringify(updated) !== JSON.stringify(selectedPopulations)) {
        setSelectedPopulations(updated);
      }
    }
  }, [allPopulations, selectedPopulations]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams(searchParams);

    // Update period
    params.set('period', period);

    // Update groupBy
    params.set('groupBy', viewMode);

    // Update date range
    if (dateRange) {
      if (dateRange.type === 'absolute') {
        params.set('startDate', dateRange.startDate);
        params.set('endDate', dateRange.endDate);
        params.delete('relativePeriod');
      } else if (dateRange.type === 'relative') {
        // Convert relative date range to compact format (e.g., "-90d", "-6m")
        const unitChar = dateRange.unit.charAt(0); // 'd', 'w', 'm', 'y'
        params.set('relativePeriod', `-${dateRange.amount}${unitChar}`);
        params.delete('startDate');
        params.delete('endDate');
      }
    } else {
      params.delete('startDate');
      params.delete('endDate');
      params.delete('relativePeriod');
    }

    // Update population filters
    params.delete('populationIds'); // Clear existing
    if (selectedPopulations.length > 0) {
      selectedPopulations.forEach(pop => {
        params.append('populationIds', pop.value!);
      });
    }

    setSearchParams(params, { replace: true });
  }, [period, viewMode, dateRange, selectedPopulations, searchParams, setSearchParams]);

  // Store view mode in localStorage
  useEffect(() => {
    try {
      localStorage.setItem('growthChartViewMode', viewMode);
    } catch (error) {
      console.error('Failed to save view mode to localStorage:', error);
    }
  }, [viewMode]);

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['growthMetrics', dateRange, period, selectedGeographicAreaId, selectedPopulations, viewMode],
    queryFn: () => {
      // Convert date range to ISO datetime format for API
      let startDate: string | undefined;
      let endDate: string | undefined;
      
      if (dateRange) {
        if (dateRange.type === 'absolute') {
          startDate = toISODateTime(dateRange.startDate, false);
          endDate = toISODateTime(dateRange.endDate, true);
        } else if (dateRange.type === 'relative') {
          // Calculate relative date range
          const now = new Date();
          const start = new Date(now);
          
          // Calculate start date based on relative amount and unit
          switch (dateRange.unit) {
            case 'day':
              start.setDate(start.getDate() - dateRange.amount);
              break;
            case 'week':
              start.setDate(start.getDate() - (dateRange.amount * 7));
              break;
            case 'month':
              start.setMonth(start.getMonth() - dateRange.amount);
              break;
            case 'year':
              start.setFullYear(start.getFullYear() - dateRange.amount);
              break;
          }
          
          startDate = start.toISOString();
          endDate = now.toISOString();
        }
      }
      
      const populationIds = selectedPopulations.map(opt => opt.value!);
      
      const params: GrowthMetricsParams = {
        startDate,
        endDate,
        period,
        geographicAreaId: selectedGeographicAreaId || undefined,
        populationIds: populationIds.length > 0 ? populationIds : undefined,
        groupBy: viewMode === 'all' ? undefined : viewMode,
      };
      
      return AnalyticsService.getGrowthMetrics(params);
    },
  });

  // Prepare data for grouped view (before hooks)
  const groupNames = metrics?.groupedTimeSeries ? Object.keys(metrics.groupedTimeSeries).sort() : [];
  const groupColors = groupNames.reduce((acc, name) => {
    acc[name] = getColorForGroup(name, groupNames);
    return acc;
  }, {} as Record<string, string>);

  // Prepare legend items for interactive legends (before hooks)
  const participantLegendItems: LegendItem[] = viewMode === 'all' 
    ? []
    : groupNames.map((name) => ({
        name,
        color: groupColors[name],
        dataKey: `uniqueParticipants_${name}`,
      }));

  const activityLegendItems: LegendItem[] = viewMode === 'all'
    ? []
    : groupNames.map((name) => ({
        name,
        color: groupColors[name],
        dataKey: `uniqueActivities_${name}`,
      }));

  const participationLegendItems: LegendItem[] = viewMode === 'all'
    ? []
    : groupNames.map((name) => ({
        name,
        color: groupColors[name],
        dataKey: `totalParticipation_${name}`,
      }));

  // Use interactive legend hooks (MUST be called before any conditional returns)
  const participantLegend = useInteractiveLegend('growth-participants', participantLegendItems);
  const activityLegend = useInteractiveLegend('growth-activities', activityLegendItems);
  const participationLegend = useInteractiveLegend('growth-participation', participationLegendItems);

  const periodOptions = [
    { label: 'Daily', value: 'DAY' as TimePeriod },
    { label: 'Weekly', value: 'WEEK' as TimePeriod },
    { label: 'Monthly', value: 'MONTH' as TimePeriod },
    { label: 'Yearly', value: 'YEAR' as TimePeriod },
  ];

  if (isLoading) {
    return <LoadingSpinner text="Loading growth metrics..." />;
  }

  // Check if we have data - either in timeSeries (all mode) or groupedTimeSeries (type/category mode)
  const hasData = metrics && (
    viewMode === 'all' 
      ? (metrics.timeSeries && metrics.timeSeries.length > 0)
      : (metrics.groupedTimeSeries && Object.keys(metrics.groupedTimeSeries).length > 0)
  );

  const timeSeriesData = metrics?.timeSeries || [];

  // Calculate absolute deltas from start to end of period
  // For grouped mode, calculate total across all groups
  let activityGrowth = 0;
  let participantGrowth = 0;
  let participationGrowth = 0;

  if (hasData) {
    if (viewMode === 'all' && timeSeriesData.length >= 2) {
      activityGrowth = timeSeriesData[timeSeriesData.length - 1].uniqueActivities - timeSeriesData[0].uniqueActivities;
      participantGrowth = timeSeriesData[timeSeriesData.length - 1].uniqueParticipants - timeSeriesData[0].uniqueParticipants;
      participationGrowth = timeSeriesData[timeSeriesData.length - 1].totalParticipation - timeSeriesData[0].totalParticipation;
    } else if (viewMode !== 'all' && metrics?.groupedTimeSeries) {
      // Sum up growth across all groups
      Object.values(metrics.groupedTimeSeries).forEach(groupData => {
        if (groupData.length >= 2) {
          activityGrowth += groupData[groupData.length - 1].uniqueActivities - groupData[0].uniqueActivities;
          participantGrowth += groupData[groupData.length - 1].uniqueParticipants - groupData[0].uniqueParticipants;
          participationGrowth += groupData[groupData.length - 1].totalParticipation - groupData[0].totalParticipation;
        }
      });
    }
  }

  // Merge grouped time series data into a single dataset for charts
  const mergedTimeSeriesData = viewMode === 'all' ? timeSeriesData : (() => {
    if (!metrics?.groupedTimeSeries) return timeSeriesData;

    // Get all unique dates across all groups
    const allDates = new Set<string>();
    Object.values(metrics.groupedTimeSeries).forEach(series => {
      series.forEach(item => allDates.add(item.date));
    });

    // Create merged data structure
    return Array.from(allDates).sort().map(date => {
      const dataPoint: any = { date };
      
      // Add data for each group
      groupNames.forEach(groupName => {
        const groupData = metrics.groupedTimeSeries![groupName];
        const item = groupData.find(d => d.date === date);
        dataPoint[`uniqueParticipants_${groupName}`] = item?.uniqueParticipants || 0;
        dataPoint[`uniqueActivities_${groupName}`] = item?.uniqueActivities || 0;
        dataPoint[`totalParticipation_${groupName}`] = item?.totalParticipation || 0;
      });

      return dataPoint;
    });
  })();

  return (
    <SpaceBetween size="l">
      <Container
        header={
          <Header variant="h3">Filters</Header>
        }
      >
        <SpaceBetween size="m">
          <ColumnLayout columns={2}>
            <div>
              <Box variant="awsui-key-label" margin={{ bottom: 'xs' }}>Date Range</Box>
              <DateRangePicker
                value={dateRange}
                onChange={({ detail }) => {
                  setDateRange(detail.value || null);
                }}
                placeholder="All history"
                dateOnly={true}
                relativeOptions={[
                  { key: 'previous-30-days', amount: 30, unit: 'day', type: 'relative' },
                  { key: 'previous-90-days', amount: 90, unit: 'day', type: 'relative' },
                  { key: 'previous-6-months', amount: 6, unit: 'month', type: 'relative' },
                  { key: 'previous-1-year', amount: 1, unit: 'year', type: 'relative' },
                ]}
                isValidRange={() => ({ valid: true })}
                i18nStrings={{
                  todayAriaLabel: 'Today',
                  nextMonthAriaLabel: 'Next month',
                  previousMonthAriaLabel: 'Previous month',
                  customRelativeRangeDurationLabel: 'Duration',
                  customRelativeRangeDurationPlaceholder: 'Enter duration',
                  customRelativeRangeOptionLabel: 'Custom range',
                  customRelativeRangeOptionDescription: 'Set a custom range in the past',
                  customRelativeRangeUnitLabel: 'Unit of time',
                  formatRelativeRange: (value) => {
                    const unit = value.amount === 1 
                      ? value.unit 
                      : value.unit === 'day' ? 'days' 
                      : value.unit === 'week' ? 'weeks' 
                      : value.unit === 'month' ? 'months' 
                      : 'years';
                    return `Last ${value.amount} ${unit}`;
                  },
                  formatUnit: (unit, value) => (value === 1 ? unit : `${unit}s`),
                  dateTimeConstraintText: 'Select a date range for growth analysis.',
                  relativeModeTitle: 'Relative range',
                  absoluteModeTitle: 'Absolute range',
                  relativeRangeSelectionHeading: 'Choose a range',
                  startDateLabel: 'Start date',
                  endDateLabel: 'End date',
                  clearButtonLabel: 'Clear and dismiss',
                  cancelButtonLabel: 'Cancel',
                  applyButtonLabel: 'Apply',
                }}
              />
            </div>
            <div>
              <Box variant="awsui-key-label" margin={{ bottom: 'xs' }}>Time Period Grouping</Box>
              <Select
                selectedOption={periodOptions.find((o) => o.value === period) || periodOptions[2]}
                onChange={({ detail }) => setPeriod(detail.selectedOption.value as TimePeriod)}
                options={periodOptions}
              />
            </div>
          </ColumnLayout>

          <div>
            <Box variant="awsui-key-label" margin={{ bottom: 'xs' }}>Group By</Box>
            <SegmentedControl
              selectedId={viewMode}
              onChange={({ detail }) => setViewMode(detail.selectedId as ViewMode)}
              label="Growth chart view mode"
              options={[
                { id: 'all', text: 'All' },
                { id: 'type', text: 'Activity Type' },
                { id: 'category', text: 'Activity Category' },
              ]}
            />
          </div>

          <div>
            <Box variant="awsui-key-label" margin={{ bottom: 'xs' }}>Populations</Box>
            <Multiselect
              selectedOptions={selectedPopulations}
              onChange={({ detail }) => setSelectedPopulations(detail.selectedOptions)}
              options={allPopulations.map(pop => ({ label: pop.name, value: pop.id }))}
              placeholder="Filter by populations"
              filteringType="auto"
              tokenLimit={3}
            />
          </div>
        </SpaceBetween>
      </Container>

      {/* Only display growth numbers in "All" view mode and when data is available */}
      {viewMode === 'all' && hasData && (
        <ColumnLayout columns={3} variant="text-grid">
          <Container>
            <Box variant="awsui-key-label">Activity Growth</Box>
            <Box fontSize="display-l" fontWeight="bold" color={activityGrowth >= 0 ? 'text-status-success' : 'text-status-error'}>
              {activityGrowth >= 0 ? '+' : ''}{activityGrowth}
            </Box>
          </Container>
          <Container>
            <SpaceBetween size="xs" direction="horizontal">
              <Box variant="awsui-key-label">Participant Growth</Box>
              <Popover
                dismissButton={false}
                position="top"
                size="small"
                triggerType="custom"
                content={
                  <Box variant="p">
                    <strong>Unique Participants:</strong> The count of distinct individuals involved in activities. 
                    The same person involved in multiple activities is counted only once.
                  </Box>
                }
              >
                <Icon name="status-info" variant="link" />
              </Popover>
            </SpaceBetween>
            <Box fontSize="display-l" fontWeight="bold" color={participantGrowth >= 0 ? 'text-status-success' : 'text-status-error'}>
              {participantGrowth >= 0 ? '+' : ''}{participantGrowth}
            </Box>
          </Container>
          <Container>
            <SpaceBetween size="xs" direction="horizontal">
              <Box variant="awsui-key-label">Participation Growth</Box>
              <Popover
                dismissButton={false}
                position="top"
                size="small"
                triggerType="custom"
                content={
                  <Box variant="p">
                    <strong>Total Participation:</strong> The sum of all participant-activity associations. 
                    The same person involved in 3 activities contributes 3 to this count.
                  </Box>
                }
              >
                <Icon name="status-info" variant="link" />
              </Popover>
            </SpaceBetween>
            <Box fontSize="display-l" fontWeight="bold" color={participationGrowth >= 0 ? 'text-status-success' : 'text-status-error'}>
              {participationGrowth >= 0 ? '+' : ''}{participationGrowth}
            </Box>
          </Container>
        </ColumnLayout>
      )}

      {/* Display charts or empty state */}
      {!hasData ? (
        <Container>
          <Box textAlign="center" padding="xxl">
            <b>No data available for the selected filters</b>
            <Box variant="p" color="text-body-secondary" margin={{ top: 'xs' }}>
              Try adjusting your filters or date range to see growth metrics.
            </Box>
          </Box>
        </Container>
      ) : (
        <>
      <Container header={<Header variant="h3">Unique Activities Over Time</Header>}>
        {viewMode !== 'all' && activityLegendItems.length > 0 && (
          <InteractiveLegend
            chartId="growth-activities"
            series={activityLegendItems}
            onVisibilityChange={activityLegend.handleVisibilityChange}
          />
        )}
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={mergedTimeSeriesData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis 
              label={{ value: 'Unique Activities', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip />
            {viewMode === 'all' ? (
              <Line
                type="monotone"
                dataKey="uniqueActivities"
                stroke="#00C49F"
                strokeWidth={2}
                name="Unique Activities"
              />
            ) : (
              groupNames
                .filter((groupName) => activityLegend.isSeriesVisible(groupName))
                .map((groupName) => (
                  <Line
                    key={groupName}
                    type="monotone"
                    dataKey={`uniqueActivities_${groupName}`}
                    stroke={groupColors[groupName]}
                    strokeWidth={2}
                    name={groupName}
                  />
                ))
            )}
          </LineChart>
        </ResponsiveContainer>
      </Container>

          <Container header={<Header variant="h3">Unique Participants Over Time</Header>}>
            {viewMode !== 'all' && participantLegendItems.length > 0 && (
              <InteractiveLegend
                chartId="growth-participants"
                series={participantLegendItems}
                onVisibilityChange={participantLegend.handleVisibilityChange}
              />
            )}
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={mergedTimeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis 
                  label={{ value: 'Unique Participants', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip />
                {viewMode === 'all' ? (
                  <Line
                    type="monotone"
                    dataKey="uniqueParticipants"
                    stroke="#0088FE"
                    strokeWidth={2}
                    name="Unique Participants"
                  />
                ) : (
                  groupNames
                    .filter((groupName) => participantLegend.isSeriesVisible(groupName))
                    .map((groupName) => (
                      <Line
                        key={groupName}
                        type="monotone"
                        dataKey={`uniqueParticipants_${groupName}`}
                        stroke={groupColors[groupName]}
                        strokeWidth={2}
                        name={groupName}
                      />
                    ))
                )}
              </LineChart>
            </ResponsiveContainer>
          </Container>

      <Container header={<Header variant="h3">Total Participation Over Time</Header>}>
        {viewMode !== 'all' && participationLegendItems.length > 0 && (
          <InteractiveLegend
            chartId="growth-participation"
            series={participationLegendItems}
            onVisibilityChange={participationLegend.handleVisibilityChange}
          />
        )}
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={mergedTimeSeriesData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis 
              label={{ value: 'Total Participation', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip />
            {viewMode === 'all' ? (
              <Line
                type="monotone"
                dataKey="totalParticipation"
                stroke="#FFBB28"
                strokeWidth={2}
                name="Total Participation"
              />
            ) : (
              groupNames
                .filter((groupName) => participationLegend.isSeriesVisible(groupName))
                .map((groupName) => (
                  <Line
                    key={groupName}
                    type="monotone"
                    dataKey={`totalParticipation_${groupName}`}
                    stroke={groupColors[groupName]}
                    strokeWidth={2}
                    name={groupName}
                  />
                ))
            )}
          </LineChart>
        </ResponsiveContainer>
      </Container>
        </>
      )}
    </SpaceBetween>
  );
}
