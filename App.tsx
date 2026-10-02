import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { useKeepAwake } from 'expo-keep-awake';
import * as Clipboard from 'expo-clipboard';
import Svg, { ClipPath, Defs, G, Line, Path, Pattern, Polygon, Rect } from 'react-native-svg';
import { useFonts } from 'expo-font';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RUNTIME_FONTS } from './fonts';

type CounterKey = 'live' | 'dead';
// events is the ordered tap log, in order, so undo() is just "drop the last one".
// touched marks that the user has started counting this square, so a square
// counted down to a genuine zero is still included in the mean (as opposed to
// a square the user never visited).
// live / dead are running totals of events, kept in sync so taps and stats don't rescan the log.
type Square = { events: CounterKey[]; touched: boolean } & Record<CounterKey, number>;

const emptySquare = (): Square => ({ events: [], touched: false, live: 0, dead: 0 });

// Concentration factor = 1 / (counted-square volume in mL), per chamber type.
const CHAMBERS = [
  { key: 'neubauer', label: 'Neubauer Improved', factor: 1e4 },
  { key: 'fuchsRosenthal', label: 'Fuchs-Rosenthal', factor: 5e3 },
  { key: 'malassez', label: 'Malassez', factor: 1.25e5 },
] as const;
type ChamberKey = (typeof CHAMBERS)[number]['key'];

// On Android, use the system's tuned click effects (crisper than impactAsync's custom
// vibration waveform, and they follow the phone's touch-feedback setting).
const isAndroid = Platform.OS === 'android';
let hapticsEnabled = true;
const hapticLight = () => {
  if (!hapticsEnabled) return;
  (isAndroid
    ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Keyboard_Tap)
    : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  ).catch(() => {});
};
const hapticMedium = () => {
  if (!hapticsEnabled) return;
  (isAndroid
    ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Virtual_Key)
    : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  ).catch(() => {});
};

// Live = soft high fingertip tap, dead = lower, woodier tap (both under 50 ms audible): distinguishable by ear alone.
// Players are created once and rewound on each tap so rapid counting stays snappy.
// Created after the first frame (initAudio in an effect): on Android each constructor
// blocks the JS thread until the main thread has built the player, which would
// otherwise delay startup.
let players: Record<CounterKey, AudioPlayer> | null = null;
const initAudio = () => {
  if (players) return;
  players = {
    live: createAudioPlayer(require('./assets/sounds/live.wav')),
    dead: createAudioPlayer(require('./assets/sounds/dead.wav')),
  };
  setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => {});
};
let tapVolume = 1;
const applyVolume = (volume: number, muted: boolean) => {
  tapVolume = muted ? 0 : volume;
  if (players) for (const k of Object.keys(players) as CounterKey[]) players[k].volume = tapVolume;
};
// Not awaiting the seek: seekTo and play run in order on the same native queue, so
// play is issued in the same tick instead of after a native round trip.
const playTap = (k: CounterKey) => {
  const p = players?.[k];
  if (!p || tapVolume === 0) return;
  p.seekTo(0).catch(() => {});
  p.play();
};

// react-native-web delays onPressIn by 50 ms by default and, with no onPress set, drops
// taps released within that delay. delayPressIn is web-only (not in RN's Pressable
// types); native Pressable already starts the press immediately.
const noPressDelay = (Platform.OS === 'web' ? { delayPressIn: 0 } : {}) as {};

// react-native-web's Alert.alert is a no-op, so confirm with the browser dialog there.
const confirmDestructive = (title: string, message: string, confirmText: string, onConfirm: () => void) => {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmText, style: 'destructive', onPress: onConfirm },
  ]);
};

type LayoutKey = 'A' | 'B' | 'E';
const LAYOUTS: { key: LayoutKey; label: string }[] = [
  { key: 'A', label: 'Vertical' },
  { key: 'B', label: 'Horizontal' },
  { key: 'E', label: 'Diagonal' },
];

type ThemeMode = 'dark' | 'light';
type ThemeName = 'gridline' | 'cleanroom';
const THEME_NAMES: { key: ThemeName; label: string }[] = [
  { key: 'gridline', label: 'Gridline' },
  { key: 'cleanroom', label: 'Cleanroom' },
];

type Palette = {
  background: string;
  surface: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  live: string;
  dead: string;
  grid: string;
  dangerBg: string;
  dangerBorder: string;
  dangerText: string;
};

// Font families per theme: ui weights (medium / semibold / bold) and the numeral face.
type Fonts = { m: string; b: string; num6: string; num7: string };

// Shape and surface treatment shared by both modes of a theme.
type Shape = {
  radius: number; // controls
  zoneRadius: number; // counting zones
  zoneBorder: number; // 0 = borderless tile
  zoneFill: string; // alpha hex laid over the surface
  soft: boolean; // soft drop shadows instead of outlines
  showGrid: boolean; // faint grid behind the screen
  pipRadius: number;
  fonts: Fonts;
};

type Theme = Palette & Shape & { name: ThemeName; mode: ThemeMode };

const PALETTES: Record<ThemeName, Record<ThemeMode, Palette>> = {
  gridline: {
    light: {
      background: '#edf1f5', surface: '#ffffff', border: '#cfd8e2',
      textPrimary: '#132238', textSecondary: '#5c6d84',
      live: '#0b7d8a', dead: '#d9480f', grid: 'rgba(19,34,56,0.055)',
      dangerBg: '#fff0e8', dangerBorder: '#f6c9b0', dangerText: '#b23a0a',
    },
    dark: {
      background: '#0d1620', surface: '#15222f', border: '#28394b',
      textPrimary: '#e4eef8', textSecondary: '#8497ae',
      live: '#3cc9d6', dead: '#ff8a5c', grid: 'rgba(140,180,220,0.07)',
      dangerBg: '#2c1c14', dangerBorder: '#54321f', dangerText: '#ffb08a',
    },
  },
  cleanroom: {
    light: {
      background: '#edf2f8', surface: '#ffffff', border: '#d9e2ee',
      textPrimary: '#0f2137', textSecondary: '#64768d',
      live: '#0a6fe0', dead: '#e8590c', grid: 'transparent',
      dangerBg: '#fff0e6', dangerBorder: '#fbd0b3', dangerText: '#b8430a',
    },
    dark: {
      background: '#0d131b', surface: '#172130', border: '#263447',
      textPrimary: '#e8f0fa', textSecondary: '#8a9bb1',
      live: '#4da3ff', dead: '#ff8a4c', grid: 'transparent',
      dangerBg: '#2c1b12', dangerBorder: '#54301c', dangerText: '#ffb185',
    },
  },
};

