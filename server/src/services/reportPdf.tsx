/**
 * Print template for personalized executive briefings, composed page by page
 * like a premium management-consulting publication — NOT auto-flowed.
 *
 * Every section is art-directed onto its own page using a small set of page
 * masters, so pages never exist merely because the previous page overflowed:
 *
 *   Cover (light, photo-anchored) → Executive brief (split composition)
 *   → Narrative + exhibit pages (one per body section)
 *   → Visual reset page (full-bleed photo + showcased quote)
 *   → Split page (key questions | analysis)
 *   → Action agenda (one page ≤4 items; balanced two-page spread otherwise)
 *   → Quiet closing (watch-next, methodology, sources, prepared for/by)
 *
 * US Letter (612×792pt), white pages, Source Serif 4 display, Source Sans 3
 * body, sender-brand accent used sparingly (gold only on an exhibit's single
 * conclusion datapoint). The palette derives from the sender's brand colors
 * (services/palette.ts) and flows through React context.
 */
import React, { createContext, useContext } from 'react';
import { Document, Page, View, Text, Image, Font, StyleSheet, Svg, Rect, Defs, LinearGradient, Stop, renderToStream } from '@react-pdf/renderer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { sectionRole, type AppSettings, type Lead, type Report, type ReportSection } from '../types.js';
import { getImage } from '../db/images.js';
import { buildPalette, type Palette } from './palette.js';
import { fetchImageBuffer } from './fetchImage.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// Candidate roots cover local dev (src or dist next to server/) and the
// Vercel bundle, where includeFiles places server/assets relative to cwd.
const FONTS = [
  path.join(here, '../../assets/fonts'),
  path.join(process.cwd(), 'server/assets/fonts'),
  path.join(process.cwd(), 'assets/fonts'),
].find(existsSync) ?? path.join(here, '../../assets/fonts');

/* ------------------------------------------------------------------ fonts */

Font.register({
  family: 'Serif',
  fonts: [
    { src: path.join(FONTS, 'SourceSerif4-Regular.ttf') },
    { src: path.join(FONTS, 'SourceSerif4-Bold.ttf'), fontWeight: 700 },
    { src: path.join(FONTS, 'SourceSerif4-Italic.ttf'), fontStyle: 'italic' },
  ],
});
Font.register({
  family: 'Sans',
  fonts: [
    { src: path.join(FONTS, 'SourceSans3-Regular.ttf') },
    { src: path.join(FONTS, 'SourceSans3-SemiBold.ttf'), fontWeight: 600 },
    { src: path.join(FONTS, 'SourceSans3-Bold.ttf'), fontWeight: 700 },
  ],
});
// Editorial type: no mid-word hyphen breaks.
Font.registerHyphenationCallback((word) => [word]);

/* ------------------------------------------------------------------ tokens */

const PAGE_W = 612; // US Letter
const PAGE_H = 792;
const MARGIN = 54;
const CONTENT_W = PAGE_W - MARGIN * 2; // 504
const TEXT_W = 396;
const FOOTER_H = 34;

const INK = '#1f2328';
const GRAY = '#6b7280';
const LIGHT = '#e5e7eb';
const PALE = '#f4f5f7';

/** Sender palette flows via context; the default is the original HT scheme. */
const PaletteCtx = createContext<Palette>(buildPalette());
const usePal = () => useContext(PaletteCtx);

/** #RRGGBB + 0..1 alpha → rgba() string (react-pdf accepts rgba). */
function tint(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const s = StyleSheet.create({
  page: {
    fontFamily: 'Sans',
    fontSize: 9.8,
    color: INK,
    backgroundColor: '#ffffff',
    paddingTop: 52,
    paddingBottom: FOOTER_H + 20,
    paddingHorizontal: MARGIN,
  },
  bare: { fontFamily: 'Sans', fontSize: 9.8, color: INK, backgroundColor: '#ffffff' },
  body: { fontSize: 9.8, lineHeight: 1.5 },
  eyebrow: { fontFamily: 'Sans', fontWeight: 600, fontSize: 7.5, letterSpacing: 1.6, color: GRAY },
  sourceLine: { fontFamily: 'Sans', fontSize: 6.8, color: GRAY, marginTop: 6 },
  /** Standard analytical page headline — modest, per the reference (not hero type). */
  headline: { fontFamily: 'Serif', fontWeight: 700, fontSize: 18.5, lineHeight: 1.16, color: INK },
  footer: {
    position: 'absolute',
    left: MARGIN,
    right: MARGIN,
    bottom: 0,
    height: FOOTER_H,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 0.75,
    borderTopColor: LIGHT,
  },
});

/* --------------------------------------------------------------- utilities */

function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}|\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Sections grouped by rendering role (legacy keys resolve via sectionRole). */
function splitByRole(report: Report) {
  const summary = report.sections.find((x) => sectionRole(x.key) === 'exec-summary') ?? null;
  const body = report.sections.filter((x) => sectionRole(x.key) === 'body');
  const takeaways = report.sections.find((x) => sectionRole(x.key) === 'takeaways') ?? null;
  const closing = report.sections.find((x) => sectionRole(x.key) === 'closing') ?? null;
  return { summary, body, takeaways, closing };
}

/** Load a stored report image from the database by its /api/images/... URL. */
async function storedImageBuffer(url: string | null | undefined): Promise<Buffer | null> {
  if (!url) return null;
  const image = await getImage(path.basename(url));
  return image?.data ?? null;
}

