import '@/global.css';
import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0F172A', // Slate 900
    textSecondary: '#475569', // Slate 600
    textMuted: '#94A3B8', // Slate 400
    background: '#F8FAFC', // Slate 50
    backgroundElement: '#FFFFFF', // White
    backgroundSelected: '#F1F5F9', // Slate 100
    border: '#E2E8F0', // Slate 200
    primary: '#4F46E5', // Indigo 600
    accent: '#8B5CF6', // Violet 500
    success: '#10B981', // Emerald 500
    warning: '#F59E0B', // Amber 500
    danger: '#EF4444', // Rose 500
  },
  dark: {
    text: '#F8FAFC', // Slate 50
    textSecondary: '#94A3B8', // Slate 400
    textMuted: '#64748B', // Slate 500
    background: '#0B0F19', // Very dark slate-blue
    backgroundElement: '#161F30', // Darker card background
    backgroundSelected: '#24324D', // Highlighted card
    border: '#1E293B', // Slate 800
    primary: '#0EA5E9', // Sky 500
    accent: '#A78BFA', // Violet 400
    success: '#34D399', // Emerald 400
    warning: '#FBBF24', // Amber 400
    danger: '#F87171', // Rose 400
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'System',
    serif: 'Georgia',
    rounded: 'System',
    mono: 'Courier New', // Fallback, we will use monospace styles
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'Inter, system-ui, sans-serif',
    serif: 'Georgia, serif',
    rounded: 'system-ui, sans-serif',
    mono: '"Fira Code", Monaco, Consolas, monospace',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 65, android: 75 }) ?? 0;
export const MaxContentWidth = 800;

// Helper to get color values dynamically
export function useThemeColors(scheme: 'light' | 'dark' = 'dark') {
  return Colors[scheme];
}
