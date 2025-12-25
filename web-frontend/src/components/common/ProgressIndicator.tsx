import ProgressBar from '@cloudscape-design/components/progress-bar';
import Box from '@cloudscape-design/components/box';

interface ProgressIndicatorProps {
  value: number;
  label?: string;
  description?: string;
}

export function ProgressIndicator({ value, label, description }: ProgressIndicatorProps) {
  return (
    <Box padding="l">
      <ProgressBar
        value={value}
        label={label}
        description={description}
        variant="standalone"
      />
    </Box>
  );
}