/** Strip list markers / numbering the model may have baked into titles (the template draws its own). */
function cleanTitle(t: string): string {
  return t
    .replace(/^[■▪●•·\-\s]+/, '')
    .replace(/^\d+[.)]\s*/, '')
    .trim();
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/** Sentence-case guard for model output that arrives ALL CAPS. */
function sentenceCase(t: string): string {
  const letters = t.replace(/[^a-zA-Z]/g, '');
  if (!letters || letters !== letters.toUpperCase()) return t;
  const lower = t.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** Short running title for footers ("Corewell Health revenue cycle briefing") — never a truncated headline. */
function runningTitle(report: Report, lead: Lead): string {
  const focus = report.focus.trim();
  return `${lead.organization} ${focus ? focus.charAt(0).toLowerCase() + focus.slice(1) : 'executive'} briefing`;
}

/** The word showcased as giant pale background type on the section opener. */
function backgroundWord(report: Report): string {
  const words = report.title.replace(/[^\w\s]/g, '').split(/\s+/).filter((w) => w.length >= 6);
  const pick = words.sort((a, b) => b.length - a.length)[0] ?? report.focus.split(/\s+/)[0] ?? 'BRIEFING';
  return pick.toUpperCase();
}

/** Whether a section's subTopics are the key-questions sidebar. */
function isKeyQuestions(section: ReportSection): boolean {
  return /^key questions/i.test(section.kicker ?? '') || /^key questions/i.test(section.subTopics?.[0]?.title ?? '');
}

const nonEmpty = (xs: string[] | null | undefined) => (xs ?? []).filter((x) => x.trim().length > 0);

/* ------------------------------------------------------------- components */

/**
 * Sender mark, deliberately quiet: the uploaded logo when available, otherwise
 * a small sans wordmark that never competes with the report title.
 */
function SenderMark({ settings, height }: { settings: AppSettings; height: number }) {
  const pal = usePal();
  if (settings.logoDataUrl) {
    return <Image src={settings.logoDataUrl} style={{ height, maxWidth: height * 4, objectFit: 'contain' }} />;
  }
  return (
    <Text style={{ fontFamily: 'Sans', fontWeight: 700, fontSize: height * 0.52, letterSpacing: 0.4, color: pal.primary }}>
      {settings.companyName}
    </Text>
  );
}

/** Minimal footer: page number + short running title. The publisher appears on the cover and closing only. */
function Footer({ running }: { running: string }) {
  return (
    <View style={s.footer} fixed>
      <Text
        style={{ fontFamily: 'Sans', fontWeight: 600, fontSize: 7, color: GRAY }}
        // The cover is page 1 but carries no footer; numbering starts after it.
        render={({ pageNumber }) => `${pageNumber - 1}`}
      />
      <Text style={{ fontFamily: 'Sans', fontSize: 7, color: GRAY, marginLeft: 14 }}>{running}</Text>
      <View style={{ flex: 1 }} />
    </View>
  );
}

/** Restrained pull quote: thin brand rule, serif italic, attribution below. */
function QuoteBlock({ quote, width = TEXT_W }: { quote: NonNullable<ReportSection['quote']>; width?: number }) {
  const pal = usePal();
  return (
    <View wrap={false} style={{ marginVertical: 14, paddingLeft: 14, borderLeftWidth: 2, borderLeftColor: pal.primary, width }}>
      <Text style={{ fontFamily: 'Serif', fontStyle: 'italic', fontSize: 13, lineHeight: 1.4, color: INK }}>
        “{quote.text.replace(/^["“]|["”]$/g, '')}”
      </Text>
      <Text style={{ fontFamily: 'Sans', fontSize: 8, color: GRAY, marginTop: 6 }}>
        <Text style={{ fontWeight: 600, color: INK }}>{quote.attribution}</Text>
        {quote.role ? `, ${quote.role}` : ''}
      </Text>
    </View>
  );
}

/**
 * Consulting-style exhibit: numbered eyebrow, the analytical conclusion as the
 * headline, direct-labeled bars. The accent color marks ONLY the datapoint the
 * writer flagged as the conclusion; everything else stays in navy tints.
 */
/** Time-series datasets (labels carry years/quarters) render as columns, not bars. */
function isTimeSeries(chart: NonNullable<ReportSection['chart']>): boolean {
  const timeLike = chart.data.filter((d) => /\b(19|20)\d{2}\b|\bQ[1-4]\b/i.test(d.label)).length;
  return chart.data.length >= 3 && timeLike / chart.data.length >= 0.6;
}

/** Vertical trend columns for time-series exhibits — a second visual family. */
function TrendColumns({ chart, width, large }: { chart: NonNullable<ReportSection['chart']>; width: number; large: boolean }) {
  const pal = usePal();
  const max = Math.max(...chart.data.map((d) => d.value), 1);
  const anyHighlight = chart.data.some((d) => d.highlight);
  const H = large ? 190 : 130;
  const gap = 18;
  const colW = Math.min(72, (width - gap * (chart.data.length - 1)) / chart.data.length);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', borderBottomWidth: 1, borderBottomColor: '#c9cdd3', paddingBottom: 0, marginTop: 6 }}>
      {chart.data.map((d, i) => {
        const hot = anyHighlight ? Boolean(d.highlight) : false;
        const h = Math.max(6, (d.value / max) * H);
        return (
          <View key={d.label} style={{ width: colW, marginLeft: i === 0 ? 0 : gap, alignItems: 'center' }}>
            <Text style={{ fontFamily: 'Sans', fontWeight: 600, fontSize: large ? 9.5 : 8.6, color: INK, marginBottom: 3 }}>
              {d.value}
              {d.suffix ?? ''}
            </Text>
            <View style={{ width: colW * 0.62, height: h, backgroundColor: hot ? pal.accent : pal.primary, opacity: hot ? 1 : 0.85 }} />
          </View>
        );
      })}
    </View>
  );
}

function TrendColumnLabels({ chart, width }: { chart: NonNullable<ReportSection['chart']>; width: number }) {
  const gap = 18;
  const colW = Math.min(72, (width - gap * (chart.data.length - 1)) / chart.data.length);
  return (
    <View style={{ flexDirection: 'row', marginTop: 4 }}>
      {chart.data.map((d, i) => (
        <Text
          key={d.label}
          style={{ width: colW, marginLeft: i === 0 ? 0 : gap, textAlign: 'center', fontFamily: 'Sans', fontSize: 7.2, lineHeight: 1.3, color: GRAY }}
        >
          {d.label}
        </Text>
      ))}
    </View>
  );
}

