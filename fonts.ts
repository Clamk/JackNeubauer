// Fonts loaded at runtime by useFonts (iOS and web). Android embeds the same files at
// build time through the expo-font plugin in app.json, see fonts.android.ts.
// Per-weight subpath imports: each package index require()s every weight (and italic),
// which would bundle ~30 font files instead of the 4 actually used.
import { Figtree_500Medium } from '@expo-google-fonts/figtree/500Medium';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';
import { Figtree_700Bold } from '@expo-google-fonts/figtree/700Bold';
import { IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono/600SemiBold';

export const RUNTIME_FONTS: Record<string, number> = {
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  IBMPlexMono_600SemiBold,
};