const SHAPES: Record<ThemeName, Shape> = {
  gridline: {
    radius: 10,
    zoneRadius: 14,
    zoneBorder: 1.5,
    zoneFill: '14',
    soft: false,
    showGrid: true,
    pipRadius: 2,
    fonts: {
      m: 'BricolageGrotesque_500Medium',
      b: 'BricolageGrotesque_700Bold',
      num6: 'JetBrainsMono_600SemiBold',
      num7: 'JetBrainsMono_700Bold',
    },
  },
  cleanroom: {
    radius: 14,
    zoneRadius: 26,
    zoneBorder: 0,
    zoneFill: '1f',
    soft: true,
    showGrid: false,
    pipRadius: 5,
    fonts: {
      m: 'Manrope_500Medium',
      b: 'Manrope_700Bold',
      num6: 'IBMPlexMono_600SemiBold',
      num7: 'IBMPlexMono_700Bold',
    },
  },
};

const SETTINGS_KEY = 'cellcounter.settings.v1';

const makeTheme = (name: ThemeName, mode: ThemeMode): Theme => ({
  name,
  mode,
  ...PALETTES[name][mode],
  ...SHAPES[name],
});

export default function App() {
  useKeepAwake();
  // Empty on Android (fonts are embedded), so this is loaded on the first render there.
  // On a load error (e.g. offline on web), render anyway with the system fallback fonts.
  const [fontsLoaded, fontError] = useFonts(RUNTIME_FONTS);
  useEffect(initAudio, []);
  const [squares, setSquares] = useState<Square[]>([emptySquare()]);
  const [idx, setIdx] = useState(0);
  const [dilution, setDilution] = useState('1');
  const [chamber, setChamber] = useState<ChamberKey>('neubauer');
  const [chamberPickerOpen, setChamberPickerOpen] = useState(false);
  const [layout, setLayout] = useState<LayoutKey>('A');
  const [inverted, setInverted] = useState(false);
  const [themeName, setThemeName] = useState<ThemeName>('gridline');
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [soundOpen, setSoundOpen] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const silent = muted || volume === 0;
  useEffect(() => applyVolume(volume, muted), [volume, muted]);
  const [haptics, setHaptics] = useState(true);
  // In an effect: a module write during render breaks purity and makes the React Compiler skip App.
  useEffect(() => {
    hapticsEnabled = haptics;
  }, [haptics]);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  // Last JSON written to (or read from) storage, so unchanged settings aren't rewritten.
  const savedJson = useRef<string | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY)
      .then((raw) => {
        if (!raw) return;
        savedJson.current = raw;
        const s = JSON.parse(raw);
        if (typeof s.dilution === 'string') setDilution(s.dilution);
        if (CHAMBERS.some((c) => c.key === s.chamber)) setChamber(s.chamber);
        if (LAYOUTS.some((l) => l.key === s.layout)) setLayout(s.layout);
        if (typeof s.inverted === 'boolean') setInverted(s.inverted);
        if (Object.hasOwn(PALETTES, s.themeName)) setThemeName(s.themeName);
        if (s.themeMode === 'dark' || s.themeMode === 'light') setThemeMode(s.themeMode);
        if (Number.isFinite(s.volume)) setVolume(Math.min(1, Math.max(0, s.volume)));
        if (typeof s.muted === 'boolean') setMuted(s.muted);
        if (typeof s.haptics === 'boolean') setHaptics(s.haptics);
      })
      .catch(() => {})
      .finally(() => setSettingsLoaded(true));
  }, []);
  // Debounced so a slider drag or typing isn't one storage write per event; flushed
  // immediately when the app leaves the foreground so the last change isn't lost.
  useEffect(() => {
    if (!settingsLoaded) return;
    const json = JSON.stringify({ dilution, chamber, layout, inverted, themeName, themeMode, volume, muted, haptics });
    if (json === savedJson.current) return;
    const save = () => {
      if (savedJson.current === json) return;
      savedJson.current = json;
      AsyncStorage.setItem(SETTINGS_KEY, json).catch(() => {});
    };
    const timer = setTimeout(save, 300);
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') save();
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [settingsLoaded, dilution, chamber, layout, inverted, themeName, themeMode, volume, muted, haptics]);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [zoneSize, setZoneSize] = useState({ width: 0, height: 0 });
  const { factor: chamberFactor, label: chamberLabel } = CHAMBERS.find((c) => c.key === chamber)!;

  const theme = useMemo(() => makeTheme(themeName, themeMode), [themeName, themeMode]);
  // Big numerals scale with the usable screen: the layout is capped at MAX_CONTENT_WIDTH wide,
  // and a short screen shrinks them so the counting zones keep room.
  const { width: winW, height: winH } = useWindowDimensions();
  const scale = Math.min(1.3, Math.max(0.8, Math.min(Math.min(winW, MAX_CONTENT_WIDTH) / 390, winH / 800)));
  const styles = useMemo(() => makeStyles(theme, scale), [theme, scale]);
  useEffect(setupWebViewport, []);

  const square = squares[idx];

  // slot1 is the "primary" position (left / top / top-left triangle); slot2 the secondary one
  // (right / bottom / bottom-right).
  const [slot1, slot2]: [CounterKey, CounterKey] = inverted ? ['dead', 'live'] : ['live', 'dead'];

  const update = useCallback(
    (fn: (s: Square) => Square) =>
      setSquares((all) => all.map((s, i) => (i === idx ? fn(s) : s))),
    [idx],
  );

  const add = useCallback(
    (k: CounterKey) => {
      hapticLight();
      playTap(k);
      update((s) => ({ ...s, events: [...s.events, k], [k]: s[k] + 1, touched: true }));
    },
    [update],
  );

  // Web keyboard counting: left/up count the primary slot, right/down the secondary one, so
  // inverting swaps the keys along with the zones.
  const modalOpen = settingsOpen || infoOpen || soundOpen || chamberPickerOpen;
  useEffect(() => {
    if (Platform.OS !== 'web' || modalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') add(slot1);
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') add(slot2);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalOpen, add, slot1, slot2]);

  // Removes the most recent tap in this square, whichever counter it went to.
  const undo = () => {
    hapticMedium();
    update((s) => {
      const last = s.events[s.events.length - 1];
      return last ? { ...s, events: s.events.slice(0, -1), [last]: s[last] - 1 } : s;
    });
  };

  const adjustDilution = (delta: number) => {
    hapticLight();
    setDilution((d) => {
      const cur = parseFloat(d.replace(',', '.'));
      const base = Number.isFinite(cur) ? cur : 1;
      // Step to the next whole number in that direction (2.5 goes to 3 or 2, not 4 or 2).
      const next = delta > 0 ? Math.floor(base) + delta : Math.ceil(base) + delta;
      return String(Math.max(1, next));
    });
  };

  const resetSquare = () => {
    hapticMedium();
    update(() => emptySquare());
  };

  const addSquare = () => {
    setSquares((all) => [...all, emptySquare()]);
    setIdx(squares.length);
  };

  const resetAll = () => {
    confirmDestructive('Reset everything?', 'This clears all squares.', 'Reset', () => {
      setSquares([emptySquare()]);
      setIdx(0);
    });
  };

  const toggleMode = () => {
    hapticLight();
    setThemeMode((m) => (m === 'dark' ? 'light' : 'dark'));
  };

  // Concentration (cells/mL) = mean count per counted square x dilution x chamber factor, per counter.
  // "Counted" means touched, not nonzero: a square genuinely counted as zero
  // still belongs in the mean, unlike a square the user never visited.
  const stats = useMemo(() => {
    const counted = squares.filter((s) => s.touched);
    const live = counted.reduce((n, s) => n + s.live, 0);
    const dead = counted.reduce((n, s) => n + s.dead, 0);
    const meanLive = counted.length ? live / counted.length : 0;
    const meanDead = counted.length ? dead / counted.length : 0;
    const d = parseFloat(dilution.replace(',', '.'));
    const validDilution = Number.isFinite(d) && d > 0;
    const concLive = validDilution ? meanLive * d * chamberFactor : NaN;
    const concDead = validDilution ? meanDead * d * chamberFactor : NaN;
    const concTotal = validDilution ? concLive + concDead : NaN;
    const viability = live + dead > 0 ? (live / (live + dead)) * 100 : NaN;
    return { n: counted.length, live, dead, concLive, concDead, concTotal, viability };
  }, [squares, dilution, chamberFactor]);

  const anyCounts = stats.n > 0;
  const squareHasCounts = square.events.length > 0;

  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: theme.background }} />;
  }

  const option = (label: string, active: boolean, onPress: () => void) => (
    <Pressable key={label} style={[styles.modalOption, active && styles.modalOptionActive]} onPress={onPress}>
      <Text style={[styles.modalOptionText, active && styles.modalOptionTextActive]}>{label}</Text>
      {active && <Text style={styles.modalCheck}>✓</Text>}
    </Pressable>
  );

  const viaTotal = stats.live + stats.dead;
  const concText = (c: number) => (anyCounts && Number.isFinite(c) ? formatConc(c) : '–');
  const meanText = (total: number) => (stats.n ? (total / stats.n).toFixed(2) : '–');
  const viabilityText = (digits: number) =>
    Number.isFinite(stats.viability) ? `${stats.viability.toFixed(digits)} %` : '–';

  const toggleMute = () => {
    if (silent && volume === 0) setVolume(0.5);
    setMuted(!silent);
  };

  const summaryText = () => {
    const conc = (c: number) => (anyCounts && Number.isFinite(c) ? `${formatConc(c)} cells/mL` : '–');
    return [
      `Cell count – ${chamberLabel}`,
      `Squares counted: ${stats.n}`,
      `Live: ${stats.live} (mean ${meanText(stats.live)})`,
      `Dead: ${stats.dead} (mean ${meanText(stats.dead)})`,
      `Dilution factor: ${dilution || '–'}`,
      `Live concentration: ${conc(stats.concLive)}`,
      `Dead concentration: ${conc(stats.concDead)}`,
      `Total concentration: ${conc(stats.concTotal)}`,
      `Viability: ${viabilityText(1)}`,
    ].join('\n');
  };

  const copySummary = async () => {
    try {
      await Clipboard.setStringAsync(summaryText());
    } catch {
      return;
    }
    hapticLight();
    setCopied(true);
    // Restart the timer so "Copied ✓" stays 1.5 s after the latest copy.
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 1500);
  };

  // Opens the system share sheet. On web this needs navigator.share, so fall back to copying,
  // but not when the user just cancelled the browser's share sheet (AbortError).
  const sendSummary = async () => {
    try {
      await Share.share({ message: summaryText() });
    } catch (e) {
      if ((e as Error | null)?.name !== 'AbortError') copySummary();
    }
  };

  return (
    <SafeAreaProvider>
    <View style={styles.page}>
    <SafeAreaView style={styles.root}>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      {theme.showGrid && <GridBackground theme={theme} />}

      <View style={styles.topRow}>
        <Pressable style={styles.ribbon} onPress={() => setChamberPickerOpen(true)}>
          <Text style={styles.ribbonText}>{chamberLabel}</Text>
          <Text style={styles.ribbonChevron}>▾</Text>
        </Pressable>
        <Pressable
          style={styles.gearButton}
          onPress={() => setSoundOpen(true)}
          accessibilityLabel="Sound"
        >
          <SpeakerIcon color={theme.textSecondary} muted={silent} />
        </Pressable>
        <Pressable
          style={styles.gearButton}
          onPress={() => setSettingsOpen(true)}
          accessibilityLabel="Layout options"
        >
          <Text style={styles.gearIcon}>⚙</Text>
        </Pressable>
      </View>

      <Modal
        visible={chamberPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setChamberPickerOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setChamberPickerOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            {CHAMBERS.map((c) =>
              option(c.label, chamber === c.key, () => {
                setChamber(c.key);
                setChamberPickerOpen(false);
              }),
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={soundOpen} transparent animationType="fade" onRequestClose={() => setSoundOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSoundOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalSectionLabel}>Sound</Text>
            <View style={styles.soundRow}>
              <Pressable
                style={styles.gearButton}
                onPress={toggleMute}
                accessibilityLabel={silent ? 'Unmute' : 'Mute'}
              >
                <SpeakerIcon color={theme.textPrimary} muted={silent} />
              </Pressable>
              <VolumeSlider
                value={silent ? 0 : volume}
                onChange={(v) => {
                  setVolume(v);
                  setMuted(false);
                }}
                styles={styles}
              />
            </View>
            <Pressable style={styles.modalOption} onPress={() => setSoundOpen(false)}>
              <Text style={styles.modalOptionText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={settingsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSettingsOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSettingsOpen(false)}>
          <Pressable style={[styles.modalSheet, { maxHeight: '90%' }]} onPress={() => {}}>
            <ScrollView contentContainerStyle={{ paddingTop: 14 }}>
              <View style={styles.tileRow}>
                {THEME_NAMES.map((t) => (
                  <ThemeCard
                    key={t.key}
                    name={t.key}
                    label={t.label}
                    mode={themeMode}
                    active={themeName === t.key}
                    onPress={() => {
                      hapticLight();
                      setThemeName(t.key);
                    }}
                    styles={styles}
                  />
                ))}
              </View>

              <View style={styles.tileRow}>
                {LAYOUTS.map((l) => (
                  <Pressable
                    key={l.key}
                    style={[styles.tile, layout === l.key && styles.tileActive]}
                    onPress={() => {
                      hapticLight();
                      setLayout(l.key);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: layout === l.key }}
                    accessibilityLabel={`${l.label} split`}
                  >
                    <LayoutIcon layoutKey={l.key} slot1={theme[slot1]} slot2={theme[slot2]} theme={theme} />
                    <Text style={[styles.tileText, layout === l.key && styles.tileTextActive]}>{l.label}</Text>
                  </Pressable>
                ))}
              </View>
              <SwitchRow
                label="Switch positions"
                hint={inverted ? 'Dead first, live second' : 'Live first, dead second'}
                value={inverted}
                onToggle={() => {
                  hapticLight();
                  setInverted((v) => !v);
                }}
                styles={styles}
              />
              <SwitchRow label="Dark mode" value={themeMode === 'dark'} onToggle={toggleMode} styles={styles} />
              <SwitchRow
                label="Haptic feedback"
                value={haptics}
                onToggle={() => {
                  hapticsEnabled = !haptics;
                  hapticLight();
                  setHaptics(!haptics);
                }}
                styles={styles}
              />
              <SwitchRow
                label="Mute sound"
                value={silent}
                onToggle={() => {
                  hapticLight();
                  toggleMute();
                }}
                styles={styles}
              />

              <View style={styles.modalFooter}>
                <Pressable style={styles.button} onPress={() => setSettingsOpen(false)}>
                  <Text style={styles.buttonText}>Done</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <View style={styles.results}>
        <View style={styles.concMain}>
          <View style={styles.concLine}>
            <View style={styles.pip} />
            <Text style={[styles.conc, { color: theme.live }]}>{concText(stats.concLive)}</Text>
          </View>
          <Text style={styles.concUnit}>live cells/mL</Text>
        </View>
        <View style={styles.concRow}>
          {([
            ['dead', stats.concDead, theme.dead],
            ['total', stats.concTotal, theme.textPrimary],
          ] as const).map(([label, c, color]) => (
            <View key={label} style={styles.concCol}>
              <Text style={[styles.concSmall, { color }]}>{concText(c)}</Text>
              <Text style={styles.concUnit}>{label} cells/mL</Text>
            </View>
          ))}
        </View>
        <View style={styles.via}>
          <View style={styles.viaTop}>
            <Text style={styles.concUnit}>Viability</Text>
            <Text style={styles.viaValue}>{viabilityText(0)}</Text>
          </View>
          <View style={styles.viaBar}>
            {stats.live > 0 && <View style={{ flex: stats.live, backgroundColor: theme.live }} />}
            {stats.dead > 0 && <View style={{ flex: stats.dead, backgroundColor: theme.dead }} />}
          </View>
        </View>
      </View>

      <View style={styles.dilRow}>
        <Text style={styles.dilLabel}>Dilution factor</Text>
        <View style={styles.dilControl}>
          <Pressable
            style={styles.dilStepBtn}
            onPress={() => adjustDilution(-1)}
            accessibilityLabel="Decrease dilution factor"
          >
            <Text style={styles.dilStepText}>−</Text>
          </Pressable>
          <TextInput
            style={styles.dilInput}
            value={dilution}
            onChangeText={setDilution}
            keyboardType="decimal-pad"
            selectTextOnFocus
          />
          <Pressable
            style={[styles.dilStepBtn, styles.dilStepBtnEnd]}
            onPress={() => adjustDilution(1)}
            accessibilityLabel="Increase dilution factor"
          >
            <Text style={styles.dilStepText}>+</Text>
          </Pressable>
        </View>
      </View>

      {layout === 'A' && (
        <View style={styles.split}>
          {[slot1, slot2].map((k) => (
            <CountZone
              key={k}
              k={k}
              count={square[k]}
              color={theme[k]}
              style={styles.zone}
              fill={theme.zoneFill}
              onAdd={add}
              styles={styles}
            />
          ))}
        </View>
      )}

      {layout === 'B' && (
        <View style={styles.stack}>
          {[slot1, slot2].map((k) => (
            <CountZone
              key={k}
              k={k}
              count={square[k]}
              color={theme[k]}
              style={styles.stackZone}
              countStyle={styles.stackCount}
              fill={theme.zoneFill}
              onAdd={add}
              styles={styles}
            />
          ))}
        </View>
      )}

      {layout === 'E' && (
        <View
          style={styles.diagonalZone}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setZoneSize((z) => (z.width === width && z.height === height ? z : { width, height }));
          }}
        >
          {zoneSize.width > 0 && zoneSize.height > 0 && (
            <Svg width={zoneSize.width} height={zoneSize.height} style={StyleSheet.absoluteFill}>
              <Polygon
                points={`0,0 ${zoneSize.width},0 0,${zoneSize.height}`}
                fill={theme[slot1] + '26'}
              />
              <Polygon
                points={`${zoneSize.width},0 ${zoneSize.width},${zoneSize.height} 0,${zoneSize.height}`}
                fill={theme[slot2] + '26'}
              />
              <Line x1={zoneSize.width} y1={0} x2={0} y2={zoneSize.height} stroke={theme.border} strokeWidth={2} />
            </Svg>
          )}
          <Pressable
            style={StyleSheet.absoluteFill}
            // Counts on touch-down, like the other layouts (see noPressDelay).
            {...noPressDelay}
            onPressIn={(e) => {
              const { locationX, locationY } = e.nativeEvent;
              const { width, height } = zoneSize;
              if (width === 0 || height === 0) return;
              const inTopLeft = locationX / width + locationY / height < 1;
              const k = inTopLeft ? slot1 : slot2;
              add(k);
            }}
            accessibilityLabel="Diagonal counting zone: tap top-left or bottom-right"
            // Screen readers can't pick a triangle, so offer one action per counter.
            accessibilityActions={[
              { name: slot1, label: `Add one ${slot1} cell` },
              { name: slot2, label: `Add one ${slot2} cell` },
            ]}
            onAccessibilityAction={(e) => {
              const name = e.nativeEvent.actionName;
              if (name === 'live' || name === 'dead') add(name);
            }}
          >
            {/* pointerEvents none: locationX/Y are relative to the touched view, so a tap on a
                label would otherwise be measured from the label's corner, not the zone's. */}
            <View style={styles.diagonalLabelTop} pointerEvents="none">
              <ZoneReadout
                k={slot1}
                count={square[slot1]}
                color={theme[slot1]}
                labelStyle={styles.diagonalZoneLabel}
                countStyle={styles.diagonalCount}
                styles={styles}
              />
            </View>
            <View style={styles.diagonalLabelBottom} pointerEvents="none">
              <ZoneReadout
                k={slot2}
                count={square[slot2]}
                color={theme[slot2]}
                labelStyle={styles.diagonalZoneLabel}
                countStyle={styles.diagonalCount}
                styles={styles}
              />
            </View>
          </Pressable>
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chips}
      >
        {squares.map((s, i) => (
          <SquareChip key={i} i={i} total={s.events.length} active={i === idx} onSelect={setIdx} styles={styles} />
        ))}
        <Pressable style={[styles.chip, styles.chipAdd]} onPress={addSquare} accessibilityLabel="Add square">
          <Text style={styles.chipAddText}>+</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.bar}>
        <Pressable
          style={[styles.button, !squareHasCounts && styles.dim]}
          onPress={undo}
          disabled={!squareHasCounts}
        >
          <Text style={styles.buttonText} numberOfLines={1}>Undo</Text>
        </Pressable>
        <Pressable
          style={[styles.button, !square.touched && styles.dim]}
          onPress={resetSquare}
          disabled={!square.touched}
        >
          <Text style={styles.buttonText} numberOfLines={1} adjustsFontSizeToFit>Reset</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.buttonDanger, !anyCounts && styles.dim]} onPress={resetAll} disabled={!anyCounts}>
          <Text style={styles.buttonDangerText} numberOfLines={1} adjustsFontSizeToFit>Reset all</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.buttonInfo]}
          onPress={() => setInfoOpen(true)}
          accessibilityLabel="Show calculation details"
        >
          <Text style={styles.buttonText}>Info</Text>
        </Pressable>
      </View>

      <Modal visible={infoOpen} transparent animationType="fade" onRequestClose={() => setInfoOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setInfoOpen(false)}>
          <Pressable style={[styles.modalSheet, { maxHeight: '85%' }]} onPress={() => {}}>
            <ScrollView contentContainerStyle={styles.infoBody}>
              <Text style={styles.infoTitle}>{chamberLabel}</Text>
              <Text style={styles.infoText}>How the concentrations are calculated.</Text>

              <Text style={styles.infoHead}>1. Counted volume</Text>
              <Text style={styles.infoText}>
                Chamber factor = 1 / volume of one counted square (in mL).
              </Text>
              <Text style={styles.infoFormula}>
                factor = {chamberFactor.toExponential(2).replace('e+', ' × 10^')}
              </Text>
              <Text style={styles.infoFormula}>
                volume = 1 / factor = {formatVolume(1 / chamberFactor)} mL
              </Text>

              <Text style={styles.infoHead}>2. Mean count per square</Text>
              <Text style={styles.infoText}>
                Only squares you have started counting are included (a square counted down to 0 still counts).
              </Text>
              <Text style={styles.infoFormula}>mean = Σ cells / N squares</Text>
              <Text style={styles.infoFormula}>
                live: {stats.live} / {stats.n} = {meanText(stats.live)}
              </Text>
              <Text style={styles.infoFormula}>
                dead: {stats.dead} / {stats.n} = {meanText(stats.dead)}
              </Text>

              <Text style={styles.infoHead}>3. Concentration</Text>
              <Text style={styles.infoFormula}>cells/mL = mean × dilution × factor</Text>
              <Text style={styles.infoFormula}>live = {concText(stats.concLive)}</Text>
              <Text style={styles.infoFormula}>dead = {concText(stats.concDead)}</Text>
              <Text style={styles.infoFormula}>total = live + dead</Text>
              <Text style={styles.infoFormula}>total = {concText(stats.concTotal)}</Text>
              <Text style={styles.infoText}>Dilution factor currently: {dilution || '–'}</Text>

              <Text style={styles.infoHead}>4. Viability</Text>
              <Text style={styles.infoFormula}>live / (live + dead) × 100</Text>
              <Text style={styles.infoFormula}>
                {stats.live} / {viaTotal} × 100 = {viabilityText(1)}
              </Text>
            </ScrollView>
            <Pressable style={styles.modalOption} onPress={copySummary}>
              <Text style={styles.modalOptionText}>{copied ? 'Copied ✓' : 'Copy to clipboard'}</Text>
            </Pressable>
            <Pressable style={styles.modalOption} onPress={sendSummary}>
              <Text style={styles.modalOptionText}>Send to…</Text>
            </Pressable>
            <Pressable style={styles.modalOption} onPress={() => setInfoOpen(false)}>
              <Text style={styles.modalOptionText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
    </View>
    </SafeAreaProvider>
  );
}

