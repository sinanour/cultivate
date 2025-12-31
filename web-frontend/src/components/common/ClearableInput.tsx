import { FormField, Input, Button, SpaceBetween } from '@cloudscape-design/components';
import type { InputProps } from '@cloudscape-design/components/input';

interface ClearableInputProps extends Omit<InputProps, 'value' | 'onChange'> {
  label?: string;
  description?: string;
  constraintText?: string;
  errorText?: string;
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
}

export function ClearableInput({
  label,
  description,
  constraintText,
  errorText,
  value,
  onChange,
  onClear,
  ...inputProps
}: ClearableInputProps) {
  return (
    <FormField
      label={label}
      description={description}
      constraintText={constraintText}
      errorText={errorText}
    >
      <SpaceBetween direction="horizontal" size="xs">
        <div style={{ flex: 1 }}>
          <Input
            {...inputProps}
            value={value}
            onChange={(event) => onChange(event.detail.value)}
          />
        </div>
        {value && (
          <Button
            iconName="close"
            variant="icon"
            onClick={onClear}
            ariaLabel="Clear field"
          />
        )}
      </SpaceBetween>
    </FormField>
  );
}
