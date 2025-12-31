import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Box from '@cloudscape-design/components/box';
import Select from '@cloudscape-design/components/select';
import DateRangePicker from '@cloudscape-design/components/date-range-picker';
import type { DateRangePickerProps } from '@cloudscape-design/components/date-range-picker';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AnalyticsService, type GrowthMetricsParams } from '../../services/api/analytics.service';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useGlobalGeographicFilter } from '../../hooks/useGlobalGeographicFilter';
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

export function GrowthDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedGeographicAreaId } = useGlobalGeographicFilter();

  // Initialize state from URL parameters
  const [period, setPeriod] = useState<TimePeriod>(() => {
    const urlPeriod = searchParams.get('period');
    return (urlPeriod as TimePeriod) || 'MONTH';
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

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams(searchParams);

    // Update period
    params.set('period', period);

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

    setSearchParams(params, { replace: true });
  }, [period, dateRange, searchParams, setSearchParams]);

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['growthMetrics', dateRange, period, selectedGeographicAreaId],
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
      
      const params: GrowthMetricsParams = {
        startDate,
        endDate,
        period,
        geographicAreaId: selectedGeographicAreaId || undefined,
      };
      
      return AnalyticsService.getGrowthMetrics(params);
    },
  });

  const periodOptions = [
    { label: 'Daily', value: 'DAY' as TimePeriod },
    { label: 'Weekly', value: 'WEEK' as TimePeriod },
    { label: 'Monthly', value: 'MONTH' as TimePeriod },
    { label: 'Yearly', value: 'YEAR' as TimePeriod },
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

  // Calculate absolute deltas from start to end of period
  const activityGrowth = timeSeriesData.length >= 2
    ? timeSeriesData[timeSeriesData.length - 1].uniqueActivities - timeSeriesData[0].uniqueActivities
    : 0;

  const participantGrowth = timeSeriesData.length >= 2
    ? timeSeriesData[timeSeriesData.length - 1].uniqueParticipants - timeSeriesData[0].uniqueParticipants
    : 0;

  return (
    <SpaceBetween size="l">
      <Container
        header={
          <Header variant="h3">Filters</Header>
        }
      >
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
      </Container>

      <ColumnLayout columns={2} variant="text-grid">
        <Container>
          <Box variant="awsui-key-label">Participant Growth</Box>
          <Box fontSize="display-l" fontWeight="bold" color={participantGrowth >= 0 ? 'text-status-success' : 'text-status-error'}>
            {participantGrowth >= 0 ? '+' : ''}{participantGrowth}
          </Box>
        </Container>
        <Container>
          <Box variant="awsui-key-label">Activity Growth</Box>
          <Box fontSize="display-l" fontWeight="bold" color={activityGrowth >= 0 ? 'text-status-success' : 'text-status-error'}>
            {activityGrowth >= 0 ? '+' : ''}{activityGrowth}
          </Box>
        </Container>
      </ColumnLayout>

      <Container header={<Header variant="h3">Unique Engagement Over Time</Header>}>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={timeSeriesData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis 
              yAxisId="left"
              label={{ value: 'Unique Participants', angle: -90, position: 'insideLeft' }}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              label={{ value: 'Unique Activities', angle: 90, position: 'insideRight' }}
            />
            <Tooltip />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="uniqueParticipants"
              stroke="#0088FE"
              strokeWidth={2}
              name="Unique Participants"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="uniqueActivities"
              stroke="#00C49F"
              strokeWidth={2}
              name="Unique Activities"
            />
          </LineChart>
        </ResponsiveContainer>
      </Container>
    </SpaceBetween>
  );
}
