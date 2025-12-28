import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Box from '@cloudscape-design/components/box';
import Select from '@cloudscape-design/components/select';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AnalyticsService } from '../../services/api/analytics.service';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useGlobalGeographicFilter } from '../../hooks/useGlobalGeographicFilter';

export function GrowthDashboard() {
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month');
  const { selectedGeographicAreaId } = useGlobalGeographicFilter();

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['growthMetrics', period, selectedGeographicAreaId],
    queryFn: () => AnalyticsService.getGrowthMetrics(period, selectedGeographicAreaId || undefined),
  });

  const periodOptions = [
    { label: 'Daily', value: 'day' },
    { label: 'Weekly', value: 'week' },
    { label: 'Monthly', value: 'month' },
    { label: 'Yearly', value: 'year' },
  ];

  if (isLoading) {
    return <LoadingSpinner text="Loading growth metrics..." />;
  }

  if (!metrics || metrics.length === 0) {
    return (
      <Box textAlign="center" padding="xxl">
        <b>No data available</b>
      </Box>
    );
  }

  // Calculate percentage changes
  const participantChange = metrics.length >= 2
    ? ((metrics[metrics.length - 1].newParticipants - metrics[metrics.length - 2].newParticipants) / 
       (metrics[metrics.length - 2].newParticipants || 1)) * 100
    : 0;

  const activityChange = metrics.length >= 2
    ? ((metrics[metrics.length - 1].newActivities - metrics[metrics.length - 2].newActivities) / 
       (metrics[metrics.length - 2].newActivities || 1)) * 100
    : 0;

  return (
    <SpaceBetween size="l">
      <Container
        header={
          <Header variant="h3">Time Period Filter</Header>
        }
      >
        <Select
          selectedOption={periodOptions.find((o) => o.value === period) || periodOptions[2]}
          onChange={({ detail }) => setPeriod(detail.selectedOption.value as 'day' | 'week' | 'month' | 'year')}
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
          <LineChart data={metrics}>
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
          <AreaChart data={metrics}>
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
