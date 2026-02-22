import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import ProgressBar from '@cloudscape-design/components/progress-bar';
import Spinner from '@cloudscape-design/components/spinner';
import Box from '@cloudscape-design/components/box';

interface ProgressIndicatorProps {
  loadedCount: number;
  totalCount: number;
  entityName: string;
  onCancel: () => void;
  onResume: () => void;
  isCancelled: boolean;
}

export function ProgressIndicator({
  loadedCount,
  totalCount,
  entityName,
  onCancel,
  onResume,
  isCancelled,
}: ProgressIndicatorProps) {
  // Unmount completely when loading is complete
  if (loadedCount >= totalCount && totalCount > 0) {
    return null;
  }

  // Determine mode based on totalCount
  const mode = totalCount > 0 ? 'determinate' : 'indeterminate';

  // Render indeterminate mode
  if (mode === 'indeterminate') {
    return (
      <SpaceBetween direction="horizontal" size="xs">
        <Button
          iconName={isCancelled ? "play" : "pause"}
          onClick={isCancelled ? onResume : onCancel}
          ariaLabel={isCancelled ? `Resume loading ${entityName}` : "Pause loading"}
        />
        <Box padding={{ top: "xs" }}>
          {!isCancelled && <Spinner size="normal" variant="disabled" />}
          <Box margin={{ left: "xs" }} display="inline-block" color="text-status-inactive">
            {isCancelled ? `Loading paused` : `Loading ${entityName}...`}
          </Box>
        </Box>
      </SpaceBetween>
    );
  }

  // Calculate progress percentage
  const progressPercentage = totalCount > 0 ? (loadedCount / totalCount) * 100 : 0;

  // Show play button and progress bar when paused with more items to load
  if (isCancelled && loadedCount < totalCount && totalCount > 0) {
    return (
      <SpaceBetween direction="horizontal" size="xs">
        <Button
          iconName="play"
          onClick={onResume}
          ariaLabel={`Resume loading ${entityName}`}
        />
        <ProgressBar
          value={progressPercentage}
          additionalInfo={`Loaded ${loadedCount} / ${totalCount} ${entityName}.`}
          status="in-progress"
        />
      </SpaceBetween>
    );
  }

  // Show pause button and progress bar when actively loading
  if (!isCancelled && loadedCount < totalCount && totalCount > 0) {
    return (
      <SpaceBetween direction="horizontal" size="xs">
        <Button
          iconName="pause"
          onClick={onCancel}
          ariaLabel="Pause loading"
        />
        <ProgressBar
          value={progressPercentage}
          additionalInfo={`Loading ${loadedCount} / ${totalCount} ${entityName}...`}
          status="in-progress"
        />
      </SpaceBetween>
    );
  }

  return null;
}