// Widest the layout gets; on a desktop window it is centred instead of stretched.
const MAX_CONTENT_WIDTH = 560;

// Web only: size the page to the visible viewport (dvh excludes the mobile browser's URL bar, so
// the bottom buttons aren't cut off), stop double-tap zoom and text selection from interfering
// with rapid counting taps, and let the safe-area insets apply.
function setupWebViewport() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const meta = document.querySelector('meta[name="viewport"]');
  meta?.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');
  const style = document.createElement('style');
  style.textContent =
    'html,body,#root{height:100%;height:100dvh;overflow:hidden;overscroll-behavior:none}' +
    'body{touch-action:manipulation;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}' +
    'input{-webkit-user-select:text;user-select:text}';
  document.head.appendChild(style);
  return () => {
    document.head.removeChild(style);
  };
}

// Faint even grid behind the screen (Gridline theme only). Memoised: it only depends on
// the theme, so taps don't re-render the SVG pattern.
const GridBackground = memo(function GridBackground({ theme }: { theme: Theme }) {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <Pattern id="grid" width={24} height={24} patternUnits="userSpaceOnUse">
          <Path d="M24 0 H0 V24" fill="none" stroke={theme.grid} strokeWidth={1} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#grid)" />
    </Svg>
  );
});

type SquareChipProps = {
  i: number;
  total: number;
  active: boolean;
  onSelect: (i: number) => void;
  styles: ReturnType<typeof makeStyles>;
};

