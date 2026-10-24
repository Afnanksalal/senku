'use client';
import * as Select from '@radix-ui/react-select';
import { useId } from 'react';
import { Glyph } from './Glyph';
import styles from './SelectField.module.css';

export type SelectOption = { value: string; label: string; disabled?: boolean };
type Props = {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  label: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  className?: string;
};

// Radix reserves an empty string for its placeholder. Encoding every option also
// preserves legitimate empty choices, such as "Model concepts only".
const token = (value: string) => `option:${encodeURIComponent(value)}`;

export function SelectField({ value, onValueChange, options, label, placeholder = 'Choose an option', disabled, required, name, id, className }: Props) {
  const generated = useId();
  const current = options.some(option => option.value === value) ? token(value) : '';
  return <Select.Root value={current} onValueChange={next => {
    const option = options.find(item => token(item.value) === next);
    if (option) onValueChange(option.value);
  }} disabled={disabled} required={required} name={name}>
    <Select.Trigger id={id ?? generated} className={`${styles.trigger} ${className ?? ''}`} aria-label={label}>
      <Select.Value placeholder={placeholder}/>
      <Select.Icon className={styles.chevron}><Glyph name="next" size={16}/></Select.Icon>
    </Select.Trigger>
    <Select.Portal>
      <Select.Content className={styles.content} position="popper" align="start" sideOffset={7} collisionPadding={12} avoidCollisions>
        <Select.ScrollUpButton className={styles.scrollButton} aria-label="Scroll options up"><Glyph name="next" size={15} style={{ transform: 'rotate(-90deg)' }}/></Select.ScrollUpButton>
        <Select.Viewport className={styles.viewport}>
          {options.map(option => <Select.Item className={styles.option} value={token(option.value)} disabled={option.disabled} key={option.value} textValue={option.label}>
            <Select.ItemText>{option.label}</Select.ItemText>
            <Select.ItemIndicator className={styles.indicator}><Glyph name="check" size={18}/></Select.ItemIndicator>
          </Select.Item>)}
        </Select.Viewport>
        <Select.ScrollDownButton className={styles.scrollButton} aria-label="Scroll options down"><Glyph name="next" size={15} style={{ transform: 'rotate(90deg)' }}/></Select.ScrollDownButton>
      </Select.Content>
    </Select.Portal>
  </Select.Root>;
}