function Exhibit({
  chart,
  exhibit,
  width = CONTENT_W,
  large = false,
}: {
  chart: NonNullable<ReportSection['chart']>;
  exhibit: number;
  width?: number;
  large?: boolean;
}) {
  const pal = usePal();
  const max = Math.max(...chart.data.map((d) => d.value), 1);
  const anyHighlight = chart.data.some((d) => d.highlight);
  const LABEL_W = large ? 180 : Math.min(150, width * 0.3);
  const VALUE_W = 46;
  const BAR_MAX = width - LABEL_W - VALUE_W - 16;
  const barH = large ? 18 : 12;
  const rowGap = large ? 12 : 7;
  if (isTimeSeries(chart)) {
    return (
      <View wrap={false} style={{ marginVertical: 14, width, borderTopWidth: 2, borderTopColor: INK, paddingTop: 8 }}>
        <Text style={[s.eyebrow, { marginBottom: 3 }]}>EXHIBIT {exhibit}</Text>
        <Text
          style={{ fontFamily: 'Sans', fontWeight: 600, fontSize: large ? 15 : 12.5, lineHeight: 1.3, color: INK, marginBottom: large ? 20 : 12, width: width * 0.92 }}
        >
          {sentenceCase(chart.question)}
        </Text>
        <TrendColumns chart={chart} width={width} large={large} />
        <TrendColumnLabels chart={chart} width={width} />
        {chart.source && <Text style={s.sourceLine}>Source: {chart.source}</Text>}
      </View>
    );
  }
  return (
    <View wrap={false} style={{ marginVertical: 14, width, borderTopWidth: 2, borderTopColor: INK, paddingTop: 8 }}>
      <Text style={[s.eyebrow, { marginBottom: 3 }]}>EXHIBIT {exhibit}</Text>
      <Text
        style={{
          fontFamily: 'Sans',
          fontWeight: 600,
          fontSize: large ? 15 : 12.5,
          lineHeight: 1.3,
          color: INK,
          marginBottom: large ? 20 : 12,
          width: width * 0.92,
        }}
      >
        {sentenceCase(chart.question)}
      </Text>
      {chart.data.map((d) => {
        const hot = anyHighlight ? Boolean(d.highlight) : false;
        return (
          <View key={d.label} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: rowGap }}>
            <Text style={{ width: LABEL_W, paddingRight: 10, textAlign: 'right', fontFamily: 'Sans', fontSize: large ? 8.6 : 8, color: GRAY }}>
              {d.label}
            </Text>
            <View
              style={{
                width: Math.max(3, (d.value / max) * BAR_MAX),
                height: barH,
                backgroundColor: hot ? pal.accent : pal.primary,
                opacity: hot ? 1 : 0.82,
              }}
            />
            <Text style={{ fontFamily: 'Sans', fontWeight: 600, fontSize: large ? 10 : 9, color: INK, marginLeft: 7 }}>
              {d.value}
              {d.suffix ?? ''}
            </Text>
          </View>
        );
      })}
      {chart.source && <Text style={s.sourceLine}>Source: {chart.source}</Text>}
    </View>
  );
}

/** Restrained big-number strip: thin rules, brand-primary figures, shared source line. */
function StatStrip({ stats, width = CONTENT_W }: { stats: NonNullable<ReportSection['stats']>; width?: number }) {
  const pal = usePal();
  const shown = stats.slice(0, 4);
  const sources = [...new Set(shown.map((t) => t.source).filter((x): x is string => Boolean(x?.trim())))];
  return (
    <View wrap={false} style={{ marginVertical: 12, width, borderTopWidth: 0.75, borderTopColor: LIGHT, borderBottomWidth: 0.75, borderBottomColor: LIGHT, paddingVertical: 12 }}>
      <View style={{ flexDirection: 'row' }}>
        {shown.map((t, i) => (
          <View key={i} style={{ flex: 1, paddingRight: 14, borderLeftWidth: i === 0 ? 0 : 0.75, borderLeftColor: LIGHT, paddingLeft: i === 0 ? 0 : 14 }}>
            <Text style={{ fontFamily: 'Serif', fontWeight: 700, fontSize: 21, color: pal.primary, lineHeight: 1 }}>{t.value}</Text>
            <Text style={{ fontFamily: 'Sans', fontSize: 7.8, lineHeight: 1.35, color: GRAY, marginTop: 4 }}>{t.label}</Text>
          </View>
        ))}
      </View>
      {sources.length > 0 && <Text style={s.sourceLine}>Source: {sources.join('; ')}</Text>}
    </View>
  );
}

/**
 * Bullets. Reference lists written as "Name — what to watch" render as a
 * compact two-column reference matrix; anything else gets quiet square bullets.
 */
function BulletList({ bullets, width = TEXT_W }: { bullets: string[]; width?: number }) {
  const pal = usePal();
  const items = nonEmpty(bullets);
  if (!items.length) return null;
  const matrix = items.length >= 3 && items.filter((b) => /\s—\s/.test(b)).length / items.length >= 0.6;
  if (matrix) {
    return (
      <View wrap={false} style={{ marginVertical: 10, width: CONTENT_W, borderTopWidth: 0.75, borderTopColor: LIGHT }}>
        {items.map((b, i) => {
          const [name, ...rest] = b.split(/\s—\s/);
          return (
            <View key={i} style={{ flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 0.75, borderBottomColor: LIGHT }}>
              <Text style={{ width: 150, paddingRight: 12, fontFamily: 'Sans', fontWeight: 600, fontSize: 8.4, color: INK }}>
                {cleanTitle(name)}
              </Text>
              <Text style={{ flex: 1, fontFamily: 'Sans', fontSize: 8.4, lineHeight: 1.4, color: GRAY }}>{rest.join(' — ')}</Text>
            </View>
          );
        })}
      </View>
    );
  }
  return (
    <View style={{ marginVertical: 8, width }}>
      {items.map((b, i) => (
        <View key={i} style={{ flexDirection: 'row', marginBottom: 4 }}>
          <Text style={{ fontSize: 6, color: pal.primary, marginTop: 3, marginRight: 6 }}>■</Text>
          <Text style={{ fontFamily: 'Sans', fontSize: 9.4, lineHeight: 1.4, color: INK, flex: 1 }}>{cleanTitle(b)}</Text>
        </View>
      ))}
    </View>
  );
}

function NumberedItem({ item, index, width = TEXT_W }: { item: { title: string; body: string }; index: number; width?: number }) {
  const pal = usePal();
  return (
    <View wrap={false} style={{ flexDirection: 'row', marginBottom: 9, width }}>
      <Text style={{ fontFamily: 'Serif', fontWeight: 700, fontSize: 12, color: pal.primary, width: 20 }}>{index + 1}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'Sans', fontSize: 9.6, lineHeight: 1.45 }}>
          <Text style={{ fontWeight: 600 }}>{cleanTitle(item.title)} </Text>
          {item.body}
        </Text>
      </View>
    </View>
  );
}

/** Prose block: single measure for short sections, balanced two columns for long ones. */
function Prose({ text, width = CONTENT_W }: { text: string; width?: number }) {
  const paras = paragraphs(text);
  const totalChars = text.length;
  if (totalChars <= 950 || width < 380) {
    return (
      <>
        {paras.map((p, i) => (
          <Text key={i} style={[s.body, { width: Math.min(width, TEXT_W), marginBottom: 7 }]}>
            {p}
          </Text>
        ))}
      </>
    );
  }
  // Two balanced columns, split at a paragraph boundary.
  let acc = 0;
  let split = paras.length;
  for (let i = 0; i < paras.length; i++) {
    acc += paras[i].length;
    if (acc >= totalChars / 2) {
      split = i + 1;
      break;
    }
  }
  const colW = (width - 22) / 2;
  return (
    <View style={{ flexDirection: 'row', gap: 22, width }}>
      <View style={{ width: colW }}>
        {paras.slice(0, split).map((p, i) => (
          <Text key={i} style={[s.body, { fontSize: 9.4, marginBottom: 7 }]}>
            {p}
          </Text>
        ))}
      </View>
      <View style={{ width: colW }}>
        {paras.slice(split).map((p, i) => (
          <Text key={i} style={[s.body, { fontSize: 9.4, marginBottom: 7 }]}>
            {p}
          </Text>
        ))}
      </View>
    </View>
  );
}

