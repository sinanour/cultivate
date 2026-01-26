import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Container,
    Header,
    SpaceBetween,
    Table,
    Box,
    DateRangePicker,
    type DateRangePickerProps,
} from '@cloudscape-design/components';
import { AnalyticsService } from '../services/api/analytics.service';
import { useGlobalGeographicFilter } from '../hooks/useGlobalGeographicFilter';
import type { GeographicAnalytics } from '../types';

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

export default function GeographicAnalyticsDashboardPage() {
    const [dateRange, setDateRange] = useState<DateRangePickerProps.Value | null>(null);
    const { selectedGeographicAreaId } = useGlobalGeographicFilter();

    const { data: geographicResponse, isLoading } = useQuery({
        queryKey: ['geographic-analytics', dateRange, selectedGeographicAreaId],
        queryFn: () => {
            // Extract dates from the date range value and convert to ISO datetime
            let startDate: string | undefined;
            let endDate: string | undefined;

            if (dateRange?.type === 'absolute') {
                startDate = toISODateTime(dateRange.startDate, false);
                endDate = toISODateTime(dateRange.endDate, true);
            }

            return AnalyticsService.getGeographicAnalytics(
                selectedGeographicAreaId || undefined, // parentGeographicAreaId
                startDate,
                endDate
            );
        },
    });
    
    const geographicData = geographicResponse?.data || [];

    return (
        <SpaceBetween size="l">
            <Header variant="h1">Geographic Analytics</Header>

            <Container
                header={
                    <Header
                        variant="h2"
                        actions={
                            <DateRangePicker
                                onChange={({ detail }) => setDateRange(detail.value)}
                                value={dateRange}
                                dateOnly={true}
                                relativeOptions={[
                                    {
                                        key: 'previous-7-days',
                                        amount: 7,
                                        unit: 'day',
                                        type: 'relative',
                                    },
                                    {
                                        key: 'previous-30-days',
                                        amount: 30,
                                        unit: 'day',
                                        type: 'relative',
                                    },
                                    {
                                        key: 'previous-90-days',
                                        amount: 90,
                                        unit: 'day',
                                        type: 'relative',
                                    },
                                ]}
                                isValidRange={(range) => {
                                    if (range?.type === 'absolute') {
                                        const [startDateWithoutTime] = range.startDate.split('T');
                                        const [endDateWithoutTime] = range.endDate.split('T');
                                        if (!startDateWithoutTime || !endDateWithoutTime) {
                                            return {
                                                valid: false,
                                                errorMessage: 'Invalid date format',
                                            };
                                        }
                                        if (new Date(range.startDate) > new Date(range.endDate)) {
                                            return {
                                                valid: false,
                                                errorMessage: 'Start date must be before end date',
                                            };
                                        }
                                    }
                                    return { valid: true };
                                }}
                                i18nStrings={{
                                    todayAriaLabel: 'Today',
                                    nextMonthAriaLabel: 'Next month',
                                    previousMonthAriaLabel: 'Previous month',
                                    customRelativeRangeDurationLabel: 'Duration',
                                    customRelativeRangeDurationPlaceholder: 'Enter duration',
                                    customRelativeRangeOptionLabel: 'Custom range',
                                    customRelativeRangeOptionDescription: 'Set a custom range in the past',
                                    customRelativeRangeUnitLabel: 'Unit of time',
                                    formatRelativeRange: (e) => {
                                        const n = 1 === e.amount ? e.unit : `${e.unit}s`;
                                        return `Last ${e.amount} ${n}`;
                                    },
                                    formatUnit: (e, n) => (1 === n ? e : `${e}s`),
                                    dateTimeConstraintText: 'Range must be between 6 and 30 days.',
                                    relativeModeTitle: 'Relative range',
                                    absoluteModeTitle: 'Absolute range',
                                    relativeRangeSelectionHeading: 'Choose a range',
                                    startDateLabel: 'Start date',
                                    endDateLabel: 'End date',
                                    clearButtonLabel: 'Clear',
                                    cancelButtonLabel: 'Cancel',
                                    applyButtonLabel: 'Apply',
                                }}
                                placeholder="Filter by date range"
                            />
                        }
                    >
                        Engagement by Geographic Area
                    </Header>
                }
            >
                <Table
                    columnDefinitions={[
                        {
                            id: 'name',
                            header: 'Geographic Area',
                            cell: (item: GeographicAnalytics) => item.geographicAreaName,
                            sortingField: 'geographicAreaName',
                        },
                        {
                            id: 'areaType',
                            header: 'Area Type',
                            cell: (item: GeographicAnalytics) => item.areaType,
                            sortingField: 'areaType',
                        },
                        {
                            id: 'activityCount',
                            header: 'Activities',
                            cell: (item: GeographicAnalytics) => item.activityCount,
                            sortingField: 'activityCount',
                        },
                        {
                            id: 'participantCount',
                            header: 'Participants',
                            cell: (item: GeographicAnalytics) => item.participantCount,
                            sortingField: 'participantCount',
                        },
                        {
                            id: 'participationCount',
                            header: 'Participation',
                            cell: (item: GeographicAnalytics) => item.participationCount,
                            sortingField: 'participationCount',
                        },
                    ]}
                    items={geographicData || []}
                    loading={isLoading}
                    loadingText="Loading geographic analytics..."
                    sortingDisabled={false}
                    empty={
                        <Box textAlign="center" color="inherit">
                            <b>No geographic data</b>
                            <Box padding={{ bottom: 's' }} variant="p" color="inherit">
                                No geographic analytics data available for the selected period.
                            </Box>
                        </Box>
                    }
                />
            </Container>
        </SpaceBetween>
    );
}
