import { useThemeContext } from '@/contexts/ThemeContext';

export function useTheme() {
  const { theme } = useThemeContext();
  return theme;
}
