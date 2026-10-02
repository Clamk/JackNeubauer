import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, AppState, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, useColorScheme, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { useKeepAwake } from 'expo-keep-awake';
import * as Clipboard from 'expo-clipboard';
import Svg, { ClipPath, Defs, G, Line, LinearGradient, Path, Polygon, Rect, Stop } from 'react-native-svg';
import { useFonts } from 'expo-font';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RUNTIME_FONTS } from './fonts';
import { CHAMBERS, chamberGeometry, computeStats, formatFixed, formatSci, stepDilution, type ChamberKey, type Frac } from './calc';

type CounterKey = 'live' | 'dead';
// events is the ordered tap log, in order, so undo() is just "drop the last one".
// touched marks that the user has started counting this square, so a square
// counted down to a genuine zero is still included in the mean (as opposed to
// a square the user never visited).
// live / dead are running totals of events, kept in sync so taps and stats don't rescan the log.
type Square = { events: CounterKey[]; touched: boolean } & Record<CounterKey, number>;

const emptySquare = (): Square => ({ events: [], touched: false, live: 0, dead: 0 });

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

// The arrow keys count on web (slot1: left / up, slot2: right / down). The zones hint at it only
// where a keyboard is likely: a device whose main pointer is a mouse or trackpad.
const KEY_HINTS: readonly [string, string] | null =
  Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches
    ? ['← ↑', '→ ↓']
    : null;

// react-native-web's Pressable also reports hover; RN's types only know pressed.
type PressState = { pressed: boolean; hovered?: boolean };

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

// A marker colour: a pale tint for surfaces, an ink for dots and large numerals, a
// text-safe ink for small text, and a stronger tint for a zone while it is pressed.
type Marker = { tint: string; ink: string; text: string; pressed: string };

// The clamk-tools identity, shared with the hub and the other tools: cool neutrals, one
// blue accent for everything interactive, and marker colours that only carry meaning.
type Theme = {
  mode: ThemeMode;
  bg: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  rail: string;
  accent: string;
  onAccent: string;
  accentTint: string;
  backdrop: string;
  shadow: string; // floating layers only (menus, dialogs)
  live: Marker;
  dead: Marker;
};

// Blends two #rrggbb colours: t = 0 gives a, t = 1 gives b.
const mix = (a: string, b: string, t: number) =>
  '#' +
  [1, 3, 5]
    .map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t))
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');

const marker = (tint: string, ink: string, text: string): Marker => ({ tint, ink, text, pressed: mix(tint, ink, 0.2) });

// Live is the green marker and dead the coral one, so blue stays reserved for interaction.
const THEMES: Record<ThemeMode, Theme> = {
  light: {
    mode: 'light',
    bg: '#fbfcfc', surface: '#ffffff', text: '#1b2226', muted: '#6b747a',
    border: '#e1e5e8', rail: '#c7cdd2',
    accent: '#1f5fe0', onAccent: '#ffffff', accentTint: '#eaf1fe',
    backdrop: 'rgba(15, 23, 26, 0.4)', shadow: '0 8px 24px rgba(15, 23, 26, 0.12)',
    live: marker('#e9f7ef', '#1f9d5e', '#197e4b'),
    dead: marker('#fdeee7', '#d9521f', '#bb461b'),
  },
  dark: {
    mode: 'dark',
    bg: '#15181a', surface: '#1d2124', text: '#eef1f2', muted: '#9aa3a8',
    border: '#2b3134', rail: '#3a4044',
    accent: '#6fa0ff', onAccent: '#15181a', accentTint: '#16233d',
    backdrop: 'rgba(0, 0, 0, 0.6)', shadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
    live: marker('#113625', '#5cd99a', '#5cd99a'),
    dead: marker('#3a2015', '#ff9a66', '#ff9a66'),
  },
};

// Figtree carries content and UI; IBM Plex Mono carries labels, metadata and formulas.
const FONTS = {
  m: 'Figtree_500Medium',
  sb: 'Figtree_600SemiBold',
  b: 'Figtree_700Bold',
  mono: 'IBMPlexMono_600SemiBold',
};

const RADIUS = { control: 7, card: 9, pill: 999 };
const GUTTER = 20;

const SETTINGS_KEY = 'cellcounter.settings.v1';