// Memoised so a tap only re-renders the active square's chip, not the whole row.
const SquareChip = memo(function SquareChip({ i, total, active, onSelect, styles }: SquareChipProps) {
  return (
    <Pressable
      style={[styles.chip, active && styles.chipActive]}
      onPress={() => onSelect(i)}
      accessibilityLabel={`Square ${i + 1}`}
    >
      <Text style={[styles.chipLabel, active && styles.chipTextActive]}>SQ {i + 1}</Text>
      <Text style={[styles.chipValue, active && styles.chipTextActive]}>{total}</Text>
    </Pressable>
  );
});

type ZoneReadoutProps = {
  k: CounterKey;
  count: number;
  color: string;
  styles: ReturnType<typeof makeStyles>;
  labelStyle?: object;
  countStyle?: object;
};

function ZoneReadout({ k, count, color, styles, labelStyle, countStyle }: ZoneReadoutProps) {
  return (
    <>
      <Text style={[styles.zoneLabel, labelStyle, { color }]}>{k}</Text>
      <Text style={[styles.count, countStyle, { color }]}>{count}</Text>
    </>
  );
}

// Memoised with a stable onAdd so tapping one zone doesn't re-render the other.
// Counts on onPressIn (touch-down) rather than onPress (finger lift), so a count doesn't
// wait for the tap to end; it also skips Android's system click sound, which onPress
// plays on top of the live/dead sounds.
const CountZone = memo(function CountZone({
  k,
  count,
  color,
  style,
  countStyle,
  labelStyle,
  fill,
  onAdd,
  styles,
}: ZoneReadoutProps & { style: object; fill: string; onAdd: (k: CounterKey) => void }) {
  return (
    <Pressable
      onPressIn={() => onAdd(k)}
      {...noPressDelay}
      // Screen readers activate through onPress, which is no longer set.
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={() => onAdd(k)}
      style={({ pressed }) => [
        style,
        { backgroundColor: color + (pressed ? '47' : fill), borderColor: color, shadowColor: color },
      ]}
      accessibilityLabel={`Add one ${k} cell`}
    >
      <View style={[styles.zonePip, { backgroundColor: color }]} />
      <ZoneReadout k={k} count={count} color={color} styles={styles} countStyle={countStyle} labelStyle={labelStyle} />
    </Pressable>
  );
});

