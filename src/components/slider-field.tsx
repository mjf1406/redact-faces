import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

export function SliderField({
  label,
  min,
  max,
  step = 0.01,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label>
        {label} {value.toFixed(2)}
      </Label>
      <Slider
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(next) => {
          const resolved = typeof next === 'number' ? next : next[0];
          if (resolved !== undefined) onChange(resolved);
        }}
      />
    </div>
  );
}
