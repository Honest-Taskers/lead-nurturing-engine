import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import type { Lead, Report, ReportSection } from '../data/types';
import { brand } from '../theme';
import { useApp } from '../context/AppContext';

/**
 * Magazine-style report renderer modeled on the HFMA "Revenue Cycle of the Future"
 * sample (server/sample_report), repurposed to the Honest Taskers brand:
 * HT Blue replaces HFMA navy, aqua/sky bursts replace the gold halftone.
 */

const headlineSx = {
  fontWeight: 800,
  letterSpacing: '-0.01em',
  lineHeight: 1.08,
  color: brand.blueInk,
} as const;

const bodySx = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: '0.95rem',
  lineHeight: 1.65,
  color: brand.ink,
  whiteSpace: 'pre-line',
} as const;

function Kicker({ label }: { label: string }) {
  return (
    <Box
      sx={{
        display: 'inline-block',
        bgcolor: brand.blue,
        color: '#fff',
        px: 1.5,
        py: 0.4,
        transform: 'skewX(-8deg)',
        mb: 1.5,
      }}
    >
      <Typography sx={{ fontWeight: 800, fontSize: '0.78rem', letterSpacing: '0.1em', transform: 'skewX(8deg)' }}>
        {label.toUpperCase()}
      </Typography>
    </Box>
  );
}

function PullQuote({ quote }: { quote: NonNullable<ReportSection['quote']> }) {
  return (
    <Box sx={{ bgcolor: '#eef0f2', borderRadius: '10px', p: 3, my: 2.5 }}>
      <Typography sx={{ color: brand.blue, fontSize: '2.6rem', lineHeight: 0.5, fontFamily: 'Georgia, serif', mb: 1.5 }}>
        “
      </Typography>
      <Typography sx={{ fontWeight: 800, fontStyle: 'italic', fontSize: '1.15rem', lineHeight: 1.35, color: brand.ink, mb: 1.5 }}>
        {quote.text.replace(/^["“]|["”]$/g, '')}”
      </Typography>
      <Typography variant="body2" sx={{ color: brand.muted }}>
        <strong style={{ color: brand.ink }}>{quote.attribution}</strong>
        {quote.role ? `, ${quote.role}` : ''}
      </Typography>
    </Box>
  );
}

