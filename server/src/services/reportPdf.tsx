/**
 * Print-editorial PDF template for Honest Taskers industry reports.
 *
 * Reproduces the design system of the HFMA "Revenue Cycle of the Future" reference
 * (server/sample_report): 585×783pt trim, full-bleed cover, feature opener,
 * two-column editorial grid, navy + warm-gold halftone/burst graphic language,
 * keep-together quote/chart/number blocks, recurring navy footer with page numbers,
 * supplement page and full-bleed back cover. All text is live vector type with
 * embedded fonts (no rasterized pages).
 *
 * Type system (licensed-free equivalents of the reference faces):
 *   Dharma Gothic E  -> Bebas Neue   (display/condensed headlines)
 *   Dharma Gothic E Italic -> Oswald + skew (decks, chart questions, quotes)
 *   Exchange         -> Source Serif 4 (article body)
 *   Mallory          -> Source Sans 3  (bylines, labels, captions, footer)
 */
import React from 'react';
import { Document, Page, View, Text, Image, Font, StyleSheet, Svg, Rect, Circle, Path, Defs, LinearGradient, Stop, renderToBuffer } from '@react-pdf/renderer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import type { AppSettings, Lead, Report, ReportSection } from '../types.js';
import { getImage } from '../db/images.js';

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

const C = {
  navy: '#203667',
  navyDeep: '#16264d',
  gold: '#F7B84A',
  goldDeep: '#E8A427',
  cream: '#FDF3DF',
  ink: '#1c1c1c',
  grey: '#e9e9e6',
  greyText: '#5c5c5a',
  white: '#ffffff',
  htBlue: '#2345ff', // sparing accent only
};

