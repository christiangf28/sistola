import { Colors, DarkColors, ThemeColors } from '@/constants/theme';
import { useAppScheme } from '@/contexts/theme';

export function useThemeColor(
  props: { light?: string; dark?: string },
  _colorName?: string
) {
  const { scheme } = useAppScheme();
  return props[scheme] ?? props.light ?? '#000';
}

export function useColors(): ThemeColors {
  const { scheme } = useAppScheme();
  return scheme === 'dark' ? DarkColors : Colors;
}
