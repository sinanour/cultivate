/**
 * Tests for configuration list hyperlink behavior
 * 
 * Validates that clicking on configuration entity names navigates to filtered list pages
 * instead of opening edit forms.
 * 
 * Requirements:
 * - 2.17, 2.18: Activity category links navigate to filtered Activity List
 * - 2.19, 2.20: Activity type links navigate to filtered Activity List
 * - 3.8, 3.9: Participant role links navigate to filtered Participant List
 * - 3A.11, 3A.12: Population links navigate to filtered Participant List
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { ActivityCategoryList } from '../components/features/ActivityCategoryList';
import { ActivityTypeList } from '../components/features/ActivityTypeList';
import { ParticipantRoleList } from '../components/features/ParticipantRoleList';
import { PopulationList } from '../components/configuration/PopulationList';
import { activityCategoryService } from '../services/api/activity-category.service';
import { ActivityTypeService } from '../services/api/activity-type.service';
import { ParticipantRoleService } from '../services/api/participant-role.service';
import { PopulationService } from '../services/api/population.service';

// Mock services
vi.mock('../services/api/activity-category.service');
vi.mock('../services/api/activity-type.service');
vi.mock('../services/api/participant-role.service');
vi.mock('../services/api/population.service');

// Mock hooks
vi.mock('../hooks/useNotification', () => ({
    useNotification: () => ({
        showNotification: vi.fn(),
    }),
}));

vi.mock('../hooks/usePermissions', () => ({
    usePermissions: () => ({
        canCreate: () => true,
        canEdit: () => true,
        canDelete: () => true,
    }),
}));

vi.mock('../hooks/useAuth', () => ({
    useAuth: () => ({
        user: { role: 'ADMINISTRATOR' },
    }),
}));

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

function renderWithProviders(component: React.ReactElement) {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    });

    return render(
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                {component}
            </BrowserRouter>
        </QueryClientProvider>
    );
}

describe('Configuration List Hyperlinks', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('ActivityCategoryList', () => {
        it('should navigate to filtered Activity List when category name is clicked', async () => {
            const mockCategories = [
                { id: '1', name: 'Study Circles', isPredefined: true, version: 1 },
                { id: '2', name: 'Devotional Gatherings', isPredefined: true, version: 1 },
            ];

            vi.mocked(activityCategoryService.getActivityCategories).mockResolvedValue(mockCategories);

            renderWithProviders(<ActivityCategoryList />);

            await waitFor(() => {
                expect(screen.getByText('Study Circles')).toBeInTheDocument();
            });

            const link = screen.getByText('Study Circles');
            await userEvent.click(link);

            expect(mockNavigate).toHaveBeenCalledWith('/activities?filter_activityCategory=Study+Circles');
        });

        it('should URL-encode category names with special characters', async () => {
            const mockCategories = [
                { id: '1', name: 'Junior Youth Groups', isPredefined: true, version: 1 },
            ];

            vi.mocked(activityCategoryService.getActivityCategories).mockResolvedValue(mockCategories);

            renderWithProviders(<ActivityCategoryList />);

            await waitFor(() => {
                expect(screen.getByText('Junior Youth Groups')).toBeInTheDocument();
            });

            const link = screen.getByText('Junior Youth Groups');
            await userEvent.click(link);

            expect(mockNavigate).toHaveBeenCalledWith('/activities?filter_activityCategory=Junior+Youth+Groups');
        });
    });

    describe('ActivityTypeList', () => {
        it('should navigate to filtered Activity List when type name is clicked', async () => {
            const mockTypes = [
                {
                    id: '1',
                    name: 'Devotional Gathering',
                    isPredefined: true,
                    version: 1,
                    activityCategoryId: 'cat1',
                    activityCategory: { id: 'cat1', name: 'Devotional Gatherings', isPredefined: true, version: 1 },
                },
            ];

            vi.mocked(ActivityTypeService.getActivityTypes).mockResolvedValue(mockTypes);

            renderWithProviders(<ActivityTypeList />);

            await waitFor(() => {
                expect(screen.getByText('Devotional Gathering')).toBeInTheDocument();
            });

            const link = screen.getByText('Devotional Gathering');
            await userEvent.click(link);

            expect(mockNavigate).toHaveBeenCalledWith('/activities?filter_activityType=Devotional+Gathering');
        });

        it('should URL-encode type names with special characters', async () => {
            const mockTypes = [
                {
                    id: '1',
                    name: "Children's Class",
                    isPredefined: true,
                    version: 1,
                    activityCategoryId: 'cat1',
                    activityCategory: { id: 'cat1', name: "Children's Classes", isPredefined: true, version: 1 },
                },
            ];

            vi.mocked(ActivityTypeService.getActivityTypes).mockResolvedValue(mockTypes);

            renderWithProviders(<ActivityTypeList />);

            await waitFor(() => {
                expect(screen.getByText("Children's Class")).toBeInTheDocument();
            });

            const link = screen.getByText("Children's Class");
            await userEvent.click(link);

            // Note: encodeURIComponent doesn't encode apostrophes, which is correct for URLs
            expect(mockNavigate).toHaveBeenCalledWith("/activities?filter_activityType=Children's+Class");
        });
    });

    describe('ParticipantRoleList', () => {
        it('should navigate to filtered Participant List when role name is clicked', async () => {
            const mockRoles = [
                { id: '1', name: 'Tutor', isPredefined: true, version: 1 },
                { id: '2', name: 'Teacher', isPredefined: true, version: 1 },
            ];

            vi.mocked(ParticipantRoleService.getRoles).mockResolvedValue(mockRoles);

            renderWithProviders(<ParticipantRoleList />);

            await waitFor(() => {
                expect(screen.getByText('Tutor')).toBeInTheDocument();
            });

            const link = screen.getByText('Tutor');
            await userEvent.click(link);

            expect(mockNavigate).toHaveBeenCalledWith('/participants?filter_role=Tutor');
        });

        it('should URL-encode role names with spaces', async () => {
            const mockRoles = [
                { id: '1', name: 'Study Circle Facilitator', isPredefined: false, version: 1 },
            ];

            vi.mocked(ParticipantRoleService.getRoles).mockResolvedValue(mockRoles);

            renderWithProviders(<ParticipantRoleList />);

            await waitFor(() => {
                expect(screen.getByText('Study Circle Facilitator')).toBeInTheDocument();
            });

            const link = screen.getByText('Study Circle Facilitator');
            await userEvent.click(link);

            expect(mockNavigate).toHaveBeenCalledWith('/participants?filter_role=Study+Circle+Facilitator');
        });
    });

    describe('PopulationList', () => {
        it('should navigate to filtered Participant List when population name is clicked', async () => {
            const mockPopulations = [
                { id: '1', name: 'Persian', version: 1 },
                { id: '2', name: 'Youth', version: 1 },
            ];

            vi.mocked(PopulationService.getPopulations).mockResolvedValue(mockPopulations);

            renderWithProviders(<PopulationList />);

            await waitFor(() => {
                expect(screen.getByText('Persian')).toBeInTheDocument();
            });

            const link = screen.getByText('Persian');
            await userEvent.click(link);

            expect(mockNavigate).toHaveBeenCalledWith('/participants?filter_population=Persian');
        });

        it('should URL-encode population names with spaces', async () => {
            const mockPopulations = [
                { id: '1', name: 'Young Adults', version: 1 },
            ];

            vi.mocked(PopulationService.getPopulations).mockResolvedValue(mockPopulations);

            renderWithProviders(<PopulationList />);

            await waitFor(() => {
                expect(screen.getByText('Young Adults')).toBeInTheDocument();
            });

            const link = screen.getByText('Young Adults');
            await userEvent.click(link);

            expect(mockNavigate).toHaveBeenCalledWith('/participants?filter_population=Young+Adults');
        });
    });

    describe('URL Encoding Consistency', () => {
        it('should consistently use + for spaces across all configuration entities', () => {
            const testCases = [
                { name: 'Study Circles', expected: 'Study+Circles' },
                { name: 'Junior Youth Groups', expected: 'Junior+Youth+Groups' },
                { name: 'Multiple Word Name Here', expected: 'Multiple+Word+Name+Here' },
            ];

            testCases.forEach(({ name, expected }) => {
                const encoded = encodeURIComponent(name).replace(/%20/g, '+');
                expect(encoded).toBe(expected);
            });
        });

        it('should handle special characters in entity names', () => {
            const testCases = [
                { name: "Children's Class", expected: "Children's+Class" },
                { name: 'Study & Prayer', expected: 'Study+%26+Prayer' },
            ];

            testCases.forEach(({ name, expected }) => {
                const encoded = encodeURIComponent(name).replace(/%20/g, '+');
                expect(encoded).toBe(expected);
            });
        });
    });
});
