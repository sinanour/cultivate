import ContentLayout from '@cloudscape-design/components/content-layout';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import { MapView } from '../components/features/MapView';

export default function MapViewPage() {
  return (
    <ContentLayout>
      <Container 
        header={<Header variant="h2">Map View</Header>}
        disableContentPaddings
      >
        <div style={{ height: 'calc(100vh - 200px)', minHeight: '500px' }}>
          <MapView />
        </div>
      </Container>
    </ContentLayout>
  );
}
