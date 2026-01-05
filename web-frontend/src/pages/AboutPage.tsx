import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Container from '@cloudscape-design/components/container';
import Box from '@cloudscape-design/components/box';
import Link from '@cloudscape-design/components/link';

export default function AboutPage() {
  return (
    <ContentLayout
      header={
        <Header variant="h1">
          About Cultivate
        </Header>
      }
    >
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        minHeight: 'calc(100vh - 200px)',
        justifyContent: 'space-between'
      }}>
        <SpaceBetween size="l">
          {/* App Icon and Description */}
          <Container>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '200px 1fr', 
              gap: '32px', 
              alignItems: 'center',
              padding: '20px' 
            }}>
              <div style={{
                width: '180px',
                height: '180px',
                backgroundColor: '#0B1F3B',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '10px',
                boxSizing: 'border-box'
              }}>
                <img 
                  src="/icon-no-bg.svg" 
                  alt="Cultivate App Icon" 
                  style={{ width: '180px', height: '180px' }}
                />
              </div>
              <Box variant="p" fontSize="body-m">
                The Cultivate logo incorporates themes of concentric circles as well as expanding 
                nuclei. The fact that the circles are not perfectly concentric is a reflection of the 
                organic nature of this growth. Careful examination of the three circles will reveal
                a representation of a person raising their arms in supplication of the Blessed Beauty.
              </Box>
            </div>
          </Container>

          {/* Universal House of Justice Excerpt */}
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <SpaceBetween size="m">
              <Box variant="p" fontSize="body-m" color="text-body-secondary">
                <em>
                  "The Formative Age is that critical period in the Faith's development in which 
                  the friends increasingly come to appreciate the mission with which Bahá'u'lláh 
                  has entrusted them, deepen their understanding of the meaning and implications 
                  of His revealed Word, and systematically <strong>cultivate</strong> capacity—their own and that 
                  of others—in order to put into practice His teachings for the betterment of the world."
                </em>
              </Box>
              <Box variant="p" fontSize="body-s" color="text-body-secondary" textAlign="right">
                — The Universal House of Justice
              </Box>
            </SpaceBetween>
          </div>

          {/* Disclaimer */}
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <Box variant="p" fontSize="body-m">
              This software is an individual initiative to help communities more systematically 
              track their growth, and has not been officially sponsored by any Bahá'í Institution.
            </Box>
          </div>
        </SpaceBetween>

        {/* Link to Official Website - Sticks to bottom when space available */}
        <div style={{ maxWidth: '800px', margin: '20px auto 0 auto' }}>
          <Box variant="p" fontSize="body-m" textAlign="center">
            Learn more about the Bahá'í Faith at{' '}
            <Link href="https://www.bahai.org" external>
              www.bahai.org
            </Link>
          </Box>
        </div>
      </div>
    </ContentLayout>
  );
}
