/**
 * SmartWatt Color Palette
 * Modern dark-slate theme with solid surfaces and crisp borders.
 * NO GRADIENTS USED.
 */

export const colors = {
  background: '#090D16',
  backgroundSecondary: '#0E1626',
  surface: '#131B2E',
  surfaceElevated: '#1B2640',
  surfaceSubtle: '#172238',
  surfaceActive: '#223052',

  border: '#23304B',
  borderLight: '#334366',
  borderHighlight: '#38BDF8',

  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textInverse: '#090D16',

  primary: '#38BDF8',
  primaryHover: '#0EA5E9',
  primarySubtle: '#0C2842',
  primaryText: '#E0F2FE',

  secondary: '#818CF8',
  secondarySubtle: '#1E1B4B',

  electric: '#F59E0B',
  electricSubtle: '#38220A',
  electricText: '#FEF3C7',

  water: '#06B6D4',
  waterSubtle: '#083344',
  waterText: '#CFFAFE',

  // Threshold / Status Colors
  normal: '#10B981',
  normalSubtle: '#064E3B',
  normalText: '#D1FAE5',

  warning: '#F59E0B',
  warningSubtle: '#78350F',
  warningText: '#FEF3C7',

  danger: '#EF4444',
  dangerSubtle: '#7F1D1D',
  dangerText: '#FEE2E2',

  info: '#3B82F6',
  infoSubtle: '#1E3A8A',
  infoText: '#DBEAFE',

  // Trend
  trendUp: '#EF4444',
  trendDown: '#10B981',

  // UI helpers
  cardOverlay: 'rgba(15, 23, 42, 0.85)',
  backdrop: 'rgba(3, 7, 18, 0.8)',
};

export type ColorTheme = typeof colors;