function formatConc(c: number) {
  if (c === 0) return '0';
  let exp = Math.floor(Math.log10(c));
  let mantissa = c / 10 ** exp;
  // Rounding to 2 decimals can push the mantissa up to "10.00" (either from a
  // true value near the next power of ten, or float error at the boundary);
  // bump the exponent so it renders in proper [1, 10) scientific notation.
  if (Number(mantissa.toFixed(2)) >= 10) {
    exp += 1;
    mantissa = c / 10 ** exp;
  }
  return `${mantissa.toFixed(2)} × 10${toSuperscript(exp)}`;
}

function formatVolume(v: number) {
  return v.toExponential(2).replace('e-', ' × 10^-');
}

const SUPERSCRIPT: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };

function toSuperscript(n: number) {
  return String(n).split('').map((c) => SUPERSCRIPT[c] ?? c).join('');
}

// Miniature of a counting layout. Positions mirror the real screens: slot1 is left / top /
// top-left, slot2 is right / bottom / bottom-right.
function LayoutIcon({ layoutKey, slot1, slot2, theme }: { layoutKey: LayoutKey; slot1: string; slot2: string; theme: Theme }) {
  const fill = (c: string) => c + theme.zoneFill;
  const stroke = theme.zoneBorder ? 1.5 : 0;
  const r = Math.min(theme.zoneRadius / 3, 8);
  const zone = (x: number, y: number, w: number, h: number, c: string) => (
    <Rect x={x} y={y} width={w} height={h} rx={r} fill={fill(c)} stroke={c} strokeWidth={stroke} />
  );
  return (
    <Svg width={56} height={56} viewBox="0 0 64 64">
      {layoutKey === 'A' && (
        <>
          {zone(6, 8, 24, 48, slot1)}
          {zone(34, 8, 24, 48, slot2)}
        </>
      )}
      {layoutKey === 'B' && (
        <>
          {zone(6, 8, 52, 22, slot1)}
          {zone(6, 34, 52, 22, slot2)}
        </>
      )}
      {layoutKey === 'E' && (
        <>
          <Defs>
            <ClipPath id="diagClip">
              <Rect x={6} y={8} width={52} height={48} rx={r + 2} />
            </ClipPath>
          </Defs>
          <G clipPath="url(#diagClip)">
            <Polygon points="6,8 58,8 6,56" fill={fill(slot1)} />
            <Polygon points="58,8 58,56 6,56" fill={fill(slot2)} />
          </G>
          <Rect x={6} y={8} width={52} height={48} rx={r + 2} fill="none" stroke={slot1} strokeWidth={stroke} />
          <Line x1={58} y1={8} x2={6} y2={56} stroke={theme.zoneBorder ? slot1 : theme.textSecondary} strokeWidth={1.5} />
        </>
      )}
    </Svg>
  );
}

