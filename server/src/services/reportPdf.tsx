/**
 * Print-editorial PDF template for personalized industry reports.
 *
 * Reproduces the design system of the HFMA "Revenue Cycle of the Future" reference
 * (server/sample_report): 585×783pt trim, full-bleed cover, feature opener,
 * two-column editorial grid, keep-together quote/chart/number blocks, recurring
 * footer with page numbers. All text is live vector type with embedded fonts.
 *
 * Page order (sections dispatch by sectionRole, so legacy reports still render):
 *   Cover → Executive summary → Article (body sections) → Actionable takeaways → Closing
 *
 * The palette derives from the sender's brand colors (see services/palette.ts;
 * defaults reproduce the original Honest Taskers navy/gold exactly) and flows
 * through React context so concurrent renders can't leak colors into each other.
 *
 * Type system (licensed-free equivalents of the reference faces):
 *   Dharma Gothic E  -> Bebas Neue   (display/condensed headlines)
 *   Dharma Gothic E Italic -> Oswald + skew (decks, chart questions, quotes)
 *   Exchange         -> Source Serif 4 (article body)
 *   Mallory          -> Source Sans 3  (bylines, labels, captions, footer)
 */
import React, { createContext, useContext } from 'react';
import { Document, Page, View, Text, Image, Font, StyleSheet, Svg, Rect, Circle, Path, Defs, LinearGradient, Stop, renderToStream } from '@react-pdf/renderer';
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

Font.register({ family: 'Display', src: path.join(FONTS, 'BebasNeue-Regular.ttf') });
Font.register({
  family: 'Deck',
  fonts: [
    { src: path.join(FONTS, 'Oswald-Medium.ttf'), fontWeight: 500 },
    { src: path.join(FONTS, 'Oswald-Bold.ttf'), fontWeight: 700 },
  ],
});
Font.register({
  family: 'Body',
  fonts: [
    { src: path.join(FONTS, 'SourceSerif4-Regular.ttf') },
    { src: path.join(FONTS, 'SourceSerif4-Bold.ttf'), fontWeight: 700 },
    { src: path.join(FONTS, 'SourceSerif4-Italic.ttf'), fontStyle: 'italic' },
  ],
});
Font.register({
  family: 'Meta',
  fonts: [
    { src: path.join(FONTS, 'SourceSans3-Regular.ttf') },
    { src: path.join(FONTS, 'SourceSans3-SemiBold.ttf'), fontWeight: 600 },
    { src: path.join(FONTS, 'SourceSans3-Bold.ttf'), fontWeight: 700 },
  ],
});
// Editorial type: no mid-word hyphen breaks.
Font.registerHyphenationCallback((word) => [word]);

/* ------------------------------------------------------------------ tokens */

const PAGE_W = 585;
const PAGE_H = 783;
const MARGIN = 42;
const CONTENT_W = PAGE_W - MARGIN * 2; // 501
const COL_W = (CONTENT_W - 20) / 2; // two-column grid, 20pt gutter
const FOOTER_H = 30;

/** Sender palette flows via context; the default is the original HT scheme. */
const PaletteCtx = createContext<Palette>(buildPalette());
const usePal = () => useContext(PaletteCtx);

const INK = '#1c1c1c';

const s = StyleSheet.create({
  page: { fontFamily: 'Body', fontSize: 8.8, color: INK, backgroundColor: '#ffffff' },
  /**
   * Flowing article pages: bottom padding must live on the Page (react-pdf honors
   * Page padding at every page break; a wrapping View's own paddingBottom is only
   * applied at the end of the element, letting text collide with the fixed footer).
   */
  flowPage: { fontFamily: 'Body', fontSize: 8.8, color: INK, backgroundColor: '#ffffff', paddingBottom: FOOTER_H + 20 },
  content: { paddingHorizontal: MARGIN, paddingTop: 34 },
  body: { fontSize: 8.8, lineHeight: 1.5, textAlign: 'justify' },
  twoCol: { flexDirection: 'row', gap: 20 },
  col: { width: COL_W },
  kicker: {
    fontFamily: 'Meta',
    fontWeight: 700,
    fontSize: 8,
    letterSpacing: 1.6,
    color: '#ffffff',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: FOOTER_H,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: MARGIN,
  },
});

/* --------------------------------------------------------------- utilities */

