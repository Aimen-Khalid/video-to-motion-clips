// Dumps Animora's caption templates (resolved against the default theme) to captions/templates.json.
// Run: npx tsx captions/tools/extract.ts   (from /home/claude/clipjob/motion)
import { writeFileSync } from "node:fs";
import { CAPTION_TEMPLATES } from "/home/claude/animora/library/caption-style/templates/catalogue";
import { TEMPLATE_GROUPS } from "/home/claude/animora/library/caption-style/templates/template";
import { DEFAULT_PRESET, CAPTION_RANGES } from "/home/claude/animora/library/caption-style/presets";
import { resolveColour } from "/home/claude/animora/library/caption-style/colour";
import * as T from "/home/claude/animora/library/caption-style/types";
import { THEME_COLOUR_ROLES } from "/home/claude/animora/library/caption-style/colour";
import { MAX_ROWS } from "/home/claude/animora/library/caption-style/rows";
import * as CH from "/home/claude/animora/library/captions/chunking";
import { BREAK_SECONDS } from "/home/claude/animora/library/captions/word-groups";
const { COLOUR_VALUES } = T;
import { DEFAULT_THEME } from "/home/claude/animora/library/design-tokens/default-theme";
import { CAPTION_FONT_FAMILIES } from "/home/claude/animora/library/design-tokens/caption-fonts";
import { CAPTION_METRICS, CAPTION_CARD_COLOURS, CAPTION_RANSOM_COLOURS, CAPTION_PALETTE } from "/home/claude/animora/library/design-tokens/caption-palette";
import { CAPTION_MOTION } from "/home/claude/animora/library/design-tokens/caption-motion";
import { CARD_TEXT } from "/home/claude/animora/library/caption-style/backdrops/card-text";

const theme = DEFAULT_THEME;
const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, "0").toUpperCase();
/** Theme colours may be rgba(); turn every colour into #RRGGBB or #RRGGBBAA. */
const toHex = (css: string): string => {
  if (/^#[0-9a-fA-F]{6}$/.test(css)) return css.toUpperCase();
  const m = css.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (!m) throw new Error("colour? " + css);
  const a = m[4] === undefined ? 1 : Number(m[4]);
  return "#" + hex2(+m[1]) + hex2(+m[2]) + hex2(+m[3]) + (a < 1 ? hex2(a * 255) : "");
};
const col = (ref: string | null) => (ref == null ? null : toHex(resolveColour(theme, ref)));

const templates = Object.entries(CAPTION_TEMPLATES).map(([id, t]: [string, any]) => {
  const v: any = t.values(theme);
  for (const k of COLOUR_VALUES) v[k] = col(v[k]);
  v.rows = v.rows.map((r: any) => ({ ...r, colour: col(r.colour), gradient: col(r.gradient), box: col(r.box) }));
  return { id, label: t.label, hint: t.hint, group: t.group, groupLabel: (TEMPLATE_GROUPS as any)[t.group], footageOnly: Boolean(t.footageOnly), values: v };
});

const typo = (s: any) => ({ family: s.fontFamily, fontSize: s.fontSize, fontWeight: s.fontWeight, lineHeight: s.lineHeight, letterSpacing: s.letterSpacing });
const out = {
  source: "Animora library/caption-style (extracted with captions/tools/extract.ts against DEFAULT_THEME)",
  count: templates.length,
  groups: Object.entries(TEMPLATE_GROUPS).map(([id, label]) => ({ id, label })),
  defaultNarration: DEFAULT_PRESET.narration,
  defaultFootage: DEFAULT_PRESET.footage,
  ranges: CAPTION_RANGES,
  theme: {
    tokenBaseEdge: 1080,
    subtitle: typo(theme.typography.subtitle),
    headline: typo(theme.typography.headline),
    spaceMd: theme.space.md,
    safeSide: 0.06,
    safeEndPortrait: 0.12,
    safeEndLandscape: 0.08,
  },
  themeColours: Object.fromEntries(THEME_COLOUR_ROLES.map((r) => [r, col("theme:" + r)])),
  choices: {
    font: T.CAPTION_FONTS, stressFont: T.STRESS_FONTS, letterCase: T.LETTER_CASES, stressCase: T.LETTER_CASES, slant: T.SLANTS, stressSlant: T.SLANTS,
    emphasis: T.EMPHASES, reveal: T.REVEALS, autoStress: T.AUTO_STRESSES, stressLine: T.STRESS_LINES, stressMark: T.STRESS_MARKS,
    backdrop: T.BACKDROPS, textFill: T.FILLS, gradientDirection: T.GRADIENT_DIRECTIONS, entrance: T.ENTRANCES, align: T.ALIGNS,
    position: T.POSITIONS, layer: T.LAYERS, grouping: T.GROUPINGS,
  },
  numberValues: T.NUMBER_VALUES,
  colourValues: T.COLOUR_VALUES,
  maxRows: MAX_ROWS,
  chunking: { MAX_LINE_CHARS: CH.MAX_LINE_CHARS, MAX_LINES: CH.MAX_LINES, MIN_SECONDS: CH.MIN_SECONDS, MIN_WORDS_BEFORE_CLAUSE_BREAK: CH.MIN_WORDS_BEFORE_CLAUSE_BREAK, PAUSE_SECONDS: CH.PAUSE_SECONDS, BREAK_SECONDS, MIN_LINE_CHARS: 12 },
  fontFamilies: CAPTION_FONT_FAMILIES,
  metrics: CAPTION_METRICS,
  palette: CAPTION_PALETTE,
  cardColours: CAPTION_CARD_COLOURS,
  cardText: CARD_TEXT,
  ransomColours: CAPTION_RANSOM_COLOURS,
  ransomFonts: ["heavy", "serif", "slab", "sans", "condensed", "poster", "western", "tall"],
  motion: CAPTION_MOTION,
  templates,
};
writeFileSync(new URL("../templates.json", import.meta.url), JSON.stringify(out, null, 1));
console.log("templates:", templates.length, "footageOnly:", templates.filter((t) => t.footageOnly).map((t) => t.id));
