import Spinner from '@cloudscape-design/components/spinner';
import Box from '@cloudscape-design/components/box';

interface LoadingSpinnerProps {
  size?: 'normal' | 'big' | 'large';
  text?: string;
}

export function LoadingSpinner({ size = 'large', text = 'Loading...' }: LoadingSpinnerProps) {
  return (
    <Box textAlign="center" padding="xxl">
      <Spinner size={size} />
      {text && (
        <Box variant="p" padding={{ top: 's' }}>
          {text}
        </Box>
      )}
    </Box>
  );
}
