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
import { GeographicAreaService } from '../../services/api/geographic-area.service';
import { LoadingSpinner } from '../common/LoadingSpinner';

export function GrowthDashboard() {
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month');
  const [geographicAreaId, setGeographicAreaId] = useState('');

  const { data: geographicAreas = [] } = useQuery({
    queryKey: ['geographicAreas'],
    queryFn: () => GeographicAreaService.getGeographicAreas(),
  });

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['growthMetrics', period, geographicAreaId],
    queryFn: () => AnalyticsService.getGrowthMetrics(period, geographicAreaId || undefined),
  });

  const periodOptions = [
    { label: 'Daily', value: 'day' },
    { label: 'Weekly', value: 'week' },
    { label: 'Monthly', value: 'month' },
    { label: 'Yearly', value: 'year' },
  ];

  const geographicAreaOptions = [
    { label: 'All areas', value: '' },
    ...geographicAreas.map((area) => ({
      label: area.name,
      value: area.id,
    })),
  ];

  if (isLoading) {
    return <LoadingSpinner text="Loading growth metrics..." />;
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
          <Header variant="h3">Filters</Header>
        }
      >
        <SpaceBetween direction="horizontal" size="m">
          <Select
            selectedOption={periodOptions.find((o) => o.value === period) || periodOptions[2]}
            onChange={({ detail }) => setPeriod(detail.selectedOption.value as 'day' | 'week' | 'month' | 'year')}
            options={periodOptions}
          />
          <Select
            selectedOption={geographicAreaOptions.find((o) => o.value === geographicAreaId) || geographicAreaOptions[0]}
            onChange={({ detail }) => setGeographicAreaId(detail.selectedOption.value || '')}
            options={geographicAreaOptions}
          />
        </SpaceBetween>
      </Container>

      <ColumnLayout columns={2} variant="text-grid">
        <Container>
          <Box variant="awsui-key-label">Participant Change</Box>
          <Box fontSize="display-l" fontWeight="bold" color={metrics.participantChange >= 0 ? 'text-status-success' : 'text-status-error'}>
            {metrics.participantChange >= 0 ? '+' : ''}{metrics.participantChange}%
          </Box>
        </Container>
        <Container>
          <Box variant="awsui-key-label">Activity Change</Box>
          <Box fontSize="display-l" fontWeight="bold" color={metrics.activityChange >= 0 ? 'text-status-success' : 'text-status-error'}>
            {metrics.activityChange >= 0 ? '+' : ''}{metrics.activityChange}%
          </Box>
        </Container>
      </ColumnLayout>

      <Container header={<Header variant="h3">New Participants and Activities</Header>}>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="count"
              data={metrics.newParticipants}
              stroke="#0088FE"
              name="New Participants"
            />
            <Line
              type="monotone"
              dataKey="count"
              data={metrics.newActivities}
              stroke="#00C49F"
              name="New Activities"
            />
          </LineChart>
        </ResponsiveContainer>
      </Container>

      <Container header={<Header variant="h3">Cumulative Growth</Header>}>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area
              type="monotone"
              dataKey="count"
              data={metrics.cumulativeParticipants}
              stroke="#0088FE"
              fill="#0088FE"
              fillOpacity={0.6}
              name="Cumulative Participants"
            />
            <Area
              type="monotone"
              dataKey="count"
              data={metrics.cumulativeActivities}
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
