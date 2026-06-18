export const Colors = {
  primary:       '#5B3DF5',
  primaryDark:   '#241B52',
  primaryLight:  'rgba(91,61,245,0.08)',
  primaryMid:    'rgba(91,61,245,0.15)',
  bg:            '#F8F8FC',
  surface:       '#FFFFFF',
  surfaceAlt:    '#F4F4F8',
  border:        '#ECECF2',
  borderStrong:  '#D8D8E8',
  textPrimary:   '#111827',
  textSecondary: '#6B7280',
  textMuted:     '#9CA3AF',
  success:       '#22C55E',
  successBg:     '#F0FDF4',
  successBorder: '#BBF7D0',
  error:         '#EF4444',
  errorBg:       '#FEF2F2',
  errorBorder:   '#FECACA',
  warning:       '#F59E0B',
  warningBg:     '#FFFBEB',
  warningBorder: '#FDE68A',
  info:          '#3B82F6',
  infoBg:        '#EFF6FF',
  infoBorder:    '#BFDBFE',
};

export const Radius = {
  xs:   6,
  sm:   10,
  md:   14,
  lg:   18,
  xl:   24,
  full: 999,
};

export const Shadow = {
  xs: {
    shadowColor: '#1a1a3e',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: '#1a1a3e',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#1a1a3e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#1a1a3e',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 24,
    elevation: 8,
  },
};

export const Spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 24,
  '3xl': 32,
  '4xl': 40,
};

export const Typography = {
  screenTitle:  { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5, color: Colors.textPrimary },
  sectionTitle: { fontSize: 20, fontWeight: '600' as const, letterSpacing: -0.3, color: Colors.textPrimary },
  cardTitle:    { fontSize: 16, fontWeight: '600' as const, letterSpacing: -0.1, color: Colors.textPrimary },
  body:         { fontSize: 15, fontWeight: '400' as const, color: Colors.textPrimary },
  bodySmall:    { fontSize: 13, fontWeight: '400' as const, color: Colors.textSecondary },
  label:        { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.4, color: Colors.textSecondary },
  caption:      { fontSize: 11, fontWeight: '400' as const, color: Colors.textMuted },
};
