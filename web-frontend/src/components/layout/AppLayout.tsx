import { Suspense, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import AppLayoutComponent from '@cloudscape-design/components/app-layout';
import SideNavigation from '@cloudscape-design/components/side-navigation';
import TopNavigation from '@cloudscape-design/components/top-navigation';
import Spinner from '@cloudscape-design/components/spinner';
import { useAuth } from '../../hooks/useAuth';
import { useConnectionStatus } from '../../hooks/useConnectionStatus';

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isOnline } = useConnectionStatus();
  const [navigationOpen, setNavigationOpen] = useState(true);

  const navigationItems = [
    { type: 'link', text: 'Dashboard', href: '/dashboard' },
    { type: 'divider' },
    {
      type: 'section',
      text: 'Configuration',
      items: [
        { type: 'link', text: 'Activity Types', href: '/activity-types' },
        { type: 'link', text: 'Participant Roles', href: '/participant-roles' },
      ],
    },
    { type: 'divider' },
    {
      type: 'section',
      text: 'Management',
      items: [
        { type: 'link', text: 'Participants', href: '/participants' },
        { type: 'link', text: 'Activities', href: '/activities' },
        { type: 'link', text: 'Venues', href: '/venues' },
        { type: 'link', text: 'Geographic Areas', href: '/geographic-areas' },
      ],
    },
    { type: 'divider' },
    {
      type: 'section',
      text: 'Visualization',
      items: [
        { type: 'link', text: 'Map View', href: '/map' },
      ],
    },
    { type: 'divider' },
    {
      type: 'section',
      text: 'Analytics',
      items: [
        { type: 'link', text: 'Engagement', href: '/analytics/engagement' },
        { type: 'link', text: 'Growth', href: '/analytics/growth' },
      ],
    },
  ];

  // Add Users section for administrators
  if (user?.role === 'ADMINISTRATOR') {
    navigationItems.push(
      { type: 'divider' },
      {
        type: 'section',
        text: 'Administration',
        items: [
          { type: 'link', text: 'Users', href: '/users' },
        ],
      }
    );
  }

  return (
    <>
      <TopNavigation
        identity={{
          href: '/',
          title: 'Community Activity Tracker',
        }}
        utilities={[
          {
            type: 'button',
            text: isOnline ? 'Online' : 'Offline',
            iconName: isOnline ? 'status-positive' : 'status-negative',
            disableUtilityCollapse: true,
          },
          {
            type: 'menu-dropdown',
            text: user?.email || 'User',
            description: user?.role,
            iconName: 'user-profile',
            items: [
              {
                id: 'role',
                text: `Role: ${user?.role}`,
                disabled: true,
              },
              {
                id: 'logout',
                text: 'Logout',
              },
            ],
            onItemClick: ({ detail }) => {
              if (detail.id === 'logout') {
                logout();
                navigate('/login');
              }
            },
          },
        ]}
      />
      <AppLayoutComponent
        navigation={
          <SideNavigation
            activeHref={location.pathname}
            items={navigationItems as any}
            onFollow={(event) => {
              event.preventDefault();
              navigate(event.detail.href);
            }}
          />
        }
        navigationOpen={navigationOpen}
        onNavigationChange={({ detail }: any) => setNavigationOpen(detail.open)}
        content={
          <Suspense fallback={<Spinner size="large" />}>
            <Outlet />
          </Suspense>
        }
        toolsHide
      />
    </>
  );
}