function SwitchRow({
  label,
  hint,
  value,
  onToggle,
  styles,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onToggle: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable
      style={styles.switchRow}
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
    >
      <View style={styles.switchText}>
        <Text style={styles.modalOptionText}>{label}</Text>
        {hint ? <Text style={styles.switchHint}>{hint}</Text> : null}
      </View>
      <View style={[styles.switchTrack, value && styles.switchTrackOn]}>
        <View style={[styles.switchThumb, value && styles.switchThumbOn]} />
      </View>
    </Pressable>
  );
}

// Theme picker card with a small preview of that theme's zones, shape and numeral font.
function ThemeCard({
  name,
  label,
  mode,
  active,
  onPress,
  styles,
}: {
  name: ThemeName;
  label: string;
  mode: ThemeMode;
  active: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  const p = PALETTES[name][mode];
  const s = SHAPES[name];
  const zone = (c: string, n: string) => (
    <View
      style={[
        styles.themeZone,
        {
          backgroundColor: c + s.zoneFill,
          borderWidth: s.zoneBorder ? 1 : 0,
          borderColor: c,
          borderRadius: Math.round(s.zoneRadius / 2.5),
        },
      ]}
    >
      <Text style={[styles.themeZoneText, { color: c, fontFamily: s.fonts.num7 }]}>{n}</Text>
    </View>
  );
  return (
    <Pressable
      style={[styles.themeCard, active && styles.tileActive]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      accessibilityLabel={label}
    >
      <View style={styles.themeCardTop}>
        <Text style={[styles.tileText, styles.themeCardName, active && styles.tileTextActive]}>{label}</Text>
        {active && <Text style={styles.modalCheck}>✓</Text>}
      </View>
      <View style={[styles.themePreview, { backgroundColor: p.background, borderColor: p.border }]}>
        {zone(p.live, '42')}
        {zone(p.dead, '7')}
      </View>
    </Pressable>
  );
}

function SpeakerIcon({ color, muted }: { color: string; muted: boolean }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M11 5 6 9H3v6h3l5 4z" fill={color} />
      {muted ? (
        <Path d="M16 9l5 6M21 9l-5 6" />
      ) : (
        <Path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
      )}
    </Svg>
  );
}

// Dependency-free slider (no native module, so no rebuild needed), built on the View
// responder props. Drags are measured from the value and pageX at touch-down, which
// avoids locationX quirks (locationX is only read once, on the hit view itself).
function VolumeSlider({
  value,
  onChange,
  styles,
}: {
  value: number;
  onChange: (v: number) => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  const width = useRef(1);
  const start = useRef({ value: 0, pageX: 0 });
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return (
    <View
      style={styles.sliderHit}
      onLayout={(e) => {
        width.current = Math.max(1, e.nativeEvent.layout.width);
      }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => {
        const { locationX, pageX } = e.nativeEvent;
        start.current = { value: clamp(locationX / width.current), pageX };
        onChange(start.current.value);
        // Block native responders (e.g. a parent scroll view), as PanResponder did.
        return true;
      }}
      onResponderMove={(e) =>
        onChange(clamp(start.current.value + (e.nativeEvent.pageX - start.current.pageX) / width.current))
      }
      accessibilityRole="adjustable"
      accessibilityLabel="Volume"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) =>
        onChange(clamp(value + (e.nativeEvent.actionName === 'increment' ? 0.1 : -0.1)))
      }
    >
      <View style={styles.sliderTrack} pointerEvents="none">
        <View style={[styles.sliderFill, { width: `${value * 100}%` }]} />
      </View>
      <View pointerEvents="none" style={[styles.sliderThumb, { left: `${value * 100}%` }]} />
    </View>
  );
}

