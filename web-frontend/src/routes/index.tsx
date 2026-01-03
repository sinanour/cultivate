import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { AppLayout } from '../components/layout/AppLayout';
import { GlobalGeographicFilterProvider } from '../contexts/GlobalGeographicFilterContext';

// Lazy load pages for code splitting
const LoginPage = lazy(() => import('../pages/LoginPage'));
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const ConfigurationPage = lazy(() => import('../pages/ConfigurationPage'));
const ParticipantsPage = lazy(() => import('../pages/ParticipantsPage'));
const ParticipantDetailPage = lazy(() => import('../pages/ParticipantDetailPage'));
const ActivitiesPage = lazy(() => import('../pages/ActivitiesPage'));
const ActivityDetailPage = lazy(() => import('../pages/ActivityDetailPage'));
const VenuesPage = lazy(() => import('../pages/VenuesPage'));
const VenueDetailPage = lazy(() => import('../pages/VenueDetailPage'));
const GeographicAreasPage = lazy(() => import('../pages/GeographicAreasPage'));
const GeographicAreaDetailPage = lazy(() => import('../pages/GeographicAreaDetailPage'));
const MapViewPage = lazy(() => import('../pages/MapViewPage'));
const EngagementDashboardPage = lazy(() => import('../pages/EngagementDashboardPage'));
const GrowthDashboardPage = lazy(() => import('../pages/GrowthDashboardPage'));
const GeographicAnalyticsDashboardPage = lazy(() => import('../pages/GeographicAnalyticsDashboardPage'));
const UsersPage = lazy(() => import('../pages/UsersPage'));

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <GlobalGeographicFilterProvider>
          <AppLayout />
        </GlobalGeographicFilterProvider>
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: 'configuration',
        element: <ConfigurationPage />,
      },
      {
        path: 'participants',
        element: <ParticipantsPage />,
      },
      {
        path: 'participants/:id',
        element: <ParticipantDetailPage />,
      },
      {
        path: 'activities',
        element: <ActivitiesPage />,
      },
      {
        path: 'activities/:id',
        element: <ActivityDetailPage />,
      },
      {
        path: 'venues',
        element: <VenuesPage />,
      },
      {
        path: 'venues/:id',
        element: <VenueDetailPage />,
      },
      {
        path: 'geographic-areas',
        element: <GeographicAreasPage />,
      },
      {
        path: 'geographic-areas/:id',
        element: <GeographicAreaDetailPage />,
      },
      {
        path: 'map',
        element: <MapViewPage />,
      },
      {
        path: 'analytics/engagement',
        element: <EngagementDashboardPage />,
      },
      {
        path: 'analytics/growth',
        element: <GrowthDashboardPage />,
      },
      {
        path: 'analytics/geographic',
        element: <GeographicAnalyticsDashboardPage />,
      },
      {
        path: 'users',
        element: (
          <ProtectedRoute requiredRole="ADMINISTRATOR">
            <UsersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);
