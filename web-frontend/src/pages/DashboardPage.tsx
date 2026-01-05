import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Box from '@cloudscape-design/components/box';
import Icon from '@cloudscape-design/components/icon';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const allQuickLinks = [
    {
      href: '/geographic-areas',
      icon: 'globe',
      title: 'Manage Geographic Areas',
      description: 'View and manage geographic hierarchy',
    },
    {
      href: '/venues',
      icon: 'location-pin',
      title: 'Manage Venues',
      description: 'View and manage activity venues',
    },
    {
      href: '/participants',
      icon: 'user-profile',
      title: 'Manage Participants',
      description: 'View and manage community participants',
    },
    {
      href: '/activities',
      icon: 'group',
      title: 'Manage Activities',
      description: 'View and manage community activities',
    },
    {
      href: '/map',
      icon: 'map',
      title: 'Map View',
      description: 'Visualize activities by geography',
    },
    {
      href: '/analytics/engagement',
      icon: 'gen-ai',
      title: 'Engagement Analytics',
      description: 'View engagement metrics and charts',
    },
    {
      href: '/analytics/growth',
      icon: 'star',
      title: 'Growth Analytics',
      description: 'View growth trends over time',
    },
    {
      href: '/configuration',
      icon: 'settings',
      title: 'Configuration',
      description: 'Manage activity categories, types, and roles',
      adminOnly: true,
    },
    {
      href: '/users',
      icon: 'lock-private',
      title: 'User Administration',
      description: 'Manage system users and permissions',
      adminOnly: true,
    },
    {
      href: '/about',
      icon: 'status-info',
      title: 'About',
      description: 'Learn about the Cultivate application',
    },
  ];

  // Filter quick links based on user role
  const quickLinks = allQuickLinks.filter(link => {
    if (link.adminOnly) {
      return user?.role === 'ADMINISTRATOR';
    }
    return true;
  });

  return (
    <ContentLayout
      header={
        <Header variant="h1">
          Welcome, {user?.displayName || user?.email || 'User'}
        </Header>
      }
    >
      <ColumnLayout columns={2} variant="text-grid">
        {quickLinks.map((link) => (
          <div
            key={link.href}
            onClick={() => navigate(link.href)}
            style={{
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              borderRadius: '8px',
              border: '1px solid #e9ebed',
              backgroundColor: '#ffffff',
              padding: '20px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.cursor = 'pointer';
              e.currentTarget.style.backgroundColor = 'rgba(0, 7, 22, 0.04)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ffffff';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '48px', cursor: 'pointer', color: '#0972d3' }}>
                <Icon name={link.icon as any} size="big" />
              </div>
              <SpaceBetween size="xs">
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#0972d3' }}>
                  {link.title}
                </div>
                <Box variant="small" color="text-body-secondary">
                  {link.description}
                </Box>
              </SpaceBetween>
            </div>
          </div>
        ))}
      </ColumnLayout>
    </ContentLayout>
  );
}