/** Split body text into paragraph chunks, then balance each chunk over two columns. */
function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}|\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function sentences(text: string): string[] {
  return text.match(/[^.!?]+[.!?]+["”']?\s*|[^.!?]+$/g)?.map((x) => x.trim()) ?? [text];
}

/** Balance a block of prose into two columns at a sentence boundary. */
function balanceColumns(text: string): [string, string] {
  const sents = sentences(text);
  const total = text.length;
  let acc = 0;
  let split = sents.length;
  for (let i = 0; i < sents.length; i++) {
    acc += sents[i].length;
    if (acc >= total / 2) {
      split = i + 1;
      break;
    }
  }
  return [sents.slice(0, split).join(' '), sents.slice(split).join(' ')];
}

/** Chunk long prose so each two-column row stays comfortably within a page. */
function chunkProse(text: string, maxChars = 1500): string[] {
  const paras = paragraphs(text);
  const chunks: string[] = [];
  let current = '';
  for (const p of paras) {
    if ((current + ' ' + p).length > maxChars && current) {
      chunks.push(current.trim());
      current = p;
    } else {
      current = current ? `${current}\n${p}` : p;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/** Sections grouped by rendering role (legacy keys resolve via sectionRole). */
function splitByRole(report: Report) {
  const summary = report.sections.find((x) => sectionRole(x.key) === 'exec-summary') ?? null;
  const body = report.sections.filter((x) => sectionRole(x.key) === 'body');
  const takeaways = report.sections.find((x) => sectionRole(x.key) === 'takeaways') ?? null;
  const closing = report.sections.find((x) => sectionRole(x.key) === 'closing') ?? null;
  return { summary, body, takeaways, closing };
}

/* ------------------------------------------------------- graphic language */

/** Radial burst rays (the reference cover/interior sunburst). */
function Burst({ w, h, color, opacity = 0.35, cx, cy }: { w: number; h: number; color: string; opacity?: number; cx?: number; cy?: number }) {
  const centerX = cx ?? w / 2;
  const centerY = cy ?? h * 0.55;
  const rays: string[] = [];
  const R = Math.max(w, h) * 1.4;
  for (let i = 0; i < 36; i++) {
    const a1 = (i * 10 * Math.PI) / 180;
    const a2 = ((i * 10 + 4.5) * Math.PI) / 180;
    rays.push(
      `M${centerX},${centerY} L${centerX + R * Math.cos(a1)},${centerY + R * Math.sin(a1)} L${centerX + R * Math.cos(a2)},${centerY + R * Math.sin(a2)} Z`,
    );
  }
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: 'absolute', top: 0, left: 0 }}>
      {rays.map((d, i) => (
        <Path key={i} d={d} fill={color} opacity={opacity} />
      ))}
    </Svg>
  );
}

/** Halftone dot texture band (print texture on accent fields). */
function Halftone({ w, h, color, dotMax = 2.2, opacity = 0.5 }: { w: number; h: number; color: string; dotMax?: number; opacity?: number }) {
  const dots: Array<{ x: number; y: number; r: number }> = [];
  const step = 9;
  for (let y = step / 2; y < h; y += step) {
    for (let x = step / 2; x < w; x += step) {
      const r = dotMax * (0.25 + 0.75 * (y / h));
      dots.push({ x, y, r });
    }
  }
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: 'absolute', top: 0, left: 0 }}>
      {dots.map((d, i) => (
        <Circle key={i} cx={d.x} cy={d.y} r={d.r} fill={color} opacity={opacity} />
      ))}
    </Svg>
  );
}

