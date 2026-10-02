// Fonts loaded at runtime by useFonts (iOS and web). Android embeds the same files at
// build time through the expo-font plugin in app.json, see fonts.android.ts.
// Per-weight subpath imports: each package index require()s every weight (and italic),
// which would bundle ~44 font files instead of the 8 actually used.
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono/600SemiBold';
import { IBMPlexMono_700Bold } from '@expo-google-fonts/ibm-plex-mono/700Bold';
import { BricolageGrotesque_500Medium } from '@expo-google-fonts/bricolage-grotesque/500Medium';
import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold';
import { JetBrainsMono_600SemiBold } from '@expo-google-fonts/jetbrains-mono/600SemiBold';
import { JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono/700Bold';

export const RUNTIME_FONTS: Record<string, number> = {
  Manrope_500Medium,
  Manrope_700Bold,
  IBMPlexMono_600SemiBold,
  IBMPlexMono_700Bold,
  BricolageGrotesque_500Medium,
  BricolageGrotesque_700Bold,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
};
