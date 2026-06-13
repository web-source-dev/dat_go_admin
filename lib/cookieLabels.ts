export type CookieLabel =
  | 'new'
  | 'single'
  | 'double'
  | 'multi_without_auto'
  | 'multi_with_auto'
  | 'multi';

export type AssignableCookieLabel = Exclude<CookieLabel, 'multi'>;

export const COOKIE_LABEL_OPTIONS: { value: AssignableCookieLabel; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'single', label: 'Single' },
  { value: 'double', label: 'Double' },
  { value: 'multi_without_auto', label: 'Multi (without auto)' },
  { value: 'multi_with_auto', label: 'Multi (with Auto)' },
];

export function getCookieLabelDisplay(label?: string | null): string {
  if (!label) return 'New';
  const match = COOKIE_LABEL_OPTIONS.find((opt) => opt.value === label);
  if (match) return match.label;
  if (label === 'multi') return 'Multi (legacy)';
  return label;
}

export function isAssignableCookieLabel(label: string): label is AssignableCookieLabel {
  return COOKIE_LABEL_OPTIONS.some((opt) => opt.value === label);
}
