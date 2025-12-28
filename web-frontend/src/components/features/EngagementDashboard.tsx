import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Box from '@cloudscape-design/components/box';
import DateRangePicker from '@cloudscape-design/components/date-range-picker';
import type { DateRangePickerProps } from '@cloudscape-design/components/date-range-picker';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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

// Initialize with last 30 days
const getDefaultDateRange = (): DateRangePickerProps.Value => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  
  return {
    type: 'absolute',
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
};

export function EngagementDashboard() {
  const [dateRange, setDateRange] = useState<DateRangePickerProps.Value>(getDefaultDateRange());
  const { selectedGeographicAreaId } = useGlobalGeographicFilter();

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['engagementMetrics', dateRange, selectedGeographicAreaId],
    queryFn: () => {
      // Convert date range to ISO datetime format for API
      let startDate: string | undefined;
      let endDate: string | undefined;
      
      if (dateRange && dateRange.type === 'absolute') {
        startDate = toISODateTime(dateRange.startDate, false);
        endDate = toISODateTime(dateRange.endDate, true);
      }
      
      return AnalyticsService.getEngagementMetrics(
        startDate,
        endDate,
        selectedGeographicAreaId || undefined
      );
    },
  });

  if (isLoading) {
    return <LoadingSpinner text="Loading engagement metrics..." />;
  }

  if (!metrics) {
    return (
      <Box textAlign="center" padding="xxl">
        <b>No data available</b>
      </Box>
    );
  }

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
            if (detail.value) {
              setDateRange(detail.value);
            }
          }}
          placeholder="Filter by date range"
          dateOnly={true}
          relativeOptions={[
            { key: 'previous-7-days', amount: 7, unit: 'day', type: 'relative' },
            { key: 'previous-30-days', amount: 30, unit: 'day', type: 'relative' },
            { key: 'previous-90-days', amount: 90, unit: 'day', type: 'relative' },
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
            dateTimeConstraintText: 'Range must be between 6 and 30 days.',
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

      <ColumnLayout columns={4} variant="text-grid">
        <Container>
          <Box variant="awsui-key-label">Total Participants</Box>
          <Box fontSize="display-l" fontWeight="bold">
            {metrics.totalParticipants}
          </Box>
        </Container>
        <Container>
          <Box variant="awsui-key-label">Total Activities</Box>
          <Box fontSize="display-l" fontWeight="bold">
            {metrics.totalActivities}
          </Box>
        </Container>
        <Container>
          <Box variant="awsui-key-label">Active Activities</Box>
          <Box fontSize="display-l" fontWeight="bold">
            {metrics.activeActivities}
          </Box>
        </Container>
        <Container>
          <Box variant="awsui-key-label">Participation Rate</Box>
          <Box fontSize="display-l" fontWeight="bold">
            {(metrics.participationRate * 100).toFixed(1)}%
          </Box>
        </Container>
      </ColumnLayout>

      {metrics.geographicBreakdown && metrics.geographicBreakdown.length > 0 && (
        <Container header={<Header variant="h3">Geographic Breakdown</Header>}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={metrics.geographicBreakdown}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="geographicAreaName" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#00C49F" />
            </BarChart>
          </ResponsiveContainer>
        </Container>
      )}
    </SpaceBetween>
  );
}