function SurveyChart({ chart, kicker }: { chart: NonNullable<ReportSection['chart']>; kicker?: string | null }) {
  const max = Math.max(...chart.data.map((d) => d.value), 1);
  return (
    <Box
      sx={{
        borderRadius: '12px',
        p: 3,
        my: 2.5,
        background: `linear-gradient(160deg, ${brand.accentSoft} 0%, #f0fbfd 55%, #ffffff 100%)`,
        border: `1px solid #dbe2ff`,
      }}
    >
      <Kicker label={kicker ?? 'SURVEY QUESTION'} />
      <Typography sx={{ fontWeight: 800, fontStyle: 'italic', fontSize: '1.2rem', color: brand.blueInk, mb: 2.5, lineHeight: 1.3 }}>
        {chart.question}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {chart.data.map((d) => (
          <Box key={d.label} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography
              sx={{
                width: 130,
                flexShrink: 0,
                textAlign: 'right',
                fontWeight: 700,
                fontSize: '0.72rem',
                letterSpacing: '0.06em',
                color: brand.ink,
                textTransform: 'uppercase',
                lineHeight: 1.25,
              }}
            >
              {d.label}
            </Typography>
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1.25, borderLeft: `2px solid ${brand.ink}`, pl: 0 }}>
              <Box
                sx={{
                  width: `${Math.max(3, (d.value / max) * 70)}%`,
                  height: 34,
                  bgcolor: brand.blue,
                }}
              />
              <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', color: brand.blueInk, whiteSpace: 'nowrap' }}>
                {d.value}
                {d.suffix ?? ''}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
      {chart.source && (
        <Typography variant="caption" sx={{ display: 'block', mt: 2.5, color: brand.muted }}>
          Source: {chart.source}
        </Typography>
      )}
    </Box>
  );
}

function NumberedItems({ items }: { items: Array<{ title: string; body: string }> }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, my: 2.5 }}>
      {items.map((item, i) => (
        <Box key={i} sx={{ display: 'flex', gap: 2 }}>
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: '2.2rem',
              lineHeight: 1,
              color: '#fff',
              bgcolor: brand.blue,
              width: 44,
              height: 44,
              flexShrink: 0,
              display: 'grid',
              placeItems: 'center',
              borderRadius: '6px',
            }}
          >
            {i + 1}
          </Typography>
          <Box>
            <Typography component="span" sx={{ fontWeight: 800, fontSize: '0.95rem', color: brand.ink }}>
              {item.title}{' '}
            </Typography>
            <Typography component="span" sx={{ ...bodySx, fontSize: '0.9rem' }}>
              {item.body}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function SubTopics({ items }: { items: Array<{ title: string; body: string }> }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, my: 2.5 }}>
      {items.map((t, i) => (
        <Box key={i}>
          <Typography component="span" sx={{ color: brand.blue, fontWeight: 800, mr: 1 }}>
            ■
          </Typography>
          <Typography component="span" sx={{ fontWeight: 800, fontSize: '0.92rem', color: brand.ink }}>
            {t.title}{' '}
          </Typography>
          <Typography component="span" sx={{ ...bodySx, fontSize: '0.9rem' }}>
            {t.body}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function Section({ section, first }: { section: ReportSection; first: boolean }) {
  return (
    <Box sx={{ mb: 4, '&:last-child': { mb: 0 } }}>
      {section.kicker && !section.chart && <Kicker label={section.kicker} />}
      <Typography sx={{ ...headlineSx, fontSize: first ? '1.7rem' : '1.25rem', mb: 1.25 }}>
        {section.heading}
      </Typography>
      <Typography sx={bodySx}>{section.body}</Typography>
      {section.bullets && section.bullets.length > 0 && (
        <Box component="ul" sx={{ my: 1.25, pl: 3 }}>
          {section.bullets.map((b, i) => (
            <Typography key={i} component="li" sx={{ ...bodySx, mb: 0.25 }}>
              {b}
            </Typography>
          ))}
        </Box>
      )}
      {section.chart && <SurveyChart chart={section.chart} kicker={section.kicker} />}
      {section.quote && <PullQuote quote={section.quote} />}
      {section.numberedItems && section.numberedItems.length > 0 && <NumberedItems items={section.numberedItems} />}
      {section.subTopics && section.subTopics.length > 0 && <SubTopics items={section.subTopics} />}
      {/* Legacy callouts from earlier reports */}
      {section.callouts && section.callouts.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1.5, mt: 1.5, flexWrap: 'wrap' }}>
          {section.callouts.map((c, i) => (
            <Box key={i} sx={{ flex: '1 1 240px', bgcolor: brand.surface, borderRadius: '10px', p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                {c.title}
              </Typography>
              <Typography variant="body2" sx={{ color: brand.muted }}>
                {c.body}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

export default function ReportDocument({ lead, report }: { lead: Lead; report: Report }) {
  const { settings } = useApp();
  const badge = report.badge ?? `${settings.companyName.toUpperCase()} · INDUSTRY REPORT`;
  const burst = `repeating-conic-gradient(from 0deg at 50% 62%, ${brand.blue} 0deg 6deg, ${brand.blueInk} 6deg 12deg)`;

  return (
    <Card sx={{ overflow: 'hidden' }} className="report-document">
      {/* Cover — pop-art burst + generated illustration, sample-report style */}
      <Box
        className="report-header"
        sx={{
          position: 'relative',
          color: '#fff',
          minHeight: report.coverImageUrl ? 520 : 300,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          background: report.coverImageUrl ? brand.sidebar : burst,
          overflow: 'hidden',
        }}
      >
        {report.coverImageUrl && (
          <Box
            component="img"
            src={report.coverImageUrl}
            alt=""
            sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }}
          />
        )}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, rgba(10,14,40,0.15) 30%, rgba(10,14,40,0.85) 85%)',
          }}
        />
        {/* Badge */}
        <Box
          sx={{
            position: 'absolute',
            top: 20,
            left: 20,
            width: 84,
            height: 84,
            borderRadius: '50%',
            bgcolor: brand.blueInk,
            border: '3px dashed rgba(255,255,255,0.85)',
            display: 'grid',
            placeItems: 'center',
            textAlign: 'center',
            px: 1,
          }}
        >
          <Typography sx={{ fontWeight: 800, fontSize: '0.56rem', letterSpacing: '0.08em', lineHeight: 1.35, color: '#fff' }}>
            {badge.split('·').map((part, i) => (
              <span key={i} style={{ display: 'block' }}>{part.trim()}</span>
            ))}
          </Typography>
        </Box>
        <Box sx={{ position: 'relative', p: 3, pt: 6 }}>
          <Typography
            sx={{
              fontWeight: 800,
              textTransform: 'uppercase',
              fontSize: 'clamp(1.8rem, 4.5vw, 3rem)',
              lineHeight: 0.98,
              letterSpacing: '-0.02em',
              color: '#fff',
              textShadow: '0 2px 18px rgba(0,0,0,0.45)',
              mb: 1.5,
            }}
          >
            {report.title}
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>
            Prepared for {lead.personaName}, {lead.personaTitle} · {lead.organization}
          </Typography>
        </Box>
      </Box>

      {/* Dek — italic subheadline like the sample's feature opener */}
      {report.dek && (
        <Box sx={{ px: 3, pt: 3 }}>
          <Typography
            sx={{
              fontWeight: 700,
              fontStyle: 'italic',
              fontSize: '1.15rem',
              lineHeight: 1.4,
              color: brand.blueInk,
              borderBottom: `1px solid ${brand.line}`,
              pb: 2.5,
            }}
          >
            {report.dek}
          </Typography>
        </Box>
      )}

      {/* Body */}
      <Box sx={{ px: 3, py: 3 }}>
        {report.sections.map((s, i) => (
          <Section key={s.key} section={s} first={i === 0} />
        ))}
        {report.sections.length === 0 && (
          <Typography variant="body2" sx={{ color: brand.faint }}>
            This report has no content sections.
          </Typography>
        )}
      </Box>

      {/* Footer band */}
      <Box sx={{ bgcolor: brand.blue, color: '#fff', px: 3, py: 1.5, display: 'flex', alignItems: 'center' }}>
        <Typography sx={{ fontSize: '0.78rem', fontStyle: 'italic', opacity: 0.9 }}>
          www.honesttaskers.com
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.02em' }}>
          {settings.companyName}
        </Typography>
      </Box>
    </Card>
  );
}
