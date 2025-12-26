import ContentLayout from '@cloudscape-design/components/content-layout';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Box from '@cloudscape-design/components/box';
import Link from '@cloudscape-design/components/link';
import Icon from '@cloudscape-design/components/icon';
import { useAuth } from '../hooks/useAuth';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <ContentLayout
      header={
        <Header variant="h1">
          Welcome, {user?.email || 'User'}
        </Header>
      }
    >
      <SpaceBetween size="l">
        <Container>
          <Box variant="p">
            Welcome to the Community Activity Tracker. Use the navigation menu to manage activities,
            participants, venues, and view analytics.
          </Box>
        </Container>

        <Container header={<Header variant="h2">Quick Links</Header>}>
          <SpaceBetween size="m">
            <Container
              media={{
                content: (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', paddingLeft: '16px' }}>
                    <Icon name="user-profile" size="big" />
                  </div>
                ),
                position: "side"
              }}
            >
              <SpaceBetween size="xs">
                <Link href="/participants" fontSize="heading-m">Manage Participants</Link>
                <Box variant="small" color="text-body-secondary">
                  View and manage community participants
                </Box>
              </SpaceBetween>
            </Container>
            
            <Container
              media={{
                content: (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', paddingLeft: '16px' }}>
                    <Icon name="group" size="big" />
                  </div>
                ),
                position: "side"
              }}
            >
              <SpaceBetween size="xs">
                <Link href="/activities" fontSize="heading-m">Manage Activities</Link>
                <Box variant="small" color="text-body-secondary">
                  View and manage community activities
                </Box>
              </SpaceBetween>
            </Container>
            
            <Container
              media={{
                content: (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', paddingLeft: '16px' }}>
                    <Icon name="location-pin" size="big" />
                  </div>
                ),
                position: "side"
              }}
            >
              <SpaceBetween size="xs">
                <Link href="/venues" fontSize="heading-m">Manage Venues</Link>
                <Box variant="small" color="text-body-secondary">
                  View and manage activity venues
                </Box>
              </SpaceBetween>
            </Container>
            
            <Container
              media={{
                content: (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', paddingLeft: '16px' }}>
                    <Icon name="map" size="big" />
                  </div>
                ),
                position: "side"
              }}
            >
              <SpaceBetween size="xs">
                <Link href="/map" fontSize="heading-m">Map View</Link>
                <Box variant="small" color="text-body-secondary">
                  Visualize activities by geography
                </Box>
              </SpaceBetween>
            </Container>
            
            <Container
              media={{
                content: (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', paddingLeft: '16px' }}>
                    <Icon name="gen-ai" size="big" />
                  </div>
                ),
                position: "side"
              }}
            >
              <SpaceBetween size="xs">
                <Link href="/analytics/engagement" fontSize="heading-m">Engagement Analytics</Link>
                <Box variant="small" color="text-body-secondary">
                  View engagement metrics and charts
                </Box>
              </SpaceBetween>
            </Container>
            
            <Container
              media={{
                content: (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', paddingLeft: '16px' }}>
                    <Icon name="star" size="big" />
                  </div>
                ),
                position: "side"
              }}
            >
              <SpaceBetween size="xs">
                <Link href="/analytics/growth" fontSize="heading-m">Growth Analytics</Link>
                <Box variant="small" color="text-body-secondary">
                  View growth trends over time
                </Box>
              </SpaceBetween>
            </Container>
          </SpaceBetween>
        </Container>
      </SpaceBetween>
    </ContentLayout>
  );
}