const s = StyleSheet.create({
  page: { fontFamily: 'Body', fontSize: 8.8, color: C.ink, backgroundColor: C.white },
  /**
   * Flowing article pages: bottom padding must live on the Page (react-pdf honors
   * Page padding at every page break; a wrapping View's own paddingBottom is only
   * applied at the end of the element, letting text collide with the fixed footer).
   */
  flowPage: { fontFamily: 'Body', fontSize: 8.8, color: C.ink, backgroundColor: C.white, paddingBottom: FOOTER_H + 20 },
  content: { paddingHorizontal: MARGIN, paddingTop: 34 },
  body: { fontSize: 8.8, lineHeight: 1.5, textAlign: 'justify' },
  twoCol: { flexDirection: 'row', gap: 20 },
  col: { width: COL_W },
  kicker: {
    fontFamily: 'Meta',
    fontWeight: 700,
    fontSize: 8,
    letterSpacing: 1.6,
    color: C.white,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: FOOTER_H,
    backgroundColor: C.navy,
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

/** Halftone dot texture band (print texture on gold fields). */
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

function KickerPill({ label, bg = C.navy }: { label: string; bg?: string }) {
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 3, transform: 'skewX(-8deg)', marginBottom: 8 }}>
      <Text style={[s.kicker, { transform: 'skewX(8deg)' }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

/* ------------------------------------------------------------- components */

function Footer() {
  return (
    <View style={s.footer} fixed>
      <Text
        style={{ fontFamily: 'Meta', fontWeight: 600, fontSize: 7.5, color: C.white }}
        render={({ pageNumber }) => `${pageNumber} • honesttaskers.com`}
      />
      <View style={{ flex: 1 }} />
      <View style={{ width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.5)', marginRight: 10 }} />
      <Text style={{ fontFamily: 'Display', fontSize: 11, color: C.white, letterSpacing: 0.5 }}>HONEST TASKERS</Text>
    </View>
  );
}

function CoverPage({ report, lead, settings, cover }: { report: Report; lead: Lead; settings: AppSettings; cover: Buffer | null }) {
  const img = cover;
  const badge = report.badge ?? `${settings.companyName.toUpperCase()} · INDUSTRY REPORT`;
  return (
    <Page size={[PAGE_W, PAGE_H]} style={s.page}>
      {/* Full-bleed artwork */}
      <View style={{ position: 'absolute', top: 0, left: 0, width: PAGE_W, height: PAGE_H, backgroundColor: C.navyDeep }}>
        {img ? (
          <Image src={img} style={{ width: PAGE_W, height: PAGE_H, objectFit: 'cover' }} />
        ) : (
          <>
            <View style={{ position: 'absolute', top: 0, left: 0, width: PAGE_W, height: PAGE_H, backgroundColor: C.gold }} />
            <Burst w={PAGE_W} h={PAGE_H} color={C.navyDeep} opacity={0.85} cy={PAGE_H * 0.45} />
            <Halftone w={PAGE_W} h={PAGE_H} color={C.goldDeep} dotMax={2} opacity={0.35} />
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

      {/* Edition badge */}
      <View
        style={{
          position: 'absolute',
          top: 26,
          left: 26,
          width: 74,
          height: 74,
          borderRadius: 37,
          backgroundColor: C.navy,
          borderWidth: 2,
          borderStyle: 'dashed',
          borderColor: C.white,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {badge.split('·').map((part, i) => (
          <Text key={i} style={{ fontFamily: 'Meta', fontWeight: 700, fontSize: i === 0 ? 8 : 7, color: i === 0 ? C.white : C.gold, letterSpacing: 0.8, textAlign: 'center' }}>
            {part.trim()}
          </Text>
        ))}
      </View>

      {/* Title block, lower third */}
      <View style={{ position: 'absolute', left: MARGIN, right: MARGIN, bottom: 64 }}>
        <Text style={{ fontFamily: 'Display', fontSize: 86, lineHeight: 0.92, color: C.white }}>{report.title.toUpperCase()}</Text>
      </View>
      {/* Support/metadata bar along the bottom */}
      <View style={{ position: 'absolute', left: MARGIN, right: MARGIN, bottom: 26, flexDirection: 'row', alignItems: 'center' }}>
        <View>
          <Text style={{ fontFamily: 'Meta', fontWeight: 700, fontSize: 7, color: C.gold, letterSpacing: 1.4 }}>PREPARED EXCLUSIVELY FOR</Text>
          <Text style={{ fontFamily: 'Meta', fontWeight: 600, fontSize: 9.5, color: C.white, marginTop: 2 }}>
            {lead.personaName}, {lead.personaTitle} · {lead.organization}
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        <Text style={{ fontFamily: 'Display', fontSize: 13, color: C.white, letterSpacing: 0.5 }}>{settings.companyName.toUpperCase()}</Text>
      </View>
    </Page>
  );
}

function PullQuote({ quote }: { quote: NonNullable<ReportSection['quote']> }) {
  return (
    <View wrap={false} style={{ backgroundColor: C.grey, padding: 20, marginVertical: 12 }}>
      <Text style={{ fontFamily: 'Display', fontSize: 34, color: C.navy, lineHeight: 0.6, marginBottom: 8 }}>“</Text>
      <View style={{ transform: 'skewX(-6deg)' }}>
        <Text style={{ fontFamily: 'Deck', fontWeight: 700, fontSize: 14.5, lineHeight: 1.25, color: C.ink }}>
          {quote.text.replace(/^["“]|["”]$/g, '')}”
        </Text>
      </View>
      <Text style={{ fontFamily: 'Meta', fontSize: 8, color: C.greyText, marginTop: 10 }}>
        <Text style={{ fontWeight: 700, color: C.ink }}>{quote.attribution}</Text>
        {quote.role ? `, ${quote.role}` : ''}
      </Text>
    </View>
  );
}

function SurveyChart({ chart, kicker, flip }: { chart: NonNullable<ReportSection['chart']>; kicker?: string | null; flip: boolean }) {
  const max = Math.max(...chart.data.map((d) => d.value), 1);
  const FIELD_W = CONTENT_W;
  const rowH = 30;
  const fieldH = 118 + chart.data.length * rowH + (chart.source ? 20 : 0);
  return (
    <View wrap={false} style={{ marginVertical: 14, width: FIELD_W, height: fieldH, backgroundColor: C.gold, overflow: 'hidden' }}>
      <Halftone w={FIELD_W} h={fieldH} color={C.goldDeep} dotMax={2.4} opacity={0.45} />
      <Burst w={FIELD_W} h={fieldH} color={C.cream} opacity={0.18} cx={flip ? FIELD_W * 0.12 : FIELD_W * 0.88} cy={fieldH * 0.1} />
      <View style={{ padding: 20 }}>
        <KickerPill label={kicker ?? 'SURVEY QUESTION'} />
        <View style={{ transform: 'skewX(-6deg)', marginBottom: 14, width: FIELD_W * 0.8 }}>
          <Text style={{ fontFamily: 'Deck', fontWeight: 700, fontSize: 15, lineHeight: 1.15, color: C.navy }}>{chart.question}</Text>
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
                color: C.navyDeep,
                textTransform: 'uppercase',
              }}
            >
              {d.label.toUpperCase()}
            </Text>
            <View style={{ width: 2, height: rowH - 6, backgroundColor: C.navyDeep }} />
            <View style={{ width: Math.max(8, (d.value / max) * (FIELD_W - 240)), height: rowH - 10, backgroundColor: C.navy }} />
            <Text style={{ fontFamily: 'Display', fontSize: 19, color: C.navyDeep, marginLeft: 7 }}>
              {d.value}
              {d.suffix ?? ''}
            </Text>
          </View>
        ))}
        {chart.source && (
          <Text style={{ fontFamily: 'Meta', fontSize: 6.5, color: C.navyDeep, marginTop: 10 }}>Source: {chart.source}</Text>
        )}
      </View>
    </View>
  );
}

function NumberedItem({ item, index }: { item: { title: string; body: string }; index: number }) {
  return (
    <View wrap={false} style={{ flexDirection: 'row', marginBottom: 10 }}>
      <View style={{ width: 30, height: 30, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
        <Text style={{ fontFamily: 'Display', fontSize: 21, color: C.gold, marginTop: 2 }}>{index + 1}</Text>
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

function SubTopic({ item }: { item: { title: string; body: string } }) {
  return (
    <View wrap={false} style={{ flexDirection: 'row', marginBottom: 7 }}>
      <Text style={{ fontSize: 6.5, color: C.ink, marginTop: 2, marginRight: 5 }}>■</Text>
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
  return (
    <View wrap={false} style={{ marginBottom: 8, marginTop: level === 'section' ? 14 : 0 }}>
      {section.kicker && !section.chart && <KickerPill label={section.kicker} />}
      <Text style={{ fontFamily: 'Display', fontSize: level === 'feature' ? 42 : 24, lineHeight: 0.95, color: C.navy }}>
        {section.heading.toUpperCase()}
      </Text>
    </View>
  );
}

function GoldPanelList({ heading, bullets, flip }: { heading: string; bullets: string[]; flip: boolean }) {
  const PANEL_W = COL_W + 30;
  return (
    <View wrap={false} style={{ flexDirection: flip ? 'row-reverse' : 'row', gap: 16, marginVertical: 12 }}>
      <View style={{ width: PANEL_W, backgroundColor: C.gold, padding: 16, overflow: 'hidden' }}>
        <Halftone w={PANEL_W} h={300} color={C.goldDeep} dotMax={2} opacity={0.4} />
        <Text style={{ fontFamily: 'Display', fontSize: 18, color: C.navyDeep, marginBottom: 8 }}>{heading.toUpperCase()}</Text>
        {bullets.map((b, i) => (
          <View key={i} style={{ flexDirection: 'row', marginBottom: 5 }}>
            <Text style={{ fontSize: 6, color: C.navyDeep, marginTop: 2, marginRight: 5 }}>■</Text>
            <Text style={{ fontFamily: 'Meta', fontWeight: 600, fontSize: 8.5, lineHeight: 1.35, color: C.navyDeep, flex: 1 }}>{cleanTitle(b)}</Text>
          </View>
        ))}
      </View>
      <View style={{ flex: 1 }} />
    </View>
  );
}

/* ----------------------------------------------------------------- pages */

function OpenerAndArticle({ report, lead, cover }: { report: Report; lead: Lead; cover: Buffer | null }) {
  const [openerSection, ...rest] = report.sections;
  const interior = rest.filter((sec) => sec.key !== 'How Honest Taskers helps');
  const img = cover;
  const BAND_H = 240;
  let goldFlip = false;

  return (
    <Page size={[PAGE_W, PAGE_H]} style={s.flowPage} wrap>
      {/* Feature opener band: image + layered quote (reference page 2) */}
      <View style={{ width: PAGE_W, height: BAND_H, backgroundColor: C.navyDeep, overflow: 'hidden' }}>
        {img ? (
          <Image src={img} style={{ position: 'absolute', top: -140, left: 0, width: PAGE_W, height: PAGE_H, objectFit: 'cover', opacity: 0.9 }} />
        ) : (
          <>
            <Burst w={PAGE_W} h={BAND_H} color={C.navy} opacity={0.7} cy={BAND_H * 0.4} />
            <Halftone w={PAGE_W} h={BAND_H} color={C.gold} dotMax={1.8} opacity={0.25} />
          </>
        )}
        {openerSection?.quote && (
          <View style={{ position: 'absolute', right: 28, top: 28, width: 240, backgroundColor: 'rgba(10,16,34,0.55)', padding: 14 }}>
            <Text style={{ fontFamily: 'Display', fontSize: 26, color: C.white, lineHeight: 0.6, marginBottom: 6 }}>“</Text>
            <View style={{ transform: 'skewX(-6deg)' }}>
              <Text style={{ fontFamily: 'Deck', fontWeight: 700, fontSize: 11, lineHeight: 1.25, color: C.white }}>
                {openerSection.quote.text.replace(/^["“]|["”]$/g, '')}”
              </Text>
            </View>
            <Text style={{ fontFamily: 'Meta', fontSize: 7, color: C.gold, marginTop: 8 }}>
              <Text style={{ fontWeight: 700, color: C.white }}>{openerSection.quote.attribution}</Text>
              {openerSection.quote.role ? `, ${openerSection.quote.role}` : ''}
            </Text>
          </View>
        )}
      </View>

      <View style={s.content}>
        {/* Feature headline + dek + byline */}
        {openerSection && <SectionHeading section={openerSection} level="feature" />}
        {report.dek && (
          <View style={{ transform: 'skewX(-6deg)', marginBottom: 10, width: CONTENT_W * 0.92 }}>
            <Text style={{ fontFamily: 'Deck', fontWeight: 500, fontSize: 13.5, lineHeight: 1.25, color: C.navy }}>{report.dek}</Text>
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <View style={{ width: 34, height: 5, backgroundColor: C.ink, marginRight: 8 }} />
          <Text style={{ fontFamily: 'Meta', fontWeight: 700, fontSize: 7.5, letterSpacing: 0.6 }}>
            BY {`${lead.assignedRep}`.toUpperCase()}
          </Text>
          <Text style={{ fontFamily: 'Meta', fontSize: 7.5, color: C.greyText }}> · Honest Taskers Industry Desk</Text>
        </View>

        {/* Opener article body in editorial columns */}
        {openerSection && <TwoColProse text={openerSection.body} />}
        {openerSection?.subTopics && openerSection.subTopics.length > 0 && (
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
        {openerSection?.bullets && openerSection.bullets.length > 0 && (
          <GoldPanelList heading="At a glance" bullets={openerSection.bullets} flip={false} />
        )}
        {openerSection?.numberedItems?.map((n, i) => (
          <NumberedItem key={i} item={n} index={i} />
        ))}

        {/* Interior sections flow with alternating gold fields */}
        {interior.map((sec) => {
          goldFlip = !goldFlip;
          const flip = goldFlip;
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
      <Footer />
    </Page>
  );
}

function SupplementPage({ report, settings, lead }: { report: Report; settings: AppSettings; lead: Lead }) {
  const sec = report.sections.find((x) => x.key === 'How Honest Taskers helps');
  if (!sec) return null;
  return (
    <Page size={[PAGE_W, PAGE_H]} style={s.flowPage} wrap>
      {/* Supplement masthead (reference page 12) */}
      <View style={{ width: PAGE_W, height: 118, backgroundColor: C.cream, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        <Burst w={PAGE_W} h={118} color={C.gold} opacity={0.4} cy={130} />
        <Halftone w={PAGE_W} h={118} color={C.goldDeep} dotMax={1.6} opacity={0.25} />
        <Text style={{ fontFamily: 'Display', fontSize: 30, color: C.ink }}>{report.title.toUpperCase()}</Text>
        <Text style={{ fontFamily: 'Deck', fontWeight: 700, fontSize: 11, letterSpacing: 4, color: C.navy, marginTop: 2 }}>SUPPLEMENT</Text>
      </View>
      <View style={s.content}>
        <Text style={{ fontFamily: 'Display', fontSize: 30, lineHeight: 0.98, color: C.ink, marginBottom: 10, width: CONTENT_W * 0.95 }}>
          {sec.heading.toUpperCase()}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <View style={{ width: 26, height: 26, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
            <Text style={{ fontFamily: 'Display', fontSize: 15, color: C.gold }}>HT</Text>
          </View>
          <View>
            <Text style={{ fontFamily: 'Meta', fontWeight: 700, fontSize: 8.5 }}>{settings.defaultRep.toUpperCase()}</Text>
            <Text style={{ fontFamily: 'Meta', fontSize: 7.5, color: C.greyText }}>{settings.companyName} · Client Partnerships</Text>
          </View>
        </View>
        <TwoColProse text={sec.body} />
        {sec.quote && <PullQuote quote={sec.quote} />}
        {sec.numberedItems?.map((n, i) => (
          <View key={i} wrap={false} style={{ flexDirection: 'row', marginBottom: 12, marginTop: i === 0 ? 8 : 0 }}>
            <View style={{ width: 34, height: 34, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Text style={{ fontFamily: 'Display', fontSize: 24, color: C.navyDeep, marginTop: 2 }}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'Meta', fontWeight: 700, fontSize: 9.5, marginBottom: 2 }}>{cleanTitle(n.title).toUpperCase()}</Text>
              <Text style={s.body}>{n.body}</Text>
            </View>
          </View>
        ))}
        {sec.subTopics && sec.subTopics.length > 0 && (
          <View style={{ marginTop: 4 }}>
            {sec.subTopics.map((t, i) => (
              <SubTopic key={i} item={t} />
            ))}
          </View>
        )}
      </View>
      <Footer />
    </Page>
  );
}

function BackCoverPage({ report, lead, settings }: { report: Report; lead: Lead; settings: AppSettings }) {
  return (
    <Page size={[PAGE_W, PAGE_H]} style={s.page}>
      <View style={{ position: 'absolute', top: 0, left: 0, width: PAGE_W, height: PAGE_H, backgroundColor: C.navyDeep }}>
        <Burst w={PAGE_W} h={PAGE_H} color={C.navy} opacity={0.9} cy={PAGE_H * 0.42} />
        <Halftone w={PAGE_W} h={PAGE_H} color={C.gold} dotMax={1.5} opacity={0.12} />
      </View>
      <View style={{ position: 'absolute', top: 0, left: 0, width: PAGE_W, height: PAGE_H, alignItems: 'center', justifyContent: 'center', padding: 60 }}>
        <View style={{ width: 56, height: 56, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
          <Text style={{ fontFamily: 'Display', fontSize: 32, color: C.navyDeep, marginTop: 3 }}>HT</Text>
        </View>
        <Text style={{ fontFamily: 'Display', fontSize: 40, color: C.white, letterSpacing: 1 }}>{settings.companyName.toUpperCase()}</Text>
        <View style={{ transform: 'skewX(-6deg)', marginTop: 6 }}>
          <Text style={{ fontFamily: 'Deck', fontWeight: 500, fontSize: 12, color: C.gold }}>Delivering joy through services</Text>
        </View>
        <View style={{ width: 44, height: 3, backgroundColor: C.gold, marginVertical: 22 }} />
        <Text style={{ fontFamily: 'Meta', fontSize: 9, color: C.white, textAlign: 'center', lineHeight: 1.6 }}>
          {report.title} — a {settings.companyName} industry report{'\n'}
          prepared exclusively for {lead.personaName}, {lead.organization}.{'\n'}
          Fresh insight, every two weeks.
        </Text>
        <View style={{ backgroundColor: C.gold, padding: 16, marginTop: 30, maxWidth: 360 }}>
          <Text style={{ fontFamily: 'Display', fontSize: 15, color: C.navyDeep, marginBottom: 4 }}>LET’S TALK</Text>
          <Text style={{ fontFamily: 'Meta', fontWeight: 600, fontSize: 8.5, lineHeight: 1.45, color: C.navyDeep, textAlign: 'center' }}>
            {settings.companyName} builds trained virtual assistant teams for {lead.industry.toLowerCase()} leaders. Ask{' '}
            {settings.defaultRep} for a working session on what this could unlock for {lead.organization}.
          </Text>
        </View>
        <Text style={{ fontFamily: 'Meta', fontWeight: 700, fontSize: 10, color: C.gold, marginTop: 22, letterSpacing: 1.2 }}>
          WWW.HONESTTASKERS.COM
        </Text>
      </View>
    </Page>
  );
}

/* ------------------------------------------------------------------ entry */

export async function renderReportPdf(report: Report, lead: Lead, settings: AppSettings): Promise<Buffer> {
  const cover = await coverBuffer(report);
  const doc = (
    <Document
      title={report.title}
      author={settings.companyName}
      subject={`${report.focus} industry report for ${lead.organization}`}
      creator="Relationship Engine"
    >
      <CoverPage report={report} lead={lead} settings={settings} cover={cover} />
      <OpenerAndArticle report={report} lead={lead} cover={cover} />
      <SupplementPage report={report} settings={settings} lead={lead} />
      <BackCoverPage report={report} lead={lead} settings={settings} />
    </Document>
  );
  return await renderToBuffer(doc);
}
