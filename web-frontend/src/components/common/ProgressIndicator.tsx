import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import ProgressBar from '@cloudscape-design/components/progress-bar';

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

  // Calculate progress percentage
  const progressPercentage = totalCount > 0 ? (loadedCount / totalCount) * 100 : 0;

  // Show play button and progress bar when paused with more items to load
  if (isCancelled && loadedCount < totalCount && totalCount > 0) {
    return (
      <SpaceBetween direction="horizontal" size="xs">
        <Button
          variant="icon"
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
          variant="icon"
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