function makeStyles(t: Theme, s: number) {
  const f = t.fonts;
  // Controls are outlined in Gridline and lifted with a soft shadow in Cleanroom.
  const raised = t.soft
    ? {
        borderWidth: 0,
        shadowColor: t.mode === 'dark' ? '#000000' : '#143264',
        shadowOpacity: t.mode === 'dark' ? 0.5 : 0.16,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 3,
      }
    : { borderWidth: 1, borderColor: t.border };
  const unitFont = t.soft
    ? { fontSize: 10, fontFamily: f.b, letterSpacing: 1.2 }
    : { fontSize: 9, fontFamily: f.num6, letterSpacing: 0.9 };
  const zoneLabelTopLeft = { position: 'absolute' as const, top: 14, left: 16 };
  return StyleSheet.create({
    page: { flex: 1, alignItems: 'center', overflow: 'hidden', backgroundColor: t.background },
    root: { flex: 1, width: '100%', maxWidth: MAX_CONTENT_WIDTH, backgroundColor: t.background },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 16,
      marginTop: 8,
    },
    ribbon: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: t.radius,
      backgroundColor: t.surface,
      ...raised,
    },
    ribbonText: { color: t.textPrimary, fontSize: 14, fontFamily: f.b },
    ribbonChevron: { color: t.textSecondary, fontSize: 12 },
    gearButton: {
      width: 40,
      height: 40,
      borderRadius: t.radius,
      backgroundColor: t.surface,
      alignItems: 'center',
      justifyContent: 'center',
      ...raised,
    },
    gearIcon: { color: t.textSecondary, fontSize: 18 },
    modalBackdrop: { flex: 1, backgroundColor: '#00000099', justifyContent: 'center', paddingHorizontal: 32 },
    modalSheet: { backgroundColor: t.surface, borderRadius: t.radius + 4, overflow: 'hidden', borderWidth: 1, borderColor: t.border },
    modalOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 16,
      paddingHorizontal: 18,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.border,
    },
    modalOptionActive: { backgroundColor: t.border },
    modalOptionText: { color: t.textPrimary, fontSize: 16, fontFamily: f.m },
    modalOptionTextActive: { fontFamily: f.b },
    modalCheck: { color: t.textPrimary, fontSize: 16, fontFamily: f.b },
    modalSectionLabel: {
      color: t.textSecondary,
      fontSize: 12,
      fontFamily: f.b,
      textTransform: 'uppercase',
      letterSpacing: 1,
      paddingHorizontal: 18,
      paddingTop: 14,
      paddingBottom: 4,
    },
    soundRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.border,
    },
    sliderHit: { flex: 1, height: 40, justifyContent: 'center', marginHorizontal: 11 },
    sliderTrack: { height: 6, borderRadius: 3, backgroundColor: t.border, overflow: 'hidden' },
    sliderFill: { height: 6, backgroundColor: t.live },
    sliderThumb: {
      position: 'absolute',
      top: 9,
      marginLeft: -11,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: t.live,
      borderWidth: 2,
      borderColor: t.surface,
    },
    tileRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingBottom: 12 },
    tile: {
      flex: 1,
      alignItems: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: t.radius,
      backgroundColor: t.surface,
      ...raised,
    },
    tileActive: { backgroundColor: t.border, borderWidth: 2, borderColor: t.live },
    tileText: { color: t.textSecondary, fontSize: 12, fontFamily: f.b },
    tileTextActive: { color: t.textPrimary },
    themeCard: {
      flex: 1,
      gap: 8,
      padding: 10,
      borderRadius: t.radius,
      backgroundColor: t.surface,
      ...raised,
    },
    themeCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    themeCardName: { fontSize: 14, color: t.textPrimary },
    themePreview: { flexDirection: 'row', gap: 6, padding: 6, borderRadius: 8, borderWidth: 1 },
    themeZone: { flex: 1, height: 38, alignItems: 'flex-end', justifyContent: 'flex-end', padding: 4 },
    themeZoneText: { fontSize: 12 },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 18,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.border,
    },
    switchText: { flex: 1 },
    switchHint: { color: t.textSecondary, fontSize: 13, fontFamily: f.m, marginTop: 2 },
    switchTrack: { width: 46, height: 28, borderRadius: 14, backgroundColor: t.border, justifyContent: 'center' },
    switchTrackOn: { backgroundColor: t.live },
    switchThumb: { width: 22, height: 22, borderRadius: 11, marginLeft: 3, backgroundColor: t.surface },
    switchThumbOn: { marginLeft: 21 },
    modalFooter: {
      flexDirection: 'row',
      padding: 18,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.border,
    },
    results: {
      marginHorizontal: 16,
      marginTop: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 8,
      borderRadius: t.radius + (t.soft ? 6 : 2),
      backgroundColor: t.surface,
      ...raised,
    },
    concMain: { alignItems: 'center' },
    concLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pip: { width: 9, height: 9, borderRadius: t.pipRadius, backgroundColor: t.live },
    concRow: { flexDirection: 'row', gap: 12 },
    concCol: { flex: 1, alignItems: 'center' },
    conc: { color: t.textPrimary, fontSize: Math.round(30 * s), fontFamily: f.num7, fontVariant: ['tabular-nums'] },
    concSmall: { fontSize: Math.round(18 * s), fontFamily: f.num7, fontVariant: ['tabular-nums'] },
    concUnit: { color: t.textSecondary, textTransform: 'uppercase', ...unitFont },
    via: { gap: 5 },
    viaTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    viaValue: { color: t.textPrimary, fontSize: 15, fontFamily: f.b, fontVariant: ['tabular-nums'] },
    viaBar: {
      height: 7,
      flexDirection: 'row',
      gap: 2,
      overflow: 'hidden',
      borderRadius: t.soft ? 4 : 2,
      backgroundColor: t.border,
    },
    dilRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10 },
    dilLabel: { color: t.textSecondary, fontSize: 14, fontFamily: f.m, flexShrink: 0 },
    dilControl: { flexDirection: 'row', alignItems: 'stretch', borderRadius: t.radius, backgroundColor: t.surface, ...raised },
    dilInput: {
      color: t.textPrimary,
      backgroundColor: t.surface,
      // Fixed width: on web an <input> otherwise keeps its ~240px default and overflows the row.
      width: 72,
      paddingHorizontal: 8,
      paddingVertical: 6,
      fontSize: 17,
      fontFamily: f.num6,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderLeftColor: t.border,
      borderRightColor: t.border,
    },
    dilStepBtn: {
      backgroundColor: t.surface,
      paddingHorizontal: 16,
      paddingVertical: 6,
      justifyContent: 'center',
      alignItems: 'center',
      borderTopLeftRadius: t.radius,
      borderBottomLeftRadius: t.radius,
    },
    dilStepBtnEnd: {
      borderTopLeftRadius: 0,
      borderBottomLeftRadius: 0,
      borderTopRightRadius: t.radius,
      borderBottomRightRadius: t.radius,
    },
    dilStepText: { color: t.textSecondary, fontSize: 20, fontFamily: f.b },
    chipsScroll: { flexGrow: 0, marginTop: 10 },
    chips: { paddingHorizontal: 16, gap: 6, alignItems: 'center', paddingBottom: t.soft ? 6 : 0 },
    chip: {
      minWidth: 46,
      alignItems: 'center',
      paddingVertical: 4,
      paddingHorizontal: t.soft ? 12 : 8,
      borderRadius: t.soft ? 99 : t.radius - 3,
      backgroundColor: t.surface,
      ...raised,
    },
    chipActive: { backgroundColor: t.textPrimary, borderColor: t.textPrimary },
    chipLabel: { color: t.textSecondary, fontSize: 9, fontFamily: f.b, letterSpacing: 1 },
    chipValue: { color: t.textPrimary, fontSize: 14, fontFamily: f.num6, fontVariant: ['tabular-nums'] },
    chipTextActive: { color: t.surface },
    chipAdd: { justifyContent: 'center', minHeight: 40 },
    chipAddText: { color: t.textSecondary, fontSize: 18, fontFamily: f.b },
    split: { flex: 1, flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 10 },
    zone: {
      flex: 1,
      // Clipping would hide the soft shadow on iOS, so only clip outlined zones.
      overflow: t.soft ? 'visible' : 'hidden',
      borderWidth: t.zoneBorder,
      borderRadius: t.zoneRadius,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      ...(t.soft ? { shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 } : null),
    },
    zonePip: { ...zoneLabelTopLeft, top: 16, width: 8, height: 8, borderRadius: t.pipRadius },
    zoneLabel: {
      ...zoneLabelTopLeft,
      left: 30,
      fontSize: 11,
      fontFamily: f.b,
      textTransform: 'uppercase',
      letterSpacing: 2,
    },
    count: { fontSize: Math.round(76 * s), fontFamily: f.num7, fontVariant: ['tabular-nums'] },
    stack: { flex: 1, flexDirection: 'column', gap: 10, paddingHorizontal: 16, paddingTop: 10 },
    stackZone: {
      flex: 1,
      overflow: t.soft ? 'visible' : 'hidden',
      flexDirection: 'row',
      borderWidth: t.zoneBorder,
      borderRadius: t.zoneRadius,
      alignItems: 'center',
      justifyContent: 'center',
      ...(t.soft ? { shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 } : null),
    },
    stackCount: { fontSize: Math.round(52 * s) },
    diagonalZone: {
      flex: 1,
      marginHorizontal: 16,
      marginTop: 10,
      borderRadius: t.zoneRadius,
      overflow: 'hidden',
      backgroundColor: t.surface,
      borderWidth: t.soft ? 0 : 1,
      borderColor: t.border,
    },
    diagonalLabelTop: {
      position: 'absolute',
      top: 20,
      left: 20,
    },
    diagonalLabelBottom: {
      position: 'absolute',
      bottom: 20,
      right: 20,
      alignItems: 'flex-end',
    },
    diagonalZoneLabel: { position: 'relative', top: 0, left: 0, fontSize: 14, letterSpacing: 3 },
    diagonalCount: { fontSize: Math.round(52 * s) },
    bar: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
    button: { flex: 1, paddingHorizontal: 4, paddingVertical: 16, justifyContent: 'center', borderRadius: t.radius, backgroundColor: t.surface, alignItems: 'center', ...raised },
    buttonDanger: { backgroundColor: t.dangerBg, borderWidth: t.soft ? 0 : 1, borderColor: t.dangerBorder, shadowOpacity: 0, elevation: 0 },
    buttonInfo: { flex: 0, paddingHorizontal: 18 },
    infoBody: { padding: 18, gap: 6 },
    infoTitle: { color: t.textPrimary, fontSize: 20, fontFamily: f.b },
    infoHead: { color: t.textPrimary, fontSize: 15, fontFamily: f.b, marginTop: 12 },
    infoText: { color: t.textSecondary, fontSize: 13, fontFamily: f.m },
    infoFormula: { color: t.textPrimary, fontSize: 13, fontFamily: f.num6 },
    buttonText: { color: t.textPrimary, fontSize: 15, fontFamily: f.b },
    buttonDangerText: { color: t.dangerText, fontSize: 15, fontFamily: f.b },
    dim: { opacity: 0.35 },
  });
}
