import { FormField, DatePicker, Button, SpaceBetween } from '@cloudscape-design/components';
import type { DatePickerProps } from '@cloudscape-design/components/date-picker';

interface ClearableDatePickerProps extends Omit<DatePickerProps, 'value' | 'onChange'> {
  label?: string;
  description?: string;
  constraintText?: string;
  errorText?: string;
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
}

export function ClearableDatePicker({
  label,
  description,
  constraintText,
  errorText,
  value,
  onChange,
  onClear,
  ...datePickerProps
}: ClearableDatePickerProps) {
  return (
    <FormField
      label={label}
      description={description}
      constraintText={constraintText}
      errorText={errorText}
    >
      <SpaceBetween direction="horizontal" size="xs">
        <div style={{ flex: 1 }}>
          <DatePicker
            {...datePickerProps}
            value={value}
            onChange={(event) => onChange(event.detail.value)}
          />
        </div>
        {value && (
          <Button
            iconName="close"
            variant="icon"
            onClick={onClear}
            ariaLabel="Clear date"
          />
        )}
      </SpaceBetween>
    </FormField>
  );
}