/* ----------------------------------------------------------------- pages */

/**
 * Master: cover. Light composition — quiet marks top, dark serif title on the
 * white field, the photograph dominating the lower half of the page.
 */
function CoverPage({
  report,
  lead,
  settings,
  cover,
  companyLogo,
}: {
  report: Report;
  lead: Lead;
  settings: AppSettings;
  cover: Buffer | null;
  companyLogo: Buffer | null;
}) {
  const pal = usePal();
  const month = report.badge?.split('·')[1]?.trim() ?? new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const titleSize = report.title.length > 46 ? 38 : 46;

  return (
    <Page size={[PAGE_W, PAGE_H]} style={s.bare}>
      {/* One full-page photograph; a pale scrim over the upper portion recreates
          the reference's natural sky negative space so the dark title sits
          WITHIN the image rather than on a separate white panel. */}
      <View style={{ position: 'absolute', top: 0, left: 0, width: PAGE_W, height: PAGE_H, backgroundColor: tint(pal.primary, 0.06), overflow: 'hidden' }}>
        {cover && <Image src={cover} style={{ width: PAGE_W, height: PAGE_H, objectFit: 'cover' }} />}
        <Svg width={PAGE_W} height={PAGE_H} viewBox={`0 0 ${PAGE_W} ${PAGE_H}`} style={{ position: 'absolute', top: 0, left: 0 }}>
          <Defs>
            <LinearGradient id="coverLight" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#ffffff" stopOpacity={0.96} />
              <Stop offset="0.4" stopColor="#ffffff" stopOpacity={0.9} />
              <Stop offset="0.58" stopColor="#ffffff" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={PAGE_W} height={PAGE_H} fill="url(#coverLight)" />
        </Svg>
      </View>

      {/* Top marks row */}
      <View style={{ position: 'absolute', top: 42, left: MARGIN, right: MARGIN, flexDirection: 'row', alignItems: 'flex-start' }}>
        <SenderMark settings={settings} height={22} />
        <View style={{ flex: 1 }} />
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontFamily: 'Sans', fontWeight: 600, fontSize: 6.6, letterSpacing: 1.5, color: GRAY, marginBottom: 5 }}>
            PREPARED EXCLUSIVELY FOR
          </Text>
          {companyLogo ? (
            <Image src={companyLogo} style={{ height: 26, maxWidth: 112, objectFit: 'contain' }} />
          ) : (
            <Text style={{ fontFamily: 'Sans', fontWeight: 700, fontSize: 10.5, color: INK }}>{lead.organization}</Text>
          )}
        </View>
      </View>

      {/* Title block inside the image's pale negative space */}
      <View style={{ position: 'absolute', top: 122, left: MARGIN, right: MARGIN }}>
        <Text style={{ fontFamily: 'Serif', fontWeight: 700, fontSize: titleSize, lineHeight: 1.08, color: pal.primaryDeep, width: CONTENT_W * 0.95 }}>
          {sentenceCase(report.title)}
        </Text>
        {report.dek && (
          <Text style={{ fontFamily: 'Sans', fontSize: 10.5, lineHeight: 1.45, color: '#3d434c', marginTop: 12, width: CONTENT_W * 0.78 }}>
            {report.dek}
          </Text>
        )}
        <View style={{ width: 30, height: 2.5, backgroundColor: pal.accent, marginTop: 18, marginBottom: 10 }} />
        <Text style={{ fontFamily: 'Sans', fontWeight: 700, fontSize: 11.5, color: INK }}>{lead.personaName}</Text>
        <Text style={{ fontFamily: 'Sans', fontSize: 9, color: '#3d434c', marginTop: 2 }}>
          {lead.personaTitle}, {lead.organization}
        </Text>
        <Text style={{ fontFamily: 'Sans', fontSize: 8, color: '#3d434c', marginTop: 10 }}>{month}</Text>
      </View>

      {cover && report.imageCredit && (
        <Text style={{ position: 'absolute', bottom: 5, right: 8, fontFamily: 'Sans', fontSize: 5.5, color: 'rgba(255,255,255,0.7)' }}>
          Photo: {report.imageCredit}
        </Text>
      )}
    </Page>
  );
}

/**
 * Master: contents — "In this briefing" as a full page of its own, McKinsey
 * contents style: generous entries with large serif numerals, whitespace doing
 * the hierarchy, and a quiet brand band anchoring the lower page.
 */
function ContentsPage({
  report,
  lead,
  bodySections,
  running,
}: {
  report: Report;
  lead: Lead;
  bodySections: ReportSection[];
  running: string;
}) {
  const pal = usePal();
  const entries = [
    'What matters now', // the executive brief
    ...bodySections.map((sec) => sentenceCase(sec.heading)),
    'A practical agenda for the next 90 days',
    'What we would watch next',
  ];
  return (
    <Page size={[PAGE_W, PAGE_H]} style={s.page} wrap>
      <Text style={[s.eyebrow, { color: pal.primary }]}>IN THIS BRIEFING</Text>
      <Text style={{ fontFamily: 'Serif', fontWeight: 700, fontSize: 30, lineHeight: 1.1, color: INK, marginTop: 10, marginBottom: 30 }}>
        Contents
      </Text>
      <View style={{ width: CONTENT_W }}>
        {entries.map((c, i) => (
          <View key={i} wrap={false} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 13, borderBottomWidth: i === entries.length - 1 ? 0 : 0.75, borderBottomColor: LIGHT }}>
            <Text style={{ fontFamily: 'Serif', fontWeight: 700, fontSize: 19, color: pal.primary, width: 52 }}>
              {String(i + 1).padStart(2, '0')}
            </Text>
            <Text style={{ fontFamily: 'Serif', fontSize: 13.5, lineHeight: 1.35, color: INK, flex: 1, paddingTop: 2 }}>{c}</Text>
          </View>
        ))}
      </View>
      {/* Quiet brand band anchoring the lower page */}
      <View style={{ position: 'absolute', left: MARGIN, right: MARGIN, bottom: FOOTER_H + 26 }}>
        <View style={{ borderTopWidth: 2, borderTopColor: pal.primary, paddingTop: 10 }}>
          <Text style={{ fontFamily: 'Serif', fontStyle: 'italic', fontSize: 11, lineHeight: 1.5, color: GRAY, width: CONTENT_W * 0.8 }}>
            Prepared for {lead.personaName}, {lead.personaTitle} at {lead.organization} — {report.badge?.split('·')[1]?.trim() ?? ''}
          </Text>
        </View>
      </View>
      <Footer running={running} />
    </Page>
  );
}

