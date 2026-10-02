// On Android the fonts are embedded at build time by the expo-font plugin (app.json) and
// registered under their file names, which are the fontFamily names the styles use.
// Nothing to load at runtime, so the first frame renders with the right fonts.
export const RUNTIME_FONTS: Record<string, number> = {};