// Web: the light/dark choice lives under the key the hub and the other clamk-tools use
// (same origin), so picking a theme in one applies to all of them.
const SHARED_THEME_KEY = 'clamk-tools:theme';
const readSharedTheme = (): ThemeMode | null => {
  if (Platform.OS !== 'web') return null;
  try {
    const v = localStorage.getItem(SHARED_THEME_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
};

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
  // null follows the system setting until the user picks a theme with the header switch.
  const [themeChoice, setThemeChoice] = useState<ThemeMode | null>(readSharedTheme);
  const systemMode = useColorScheme();
  const themeMode: ThemeMode = themeChoice ?? (systemMode === 'dark' ? 'dark' : 'light');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
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
        // On web the shared key (read above) decides, not this app's own settings.
        if (Platform.OS !== 'web' && (s.themeMode === 'dark' || s.themeMode === 'light')) setThemeChoice(s.themeMode);
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
    const json = JSON.stringify({ dilution, chamber, layout, inverted, themeMode: themeChoice, volume, muted, haptics });
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
  }, [settingsLoaded, dilution, chamber, layout, inverted, themeChoice, volume, muted, haptics]);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [zoneSize, setZoneSize] = useState({ width: 0, height: 0 });
  const chamberDef = CHAMBERS.find((c) => c.key === chamber)!;
  const chamberLabel = chamberDef.label;

  const theme = THEMES[themeMode];
  // Big numerals scale with the usable screen: the layout is capped at MAX_CONTENT_WIDTH wide,
  // and a short screen shrinks them (and tightens the gaps) so the counting zones keep room.
  const { width: winW, height: winH } = useWindowDimensions();
  const scale = Math.min(1.3, Math.max(0.8, Math.min(Math.min(winW, MAX_CONTENT_WIDTH) / 390, winH / 800)));
  const tight = winH < 700;
  const styles = useMemo(() => makeStyles(theme, scale, tight), [theme, scale, tight]);
  useEffect(setupWebViewport, []);
  useEffect(() => applyWebTheme(theme, themeChoice), [theme, themeChoice]);

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
  const modalOpen = settingsOpen || dataOpen || infoOpen || soundOpen || chamberPickerOpen;
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

  const adjustDilution = (delta: 1 | -1) => {
    hapticLight();
    setDilution((d) => stepDilution(d, delta));
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
    const next = themeMode === 'dark' ? 'light' : 'dark';
    setThemeChoice(next);
    if (Platform.OS !== 'web') return;
    try {
      localStorage.setItem(SHARED_THEME_KEY, next);
    } catch {}
  };

  // Concentration (cells/mL) = mean count per counted square x dilution x chamber factor, per counter.
  // The results are exact fractions (or null for "no result"), rounded only when shown.
  const stats = useMemo(() => computeStats(squares, dilution, chamberDef), [squares, dilution, chamberDef]);
  const geometry = chamberGeometry(chamberDef);

  const anyCounts = stats.n > 0;
  const squareHasCounts = square.events.length > 0;

  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  }

  const viaTotal = stats.live + stats.dead;
  const viabilityText = stats.viability ? `${formatFixed(stats.viability, 1)} %` : '–';

  const toggleMute = () => {
    if (silent && volume === 0) setVolume(0.5);
    setMuted(!silent);
  };

  const summaryText = () => {
    const conc = (c: Frac | null) => (c ? `${formatSci(c)} cells/mL` : '–');
    return [
      `Cell count – ${chamberLabel}`,
      `Counted square: ${chamberDef.unit}, ${geometry.width} × ${geometry.height} mm, depth ${geometry.depth} mm (${geometry.microlitres} µL)`,
      `Squares counted: ${stats.n}`,
      `Live: ${stats.live} (mean ${formatFixed(stats.meanLive, 2)})`,
      `Dead: ${stats.dead} (mean ${formatFixed(stats.meanDead, 2)})`,
      `Dilution factor: ${dilution || '–'}`,
      `Live concentration: ${conc(stats.concLive)}`,
      `Dead concentration: ${conc(stats.concDead)}`,
      `Total concentration: ${conc(stats.concTotal)}`,
      `Viability: ${viabilityText}`,
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
    // Restart the timer so "Copied" stays 1.5 s after the latest copy.
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
    <SafeAreaView style={styles.safe}>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <Rail theme={theme} styles={styles} />

      <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <View style={styles.brandDot} />
          <Text style={styles.brandName} accessibilityRole="header">Cell Counter</Text>
        </View>
        <View style={styles.headerActions}>
          <IconButton label="Info" onPress={() => setInfoOpen(true)} styles={styles}>
            <Icon d={ICONS.info} color={theme.muted} size={20} />
          </IconButton>
          <IconButton label="Sound" onPress={() => setSoundOpen(true)} styles={styles}>
            <SpeakerIcon color={theme.muted} muted={silent} />
          </IconButton>
          <IconButton label="Settings" onPress={() => setSettingsOpen(true)} styles={styles}>
            <Icon d={ICONS.options} color={theme.muted} size={20} />
          </IconButton>
          <ThemeSwitch dark={theme.mode === 'dark'} onToggle={toggleMode} theme={theme} styles={styles} />
        </View>
      </View>

      <View style={styles.setup}>
        <View style={styles.setupChamber}>
          <SectionLabel styles={styles}>Chamber</SectionLabel>
          <Pressable
            style={({ hovered }: PressState) => [styles.select, hovered && styles.controlHover]}
            onPress={() => setChamberPickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`Chamber: ${chamberLabel}`}
          >
            <Text style={styles.selectText} numberOfLines={1}>{chamberLabel}</Text>
            <Icon d={ICONS.chevron} color={theme.muted} />
          </Pressable>
        </View>
        <View style={styles.setupField}>
          <SectionLabel styles={styles}>Dilution</SectionLabel>
          <View style={styles.dilControl}>
            <Pressable
              style={({ pressed, hovered }: PressState) => [styles.dilStepBtn, (pressed || hovered) && styles.quietHover]}
              onPress={() => adjustDilution(-1)}
              accessibilityRole="button"
              accessibilityLabel="Decrease dilution factor"
            >
              <Icon d={ICONS.minus} color={theme.muted} />
            </Pressable>
            <TextInput
              style={styles.dilInput}
              value={dilution}
              onChangeText={setDilution}
              keyboardType="decimal-pad"
              selectTextOnFocus
              accessibilityLabel="Dilution factor"
            />
            <Pressable
              style={({ pressed, hovered }: PressState) => [
                styles.dilStepBtn,
                styles.dilStepBtnEnd,
                (pressed || hovered) && styles.quietHover,
              ]}
              onPress={() => adjustDilution(1)}
              accessibilityRole="button"
              accessibilityLabel="Increase dilution factor"
            >
              <Icon d={ICONS.plus} color={theme.muted} />
            </Pressable>
          </View>
        </View>
      </View>

      <Modal
        visible={chamberPickerOpen}
        transparent
        animationType="none"
        onRequestClose={() => setChamberPickerOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} focusable={false} onPress={() => setChamberPickerOpen(false)}>
          <Pressable style={[styles.modalSheet, styles.menu]} focusable={false} onPress={() => {}}>
            {CHAMBERS.map((c) => (
              <MenuItem
                key={c.key}
                label={c.label}
                active={chamber === c.key}
                onPress={() => {
                  setChamber(c.key);
                  setChamberPickerOpen(false);
                }}
                theme={theme}
                styles={styles}
              />
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={soundOpen} transparent animationType="none" onRequestClose={() => setSoundOpen(false)}>
        <Pressable style={styles.modalBackdrop} focusable={false} onPress={() => setSoundOpen(false)}>
          <Pressable style={styles.modalSheet} focusable={false} onPress={() => {}}>
            <View style={styles.dialogBody}>
              <SectionLabel styles={styles}>Sound</SectionLabel>
              <View style={styles.soundRow}>
                <IconButton label={silent ? 'Unmute' : 'Mute'} onPress={toggleMute} styles={styles}>
                  <SpeakerIcon color={theme.text} muted={silent} />
                </IconButton>
                <VolumeSlider
                  value={silent ? 0 : volume}
                  onChange={(v) => {
                    setVolume(v);
                    setMuted(false);
                  }}
                  styles={styles}
                />
              </View>
            </View>
            <View style={styles.dialogFooter}>
              <Btn label="Close" onPress={() => setSoundOpen(false)} style={styles.buttonDialog} styles={styles} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={settingsOpen}
        transparent
        animationType="none"
        onRequestClose={() => setSettingsOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} focusable={false} onPress={() => setSettingsOpen(false)}>
          <Pressable style={[styles.modalSheet, { maxHeight: '90%' }]} focusable={false} onPress={() => {}}>
            <ScrollView contentContainerStyle={styles.dialogBody}>
              <Text style={styles.dialogTitle} accessibilityRole="header">Settings</Text>

              <SectionLabel styles={styles}>Layout</SectionLabel>
              <View style={styles.tileRow}>
                {LAYOUTS.map((l) => (
                  <Pressable
                    key={l.key}
                    style={({ hovered }: PressState) => [
                      styles.tile,
                      layout === l.key ? styles.tileActive : hovered && styles.controlHover,
                    ]}
                    onPress={() => {
                      hapticLight();
                      setLayout(l.key);
                    }}
                    accessibilityRole="radio"
                    aria-checked={layout === l.key}
                    accessibilityLabel={`${l.label} split`}
                  >
                    <LayoutIcon layoutKey={l.key} slot1={theme[slot1]} slot2={theme[slot2]} theme={theme} />
                    <Text style={[styles.tileText, layout === l.key && styles.tileTextActive]}>{l.label}</Text>
                  </Pressable>
                ))}
              </View>

              <SectionLabel styles={styles}>Options</SectionLabel>
              <View>
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
                <SwitchRow
                  label="Haptic feedback"
                  value={haptics}
                  onToggle={() => {
                    hapticsEnabled = !haptics;
                    hapticLight();
                    setHaptics(!haptics);
                  }}
                  divider
                  styles={styles}
                />
                <SwitchRow
                  label="Mute sound"
                  value={silent}
                  onToggle={() => {
                    hapticLight();
                    toggleMute();
                  }}
                  divider
                  styles={styles}
                />
              </View>
            </ScrollView>
            <View style={styles.dialogFooter}>
              <Btn
                label="Done"
                variant="primary"
                onPress={() => setSettingsOpen(false)}
                style={styles.buttonDialog}
                styles={styles}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* The short form of docs/CALCULATIONS.md. The chamber lines come from CHAMBERS. */}
      <Modal visible={infoOpen} transparent animationType="none" onRequestClose={() => setInfoOpen(false)}>
        <Pressable style={styles.modalBackdrop} focusable={false} onPress={() => setInfoOpen(false)}>
          <Pressable style={[styles.modalSheet, { maxHeight: '85%' }]} focusable={false} onPress={() => {}}>
            <ScrollView contentContainerStyle={styles.dataBody}>
              <Text style={styles.dialogTitle} accessibilityRole="header">Info</Text>

              <SectionLabel style={styles.dataStep} styles={styles}>One square</SectionLabel>
              {CHAMBERS.map((c) => {
                const g = chamberGeometry(c);
                return (
                  <View key={c.key}>
                    <Text style={styles.dataText}>{c.label}: one {c.unit}</Text>
                    <Text style={styles.dataFormula}>
                      {g.width} × {g.height} × {g.depth} mm = {g.microlitres} µL
                    </Text>
                  </View>
                );
              })}

              <SectionLabel style={styles.dataStep} styles={styles}>Formulas</SectionLabel>
              <Text style={styles.dataFormula}>mean = cells / squares counted</Text>
              <Text style={styles.dataFormula}>factor = 1 / square volume in mL</Text>
              <Text style={styles.dataFormula}>cells/mL = mean × dilution × factor</Text>
              <Text style={styles.dataFormula}>viability = live / (live + dead) × 100</Text>

              <SectionLabel style={styles.dataStep} styles={styles}>Counting</SectionLabel>
              <Text style={styles.dataText}>Cell on a line: count top and left, skip bottom and right.</Text>
              <Text style={styles.dataText}>Dilution = final volume / sample volume.</Text>

              <SectionLabel style={styles.dataStep} styles={styles}>Precision</SectionLabel>
              <Text style={styles.dataText}>Exact arithmetic, rounded once, halves up.</Text>
              <Text style={styles.dataText}>Counting error ≈ 1 / √cells: 10 % for 100 cells.</Text>
            </ScrollView>
            <View style={styles.dialogFooter}>
              <Btn
                label="Close"
                variant="primary"
                onPress={() => setInfoOpen(false)}
                style={styles.buttonDialog}
                styles={styles}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <View style={styles.group}>
        <SectionLabel styles={styles}>Results</SectionLabel>
        <View style={styles.results}>
          <View style={styles.resultsTop}>
            <View style={styles.stat}>
              <View style={styles.statLabelRow}>
                <View style={[styles.dot, { backgroundColor: theme.live.ink }]} />
                <Text style={styles.statLabel}>Live cells/mL</Text>
              </View>
              <Text style={[styles.conc, { color: theme.live.ink }]}>{formatSci(stats.concLive)}</Text>
            </View>
            <View style={styles.statEnd}>
              <Text style={styles.statLabel}>Viability</Text>
              <Text style={[styles.conc, { color: theme.text }]}>{viabilityText}</Text>
            </View>
          </View>
          <View style={styles.viaBar}>
            {stats.live > 0 && <View style={{ flex: stats.live, backgroundColor: theme.live.ink }} />}
            {stats.dead > 0 && <View style={{ flex: stats.dead, backgroundColor: theme.dead.ink }} />}
          </View>
          <View style={styles.concRow}>
            <View style={styles.concCol}>
              <View style={styles.statLabelRow}>
                <View style={[styles.dot, { backgroundColor: theme.dead.ink }]} />
                <Text style={styles.statLabel}>Dead cells/mL</Text>
              </View>
              <Text style={[styles.concSmall, { color: theme.dead.text }]}>{formatSci(stats.concDead)}</Text>
            </View>
            <View style={styles.concCol}>
              <Text style={styles.statLabel}>Total cells/mL</Text>
              <Text style={[styles.concSmall, { color: theme.text }]}>{formatSci(stats.concTotal)}</Text>
            </View>
          </View>
        </View>
      </View>

      <SectionLabel style={styles.countLabel} styles={styles}>Square {idx + 1}</SectionLabel>

      {layout === 'A' && (
        <View style={styles.split}>
          {[slot1, slot2].map((k, i) => (
            <CountZone
              key={k}
              k={k}
              keyHint={KEY_HINTS?.[i]}
              count={square[k]}
              marker={theme[k]}
              style={styles.zone}
              onAdd={add}
              styles={styles}
            />
          ))}
        </View>
      )}

      {layout === 'B' && (
        <View style={styles.stack}>
          {[slot1, slot2].map((k, i) => (
            <CountZone
              key={k}
              k={k}
              keyHint={KEY_HINTS?.[i]}
              count={square[k]}
              marker={theme[k]}
              style={styles.zone}
              countStyle={styles.stackCount}
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
                fill={theme[slot1].tint}
              />
              <Polygon
                points={`${zoneSize.width},0 ${zoneSize.width},${zoneSize.height} 0,${zoneSize.height}`}
                fill={theme[slot2].tint}
              />
              <Line x1={zoneSize.width} y1={0} x2={0} y2={zoneSize.height} stroke={theme.border} strokeWidth={1} />
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
                keyHint={KEY_HINTS?.[0]}
                hintStyle={styles.diagonalZoneHint}
                count={square[slot1]}
                marker={theme[slot1]}
                labelStyle={styles.diagonalZoneLabel}
                countStyle={styles.diagonalCount}
                styles={styles}
              />
            </View>
            <View style={styles.diagonalLabelBottom} pointerEvents="none">
              <ZoneReadout
                k={slot2}
                keyHint={KEY_HINTS?.[1]}
                hintStyle={styles.diagonalZoneHint}
                count={square[slot2]}
                marker={theme[slot2]}
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
        <Pressable
          style={({ hovered }: PressState) => [styles.chip, hovered && styles.controlHover]}
          onPress={addSquare}
          accessibilityRole="button"
          accessibilityLabel="Add square"
        >
          <Icon d={ICONS.plus} color={theme.muted} />
        </Pressable>
      </ScrollView>

      <View style={styles.bar}>
        <Btn label="Undo" onPress={undo} disabled={!squareHasCounts} styles={styles} />
        <Btn label="Reset" onPress={resetSquare} disabled={!square.touched} styles={styles} />
        <Btn label="Reset all" variant="danger" onPress={resetAll} disabled={!anyCounts} styles={styles} />
        <Btn
          label="Data"
          onPress={() => setDataOpen(true)}
          accessibilityLabel="Show calculation details"
          style={styles.buttonData}
          styles={styles}
        />
      </View>

      <Modal visible={dataOpen} transparent animationType="none" onRequestClose={() => setDataOpen(false)}>
        <Pressable style={styles.modalBackdrop} focusable={false} onPress={() => setDataOpen(false)}>
          <Pressable style={[styles.modalSheet, { maxHeight: '85%' }]} focusable={false} onPress={() => {}}>
            <ScrollView contentContainerStyle={styles.dataBody}>
              <Text style={styles.dialogTitle} accessibilityRole="header">{chamberLabel}</Text>

              <SectionLabel style={styles.dataStep} styles={styles}>Inputs</SectionLabel>
              <DataRow label="Square volume" value={`${geometry.microlitres} µL`} styles={styles} />
              <DataRow label="Factor" value={`${formatSci(geometry.factor)} / mL`} styles={styles} />
              <DataRow
                label="Dilution"
                value={stats.dilutionValid || !dilution ? dilution || '–' : `${dilution} (invalid)`}
                styles={styles}
              />
              <DataRow label="Squares counted" value={String(stats.n)} styles={styles} />

              <SectionLabel style={styles.dataStep} styles={styles}>Mean per square</SectionLabel>
              <DataRow label={`Live · ${stats.live} / ${stats.n}`} value={formatFixed(stats.meanLive, 2)} styles={styles} />
              <DataRow label={`Dead · ${stats.dead} / ${stats.n}`} value={formatFixed(stats.meanDead, 2)} styles={styles} />

              <SectionLabel style={styles.dataStep} styles={styles}>Results</SectionLabel>
              <DataRow label="Live cells/mL" value={formatSci(stats.concLive)} styles={styles} />
              <DataRow label="Dead cells/mL" value={formatSci(stats.concDead)} styles={styles} />
              <DataRow label="Total cells/mL" value={formatSci(stats.concTotal)} styles={styles} />
              <DataRow label={`Viability · ${stats.live} / ${viaTotal}`} value={viabilityText} styles={styles} />
            </ScrollView>
            <View style={styles.dialogFooter}>
              <Btn label={copied ? 'Copied' : 'Copy'} onPress={copySummary} style={styles.buttonDialog} styles={styles} />
              <Btn label="Send to…" onPress={sendSummary} style={styles.buttonDialog} styles={styles} />
              <Btn
                label="Close"
                variant="primary"
                onPress={() => setDataOpen(false)}
                style={styles.buttonDialog}
                styles={styles}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      </View>
    </SafeAreaView>
    </View>
    </SafeAreaProvider>
  );
}

// Widest the layout gets; on a desktop window it is centred instead of stretched.
const MAX_CONTENT_WIDTH = 560;

// Web only: size the page to the visible viewport (dvh excludes the mobile browser's URL bar, so
// the bottom buttons aren't cut off), stop double-tap zoom and text selection from interfering
// with rapid counting taps, and let the safe-area insets apply. Also the identity's focus ring
// and 120 ms border transition, both dropped for prefers-reduced-motion.
function setupWebViewport() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const meta = document.querySelector('meta[name="viewport"]');
  meta?.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');
  const style = document.createElement('style');
  style.textContent =
    'html,body,#root{height:100%;height:100dvh;overflow:hidden;overscroll-behavior:none}' +
    'body{touch-action:manipulation;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}' +
    'input{-webkit-user-select:text;user-select:text}' +
    ':focus-visible{outline:2px solid var(--accent);outline-offset:2px}' +
    '[tabindex="0"],button,input{transition:border-color 120ms ease}' +
    '@media (prefers-reduced-motion:reduce){*{transition:none!important}}';
  document.head.appendChild(style);
  return () => {
    document.head.removeChild(style);
  };
}

// Web only: mirror the theme onto <html>, as the hub does, so the focus ring, the page behind
// the app and the browser's own controls follow it. public/index.html sets the same
// attribute and background before first paint, so there is no flash while the bundle loads.
function applyWebTheme(t: Theme, choice: ThemeMode | null) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const root = document.documentElement;
  if (choice) root.setAttribute('data-theme', choice);
  else root.removeAttribute('data-theme');
  root.style.setProperty('--accent', t.accent);
  root.style.colorScheme = t.mode;
  document.body.style.backgroundColor = t.bg;
}

type Styles = ReturnType<typeof makeStyles>;

// The identity's aluminium rail across the top: the only gradient in the app. Memoised: it
// only depends on the theme, so taps don't re-render the SVG.
const Rail = memo(function Rail({ theme, styles }: { theme: Theme; styles: Styles }) {
  return (
    <View style={styles.rail}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="rail" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.rail} />
            <Stop offset="1" stopColor={theme.border} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#rail)" />
      </Svg>
    </View>
  );
});

// Line icons on a 24-unit grid: 2px stroke, round caps and joins, no fill.
const ICONS = {
  chevron: 'M6 9l6 6 6-6',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'M20 6 9 17l-5-5',
  options: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5v.01',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41',
  moon: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
  speaker: 'M11 5 6 9H3v6h3l5 4z',
  speakerOn: 'M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13',
  speakerOff: 'M16 9l5 6M21 9l-5 6',
};

function Icon({ d, color, size = 16 }: { d: string; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d={d} />
    </Svg>
  );
}

function SpeakerIcon({ color, muted }: { color: string; muted: boolean }) {
  return <Icon d={ICONS.speaker + (muted ? ICONS.speakerOff : ICONS.speakerOn)} color={color} size={20} />;
}

// Group heading: a mono uppercase label with a hairline running to the right edge.
function SectionLabel({ children, style, styles }: { children: ReactNode; style?: object; styles: Styles }) {
  return (
    <View style={[styles.sectionLabel, style]}>
      <Text style={styles.sectionLabelText}>{children}</Text>
      <View style={styles.sectionRule} />
    </View>
  );
}

// One line of the Data modal: what the number is on the left, the number on the right.
function DataRow({ label, value, styles }: { label: string; value: string; styles: Styles }) {
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataText}>{label}</Text>
      <Text style={styles.dataFormula}>{value}</Text>
    </View>
  );
}

// Quiet square button holding one icon. hitSlop brings the 32px square up to a touch target.
function IconButton({
  label,
  onPress,
  styles,
  children,
}: {
  label: string;
  onPress: () => void;
  styles: Styles;
  children: ReactNode;
}) {
  return (
    <Pressable
      style={({ pressed, hovered }: PressState) => [styles.iconButton, (pressed || hovered) && styles.quietHover]}
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {children}
    </Pressable>
  );
}

function Btn({
  label,
  onPress,
  styles,
  variant = 'secondary',
  disabled = false,
  style,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  styles: Styles;
  variant?: 'secondary' | 'primary' | 'danger';
  disabled?: boolean;
  style?: object;
  accessibilityLabel?: string;
}) {
  const hover =
    variant === 'primary' ? styles.buttonPrimaryHover : variant === 'danger' ? styles.buttonDangerHover : styles.controlHover;
  return (
    <Pressable
      style={({ pressed, hovered }: PressState) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        style,
        !disabled && hovered && hover,
        !disabled && pressed && (variant === 'primary' ? styles.buttonPrimaryHover : styles.quietHover),
        disabled && styles.dim,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Text
        style={[
          styles.buttonText,
          variant === 'primary' && styles.buttonPrimaryText,
          variant === 'danger' && styles.buttonDangerText,
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {label}
      </Text>
    </Pressable>
  );
}

function MenuItem({
  label,
  active,
  onPress,
  theme,
  styles,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  theme: Theme;
  styles: Styles;
}) {
  return (
    <Pressable
      style={({ pressed, hovered }: PressState) => [styles.menuItem, (active || pressed || hovered) && styles.quietHover]}
      onPress={onPress}
      accessibilityRole="radio"
      aria-checked={active}
    >
      <Text style={[styles.menuItemText, active && styles.menuItemTextActive]}>{label}</Text>
      {active && <Icon d={ICONS.check} color={theme.accent} />}
    </Pressable>
  );
}

type SquareChipProps = {
  i: number;
  total: number;
  active: boolean;
  onSelect: (i: number) => void;
  styles: Styles;
};

// Memoised so a tap only re-renders the active square's chip, not the whole row.
const SquareChip = memo(function SquareChip({ i, total, active, onSelect, styles }: SquareChipProps) {
  return (
    <Pressable
      style={({ hovered }: PressState) => [styles.chip, active ? styles.chipActive : hovered && styles.controlHover]}
      onPress={() => onSelect(i)}
      accessibilityRole="button"
      aria-selected={active}
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
  marker: Marker;
  styles: Styles;
  labelStyle?: object;
  countStyle?: object;
  keyHint?: string;
  hintStyle?: object;
};

// The label takes the marker's text-safe ink (it is small); the numeral is large enough for the ink.
// keyHint names the arrow keys that count this zone (KEY_HINTS), faint so it stays out of the way.
function ZoneReadout({ k, count, marker, styles, labelStyle, countStyle, keyHint, hintStyle }: ZoneReadoutProps) {
  return (
    <>
      <Text style={[styles.zoneLabel, labelStyle, { color: marker.text }]}>{k}</Text>
      <Text style={[styles.count, countStyle, { color: marker.ink }]}>{count}</Text>
      {keyHint && (
        <Text style={[styles.zoneHint, hintStyle, { color: marker.text }]} aria-hidden>{keyHint}</Text>
      )}
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
  marker,
  style,
  countStyle,
  labelStyle,
  keyHint,
  onAdd,
  styles,
}: ZoneReadoutProps & { style: object; onAdd: (k: CounterKey) => void }) {
  return (
    <Pressable
      onPressIn={() => onAdd(k)}
      {...noPressDelay}
      // Screen readers activate through onPress, which is no longer set.
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={() => onAdd(k)}
      style={({ pressed, hovered }: PressState) => [
        style,
        { backgroundColor: pressed ? marker.pressed : marker.tint },
        (pressed || hovered) && { borderColor: marker.ink },
      ]}
      accessibilityLabel={`Add one ${k} cell`}
    >
      <View style={[styles.zoneDot, { backgroundColor: marker.ink }]} />
      <ZoneReadout k={k} count={count} marker={marker} styles={styles} countStyle={countStyle} labelStyle={labelStyle} keyHint={keyHint} />
    </Pressable>
  );
});

// Miniature of a counting layout. Positions mirror the real screens: slot1 is left / top /
// top-left, slot2 is right / bottom / bottom-right.
function LayoutIcon({ layoutKey, slot1, slot2, theme }: { layoutKey: LayoutKey; slot1: Marker; slot2: Marker; theme: Theme }) {
  const zone = (x: number, y: number, w: number, h: number, m: Marker) => (
    <Rect x={x} y={y} width={w} height={h} rx={4} fill={m.tint} stroke={m.ink} strokeWidth={1.5} />
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
              <Rect x={6} y={8} width={52} height={48} rx={4} />
            </ClipPath>
          </Defs>
          <G clipPath="url(#diagClip)">
            <Polygon points="6,8 58,8 6,56" fill={slot1.tint} />
            <Polygon points="58,8 58,56 6,56" fill={slot2.tint} />
          </G>
          <Rect x={6} y={8} width={52} height={48} rx={4} fill="none" stroke={theme.muted} strokeWidth={1.5} />
          <Line x1={58} y1={8} x2={6} y2={56} stroke={theme.muted} strokeWidth={1.5} />
        </>
      )}
    </Svg>
  );
}

// The identity's pill switch. The knob slides; the row around it is the control.
function SwitchRow({
  label,
  hint,
  value,
  onToggle,
  divider = false,
  styles,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onToggle: () => void;
  divider?: boolean;
  styles: Styles;
}) {
  return (
    <Pressable
      style={[styles.switchRow, divider && styles.switchRowDivider]}
      onPress={onToggle}
      accessibilityRole="switch"
      aria-checked={value}
      accessibilityLabel={label}
    >
      <View style={styles.switchText}>
        <Text style={styles.switchLabel}>{label}</Text>
        {hint ? <Text style={styles.switchHint}>{hint}</Text> : null}
      </View>
      <View style={[styles.switchTrack, value && styles.switchTrackOn]}>
        <View style={[styles.switchKnob, value && styles.switchKnobOn]} />
      </View>
    </Pressable>
  );
}

// Header theme toggle: the same switch with a sun (light) or moon (dark) in the knob.
function ThemeSwitch({
  dark,
  onToggle,
  theme,
  styles,
}: {
  dark: boolean;
  onToggle: () => void;
  theme: Theme;
  styles: Styles;
}) {
  return (
    <Pressable
      style={({ hovered }: PressState) => [styles.switchTrack, styles.themeTrack, hovered && styles.controlHover]}
      onPress={onToggle}
      hitSlop={8}
      accessibilityRole="switch"
      aria-checked={dark}
      accessibilityLabel="Dark theme"
    >
      <View style={[styles.switchKnob, dark && styles.switchKnobOn]}>
        <Icon d={dark ? ICONS.moon : ICONS.sun} color={theme.accent} size={12} />
      </View>
    </Pressable>
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
  styles: Styles;
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

// Web only: the switch knob slides in 180 ms (transition props aren't in RN's style types).
const knobSlide = (Platform.OS === 'web' ? { transitionProperty: 'transform', transitionDuration: '180ms' } : {}) as {};

// Flat construction throughout: 1px hairlines and the bg / surface step separate layers.
// Only the floating modal sheets carry a shadow.
function makeStyles(t: Theme, s: number, tight: boolean) {
  const f = FONTS;
  const hairline = { borderWidth: 1, borderColor: t.border };
  const control = { borderRadius: RADIUS.control, backgroundColor: t.surface, ...hairline };
  // Mono label voice: uppercase with wide tracking (0.1em).
  const monoLabel = { color: t.muted, fontFamily: f.mono, textTransform: 'uppercase' as const };
  const numeral = { fontFamily: f.b, fontVariant: ['tabular-nums' as const] };
  const groupGap = tight ? 10 : 14;
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: t.bg },
    safe: { flex: 1, alignItems: 'center' },
    rail: { alignSelf: 'stretch', height: 6 },
    root: { flex: 1, width: '100%', maxWidth: MAX_CONTENT_WIDTH },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: GUTTER,
      paddingVertical: tight ? 10 : 18,
    },
    brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    brandDot: { width: 9, height: 9, borderRadius: RADIUS.pill, backgroundColor: t.accent },
    brandName: { color: t.text, fontSize: 17, fontFamily: f.b, letterSpacing: -0.17 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    iconButton: { width: 32, height: 32, borderRadius: RADIUS.control, alignItems: 'center', justifyContent: 'center' },
    // Hover and pressed states: a blue border on outlined controls, a blue tint on quiet ones.
    controlHover: { borderColor: t.accent },
    quietHover: { backgroundColor: t.accentTint },
    sectionLabel: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    sectionLabelText: { ...monoLabel, fontSize: 11, letterSpacing: 1.1 },
    sectionRule: { flex: 1, height: 1, backgroundColor: t.border },
    setup: { flexDirection: 'row', gap: 10, paddingHorizontal: GUTTER },
    setupChamber: { flex: 1, gap: 10 },
    setupField: { gap: 10 },
    select: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 36, paddingHorizontal: 10, ...control },
    selectText: { flex: 1, color: t.text, fontSize: 14, fontFamily: f.sb },
    dilControl: { flexDirection: 'row', alignItems: 'stretch', height: 36, ...control },
    dilInput: {
      color: t.text,
      // Fixed width: on web an <input> otherwise keeps its ~240px default and overflows the row.
      width: 56,
      paddingHorizontal: 6,
      paddingVertical: 0,
      // 16px keeps mobile browsers from zooming in on focus.
      fontSize: 16,
      fontFamily: f.mono,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderLeftColor: t.border,
      borderRightColor: t.border,
    },
    dilStepBtn: {
      width: 36,
      justifyContent: 'center',
      alignItems: 'center',
      borderTopLeftRadius: RADIUS.control - 1,
      borderBottomLeftRadius: RADIUS.control - 1,
    },
    dilStepBtnEnd: {
      borderTopLeftRadius: 0,
      borderBottomLeftRadius: 0,
      borderTopRightRadius: RADIUS.control - 1,
      borderBottomRightRadius: RADIUS.control - 1,
    },
    group: { paddingHorizontal: GUTTER, marginTop: groupGap, gap: 10 },
    results: { padding: 12, gap: 10, borderRadius: RADIUS.card, backgroundColor: t.surface, ...hairline },
    resultsTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
    stat: { gap: 3 },
    statEnd: { gap: 3, alignItems: 'flex-end' },
    statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    statLabel: { ...monoLabel, fontSize: 10, letterSpacing: 1 },
    dot: { width: 8, height: 8, borderRadius: RADIUS.pill },
    conc: { ...numeral, fontSize: Math.round(26 * s), letterSpacing: -0.26 * s },
    concRow: { flexDirection: 'row', gap: 12 },
    concCol: { flex: 1, gap: 3 },
    concSmall: { ...numeral, fontSize: Math.round(17 * s) },
    viaBar: {
      height: 6,
      flexDirection: 'row',
      gap: 2,
      overflow: 'hidden',
      borderRadius: RADIUS.pill,
      backgroundColor: t.border,
    },
    countLabel: { marginHorizontal: GUTTER, marginTop: groupGap },
    split: { flex: 1, flexDirection: 'row', gap: 10, paddingHorizontal: GUTTER, paddingTop: 10 },
    stack: { flex: 1, gap: 10, paddingHorizontal: GUTTER, paddingTop: 10 },
    zone: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.card, ...hairline },
    zoneDot: { position: 'absolute', top: 9, right: 9, width: 8, height: 8, borderRadius: RADIUS.pill },
    zoneLabel: { ...monoLabel, position: 'absolute', top: 9, left: 11, fontSize: 11, letterSpacing: 1.1 },
    zoneHint: { position: 'absolute', bottom: 7, left: 11, fontFamily: f.mono, fontSize: 17, letterSpacing: 1.5, opacity: 0.4 },
    count: { ...numeral, fontSize: Math.round(76 * s), letterSpacing: -1.5 * s },
    stackCount: { fontSize: Math.round(52 * s), letterSpacing: -1 * s },
    diagonalZone: {
      flex: 1,
      marginHorizontal: GUTTER,
      marginTop: 10,
      borderRadius: RADIUS.card,
      overflow: 'hidden',
      backgroundColor: t.surface,
      ...hairline,
    },
    diagonalLabelTop: { position: 'absolute', top: 12, left: 14 },
    diagonalLabelBottom: { position: 'absolute', bottom: 12, right: 14, alignItems: 'flex-end' },
    diagonalZoneLabel: { position: 'relative', top: 0, left: 0, fontSize: 12, letterSpacing: 1.2 },
    diagonalZoneHint: { position: 'relative', bottom: 0, left: 0 },
    diagonalCount: { fontSize: Math.round(52 * s), letterSpacing: -1 * s },
    chipsScroll: { flexGrow: 0, marginTop: 6 },
    // Vertical padding leaves room for the focus ring, which the scroll view would clip.
    chips: { paddingHorizontal: GUTTER, paddingVertical: 4, gap: 8, alignItems: 'center' },
    chip: { minWidth: 48, minHeight: 40, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', ...control },
    chipActive: { backgroundColor: t.accentTint, borderColor: t.accent },
    chipLabel: { color: t.muted, fontSize: 10, fontFamily: f.mono, letterSpacing: 0.4 },
    chipValue: { color: t.text, fontSize: 14, fontFamily: f.mono, fontVariant: ['tabular-nums'] },
    chipTextActive: { color: t.accent },
    bar: { flexDirection: 'row', gap: 10, paddingHorizontal: GUTTER, paddingTop: 6, paddingBottom: 16 },
    button: { flex: 1, height: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', ...control },
    // Sized by their label. Spelled out because the web reads `flex: 0` as a zero basis, which
    // collapses a single-line label.
    buttonData: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', paddingHorizontal: 18 },
    buttonDialog: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', height: 36, minWidth: 76, paddingHorizontal: 14 },
    buttonText: { color: t.text, fontSize: 14, fontFamily: f.sb },
    buttonPrimary: { backgroundColor: t.accent, borderColor: t.accent },
    buttonPrimaryHover: { backgroundColor: mix(t.accent, t.text, 0.1), borderColor: mix(t.accent, t.text, 0.1) },
    buttonPrimaryText: { color: t.onAccent },
    buttonDangerHover: { borderColor: t.dead.ink },
    buttonDangerText: { color: t.dead.text },
    dim: { opacity: 0.5 },
    modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: GUTTER, backgroundColor: t.backdrop, cursor: 'auto' },
    modalSheet: {
      width: '100%',
      maxWidth: 420,
      overflow: 'hidden',
      borderRadius: RADIUS.card,
      backgroundColor: t.surface,
      boxShadow: t.shadow,
      cursor: 'auto',
      ...hairline,
    },
    menu: { padding: 6, gap: 2 },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 44,
      paddingHorizontal: 10,
      borderRadius: RADIUS.control,
    },
    menuItemText: { color: t.text, fontSize: 15, fontFamily: f.m },
    menuItemTextActive: { color: t.accent, fontFamily: f.sb },
    dialogBody: { padding: 18, gap: 12 },
    dialogTitle: { color: t.text, fontSize: 18, fontFamily: f.b, letterSpacing: -0.18 },
    dialogFooter: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: t.border,
    },
    soundRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    sliderHit: { flex: 1, height: 40, justifyContent: 'center', marginHorizontal: 11 },
    sliderTrack: { height: 6, borderRadius: RADIUS.pill, backgroundColor: t.border, overflow: 'hidden' },
    sliderFill: { height: 6, backgroundColor: t.accent },
    sliderThumb: {
      position: 'absolute',
      top: 9,
      marginLeft: -11,
      width: 22,
      height: 22,
      borderRadius: RADIUS.pill,
      backgroundColor: t.accent,
      borderWidth: 2,
      borderColor: t.surface,
    },
    tileRow: { flexDirection: 'row', gap: 10 },
    tile: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 10, borderRadius: RADIUS.card, backgroundColor: t.surface, ...hairline },
    tileActive: { backgroundColor: t.accentTint, borderColor: t.accent },
    tileText: { color: t.muted, fontSize: 13, fontFamily: f.sb },
    tileTextActive: { color: t.accent },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      minHeight: 48,
      paddingVertical: 8,
    },
    switchRowDivider: { borderTopWidth: 1, borderTopColor: t.border },
    switchText: { flex: 1 },
    switchLabel: { color: t.text, fontSize: 15, fontFamily: f.m },
    switchHint: { color: t.muted, fontSize: 12, fontFamily: f.m, marginTop: 1 },
    // Off is a neutral track, on an accent fill. The knob sits 2px inside the border.
    switchTrack: {
      width: 50,
      height: 27,
      justifyContent: 'center',
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      borderColor: t.rail,
      backgroundColor: t.rail,
    },
    switchTrackOn: { borderColor: t.accent, backgroundColor: t.accent },
    // The theme toggle isn't on/off, so its track keeps the hub's pale accent mix either way.
    themeTrack: { marginLeft: 6, borderColor: t.border, backgroundColor: mix(t.surface, t.accent, 0.14) },
    switchKnob: {
      width: 21,
      height: 21,
      marginLeft: 2,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: RADIUS.pill,
      backgroundColor: t.surface,
      ...hairline,
      ...knobSlide,
    },
    switchKnobOn: { transform: [{ translateX: 23 }] },
    dataBody: { padding: 18, gap: 6 },
    dataStep: { marginTop: 12, marginBottom: 2 },
    dataRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
    dataText: { color: t.muted, fontSize: 13, fontFamily: f.m },
    dataFormula: { color: t.text, fontSize: 13, fontFamily: f.mono },
  });
}