/** Master: executive brief — one idea: the narrative and its three implications. */
function ExecBriefPage({
  lead,
  summary,
  running,
}: {
  lead: Lead;
  summary: ReportSection;
  running: string;
}) {
  const pal = usePal();
  const implications = nonEmpty(summary.bullets).slice(0, 3);
  return (
    <Page size={[PAGE_W, PAGE_H]} style={s.page} wrap>
      <Text style={[s.eyebrow, { color: pal.primary }]}>EXECUTIVE BRIEF</Text>
      <Text style={{ fontFamily: 'Serif', fontWeight: 700, fontSize: 23, lineHeight: 1.14, color: INK, marginTop: 8, marginBottom: 16, width: CONTENT_W * 0.9 }}>
        {sentenceCase(summary.heading)}
      </Text>

      <View style={{ flexDirection: 'row', width: CONTENT_W }}>
        {/* Narrative — left ~62% */}
        <View style={{ width: CONTENT_W * 0.6, paddingRight: 24 }}>
          {paragraphs(summary.body).map((p, i) => (
            <Text key={i} style={{ fontFamily: 'Sans', fontSize: 9.9, lineHeight: 1.55, marginBottom: 8 }}>
              {p}
            </Text>
          ))}
        </View>
        {/* Implications rail — right */}
        <View style={{ flex: 1, borderLeftWidth: 0.75, borderLeftColor: LIGHT, paddingLeft: 18 }}>
          <Text style={{ fontFamily: 'Serif', fontWeight: 700, fontSize: 11.5, color: INK, marginBottom: 10 }}>
            Three implications for a {lead.personaTitle}
          </Text>
          {implications.map((b, i) => (
            <View key={i} style={{ flexDirection: 'row', marginBottom: 10 }}>
              <Text style={{ fontFamily: 'Serif', fontWeight: 700, fontSize: 11, color: pal.primary, width: 15 }}>{i + 1}</Text>
              <Text style={{ fontFamily: 'Sans', fontSize: 8.5, lineHeight: 1.45, color: INK, flex: 1 }}>{cleanTitle(b)}</Text>
            </View>
          ))}
        </View>
      </View>

      {summary.quote && <QuoteBlock quote={summary.quote} />}
      <Footer running={running} />
    </Page>
  );
}

/** Master: narrative + exhibit — one body section, composed as a full page. */
function NarrativeExhibitPage({
  section,
  exhibitNo,
  hideQuote,
  running,
}: {
  section: ReportSection;
  exhibitNo: number;
  hideQuote: boolean;
  running: string;
}) {
  return (
    <Page size={[PAGE_W, PAGE_H]} style={s.page} wrap>
      <Text style={[s.headline, { marginBottom: 12, width: CONTENT_W * 0.92 }]}>{sentenceCase(section.heading)}</Text>
      <Prose text={section.body} />
      {section.stats && section.stats.length > 0 && <StatStrip stats={section.stats} />}
      {section.chart && <Exhibit chart={section.chart} exhibit={exhibitNo} />}
      {section.bullets && <BulletList bullets={section.bullets} />}
      {section.numberedItems?.map((n, i) => (
        <NumberedItem key={i} item={n} index={i} />
      ))}
      {section.subTopics && !isKeyQuestions(section) && (
        <View style={{ marginTop: 4 }}>
          {section.subTopics.map((t, i) => (
            <View key={i} wrap={false} style={{ flexDirection: 'row', marginBottom: 6, width: TEXT_W }}>
              <Text style={{ fontSize: 6, color: INK, marginTop: 3, marginRight: 6 }}>■</Text>
              <Text style={{ fontFamily: 'Sans', fontSize: 9.4, lineHeight: 1.4, flex: 1 }}>
                <Text style={{ fontWeight: 600 }}>{cleanTitle(t.title)} </Text>
                {t.body}
              </Text>
            </View>
          ))}
        </View>
      )}
      {section.quote && !hideQuote && <QuoteBlock quote={section.quote} />}
      <Footer running={running} />
    </Page>
  );
}