/** Load the report's cover illustration from the database (images are stored as BLOBs). */
async function coverBuffer(report: Report): Promise<Buffer | null> {
  if (!report.coverImageUrl) return null;
  const image = await getImage(path.basename(report.coverImageUrl));
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

function KickerPill({ label, bg }: { label: string; bg?: string }) {
  const pal = usePal();
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: bg ?? pal.primary, paddingHorizontal: 8, paddingVertical: 3, transform: 'skewX(-8deg)', marginBottom: 8 }}>
      <Text style={[s.kicker, { transform: 'skewX(8deg)' }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

/**
 * Sender logo mark: the uploaded brand logo when available, otherwise an
 * initials glyph square in the brand colors (never a hard-coded wordmark).
 */
function SenderMark({ settings, size, onDark = false }: { settings: AppSettings; size: number; onDark?: boolean }) {
  const pal = usePal();
  if (settings.logoDataUrl) {
    return (
      <View style={{ width: size, height: size, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', padding: 2 }}>
        <Image src={settings.logoDataUrl} style={{ width: size - 4, height: size - 4, objectFit: 'contain' }} />
      </View>
    );
  }
  return (
    <View style={{ width: size, height: size, backgroundColor: onDark ? pal.accent : pal.primary, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: 'Display', fontSize: size * 0.57, color: onDark ? pal.primaryDeep : pal.accent, marginTop: 2 }}>
        {initialsOf(settings.companyName)}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------- components */

function Footer({ settings }: { settings: AppSettings }) {
  const pal = usePal();
  return (
    <View style={[s.footer, { backgroundColor: pal.primary }]} fixed>
      <Text
        style={{ fontFamily: 'Meta', fontWeight: 600, fontSize: 7.5, color: '#ffffff' }}
        // The cover is page 1 but carries no footer; numbering starts after it.
        render={({ pageNumber }) => `${pageNumber - 1}`}
      />
      <View style={{ flex: 1 }} />
      <View style={{ width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.5)', marginRight: 10 }} />
      <Text style={{ fontFamily: 'Display', fontSize: 11, color: '#ffffff', letterSpacing: 0.5 }}>
        {settings.companyName.toUpperCase()}
      </Text>
    </View>
  );
}

function EditionBadge({ badge }: { badge: string }) {
  const pal = usePal();
  return (
    <View
      style={{
        position: 'absolute',
        top: 26,
        left: 26,
        width: 74,
        height: 74,
        borderRadius: 37,
        backgroundColor: pal.primary,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {badge.split('·').map((part, i) => (
        <Text key={i} style={{ fontFamily: 'Meta', fontWeight: 700, fontSize: i === 0 ? 8 : 7, color: i === 0 ? '#ffffff' : pal.accent, letterSpacing: 0.8, textAlign: 'center' }}>
          {part.trim()}
        </Text>
      ))}
    </View>
  );
}

/** Company logo chip, top-right of the cover (recipient's organization). */
function LogoChip({ logo }: { logo: Buffer | null }) {
  if (!logo) return null;
  return (
    <View style={{ position: 'absolute', top: 26, right: 26, backgroundColor: '#ffffff', padding: 6, borderRadius: 3 }}>
      <Image src={logo} style={{ width: 54, height: 30, objectFit: 'contain' }} />
    </View>
  );
}

function CoverPage({
  report,
  lead,
  settings,
  cover,
  photo,
  companyLogo,
}: {
  report: Report;
  lead: Lead;
  settings: AppSettings;
  cover: Buffer | null;
  photo: Buffer | null;
  companyLogo: Buffer | null;
}) {
  const pal = usePal();
  const badge = report.badge ?? `${settings.companyName.toUpperCase()} · INDUSTRY REPORT`;
  const titleSize = report.title.length > 26 ? 64 : 78;

  return (
    <Page size={[PAGE_W, PAGE_H]} style={s.page}>
      {/* Full-bleed ground */}
      <View style={{ position: 'absolute', top: 0, left: 0, width: PAGE_W, height: PAGE_H, backgroundColor: pal.primaryDeep }}>
        {photo ? (
          // Photo variant: recipient portrait fills the right side, duotone overlay keeps it on-brand.
          <>
            <Burst w={PAGE_W} h={PAGE_H} color={pal.primary} opacity={0.55} cx={PAGE_W * 0.2} cy={PAGE_H * 0.35} />
            <Halftone w={PAGE_W} h={PAGE_H} color={pal.accent} dotMax={1.6} opacity={0.1} />
            <View style={{ position: 'absolute', top: 0, right: 0, width: PAGE_W * 0.48, height: PAGE_H * 0.72, overflow: 'hidden' }}>
              <Image src={photo} style={{ width: PAGE_W * 0.48, height: PAGE_H * 0.72, objectFit: 'cover' }} />
              <Svg width={PAGE_W * 0.48} height={PAGE_H * 0.72} viewBox={`0 0 ${PAGE_W * 0.48} ${PAGE_H * 0.72}`} style={{ position: 'absolute', top: 0, left: 0 }}>
                <Rect x={0} y={0} width={PAGE_W * 0.48} height={PAGE_H * 0.72} fill={pal.primaryDeep} opacity={0.22} />
              </Svg>
              <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 6, backgroundColor: pal.accent }} />
            </View>
          </>
        ) : cover ? (
          <Image src={cover} style={{ width: PAGE_W, height: PAGE_H, objectFit: 'cover' }} />
        ) : (
          <>
            <View style={{ position: 'absolute', top: 0, left: 0, width: PAGE_W, height: PAGE_H, backgroundColor: pal.accent }} />
            <Burst w={PAGE_W} h={PAGE_H} color={pal.primaryDeep} opacity={0.85} cy={PAGE_H * 0.45} />
            <Halftone w={PAGE_W} h={PAGE_H} color={pal.accentDeep} dotMax={2} opacity={0.35} />
          </>
        )}
        {/* dark lower gradient for the title zone */}
        <Svg width={PAGE_W} height={PAGE_H} viewBox={`0 0 ${PAGE_W} ${PAGE_H}`} style={{ position: 'absolute', top: 0, left: 0 }}>
          <Defs>
            <LinearGradient id="coverShade" x1="0" y1="0.35" x2="0" y2="1">
              <Stop offset="0" stopColor="#000000" stopOpacity={0} />
              <Stop offset="0.62" stopColor="#0b1226" stopOpacity={0.72} />
              <Stop offset="1" stopColor="#0b1226" stopOpacity={0.96} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={PAGE_W} height={PAGE_H} fill="url(#coverShade)" />
        </Svg>
      </View>

      <EditionBadge badge={badge} />
      <LogoChip logo={companyLogo} />

      {/* Prominent recipient block + title, lower third */}
      <View style={{ position: 'absolute', left: MARGIN, right: MARGIN, bottom: 64 }}>
        <View style={{ width: 44, height: 4, backgroundColor: pal.accent, marginBottom: 8 }} />
        <Text style={{ fontFamily: 'Meta', fontWeight: 700, fontSize: 8.5, color: pal.accent, letterSpacing: 1.8 }}>
          PREPARED FOR
        </Text>
        <Text style={{ fontFamily: 'Display', fontSize: 27, color: '#ffffff', marginTop: 2, marginBottom: 2 }}>
          {lead.personaName.toUpperCase()}
        </Text>
        <Text style={{ fontFamily: 'Meta', fontWeight: 600, fontSize: 9.5, color: 'rgba(255,255,255,0.85)', marginBottom: 14 }}>
          {lead.personaTitle} · {lead.organization}
        </Text>
        <Text style={{ fontFamily: 'Display', fontSize: titleSize, lineHeight: 0.92, color: '#ffffff' }}>{report.title.toUpperCase()}</Text>
      </View>
      {/* Support/metadata bar along the bottom */}
      <View style={{ position: 'absolute', left: MARGIN, right: MARGIN, bottom: 26, flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ fontFamily: 'Meta', fontWeight: 600, fontSize: 8, color: 'rgba(255,255,255,0.75)' }}>
          A personalized industry briefing
        </Text>
        <View style={{ flex: 1 }} />
        <Text style={{ fontFamily: 'Display', fontSize: 13, color: '#ffffff', letterSpacing: 0.5 }}>{settings.companyName.toUpperCase()}</Text>
      </View>
    </Page>
  );
}

function PullQuote({ quote }: { quote: NonNullable<ReportSection['quote']> }) {
  const pal = usePal();
  return (
    <View wrap={false} style={{ backgroundColor: pal.grey, padding: 20, marginVertical: 12 }}>
      <Text style={{ fontFamily: 'Display', fontSize: 34, color: pal.primary, lineHeight: 0.6, marginBottom: 8 }}>“</Text>
      <View style={{ transform: 'skewX(-6deg)' }}>
        <Text style={{ fontFamily: 'Deck', fontWeight: 700, fontSize: 14.5, lineHeight: 1.25, color: pal.ink }}>
          {quote.text.replace(/^["“]|["”]$/g, '')}”
        </Text>
      </View>
      <Text style={{ fontFamily: 'Meta', fontSize: 8, color: pal.greyText, marginTop: 10 }}>
        <Text style={{ fontWeight: 700, color: pal.ink }}>{quote.attribution}</Text>
        {quote.role ? `, ${quote.role}` : ''}
      </Text>
    </View>
  );
}

function SurveyChart({ chart, kicker, flip }: { chart: NonNullable<ReportSection['chart']>; kicker?: string | null; flip: boolean }) {
  const pal = usePal();
  const max = Math.max(...chart.data.map((d) => d.value), 1);
  const FIELD_W = CONTENT_W;
  const rowH = 30;
  const fieldH = 118 + chart.data.length * rowH + (chart.source ? 20 : 0);
  return (
    <View wrap={false} style={{ marginVertical: 14, width: FIELD_W, height: fieldH, backgroundColor: pal.accent, overflow: 'hidden' }}>
      <Halftone w={FIELD_W} h={fieldH} color={pal.accentDeep} dotMax={2.4} opacity={0.45} />
      <Burst w={FIELD_W} h={fieldH} color={pal.cream} opacity={0.18} cx={flip ? FIELD_W * 0.12 : FIELD_W * 0.88} cy={fieldH * 0.1} />
      <View style={{ padding: 20 }}>
        <KickerPill label={kicker ?? 'SURVEY QUESTION'} />
        <View style={{ transform: 'skewX(-6deg)', marginBottom: 14, width: FIELD_W * 0.8 }}>
          <Text style={{ fontFamily: 'Deck', fontWeight: 700, fontSize: 15, lineHeight: 1.15, color: pal.primary }}>{chart.question}</Text>
        </View>
        {chart.data.map((d) => (
          <View key={d.label} style={{ flexDirection: 'row', alignItems: 'center', height: rowH }}>
            <Text
              style={{
                width: 108,
                paddingRight: 8,
                textAlign: 'right',
                fontFamily: 'Meta',
                fontWeight: 700,
                fontSize: 6.8,
                letterSpacing: 0.6,
                color: pal.primaryDeep,
                textTransform: 'uppercase',
              }}
            >
              {d.label.toUpperCase()}
            </Text>
            <View style={{ width: 2, height: rowH - 6, backgroundColor: pal.primaryDeep }} />
            <View style={{ width: Math.max(8, (d.value / max) * (FIELD_W - 240)), height: rowH - 10, backgroundColor: pal.primary }} />
            <Text style={{ fontFamily: 'Display', fontSize: 19, color: pal.primaryDeep, marginLeft: 7 }}>
              {d.value}
              {d.suffix ?? ''}
            </Text>
          </View>
        ))}
        {chart.source && (
          <Text style={{ fontFamily: 'Meta', fontSize: 6.5, color: pal.primaryDeep, marginTop: 10 }}>Source: {chart.source}</Text>
        )}
      </View>
    </View>
  );
}

function NumberedItem({ item, index }: { item: { title: string; body: string }; index: number }) {
  const pal = usePal();
  return (
    <View wrap={false} style={{ flexDirection: 'row', marginBottom: 10 }}>
      <View style={{ width: 30, height: 30, backgroundColor: pal.primary, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
        <Text style={{ fontFamily: 'Display', fontSize: 21, color: pal.accent, marginTop: 2 }}>{index + 1}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.body}>
          <Text style={{ fontFamily: 'Body', fontWeight: 700 }}>{cleanTitle(item.title)} </Text>
          {item.body}
        </Text>
      </View>
    </View>
  );
}

/** Larger numbered block used on the takeaways and closing pages. */
function BigNumberedItem({ item, index }: { item: { title: string; body: string }; index: number }) {
  const pal = usePal();
  return (
    <View wrap={false} style={{ flexDirection: 'row', marginBottom: 14 }}>
      <View style={{ width: 34, height: 34, backgroundColor: pal.accent, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
        <Text style={{ fontFamily: 'Display', fontSize: 24, color: pal.primaryDeep, marginTop: 2 }}>{index + 1}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'Meta', fontWeight: 700, fontSize: 9.5, marginBottom: 2 }}>{cleanTitle(item.title).toUpperCase()}</Text>
        <Text style={s.body}>{item.body}</Text>
      </View>
    </View>
  );
}

function SubTopic({ item }: { item: { title: string; body: string } }) {
  const pal = usePal();
  return (
    <View wrap={false} style={{ flexDirection: 'row', marginBottom: 7 }}>
      <Text style={{ fontSize: 6.5, color: pal.ink, marginTop: 2, marginRight: 5 }}>■</Text>
      <Text style={[s.body, { flex: 1 }]}>
        <Text style={{ fontWeight: 700 }}>{cleanTitle(item.title)} </Text>
        {item.body}
      </Text>
    </View>
  );
}

function TwoColProse({ text }: { text: string }) {
  return (
    <>
      {chunkProse(text).map((chunk, i) => {
        const [left, right] = balanceColumns(chunk);
        return (
          <View key={i} wrap={false} style={[s.twoCol, { marginBottom: 8 }]}>
            <Text style={[s.body, s.col]}>{left}</Text>
            <Text style={[s.body, s.col]}>{right}</Text>
          </View>
        );
      })}
    </>
  );
}

function SectionHeading({ section, level }: { section: ReportSection; level: 'feature' | 'section' }) {
  const pal = usePal();
  return (
    // minPresenceAhead: break to the next page unless enough room remains below
    // for the heading plus a few lines of its section — kills orphaned headings.
    <View wrap={false} minPresenceAhead={80} style={{ marginBottom: 8, marginTop: level === 'section' ? 14 : 0 }}>
      {section.kicker && !section.chart && <KickerPill label={section.kicker} />}
      <Text style={{ fontFamily: 'Display', fontSize: level === 'feature' ? 42 : 24, lineHeight: 0.95, color: pal.primary }}>
        {section.heading.toUpperCase()}
      </Text>
    </View>
  );
}

function GoldPanelList({ heading, bullets, flip }: { heading: string; bullets: string[]; flip: boolean }) {
  const pal = usePal();
  const PANEL_W = COL_W + 30;
  return (
    <View wrap={false} style={{ flexDirection: flip ? 'row-reverse' : 'row', gap: 16, marginVertical: 12 }}>
      <View style={{ width: PANEL_W, backgroundColor: pal.accent, padding: 16, overflow: 'hidden' }}>
        <Halftone w={PANEL_W} h={400} color={pal.accentDeep} dotMax={2} opacity={0.4} />
        <Text style={{ fontFamily: 'Display', fontSize: 18, color: pal.primaryDeep, marginBottom: 8 }}>{heading.toUpperCase()}</Text>
        {bullets.map((b, i) => (
          <View key={i} style={{ flexDirection: 'row', marginBottom: 5 }}>
            <Text style={{ fontSize: 6, color: pal.primaryDeep, marginTop: 2, marginRight: 5 }}>■</Text>
            <Text style={{ fontFamily: 'Meta', fontWeight: 600, fontSize: 8.5, lineHeight: 1.35, color: pal.primaryDeep, flex: 1 }}>{cleanTitle(b)}</Text>
          </View>
        ))}
      </View>
      <View style={{ flex: 1 }} />
    </View>
  );
}

/* ----------------------------------------------------------------- pages */

/** Page 2: standalone executive summary with an "IN THIS REPORT" panel. */
function ExecutiveSummaryPage({ report, settings, summary }: { report: Report; settings: AppSettings; summary: ReportSection }) {
  const pal = usePal();
  return (
    <Page size={[PAGE_W, PAGE_H]} style={s.flowPage} wrap>
      <View style={{ width: PAGE_W, height: 110, backgroundColor: pal.cream, overflow: 'hidden', justifyContent: 'center', paddingHorizontal: MARGIN }}>
        <Burst w={PAGE_W} h={110} color={pal.accent} opacity={0.35} cy={125} />
        <Halftone w={PAGE_W} h={110} color={pal.accentDeep} dotMax={1.6} opacity={0.2} />
        <Text style={{ fontFamily: 'Deck', fontWeight: 700, fontSize: 11, letterSpacing: 4, color: pal.primary }}>EXECUTIVE SUMMARY</Text>
        <Text style={{ fontFamily: 'Display', fontSize: 26, color: pal.ink, marginTop: 3 }}>{report.title.toUpperCase()}</Text>
      </View>
      <View style={s.content}>
        <Text style={{ fontFamily: 'Display', fontSize: 30, lineHeight: 0.98, color: pal.primary, marginBottom: 10, width: CONTENT_W * 0.95 }}>
          {summary.heading.toUpperCase()}
        </Text>
        {report.dek && (
          <View style={{ transform: 'skewX(-6deg)', marginBottom: 12, width: CONTENT_W * 0.92 }}>
            <Text style={{ fontFamily: 'Deck', fontWeight: 500, fontSize: 12.5, lineHeight: 1.3, color: pal.primary }}>{report.dek}</Text>
          </View>
        )}
        {/* Larger single-column serif for executive reading */}
        {paragraphs(summary.body).map((p, i) => (
          <Text key={i} style={{ fontSize: 10.2, lineHeight: 1.65, marginBottom: 8, width: CONTENT_W * 0.94 }}>
            {p}
          </Text>
        ))}
        {summary.quote && <PullQuote quote={summary.quote} />}
        {summary.bullets && summary.bullets.length > 0 && (
          <View wrap={false} style={{ backgroundColor: pal.accent, padding: 18, marginTop: 14, overflow: 'hidden' }}>
            <Halftone w={CONTENT_W} h={200} color={pal.accentDeep} dotMax={2} opacity={0.35} />
            <Text style={{ fontFamily: 'Display', fontSize: 18, color: pal.primaryDeep, marginBottom: 8 }}>IN THIS REPORT</Text>
            {summary.bullets.map((b, i) => (
              <View key={i} style={{ flexDirection: 'row', marginBottom: 5 }}>
                <Text style={{ fontFamily: 'Display', fontSize: 12, color: pal.primaryDeep, marginRight: 8 }}>{String(i + 1).padStart(2, '0')}</Text>
                <Text style={{ fontFamily: 'Meta', fontWeight: 600, fontSize: 9, lineHeight: 1.35, color: pal.primaryDeep, flex: 1 }}>{cleanTitle(b)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      <Footer settings={settings} />
    </Page>
  );
}

function OpenerAndArticle({ report, lead, settings, cover, bodySections }: { report: Report; lead: Lead; settings: AppSettings; cover: Buffer | null; bodySections: ReportSection[] }) {
  const pal = usePal();
  const [openerSection, ...interior] = bodySections;
  const img = cover;
  const BAND_H = 240;
  let accentFlip = false;

  if (!openerSection) return null;

  return (
    <Page size={[PAGE_W, PAGE_H]} style={s.flowPage} wrap>
      {/* Feature opener band: image + layered quote (reference page 2) */}
      <View style={{ width: PAGE_W, height: BAND_H, backgroundColor: pal.primaryDeep, overflow: 'hidden' }}>
        {img ? (
          <Image src={img} style={{ position: 'absolute', top: -140, left: 0, width: PAGE_W, height: PAGE_H, objectFit: 'cover', opacity: 0.9 }} />
        ) : (
          <>
            <Burst w={PAGE_W} h={BAND_H} color={pal.primary} opacity={0.7} cy={BAND_H * 0.4} />
            <Halftone w={PAGE_W} h={BAND_H} color={pal.accent} dotMax={1.8} opacity={0.25} />
          </>
        )}
        {openerSection?.quote && (
          <View style={{ position: 'absolute', right: 28, top: 28, width: 240, backgroundColor: 'rgba(10,16,34,0.55)', padding: 14 }}>
            <Text style={{ fontFamily: 'Display', fontSize: 26, color: '#ffffff', lineHeight: 0.6, marginBottom: 6 }}>“</Text>
            <View style={{ transform: 'skewX(-6deg)' }}>
              <Text style={{ fontFamily: 'Deck', fontWeight: 700, fontSize: 11, lineHeight: 1.25, color: '#ffffff' }}>
                {openerSection.quote.text.replace(/^["“]|["”]$/g, '')}”
              </Text>
            </View>
            <Text style={{ fontFamily: 'Meta', fontSize: 7, color: pal.accent, marginTop: 8 }}>
              <Text style={{ fontWeight: 700, color: '#ffffff' }}>{openerSection.quote.attribution}</Text>
              {openerSection.quote.role ? `, ${openerSection.quote.role}` : ''}
            </Text>
          </View>
        )}
      </View>

      <View style={s.content}>
        {/* Feature headline + byline (the dek lives on the executive summary page) */}
        <SectionHeading section={openerSection} level="feature" />
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <View style={{ width: 34, height: 5, backgroundColor: pal.ink, marginRight: 8 }} />
          <Text style={{ fontFamily: 'Meta', fontWeight: 700, fontSize: 7.5, letterSpacing: 0.6 }}>
            BY {`${lead.assignedRep}`.toUpperCase()}
          </Text>
          <Text style={{ fontFamily: 'Meta', fontSize: 7.5, color: pal.greyText }}> · {settings.companyName} Industry Desk</Text>
        </View>

        {/* Opener article body in editorial columns */}
        <TwoColProse text={openerSection.body} />
        {openerSection.subTopics && openerSection.subTopics.length > 0 && (
          <View style={[s.twoCol, { marginTop: 4 }]}>
            <View style={s.col}>
              {openerSection.subTopics.filter((_, i) => i % 2 === 0).map((t, i) => (
                <SubTopic key={i} item={t} />
              ))}
            </View>
            <View style={s.col}>
              {openerSection.subTopics.filter((_, i) => i % 2 === 1).map((t, i) => (
                <SubTopic key={i} item={t} />
              ))}
            </View>
          </View>
        )}
        {openerSection.bullets && openerSection.bullets.length > 0 && (
          <GoldPanelList heading="At a glance" bullets={openerSection.bullets} flip={false} />
        )}
        {openerSection.numberedItems?.map((n, i) => (
          <NumberedItem key={i} item={n} index={i} />
        ))}

        {/* Interior sections flow with alternating accent fields */}
        {interior.map((sec) => {
          accentFlip = !accentFlip;
          const flip = accentFlip;
          // Fragment (not View): keep-together children must be direct children of the
          // page content so react-pdf relocates rather than clips them at page breaks.
          return (
            <React.Fragment key={sec.key}>
              <SectionHeading section={sec} level="section" />
              {sec.chart ? (
                <>
                  <TwoColProse text={sec.body} />
                  <SurveyChart chart={sec.chart} kicker={sec.kicker} flip={flip} />
                </>
              ) : (
                <TwoColProse text={sec.body} />
              )}
              {sec.quote && <PullQuote quote={sec.quote} />}
              {sec.bullets && sec.bullets.length > 0 && <GoldPanelList heading="Reading list" bullets={sec.bullets} flip={flip} />}
              {sec.numberedItems?.map((n, i) => (
                <NumberedItem key={i} item={n} index={i} />
              ))}
              {sec.subTopics && sec.subTopics.length > 0 && (
                <View style={[s.twoCol, { marginTop: 4 }]}>
                  <View style={s.col}>
                    {sec.subTopics.filter((_, i) => i % 2 === 0).map((t, i) => (
                      <SubTopic key={i} item={t} />
                    ))}
                  </View>
                  <View style={s.col}>
                    {sec.subTopics.filter((_, i) => i % 2 === 1).map((t, i) => (
                      <SubTopic key={i} item={t} />
                    ))}
                  </View>
                </View>
              )}
            </React.Fragment>
          );
        })}
      </View>
      <Footer settings={settings} />
    </Page>
  );
}

/** Second-to-last page: the actionable takeaways the recipient can run this quarter. */
function TakeawaysPage({ settings, takeaways }: { settings: AppSettings; takeaways: ReportSection }) {
  const pal = usePal();
  return (
    <Page size={[PAGE_W, PAGE_H]} style={s.flowPage} wrap>
      <View style={{ width: PAGE_W, height: 96, backgroundColor: pal.primary, overflow: 'hidden', justifyContent: 'center', paddingHorizontal: MARGIN }}>
        <Burst w={PAGE_W} h={96} color={pal.primaryDeep} opacity={0.6} cy={110} />
        <Text style={{ fontFamily: 'Deck', fontWeight: 700, fontSize: 11, letterSpacing: 4, color: pal.accent }}>ACTIONABLE TAKEAWAYS</Text>
        <Text style={{ fontFamily: 'Display', fontSize: 26, color: '#ffffff', marginTop: 3 }}>{takeaways.heading.toUpperCase()}</Text>
      </View>
      <View style={s.content}>
        {takeaways.body ? (
          <Text style={{ fontSize: 10, lineHeight: 1.6, marginBottom: 14, width: CONTENT_W * 0.94 }}>{takeaways.body}</Text>
        ) : null}
        {takeaways.numberedItems?.map((n, i) => (
          <BigNumberedItem key={i} item={n} index={i} />
        ))}
        {takeaways.bullets && takeaways.bullets.length > 0 && (
          <GoldPanelList heading="Also worth doing" bullets={takeaways.bullets} flip={false} />
        )}
        {takeaways.quote && <PullQuote quote={takeaways.quote} />}
      </View>
      <Footer settings={settings} />
    </Page>
  );
}

/**
 * Final page: the closing note plus recipient and sender cards. Replaces the
 * old supplement + back-cover pair; legacy "How Honest Taskers helps" sections
 * land here via role mapping.
 */
function ClosingPage({ lead, settings, closing, photo }: { lead: Lead; settings: AppSettings; closing: ReportSection | null; photo: Buffer | null }) {
  const pal = usePal();
  return (
    <Page size={[PAGE_W, PAGE_H]} style={s.page}>
      <View style={{ position: 'absolute', top: 0, left: 0, width: PAGE_W, height: PAGE_H, backgroundColor: pal.primaryDeep }}>
        <Burst w={PAGE_W} h={PAGE_H} color={pal.primary} opacity={0.9} cy={PAGE_H * 0.42} />
        <Halftone w={PAGE_W} h={PAGE_H} color={pal.accent} dotMax={1.5} opacity={0.12} />
      </View>
      <View style={{ position: 'absolute', top: 0, left: 0, width: PAGE_W, height: PAGE_H, padding: 52, justifyContent: 'center' }}>
        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <SenderMark settings={settings} size={52} onDark />
        </View>
        {closing && (
          <>
            <Text style={{ fontFamily: 'Display', fontSize: 32, color: '#ffffff', textAlign: 'center', marginBottom: 12 }}>
              {closing.heading.toUpperCase()}
            </Text>
            {paragraphs(closing.body).map((p, i) => (
              <Text key={i} style={{ fontFamily: 'Body', fontSize: 10, lineHeight: 1.7, color: 'rgba(255,255,255,0.92)', textAlign: 'center', marginBottom: 8, paddingHorizontal: 30 }}>
                {p}
              </Text>
            ))}
            {closing.numberedItems && closing.numberedItems.length > 0 && (
              <View style={{ marginTop: 10, paddingHorizontal: 40 }}>
                {closing.numberedItems.slice(0, 3).map((n, i) => (
                  <View key={i} style={{ flexDirection: 'row', marginBottom: 8 }}>
                    <Text style={{ fontFamily: 'Display', fontSize: 14, color: pal.accent, marginRight: 10 }}>{i + 1}</Text>
                    <Text style={{ fontFamily: 'Meta', fontSize: 8.5, lineHeight: 1.45, color: 'rgba(255,255,255,0.9)', flex: 1 }}>
                      <Text style={{ fontWeight: 700, color: '#ffffff' }}>{cleanTitle(n.title)} </Text>
                      {n.body}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* Recipient + sender cards */}
        <View style={{ flexDirection: 'row', gap: 14, marginTop: 26 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderTopWidth: 3, borderTopColor: pal.accent, padding: 16, alignItems: 'center' }}>
            {photo ? (
              <View style={{ width: 46, height: 46, borderRadius: 23, overflow: 'hidden', marginBottom: 8 }}>
                <Image src={photo} style={{ width: 46, height: 46, objectFit: 'cover' }} />
              </View>
            ) : (
              <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: pal.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                <Text style={{ fontFamily: 'Display', fontSize: 20, color: pal.accent, marginTop: 2 }}>{initialsOf(lead.personaName)}</Text>
              </View>
            )}
            <Text style={{ fontFamily: 'Meta', fontWeight: 700, fontSize: 7, color: pal.accent, letterSpacing: 1.4, marginBottom: 4 }}>PREPARED FOR</Text>
            <Text style={{ fontFamily: 'Meta', fontWeight: 700, fontSize: 10, color: '#ffffff', textAlign: 'center' }}>{lead.personaName}</Text>
            <Text style={{ fontFamily: 'Meta', fontSize: 8, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: 2 }}>
              {lead.personaTitle}{'\n'}{lead.organization}
            </Text>
          </View>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderTopWidth: 3, borderTopColor: pal.accent, padding: 16, alignItems: 'center' }}>
            <View style={{ marginBottom: 8 }}>
              <SenderMark settings={settings} size={46} onDark />
            </View>
            <Text style={{ fontFamily: 'Meta', fontWeight: 700, fontSize: 7, color: pal.accent, letterSpacing: 1.4, marginBottom: 4 }}>FROM</Text>
            <Text style={{ fontFamily: 'Meta', fontWeight: 700, fontSize: 10, color: '#ffffff', textAlign: 'center' }}>{settings.companyName}</Text>
            <Text style={{ fontFamily: 'Meta', fontSize: 8, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: 2 }}>
              {settings.defaultRep}{settings.about ? `\n${settings.about.length > 110 ? settings.about.slice(0, 107) + '…' : settings.about}` : ''}
            </Text>
          </View>
        </View>

        <Text style={{ fontFamily: 'Meta', fontWeight: 600, fontSize: 8.5, color: pal.accent, textAlign: 'center', marginTop: 24, letterSpacing: 1 }}>
          FRESH INSIGHT, EVERY TWO WEEKS
        </Text>
      </View>
    </Page>
  );
}

/* ------------------------------------------------------------------ entry */

/**
 * Streams rather than buffers: Vercel caps a buffered function response at
 * 4.5MB (a cover-illustrated report exceeds that), while streamed responses
 * have no size limit and start reaching the browser immediately.
 */
export async function renderReportPdf(report: Report, lead: Lead, settings: AppSettings): Promise<NodeJS.ReadableStream> {
  const [cover, photo, companyLogo] = await Promise.all([
    coverBuffer(report),
    fetchImageBuffer(lead.photoUrl),
    fetchImageBuffer(lead.logoUrl),
  ]);
  const pal = buildPalette({ primary: settings.brandPrimary, secondary: settings.brandSecondary });
  const { summary, body, takeaways, closing } = splitByRole(report);

  const doc = (
    <PaletteCtx.Provider value={pal}>
      <Document
        title={report.title}
        author={settings.companyName}
        subject={`${report.focus} industry report for ${lead.organization}`}
        creator="Relationship Engine"
      >
        <CoverPage report={report} lead={lead} settings={settings} cover={cover} photo={photo} companyLogo={companyLogo} />
        {summary && <ExecutiveSummaryPage report={report} settings={settings} summary={summary} />}
        <OpenerAndArticle report={report} lead={lead} settings={settings} cover={cover} bodySections={body} />
        {takeaways && <TakeawaysPage settings={settings} takeaways={takeaways} />}
        <ClosingPage lead={lead} settings={settings} closing={closing} photo={photo} />
      </Document>
    </PaletteCtx.Provider>
  );
  return await renderToStream(doc);
}
