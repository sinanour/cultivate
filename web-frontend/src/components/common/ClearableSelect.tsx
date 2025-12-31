import { FormField, Select, Button, SpaceBetween } from '@cloudscape-design/components';
import type { SelectProps } from '@cloudscape-design/components/select';

interface ClearableSelectProps extends Omit<SelectProps, 'selectedOption' | 'onChange'> {
  label?: string;
  description?: string;
  constraintText?: string;
  errorText?: string;
  selectedOption: SelectProps.Option | null;
  onChange: (option: SelectProps.Option | null) => void;
  onClear: () => void;
}

export function ClearableSelect({
  label,
  description,
  constraintText,
  errorText,
  selectedOption,
  onChange,
  onClear,
  ...selectProps
}: ClearableSelectProps) {
  return (
    <FormField
      label={label}
      description={description}
      constraintText={constraintText}
      errorText={errorText}
    >
      <SpaceBetween direction="horizontal" size="xs">
        <div style={{ flex: 1 }}>
          <Select
            {...selectProps}
            selectedOption={selectedOption}
            onChange={(event) => onChange(event.detail.selectedOption)}
          />
        </div>
        {selectedOption && (
          <Button
            iconName="close"
            variant="icon"
            onClick={onClear}
            ariaLabel="Clear selection"
          />
        )}
      </SpaceBetween>
    </FormField>
  );
}