/** Master: split page — key questions callout left, the section's analysis right. */
function SplitQuestionsPage({
  section,
  running,
}: {
  section: ReportSection;
  running: string;
}) {
  const pal = usePal();
  const subTopics = section.subTopics ?? [];
  const label = /^key questions/i.test(section.kicker ?? '') ? section.kicker! : 'Key questions';
  const RIGHT_W = CONTENT_W * 0.55;
  return (
    <Page size={[PAGE_W, PAGE_H]} style={s.page} wrap>
      <Text style={[s.headline, { marginBottom: 14, width: CONTENT_W * 0.92 }]}>{sentenceCase(section.heading)}</Text>
      <View style={{ flexDirection: 'row', width: CONTENT_W }}>
        {/* Callout — left ~42% */}
        <View style={{ width: CONTENT_W * 0.42, marginRight: 16 }}>
          <View style={{ backgroundColor: pal.primary, paddingHorizontal: 14, paddingVertical: 7 }}>
            <Text style={{ fontFamily: 'Sans', fontWeight: 600, fontSize: 8.6, color: '#ffffff' }}>{sentenceCase(label)}</Text>
          </View>
          <View style={{ backgroundColor: PALE, paddingHorizontal: 14, paddingVertical: 12 }}>
            {subTopics.map((t, i) => (
              <View key={i} style={{ flexDirection: 'row', marginBottom: i === subTopics.length - 1 ? 0 : 9 }}>
                <Text style={{ fontFamily: 'Serif', fontWeight: 700, fontSize: 10.5, color: pal.primary, width: 15 }}>{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Sans', fontSize: 8.4, lineHeight: 1.42, color: INK }}>
                    <Text style={{ fontWeight: 600 }}>{cleanTitle(t.title)} </Text>
                    {t.body}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
        {/* Analysis — right */}
        <View style={{ width: RIGHT_W }}>
          {paragraphs(section.body).map((p, i) => (
            <Text key={i} style={{ fontFamily: 'Sans', fontSize: 9.4, lineHeight: 1.5, marginBottom: 7 }}>
              {p}
            </Text>
          ))}
          {section.stats && section.stats.length > 0 && <StatStrip stats={section.stats.slice(0, 2)} width={RIGHT_W} />}
          {section.quote && <QuoteBlock quote={section.quote} width={RIGHT_W} />}
        </View>
      </View>
      {section.bullets && <BulletList bullets={section.bullets} />}
      <Footer running={running} />
    </Page>
  );
}

/**
 * Master: exhibit-led page — one substantial analytical exhibit given room to
 * breathe (used when a split page's section also carries a chart, so the chart
 * never spills onto an accidental continuation page).
 */
function ExhibitLedPage({
  chart,
  exhibitNo,
  stats,
  running,
}: {
  chart: NonNullable<ReportSection['chart']>;
  exhibitNo: number;
  stats: ReportSection['stats'];
  running: string;
}) {
  return (
    <Page size={[PAGE_W, PAGE_H]} style={s.page} wrap>
      <View style={{ marginTop: 30 }}>
        <Exhibit chart={chart} exhibit={exhibitNo} large />
      </View>
      {stats && stats.length > 2 && <StatStrip stats={stats.slice(2)} />}
      <Footer running={running} />
    </Page>
  );
}

/**
 * Master: section opener — the reference's chapter-opener treatment: a giant
 * pale background word, an elegant serif headline (the dek), a restrained
 * quote, and a DISTINCT editorial photograph anchoring the lower page. The
 * cover image is never reused here; without an interior photo the page stays
 * purely typographic.
 */
function SectionOpenerPage({
  report,
  image,
  quote,
}: {
  report: Report;
  image: Buffer | null;
  quote: NonNullable<ReportSection['quote']> | null;
}) {
  const pal = usePal();
  const IMG_H = image ? PAGE_H * 0.46 : 0;
  return (
    <Page size={[PAGE_W, PAGE_H]} style={s.bare}>
      {/* Giant pale background word, cropped by the page edge — decorative only */}
      <Text
        style={{
          position: 'absolute',
          top: 34,
          left: MARGIN - 6,
          fontFamily: 'Serif',
          fontWeight: 700,
          fontSize: 118,
          color: tint(pal.primary, 0.07),
        }}
      >
        {backgroundWord(report)}
      </Text>

      <View style={{ paddingHorizontal: MARGIN, paddingTop: 150 }}>
        <View style={{ width: 30, height: 2.5, backgroundColor: pal.accent, marginBottom: 16 }} />
        <Text style={{ fontFamily: 'Serif', fontWeight: 700, fontSize: 27, lineHeight: 1.2, color: INK, width: CONTENT_W * 0.88 }}>
          {report.dek ?? sentenceCase(report.title)}
        </Text>
        {quote && (
          <View style={{ marginTop: 26, width: CONTENT_W * 0.8 }}>
            <Text style={{ fontFamily: 'Serif', fontStyle: 'italic', fontSize: 13.5, lineHeight: 1.45, color: '#3d434c' }}>
              “{quote.text.replace(/^["“]|["”]$/g, '')}”
            </Text>
            <Text style={{ fontFamily: 'Sans', fontSize: 8.6, color: GRAY, marginTop: 9 }}>
              <Text style={{ fontWeight: 600, color: INK }}>{quote.attribution}</Text>
              {quote.role ? `, ${quote.role}` : ''}
            </Text>
          </View>
        )}
      </View>

      {image && (
        <View style={{ position: 'absolute', bottom: 0, left: 0, width: PAGE_W, height: IMG_H, overflow: 'hidden' }}>
          <Image src={image} style={{ width: PAGE_W, height: IMG_H, objectFit: 'cover' }} />
          {report.imageCredit && (
            <Text style={{ position: 'absolute', bottom: 5, right: 8, fontFamily: 'Sans', fontSize: 5.5, color: 'rgba(255,255,255,0.7)' }}>
              Photo: {report.imageCredit}
            </Text>
          )}
        </View>
      )}
    </Page>
  );
}

type AgendaItem = NonNullable<ReportSection['numberedItems']>[number];

function AgendaRow({ item, index, last }: { item: AgendaItem; index: number; last: boolean }) {
  const pal = usePal();
  return (
    <View wrap={false} style={{ flexDirection: 'row', marginBottom: 13, width: CONTENT_W }}>
      <Text style={{ fontFamily: 'Serif', fontWeight: 700, fontSize: 16, color: pal.primary, width: 26 }}>{index + 1}</Text>
      <View style={{ flex: 1, borderBottomWidth: last ? 0 : 0.75, borderBottomColor: LIGHT, paddingBottom: 11 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
          <Text style={{ fontFamily: 'Sans', fontWeight: 700, fontSize: 10.3, color: INK, flex: 1, paddingRight: 8 }}>
            {cleanTitle(item.title)}
          </Text>
          {item.timing && (
            <View style={{ backgroundColor: tint(pal.primary, 0.09), paddingHorizontal: 7, paddingVertical: 2.5 }}>
              <Text style={{ fontFamily: 'Sans', fontWeight: 600, fontSize: 7, color: pal.primary }}>{item.timing}</Text>
            </View>
          )}
        </View>
        <Text style={{ fontFamily: 'Sans', fontSize: 9.2, lineHeight: 1.45, color: INK, marginBottom: 4 }}>{item.body}</Text>
        {item.firstStep && (
          <Text style={{ fontFamily: 'Sans', fontSize: 8.2, lineHeight: 1.4, color: GRAY }}>
            <Text style={{ fontWeight: 600, color: INK }}>First step  </Text>
            {item.firstStep}
          </Text>
        )}
        {item.kpi && (
          <Text style={{ fontFamily: 'Sans', fontSize: 8.2, lineHeight: 1.4, color: GRAY, marginTop: 2 }}>
            <Text style={{ fontWeight: 600, color: INK }}>Proof of progress  </Text>
            {item.kpi}
          </Text>
        )}
      </View>
    </View>
  );
}

/** Now → Next → Scale summary strip for the agenda's second page. */
function AgendaTimeline({ items }: { items: AgendaItem[] }) {
  const pal = usePal();
  const buckets: Array<{ label: string; match: RegExp }> = [
    { label: 'Now', match: /now/i },
    { label: 'Next', match: /next/i },
    { label: 'Scale', match: /scale/i },
  ];
  return (
    <View wrap={false} style={{ marginTop: 10, width: CONTENT_W, borderTopWidth: 2, borderTopColor: pal.primary, paddingTop: 10 }}>
      <Text style={{ fontFamily: 'Serif', fontWeight: 700, fontSize: 11.5, color: INK, marginBottom: 8 }}>The sequence at a glance</Text>
      <View style={{ flexDirection: 'row' }}>
        {buckets.map((bucket, bi) => {
          const inBucket = items
            .map((item, i) => ({ item, i }))
            .filter(({ item }) => bucket.match.test(item.timing ?? ''));
          return (
            <View key={bucket.label} style={{ flex: 1, paddingRight: 14, borderLeftWidth: bi === 0 ? 0 : 0.75, borderLeftColor: LIGHT, paddingLeft: bi === 0 ? 0 : 14 }}>
              <Text style={{ fontFamily: 'Sans', fontWeight: 700, fontSize: 8.5, color: pal.primary, marginBottom: 5 }}>
                {bucket.label.toUpperCase()}
              </Text>
              {inBucket.map(({ item, i }) => (
                <Text key={i} style={{ fontFamily: 'Sans', fontSize: 7.6, lineHeight: 1.4, color: GRAY, marginBottom: 3 }}>
                  {i + 1}. {cleanTitle(item.title)}
                </Text>
              ))}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Master: action agenda. Four or fewer items compose one page; five or six are
 * balanced across a two-page spread with a Now/Next/Scale summary — an item is
 * never orphaned onto a page of its own.
 */
function AgendaPages({ takeaways, running }: { takeaways: ReportSection; running: string }) {
  const pal = usePal();
  const items = takeaways.numberedItems ?? [];
  const twoPages = items.length > 4;
  const split = twoPages ? Math.ceil(items.length / 2) : items.length;
  const first = items.slice(0, split);
  const rest = items.slice(split);

  const header = (
    <>
      <Text style={[s.eyebrow, { color: pal.primary }]}>ACTION AGENDA</Text>
      <Text style={{ fontFamily: 'Serif', fontWeight: 700, fontSize: 20, lineHeight: 1.14, color: INK, marginTop: 8, marginBottom: 8, width: CONTENT_W * 0.92 }}>
        {sentenceCase(takeaways.heading)}
      </Text>
      {takeaways.body ? (
        <Text style={{ fontFamily: 'Sans', fontSize: 9.6, lineHeight: 1.5, marginBottom: 14, width: TEXT_W }}>{takeaways.body}</Text>
      ) : null}
    </>
  );

  // A slim phase bar fills the first page's lower area deliberately.
  const phaseBar = (
    <View wrap={false} style={{ position: 'absolute', left: MARGIN, right: MARGIN, bottom: FOOTER_H + 24 }}>
      <View style={{ flexDirection: 'row', borderTopWidth: 2, borderTopColor: pal.primary, paddingTop: 8 }}>
        {['Now (30 days)', 'Next (31–90 days)', 'Scale (6–12 months)'].map((phase, i) => {
          const count = items.filter((item) => (item.timing ?? '').toLowerCase().startsWith(phase.split(' ')[0].toLowerCase())).length;
          return (
            <View key={phase} style={{ flex: 1, paddingRight: 14, borderLeftWidth: i === 0 ? 0 : 0.75, borderLeftColor: LIGHT, paddingLeft: i === 0 ? 0 : 14 }}>
              <Text style={{ fontFamily: 'Serif', fontWeight: 700, fontSize: 15, color: pal.primary }}>{count}</Text>
              <Text style={{ fontFamily: 'Sans', fontWeight: 600, fontSize: 7.6, color: INK, marginTop: 2 }}>{phase}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );

  return (
    <>
      <Page size={[PAGE_W, PAGE_H]} style={s.page} wrap>
        {header}
        {first.map((n, i) => (
          <AgendaRow key={i} item={n} index={i} last={!twoPages && i === first.length - 1} />
        ))}
        {!twoPages && takeaways.quote && <QuoteBlock quote={takeaways.quote} />}
        {phaseBar}
        <Footer running={running} />
      </Page>
      {twoPages && (
        <Page size={[PAGE_W, PAGE_H]} style={s.page} wrap>
          {rest.map((n, i) => (
            <AgendaRow key={i} item={n} index={split + i} last={i === rest.length - 1} />
          ))}
          {/* Roadmap deliberately occupies the lower third */}
          <View wrap={false} style={{ position: 'absolute', left: MARGIN, right: MARGIN, bottom: FOOTER_H + 24 }}>
            <AgendaTimeline items={items} />
          </View>
          <Footer running={running} />
        </Page>
      )}
    </>
  );
}

/** Master: closing — ONE idea: the forward view (closing note + watch-next). */
function ClosingPage({ closing, running }: { closing: ReportSection; running: string }) {
  const pal = usePal();
  const watchNext = nonEmpty(closing.bullets).slice(0, 3);
  return (
    <Page size={[PAGE_W, PAGE_H]} style={s.page} wrap>
      <Text style={{ fontFamily: 'Serif', fontWeight: 700, fontSize: 19, lineHeight: 1.16, color: INK, marginBottom: 12, width: CONTENT_W * 0.85 }}>
        {sentenceCase(closing.heading)}
      </Text>
      {paragraphs(closing.body).map((p, i) => (
        <Text key={i} style={{ fontFamily: 'Sans', fontSize: 9.8, lineHeight: 1.55, marginBottom: 8, width: TEXT_W }}>
          {p}
        </Text>
      ))}
      {watchNext.length > 0 && (
        <View wrap={false} style={{ marginTop: 26, width: CONTENT_W }}>
          <Text style={{ fontFamily: 'Serif', fontWeight: 700, fontSize: 13.5, color: INK, marginBottom: 12 }}>What we would watch next</Text>
          <View style={{ flexDirection: 'row' }}>
            {watchNext.map((b, i) => (
              <View key={i} style={{ flex: 1, paddingRight: 18, borderTopWidth: 2, borderTopColor: pal.primary, paddingTop: 9 }}>
                <Text style={{ fontFamily: 'Serif', fontWeight: 700, fontSize: 13, color: pal.primary, marginBottom: 5 }}>{i + 1}</Text>
                <Text style={{ fontFamily: 'Sans', fontSize: 8.8, lineHeight: 1.5, color: INK }}>{cleanTitle(b)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
      <Footer running={running} />
    </Page>
  );
}

/**
 * Master: colophon — the final quiet page: methodology, sources, prepared
 * for/by. Serif sentence-case headings matching the body typography (no
 * letterspaced caps), generous whitespace, one functional zone at a time.
 */
function ColophonPage({
  report,
  lead,
  settings,
  closing,
  photo,
  companyLogo,
  running,
}: {
  report: Report;
  lead: Lead;
  settings: AppSettings;
  closing: ReportSection | null;
  photo: Buffer | null;
  companyLogo: Buffer | null;
  running: string;
}) {
  const pal = usePal();
  const colophonHeading = (label: string) => (
    <Text style={{ fontFamily: 'Serif', fontWeight: 700, fontSize: 12.5, color: INK, marginBottom: 7 }}>{label}</Text>
  );
  return (
    <Page size={[PAGE_W, PAGE_H]} style={s.page} wrap>
      <Text style={{ fontFamily: 'Serif', fontWeight: 700, fontSize: 19, lineHeight: 1.16, color: INK, marginBottom: 26 }}>
        About this briefing
      </Text>

      {closing?.methodology && (
        <View style={{ marginBottom: 22, width: TEXT_W }}>
          {colophonHeading('Methodology')}
          <Text style={{ fontFamily: 'Sans', fontSize: 9, lineHeight: 1.6, color: GRAY }}>{closing.methodology}</Text>
        </View>
      )}

      {report.publications.length > 0 && (
        <View style={{ marginBottom: 22, width: TEXT_W }}>
          {colophonHeading('Selected sources')}
          <Text style={{ fontFamily: 'Sans', fontSize: 9, lineHeight: 1.7, color: GRAY }}>
            {report.publications.slice(0, 8).join('  ·  ')}
          </Text>
        </View>
      )}

      {/* Prepared for / prepared by — anchored low, generous air */}
      <View style={{ position: 'absolute', left: MARGIN, right: MARGIN, bottom: FOOTER_H + 40 }}>
        <View style={{ flexDirection: 'row', borderTopWidth: 2, borderTopColor: pal.primary, paddingTop: 20 }}>
          <View style={{ flex: 1, paddingRight: 24 }}>
            {colophonHeading('Prepared for')}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {photo ? (
                <View style={{ width: 34, height: 34, borderRadius: 17, overflow: 'hidden', marginRight: 10 }}>
                  <Image src={photo} style={{ width: 34, height: 34, objectFit: 'cover' }} />
                </View>
              ) : (
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: tint(pal.primary, 0.1), alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                  <Text style={{ fontFamily: 'Serif', fontWeight: 700, fontSize: 12, color: pal.primary }}>{initialsOf(lead.personaName)}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Sans', fontWeight: 700, fontSize: 10, color: INK }}>{lead.personaName}</Text>
                <Text style={{ fontFamily: 'Sans', fontSize: 8.6, color: GRAY, marginTop: 1 }}>
                  {lead.personaTitle}, {lead.organization}
                </Text>
              </View>
              {companyLogo && <Image src={companyLogo} style={{ width: 44, height: 20, objectFit: 'contain', marginLeft: 8 }} />}
            </View>
          </View>
          <View style={{ flex: 1, borderLeftWidth: 0.75, borderLeftColor: LIGHT, paddingLeft: 24 }}>
            {colophonHeading('Prepared by')}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ marginRight: 10 }}>
                <SenderMark settings={settings} height={20} />
              </View>
              <View style={{ flex: 1 }}>
                {settings.logoDataUrl && (
                  <Text style={{ fontFamily: 'Sans', fontWeight: 700, fontSize: 10, color: INK }}>{settings.companyName}</Text>
                )}
                <Text style={{ fontFamily: 'Sans', fontSize: 8.6, color: GRAY, marginTop: 1 }}>{settings.defaultRep}</Text>
              </View>
            </View>
            {settings.about && (
              <Text style={{ fontFamily: 'Sans', fontSize: 8.2, lineHeight: 1.55, color: GRAY, marginTop: 8 }}>{settings.about}</Text>
            )}
          </View>
        </View>
      </View>
      <Footer running={running} />
    </Page>
  );
}

/* ------------------------------------------------------------------ entry */

/**
 * Streams rather than buffers: Vercel caps a buffered function response at
 * 4.5MB (a photo cover can exceed that), while streamed responses have no
 * size limit and start reaching the browser immediately.
 */
export async function renderReportPdf(report: Report, lead: Lead, settings: AppSettings): Promise<NodeJS.ReadableStream> {
  const [cover, sectionImage, photo, companyLogo] = await Promise.all([
    storedImageBuffer(report.coverImageUrl),
    storedImageBuffer(report.sectionImageUrl),
    fetchImageBuffer(lead.photoUrl),
    fetchImageBuffer(lead.logoUrl),
  ]);
  const pal = buildPalette({ primary: settings.brandPrimary, secondary: settings.brandSecondary });
  const { summary, body, takeaways, closing } = splitByRole(report);
  const running = runningTitle(report, lead);

  // ---- page plan -----------------------------------------------------------
  // The strongest quote is showcased on the section opener (and suppressed in
  // its home section so it never appears twice). The opener only ever uses the
  // DISTINCT interior photograph — the cover image is never repeated.
  const quoteSection = body.find((sec) => sec.quote) ?? null;
  const openerQuote = quoteSection?.quote ?? summary?.quote ?? null;
  const showOpener = Boolean(sectionImage || openerQuote || report.dek);
  // The opener sits mid-document: after the second body section (or after the
  // first when there are fewer).
  const openerAfter = Math.min(1, Math.max(0, body.length - 1));

  let exhibitNo = 0;
  const bodyPages: React.ReactElement[] = [];
  body.forEach((sec, idx) => {
    const n = sec.chart ? ++exhibitNo : exhibitNo;
    if (isKeyQuestions(sec) && (sec.subTopics?.length ?? 0) > 0) {
      bodyPages.push(<SplitQuestionsPage key={sec.key} section={sec} running={running} />);
      // The split composition has no room for a chart — showcase it on its own
      // exhibit-led page instead of letting it spill.
      if (sec.chart) {
        bodyPages.push(<ExhibitLedPage key={`${sec.key}-exhibit`} chart={sec.chart} exhibitNo={n} stats={sec.stats} running={running} />);
      }
    } else {
      bodyPages.push(
        <NarrativeExhibitPage
          key={sec.key}
          section={sec}
          exhibitNo={n}
          hideQuote={showOpener && sec === quoteSection}
          running={running}
        />,
      );
    }
    if (showOpener && idx === openerAfter) {
      bodyPages.push(<SectionOpenerPage key="section-opener" report={report} image={sectionImage} quote={openerQuote} />);
    }
  });

  const doc = (
    <PaletteCtx.Provider value={pal}>
      <Document
        title={report.title}
        author={settings.companyName}
        subject={`${report.focus} briefing for ${lead.organization}`}
        creator="Relationship Engine"
      >
        <CoverPage report={report} lead={lead} settings={settings} cover={cover} companyLogo={companyLogo} />
        <ContentsPage report={report} lead={lead} bodySections={body} running={running} />
        {summary && <ExecBriefPage lead={lead} summary={summary} running={running} />}
        {bodyPages}
        {takeaways && <AgendaPages takeaways={takeaways} running={running} />}
        {closing && <ClosingPage closing={closing} running={running} />}
        <ColophonPage report={report} lead={lead} settings={settings} closing={closing} photo={photo} companyLogo={companyLogo} running={running} />
      </Document>
    </PaletteCtx.Provider>
  );
  return await renderToStream(doc);
}
