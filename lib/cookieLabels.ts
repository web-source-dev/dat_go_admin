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

type CookieOptionSource = {
  fileName: string;
  sessionName?: string | null;
  accountName?: string | null;
  label?: string | null;
  isActiveSingle?: boolean;
  isActiveDouble?: boolean;
  isActiveMulti?: boolean;
  isActiveSwiftSolutions?: boolean;
  isActiveTest?: boolean;
  isActiveHorizon?: boolean;
};

/** Channels a cookie is currently active for, e.g. "Single, Horizon". */
export function activeCookieChannels(cookie: CookieOptionSource): string[] {
  const channels: string[] = [];
  if (cookie.isActiveSingle) channels.push('Single');
  if (cookie.isActiveDouble) channels.push('Double');
  if (cookie.isActiveMulti) channels.push('Multi');
  if (cookie.isActiveSwiftSolutions) channels.push('Swift');
  if (cookie.isActiveTest) channels.push('Test');
  if (cookie.isActiveHorizon) channels.push('Horizon');
  return channels;
}

/** "fd-container-A1 (John Doe) · Single · active: Single" — for cookie pickers. */
export function describeCookieOption(cookie: CookieOptionSource): string {
  const name = cookie.accountName || cookie.sessionName;
  const channels = activeCookieChannels(cookie);
  return [
    `${cookie.fileName}${name ? ` (${name})` : ''}`,
    getCookieLabelDisplay(cookie.label),
    channels.length ? `active: ${channels.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
