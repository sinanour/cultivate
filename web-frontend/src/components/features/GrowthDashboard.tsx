import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Box from '@cloudscape-design/components/box';
import Select from '@cloudscape-design/components/select';
import DateRangePicker from '@cloudscape-design/components/date-range-picker';
import type { DateRangePickerProps } from '@cloudscape-design/components/date-range-picker';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AnalyticsService } from '../../services/api/analytics.service';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useGlobalGeographicFilter } from '../../hooks/useGlobalGeographicFilter';

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

// Initialize with null to query all history
const getDefaultDateRange = (): DateRangePickerProps.Value | null => {
  return null;
};

export function GrowthDashboard() {
  const [period, setPeriod] = useState<'DAY' | 'WEEK' | 'MONTH' | 'YEAR'>('MONTH');
  const [dateRange, setDateRange] = useState<DateRangePickerProps.Value | null>(getDefaultDateRange());
  const { selectedGeographicAreaId } = useGlobalGeographicFilter();

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['growthMetrics', dateRange, period, selectedGeographicAreaId],
    queryFn: () => {
      // Convert date range to ISO datetime format for API
      let startDate: string | undefined;
      let endDate: string | undefined;
      
      if (dateRange && dateRange.type === 'absolute') {
        startDate = toISODateTime(dateRange.startDate, false);
        endDate = toISODateTime(dateRange.endDate, true);
      }
      // If dateRange is null, both startDate and endDate remain undefined (query all history)
      
      return AnalyticsService.getGrowthMetrics(
        startDate,
        endDate,
        period,
        selectedGeographicAreaId || undefined
      );
    },
  });

  const periodOptions = [
    { label: 'Daily', value: 'DAY' },
    { label: 'Weekly', value: 'WEEK' },
    { label: 'Monthly', value: 'MONTH' },
    { label: 'Yearly', value: 'YEAR' },
  ];

  if (isLoading) {
    return <LoadingSpinner text="Loading growth metrics..." />;
  }

  if (!metrics || !metrics.timeSeries || metrics.timeSeries.length === 0) {
    return (
      <Box textAlign="center" padding="xxl">
        <b>No data available</b>
      </Box>
    );
  }

  const timeSeriesData = metrics.timeSeries;

  // Calculate percentage changes
  const participantChange = timeSeriesData.length >= 2
    ? ((timeSeriesData[timeSeriesData.length - 1].newParticipants - timeSeriesData[timeSeriesData.length - 2].newParticipants) / 
       (timeSeriesData[timeSeriesData.length - 2].newParticipants || 1)) * 100
    : 0;

  const activityChange = timeSeriesData.length >= 2
    ? ((timeSeriesData[timeSeriesData.length - 1].newActivities - timeSeriesData[timeSeriesData.length - 2].newActivities) / 
       (timeSeriesData[timeSeriesData.length - 2].newActivities || 1)) * 100
    : 0;

  return (
    <SpaceBetween size="l">
      <Container
        header={
          <Header variant="h3">Date Range Filter</Header>
        }
      >
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
              const unit = value.unit === 'day' ? 'days' : value.unit === 'week' ? 'weeks' : value.unit === 'month' ? 'months' : 'years';
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
      </Container>

      <Container
        header={
          <Header variant="h3">Time Period Grouping</Header>
        }
      >
        <Select
          selectedOption={periodOptions.find((o) => o.value === period) || periodOptions[2]}
          onChange={({ detail }) => setPeriod(detail.selectedOption.value as 'DAY' | 'WEEK' | 'MONTH' | 'YEAR')}
          options={periodOptions}
        />
      </Container>

      <ColumnLayout columns={2} variant="text-grid">
        <Container>
          <Box variant="awsui-key-label">Participant Change</Box>
          <Box fontSize="display-l" fontWeight="bold" color={participantChange >= 0 ? 'text-status-success' : 'text-status-error'}>
            {participantChange >= 0 ? '+' : ''}{participantChange.toFixed(1)}%
          </Box>
        </Container>
        <Container>
          <Box variant="awsui-key-label">Activity Change</Box>
          <Box fontSize="display-l" fontWeight="bold" color={activityChange >= 0 ? 'text-status-success' : 'text-status-error'}>
            {activityChange >= 0 ? '+' : ''}{activityChange.toFixed(1)}%
          </Box>
        </Container>
      </ColumnLayout>

      <Container header={<Header variant="h3">New Participants and Activities</Header>}>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={timeSeriesData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="newParticipants"
              stroke="#0088FE"
              name="New Participants"
            />
            <Line
              type="monotone"
              dataKey="newActivities"
              stroke="#00C49F"
              name="New Activities"
            />
          </LineChart>
        </ResponsiveContainer>
      </Container>

      <Container header={<Header variant="h3">Cumulative Growth</Header>}>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={timeSeriesData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area
              type="monotone"
              dataKey="cumulativeParticipants"
              stroke="#0088FE"
              fill="#0088FE"
              fillOpacity={0.6}
              name="Cumulative Participants"
            />
            <Area
              type="monotone"
              dataKey="cumulativeActivities"
              stroke="#00C49F"
              fill="#00C49F"
              fillOpacity={0.6}
              name="Cumulative Activities"
            />
          </AreaChart>
        </ResponsiveContainer>
      </Container>
    </SpaceBetween>
  );
}
