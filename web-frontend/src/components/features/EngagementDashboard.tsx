import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Box from '@cloudscape-design/components/box';
import DateRangePicker from '@cloudscape-design/components/date-range-picker';
import Select from '@cloudscape-design/components/select';
import Multiselect from '@cloudscape-design/components/multiselect';
import Table from '@cloudscape-design/components/table';
import Link from '@cloudscape-design/components/link';
import type { DateRangePickerProps } from '@cloudscape-design/components/date-range-picker';
import type { SelectProps } from '@cloudscape-design/components/select';
import type { MultiselectProps } from '@cloudscape-design/components/multiselect';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { AnalyticsService, type EngagementMetricsParams } from '../../services/api/analytics.service';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useGlobalGeographicFilter } from '../../hooks/useGlobalGeographicFilter';
import { GroupingDimension, DateGranularity } from '../../utils/constants';
import type { GroupedMetrics } from '../../types';

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

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export function EngagementDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Initialize state from URL parameters
  const initializeDateRange = (): DateRangePickerProps.Value | null => {
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
  };

  const initializeGroupByDimensions = (): MultiselectProps.Options => {
    const groupByParam = searchParams.get('groupBy');
    if (!groupByParam) return [];
    
    const dimensions = groupByParam.split(',');
    return dimensions.map(dim => {
      const label = dim.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      return { label, value: dim };
    });
  };

  const initializeDateGranularity = (): SelectProps.Option | null => {
    const granularity = searchParams.get('dateGranularity');
    if (!granularity) return null;
    
    const label = granularity.charAt(0) + granularity.slice(1).toLowerCase();
    return { label, value: granularity };
  };

  const initializeActivityTypeFilter = (): SelectProps.Option | null => {
    const activityType = searchParams.get('activityType');
    if (!activityType) return null;
    
    // Note: We'll need to fetch the activity type name from the API or cache
    // For now, just use the ID as the label
    return { label: activityType, value: activityType };
  };

  const initializeVenueFilter = (): SelectProps.Option | null => {
    const venue = searchParams.get('venue');
    if (!venue) return null;
    
    // Note: We'll need to fetch the venue name from the API or cache
    // For now, just use the ID as the label
    return { label: venue, value: venue };
  };

  const [dateRange, setDateRange] = useState<DateRangePickerProps.Value | null>(initializeDateRange);
  const [activityTypeFilter, setActivityTypeFilter] = useState<SelectProps.Option | null>(initializeActivityTypeFilter);
  const [venueFilter, setVenueFilter] = useState<SelectProps.Option | null>(initializeVenueFilter);
  const [groupByDimensions, setGroupByDimensions] = useState<MultiselectProps.Options>(initializeGroupByDimensions);
  const [dateGranularity, setDateGranularity] = useState<SelectProps.Option | null>(initializeDateGranularity);
  
  const { selectedGeographicAreaId } = useGlobalGeographicFilter();

  // Sync state to URL whenever filters or grouping changes
  useEffect(() => {
    const params = new URLSearchParams();
    
    // Add date range parameters
    if (dateRange) {
      if (dateRange.type === 'absolute') {
        params.set('startDate', dateRange.startDate);
        params.set('endDate', dateRange.endDate);
      } else if (dateRange.type === 'relative') {
        // Convert relative date range to compact format (e.g., "-90d", "-6m")
        const unitChar = dateRange.unit.charAt(0); // 'd', 'w', 'm', 'y'
        params.set('relativePeriod', `-${dateRange.amount}${unitChar}`);
      }
    }
    
    if (activityTypeFilter?.value) {
      params.set('activityType', activityTypeFilter.value);
    }
    
    if (venueFilter?.value) {
      params.set('venue', venueFilter.value);
    }
    
    if (selectedGeographicAreaId) {
      params.set('geographicArea', selectedGeographicAreaId);
    }
    
    // Add grouping parameters
    if (groupByDimensions.length > 0) {
      const groupByValues = groupByDimensions.map(d => d.value).join(',');
      params.set('groupBy', groupByValues);
    }
    
    if (dateGranularity?.value) {
      params.set('dateGranularity', dateGranularity.value);
    }
    
    // Update URL without causing navigation/reload
    setSearchParams(params, { replace: true });
  }, [dateRange, activityTypeFilter, venueFilter, selectedGeographicAreaId, groupByDimensions, dateGranularity, setSearchParams]);

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['engagementMetrics', dateRange, selectedGeographicAreaId, activityTypeFilter, venueFilter, groupByDimensions, dateGranularity],
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
      
      const params: EngagementMetricsParams = {
        startDate,
        endDate,
        geographicAreaId: selectedGeographicAreaId || undefined,
        activityTypeId: activityTypeFilter?.value,
        venueId: venueFilter?.value,
        groupBy: groupByDimensions.map(d => d.value as GroupingDimension),
        dateGranularity: dateGranularity?.value as DateGranularity | undefined,
      };
      
      return AnalyticsService.getEngagementMetrics(params);
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

  // Prepare chart data for activities by type
  const activitiesByTypeChartData = metrics.activitiesByType.map(type => ({
    name: type.activityTypeName,
    'At Start': type.activitiesAtStart,
    'At End': type.activitiesAtEnd,
    'Started': type.activitiesStarted,
    'Completed': type.activitiesCompleted,
    'Cancelled': type.activitiesCancelled,
  }));

  // Prepare chart data for role distribution
  const roleDistributionChartData = metrics.roleDistribution.map(role => ({
    name: role.roleName,
    value: role.count,
  }));

  return (
    <SpaceBetween size="l">
      {/* Filters Section */}
      <Container
        header={<Header variant="h3">Filters and Grouping</Header>}
      >
        <SpaceBetween size="m">
          {/* Date Range and Date Granularity */}
          <ColumnLayout columns={2}>
            <DateRangePicker
              value={dateRange}
              onChange={({ detail }) => setDateRange(detail.value || null)}
              placeholder="All history"
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
            
            <Select
              selectedOption={dateGranularity}
              onChange={({ detail }) => setDateGranularity(detail.selectedOption)}
              options={[
                { label: 'Weekly', value: DateGranularity.WEEKLY },
                { label: 'Monthly', value: DateGranularity.MONTHLY },
                { label: 'Quarterly', value: DateGranularity.QUARTERLY },
                { label: 'Yearly', value: DateGranularity.YEARLY },
              ]}
              placeholder="Date granularity (for date grouping)"
              selectedAriaLabel="Selected"
            />
          </ColumnLayout>

          {/* Point Filters: Activity Type and Venue */}
          <ColumnLayout columns={2}>
            <Select
              selectedOption={activityTypeFilter}
              onChange={({ detail }) => setActivityTypeFilter(detail.selectedOption)}
              options={[]}
              placeholder="Filter by activity type"
              selectedAriaLabel="Selected"
              empty="No activity types available"
            />
            
            <Select
              selectedOption={venueFilter}
              onChange={({ detail }) => setVenueFilter(detail.selectedOption)}
              options={[]}
              placeholder="Filter by venue"
              selectedAriaLabel="Selected"
              empty="No venues available"
            />
          </ColumnLayout>

          {/* Grouping Dimensions */}
          <ColumnLayout columns={2}>
            <Multiselect
              selectedOptions={groupByDimensions}
              onChange={({ detail }) => setGroupByDimensions(detail.selectedOptions)}
              options={[
                { label: 'Activity Type', value: GroupingDimension.ACTIVITY_TYPE },
                { label: 'Venue', value: GroupingDimension.VENUE },
                { label: 'Geographic Area', value: GroupingDimension.GEOGRAPHIC_AREA },
                { label: 'Date', value: GroupingDimension.DATE },
              ]}
              placeholder="Group by dimensions"
              selectedAriaLabel="Selected"
            />
          </ColumnLayout>
        </SpaceBetween>
      </Container>

      {/* Temporal Activity Metrics */}
      <Container header={<Header variant="h3">Activity Metrics</Header>}>
        <ColumnLayout columns={5} variant="text-grid">
          <Container>
            <Box variant="awsui-key-label">At Start</Box>
            <Box fontSize="display-l" fontWeight="bold">
              {metrics.activitiesAtStart}
            </Box>
          </Container>
          <Container>
            <Box variant="awsui-key-label">At End</Box>
            <Box fontSize="display-l" fontWeight="bold">
              {metrics.activitiesAtEnd}
            </Box>
          </Container>
          <Container>
            <Box variant="awsui-key-label">Started</Box>
            <Box fontSize="display-l" fontWeight="bold">
              {metrics.activitiesStarted}
            </Box>
          </Container>
          <Container>
            <Box variant="awsui-key-label">Completed</Box>
            <Box fontSize="display-l" fontWeight="bold">
              {metrics.activitiesCompleted}
            </Box>
          </Container>
          <Container>
            <Box variant="awsui-key-label">Cancelled</Box>
            <Box fontSize="display-l" fontWeight="bold">
              {metrics.activitiesCancelled}
            </Box>
          </Container>
        </ColumnLayout>
      </Container>

      {/* Temporal Participant Metrics */}
      <Container header={<Header variant="h3">Participant Metrics</Header>}>
        <ColumnLayout columns={4} variant="text-grid">
          <Container>
            <Box variant="awsui-key-label">At Start</Box>
            <Box fontSize="display-l" fontWeight="bold">
              {metrics.participantsAtStart}
            </Box>
          </Container>
          <Container>
            <Box variant="awsui-key-label">At End</Box>
            <Box fontSize="display-l" fontWeight="bold">
              {metrics.participantsAtEnd}
            </Box>
          </Container>
          <Container>
            <Box variant="awsui-key-label">New</Box>
            <Box fontSize="display-l" fontWeight="bold">
              {metrics.newParticipants}
            </Box>
          </Container>
          <Container>
            <Box variant="awsui-key-label">Disengaged</Box>
            <Box fontSize="display-l" fontWeight="bold">
              {metrics.disengagedParticipants}
            </Box>
          </Container>
        </ColumnLayout>
      </Container>

      {/* Aggregate Totals */}
      <Container header={<Header variant="h3">Aggregate Totals</Header>}>
        <ColumnLayout columns={2} variant="text-grid">
          <Container>
            <Box variant="awsui-key-label">Total Activities</Box>
            <Box fontSize="display-l" fontWeight="bold">
              {metrics.totalActivities}
            </Box>
          </Container>
          <Container>
            <Box variant="awsui-key-label">Total Participants</Box>
            <Box fontSize="display-l" fontWeight="bold">
              {metrics.totalParticipants}
            </Box>
          </Container>
        </ColumnLayout>
      </Container>

      {/* Activities by Type Breakdown */}
      {metrics.activitiesByType && metrics.activitiesByType.length > 0 && (
        <Container header={<Header variant="h3">Activities by Type</Header>}>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={activitiesByTypeChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="At Start" fill="#0088FE" />
              <Bar dataKey="At End" fill="#00C49F" />
              <Bar dataKey="Started" fill="#FFBB28" />
              <Bar dataKey="Completed" fill="#FF8042" />
              <Bar dataKey="Cancelled" fill="#8884D8" />
            </BarChart>
          </ResponsiveContainer>
        </Container>
      )}

      {/* Role Distribution */}
      {metrics.roleDistribution && metrics.roleDistribution.length > 0 && (
        <Container header={<Header variant="h3">Role Distribution</Header>}>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={roleDistributionChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${entry.value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {roleDistributionChartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Container>
      )}

      {/* Geographic Breakdown */}
      {metrics.geographicBreakdown && metrics.geographicBreakdown.length > 0 && (
        <Container header={<Header variant="h3">Geographic Breakdown</Header>}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={metrics.geographicBreakdown}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="geographicAreaName" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="activityCount" fill="#0088FE" name="Activities" />
              <Bar dataKey="participantCount" fill="#00C49F" name="Participants" />
            </BarChart>
          </ResponsiveContainer>
        </Container>
      )}

            {metrics.groupedResults && metrics.groupedResults.length > 0 && (
        <Container header={<Header variant="h3">Grouped Results</Header>}>
          <Table
            columnDefinitions={[
              // Dimension columns first
              ...(metrics.groupingDimensions || []).map(dimension => {
                return {
                  id: dimension,
                  header: dimension.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                  cell: (item: GroupedMetrics) => {
                    // Get the name and ID using the dimension value
                    const nameValue = item.dimensions[dimension];
                    const idValue = item.dimensions[`${dimension}Id`];
                    
                    // Render hyperlinks for specific dimensions using constants
                    if (dimension === GroupingDimension.ACTIVITY_TYPE) {
                      if (idValue) {
                        return (
                          <Link 
                            href={`/activity-types`}
                            onFollow={(e) => {
                              e.preventDefault();
                              navigate('/activity-types');
                            }}
                          >
                            {nameValue}
                          </Link>
                        );
                      }
                      return nameValue || '-';
                    } else if (dimension === GroupingDimension.VENUE) {
                      if (idValue) {
                        return (
                          <Link 
                            href={`/venues/${idValue}`}
                            onFollow={(e) => {
                              e.preventDefault();
                              navigate(`/venues/${idValue}`);
                            }}
                          >
                            {nameValue}
                          </Link>
                        );
                      }
                      return nameValue || '-';
                    } else if (dimension === GroupingDimension.GEOGRAPHIC_AREA) {
                      if (idValue) {
                        return (
                          <Link 
                            href={`/geographic-areas/${idValue}`}
                            onFollow={(e) => {
                              e.preventDefault();
                              navigate(`/geographic-areas/${idValue}`);
                            }}
                          >
                            {nameValue}
                          </Link>
                        );
                      }
                      return nameValue || '-';
                    }
                    
                    // For date or other dimensions without IDs, just display the value
                    return nameValue || '-';
                  },
                  sortingField: dimension,
                };
              }),
              // Metric columns follow
              {
                id: 'activitiesAtStart',
                header: 'Activities at Start',
                cell: (item: GroupedMetrics) => item.metrics.activitiesAtStart,
                sortingField: 'activitiesAtStart',
              },
              {
                id: 'activitiesAtEnd',
                header: 'Activities at End',
                cell: (item: GroupedMetrics) => item.metrics.activitiesAtEnd,
                sortingField: 'activitiesAtEnd',
              },
              {
                id: 'activitiesStarted',
                header: 'Activities Started',
                cell: (item: GroupedMetrics) => item.metrics.activitiesStarted,
                sortingField: 'activitiesStarted',
              },
              {
                id: 'activitiesCompleted',
                header: 'Activities Completed',
                cell: (item: GroupedMetrics) => item.metrics.activitiesCompleted,
                sortingField: 'activitiesCompleted',
              },
              {
                id: 'activitiesCancelled',
                header: 'Activities Cancelled',
                cell: (item: GroupedMetrics) => item.metrics.activitiesCancelled,
                sortingField: 'activitiesCancelled',
              },
              {
                id: 'participantsAtStart',
                header: 'Participants at Start',
                cell: (item: GroupedMetrics) => item.metrics.participantsAtStart,
                sortingField: 'participantsAtStart',
              },
              {
                id: 'participantsAtEnd',
                header: 'Participants at End',
                cell: (item: GroupedMetrics) => item.metrics.participantsAtEnd,
                sortingField: 'participantsAtEnd',
              },
              {
                id: 'newParticipants',
                header: 'New Participants',
                cell: (item: GroupedMetrics) => item.metrics.newParticipants,
                sortingField: 'newParticipants',
              },
              {
                id: 'disengagedParticipants',
                header: 'Disengaged Participants',
                cell: (item: GroupedMetrics) => item.metrics.disengagedParticipants,
                sortingField: 'disengagedParticipants',
              },
            ]}
            items={metrics.groupedResults}
            sortingDisabled={false}
            variant="embedded"
            empty={
              <Box textAlign="center" color="inherit">
                <b>No grouped results</b>
              </Box>
            }
          />
        </Container>
      )}
    </SpaceBetween>
  );
}
