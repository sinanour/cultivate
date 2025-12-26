import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Box from '@cloudscape-design/components/box';
import Select from '@cloudscape-design/components/select';
import DateRangePicker from '@cloudscape-design/components/date-range-picker';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AnalyticsService } from '../../services/api/analytics.service';
import { GeographicAreaService } from '../../services/api/geographic-area.service';
import { LoadingSpinner } from '../common/LoadingSpinner';

export function EngagementDashboard() {
  const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string } | null>(null);
  const [geographicAreaId, setGeographicAreaId] = useState('');

  const { data: geographicAreas = [] } = useQuery({
    queryKey: ['geographicAreas'],
    queryFn: () => GeographicAreaService.getGeographicAreas(),
  });

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['engagementMetrics', dateRange, geographicAreaId],
    queryFn: () =>
      AnalyticsService.getEngagementMetrics(
        dateRange?.startDate,
        dateRange?.endDate,
        geographicAreaId || undefined
      ),
  });

  const geographicAreaOptions = [
    { label: 'All areas', value: '' },
    ...geographicAreas.map((area) => ({
      label: area.name,
      value: area.id,
    })),
  ];

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
          <Header variant="h3">Filters</Header>
        }
      >
        <SpaceBetween size="m">
          <DateRangePicker
            value={dateRange ? {
              type: 'absolute',
              startDate: dateRange.startDate,
              endDate: dateRange.endDate,
            } : null}
            onChange={({ detail }) => {
              if (detail.value && detail.value.type === 'absolute') {
                setDateRange({
                  startDate: detail.value.startDate,
                  endDate: detail.value.endDate,
                });
              } else {
                setDateRange(null);
              }
            }}
            placeholder="Filter by date range"
            relativeOptions={[]}
            isValidRange={() => ({ valid: true })}
          />
          <Select
            selectedOption={geographicAreaOptions.find((o) => o.value === geographicAreaId) || geographicAreaOptions[0]}
            onChange={({ detail }) => setGeographicAreaId(detail.selectedOption.value || '')}
            options={geographicAreaOptions}
          />
        </SpaceBetween>
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
