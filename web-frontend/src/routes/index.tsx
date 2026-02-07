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
const ParticipantFormPage = lazy(() => import('../pages/ParticipantFormPage'));
const ActivitiesPage = lazy(() => import('../pages/ActivitiesPage'));
const ActivityDetailPage = lazy(() => import('../pages/ActivityDetailPage'));
const ActivityFormPage = lazy(() => import('../pages/ActivityFormPage'));
const VenuesPage = lazy(() => import('../pages/VenuesPage'));
const VenueDetailPage = lazy(() => import('../pages/VenueDetailPage'));
const VenueFormPage = lazy(() => import('../pages/VenueFormPage'));
const GeographicAreasPage = lazy(() => import('../pages/GeographicAreasPage'));
const GeographicAreaDetailPage = lazy(() => import('../pages/GeographicAreaDetailPage'));
const GeographicAreaFormPage = lazy(() => import('../pages/GeographicAreaFormPage'));
const MapViewPage = lazy(() => import('../pages/MapViewPage'));
const EngagementDashboardPage = lazy(() => import('../pages/EngagementDashboardPage'));
const GrowthDashboardPage = lazy(() => import('../pages/GrowthDashboardPage'));
const GeographicAnalyticsDashboardPage = lazy(() => import('../pages/GeographicAnalyticsDashboardPage'));
const UsersPage = lazy(() => import('../pages/UsersPage'));
const UserFormPage = lazy(() => import('../pages/UserFormPage'));
const ProfilePage = lazy(() => import('../pages/ProfilePage'));
const AboutPage = lazy(() => import('../pages/AboutPage'));
const ServiceWorkerDebugPage = lazy(() => import('../pages/ServiceWorkerDebugPage'));

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
        element: (
          <ProtectedRoute requiredRole="ADMINISTRATOR">
            <ConfigurationPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'participants',
        element: (
          <ProtectedRoute allowedRoles={['ADMINISTRATOR', 'EDITOR', 'READ_ONLY']}>
            <ParticipantsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'participants/new',
        element: (
          <ProtectedRoute allowedRoles={['ADMINISTRATOR', 'EDITOR', 'READ_ONLY']}>
            <ParticipantFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'participants/:id/edit',
        element: (
          <ProtectedRoute allowedRoles={['ADMINISTRATOR', 'EDITOR', 'READ_ONLY']}>
            <ParticipantFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'participants/:id',
        element: (
          <ProtectedRoute allowedRoles={['ADMINISTRATOR', 'EDITOR', 'READ_ONLY']}>
            <ParticipantDetailPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'activities',
        element: (
          <ProtectedRoute allowedRoles={['ADMINISTRATOR', 'EDITOR', 'READ_ONLY']}>
            <ActivitiesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'activities/new',
        element: (
          <ProtectedRoute allowedRoles={['ADMINISTRATOR', 'EDITOR', 'READ_ONLY']}>
            <ActivityFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'activities/:id/edit',
        element: (
          <ProtectedRoute allowedRoles={['ADMINISTRATOR', 'EDITOR', 'READ_ONLY']}>
            <ActivityFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'activities/:id',
        element: (
          <ProtectedRoute allowedRoles={['ADMINISTRATOR', 'EDITOR', 'READ_ONLY']}>
            <ActivityDetailPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'venues',
        element: (
          <ProtectedRoute allowedRoles={['ADMINISTRATOR', 'EDITOR', 'READ_ONLY']}>
            <VenuesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'venues/new',
        element: (
          <ProtectedRoute allowedRoles={['ADMINISTRATOR', 'EDITOR', 'READ_ONLY']}>
            <VenueFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'venues/:id/edit',
        element: (
          <ProtectedRoute allowedRoles={['ADMINISTRATOR', 'EDITOR', 'READ_ONLY']}>
            <VenueFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'venues/:id',
        element: (
          <ProtectedRoute allowedRoles={['ADMINISTRATOR', 'EDITOR', 'READ_ONLY']}>
            <VenueDetailPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'geographic-areas',
        element: <GeographicAreasPage />,
      },
      {
        path: 'geographic-areas/new',
        element: <GeographicAreaFormPage />,
      },
      {
        path: 'geographic-areas/:id/edit',
        element: <GeographicAreaFormPage />,
      },
      {
        path: 'geographic-areas/:id',
        element: <GeographicAreaDetailPage />,
      },
      {
        path: 'map',
        element: (
          <ProtectedRoute allowedRoles={['ADMINISTRATOR', 'EDITOR', 'READ_ONLY']}>
            <MapViewPage />
          </ProtectedRoute>
        ),
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
        path: 'users/new',
        element: (
          <ProtectedRoute requiredRole="ADMINISTRATOR">
            <UserFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'users/:id/edit',
        element: (
          <ProtectedRoute requiredRole="ADMINISTRATOR">
            <UserFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'profile',
        element: <ProfilePage />,
      },
      {
        path: 'about',
        element: <AboutPage />,
      },
      {
        path: 'debug/service-worker',
        element: <ServiceWorkerDebugPage />,
      },
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);
