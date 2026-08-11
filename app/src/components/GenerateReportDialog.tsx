import { useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import StopCircleOutlinedIcon from '@mui/icons-material/StopCircleOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import { keyframes } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import type { Lead } from '../data/types';
import type { GenerationPhase, GenerationProgress } from '../api/client';
import { BODY_SECTIONS, MANDATORY_SECTIONS, REPORT_TEMPLATES } from '../data/types';
import { brand } from '../theme';
import { useApp } from '../context/AppContext';

/** Report focus is auto-derived from the persona title, overridable in the dialog. */
export function focusFromTitle(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('patient access')) return 'Patient access';
  if (t.includes('finance') || t.includes('cfo')) return 'Healthcare finance';
  if (t.includes('claims')) return 'Claims operations';
  return 'Revenue cycle management';
}

const FOCUS_OPTIONS = [
  'Revenue cycle management',
  'Patient access',
  'Healthcare finance',
  'Claims operations',
  'Practice operations',
];

/** Pipeline steps in display order; `repair` appears only when it happens. */
const STEPS: Array<{ phase: GenerationPhase; label: string; hint: string; optional?: boolean }> = [
  { phase: 'research', label: 'Researching', hint: 'Company signals, vertical benchmarks, verified data' },
  { phase: 'writing', label: 'Writing the briefing', hint: 'Thesis, exhibits, role-specific implications' },
  { phase: 'goal-check', label: 'Quality review', hint: 'Auditing against the data-integrity rubric' },
  { phase: 'repair', label: 'Refining', hint: 'Fixing issues found in review', optional: true },
  { phase: 'images', label: 'Selecting photography', hint: 'Cover and section imagery' },
  { phase: 'saving', label: 'Saving', hint: 'Storing the finished report' },
];

const pulse = keyframes`
  0% { opacity: 1; }
  50% { opacity: 0.45; }
  100% { opacity: 1; }
`;

const dotBounce = keyframes`
  0%, 80%, 100% { transform: translateY(0); opacity: 0.35; }
  40% { transform: translateY(-3px); opacity: 1; }
`;

function ThinkingDots() {
  return (
    <Box component="span" sx={{ display: 'inline-flex', gap: '3px', ml: 0.75, verticalAlign: 'middle' }}>
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          component="span"
          sx={{
            width: 4,
            height: 4,
            borderRadius: '50%',
            bgcolor: brand.blue,
            animation: `${dotBounce} 1.2s ease-in-out ${i * 0.16}s infinite`,
          }}
        />
      ))}
    </Box>
  );
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return m ? `${m}m ${String(ss).padStart(2, '0')}s` : `${ss}s`;
}

interface Props {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
}

export default function GenerateReportDialog({ lead, open, onClose }: Props) {
  const { generateReport, settings } = useApp();
  const navigate = useNavigate();
  const [focus, setFocus] = useState('');
  const [template, setTemplate] = useState<string>(REPORT_TEMPLATES[0]);
  const [sections, setSections] = useState<string[]>([...settings.defaultSections]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [seenPhases, setSeenPhases] = useState<GenerationPhase[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const autoFocus = useMemo(() => (lead ? focusFromTitle(lead.personaTitle) : FOCUS_OPTIONS[0]), [lead]);

  useEffect(() => {
    if (open && lead) {
      setFocus(focusFromTitle(lead.personaTitle));
      setTemplate(REPORT_TEMPLATES[0]);
      setSections([...settings.defaultSections]);
      setGenerating(false);
      setError('');
      setProgress(null);
      setSeenPhases([]);
      setElapsed(0);
    }
  }, [open, lead, settings.defaultSections]);

  // Elapsed-time ticker while generating.
  useEffect(() => {
    if (!generating) return;
    const startedAt = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [generating]);

  // Abort a still-running generation if the component unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  if (!lead) return null;

  const toggleSection = (s: string) =>
    setSections((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    setProgress(null);
    setSeenPhases([]);
    setElapsed(0);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const report = await generateReport(
        lead.id,
        { focus, template, sections },
        {
          signal: controller.signal,
          onProgress: (p) => {
            setProgress(p);
            setSeenPhases((prev) => (prev.includes(p.phase) ? prev : [...prev, p.phase]));
          },
        },
      );
      onClose();
      navigate(`/leads/${lead.id}/report/${report.id}`);
    } catch (err) {
      if (controller.signal.aborted) {
        setError('Generation stopped');
      } else {
        setError(err instanceof Error ? err.message : 'Report generation failed');
      }
    } finally {
      abortRef.current = null;
      setGenerating(false);
      setProgress(null);
    }
  };

  const handleStop = () => abortRef.current?.abort();

  const activePhase = progress?.phase ?? null;
  const visibleSteps = STEPS.filter((step) => !step.optional || seenPhases.includes(step.phase));
  const activeIndex = visibleSteps.findIndex((step) => step.phase === activePhase);

  return (
    <Dialog open={open} onClose={generating ? undefined : onClose} maxWidth={false}>
      <Box sx={{ width: 470, p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <AutoAwesomeOutlinedIcon sx={{ color: brand.blue, mr: 1, fontSize: 20 }} />
          <Typography variant="h6">Generate industry report</Typography>
          <Box sx={{ flex: 1 }} />
          <IconButton size="small" onClick={onClose} disabled={generating}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <Box sx={{ bgcolor: brand.surface, borderRadius: '8px', px: 1.75, py: 1.25, mb: 2.5 }}>
          <Typography variant="body2">
            For <strong>{lead.personaName}</strong> · {lead.personaTitle} ·{' '}
            <strong>{lead.industry}</strong>
          </Typography>
        </Box>

        {generating ? (
          <>
            {/* Live pipeline progress */}
            <Box sx={{ border: `1px solid ${brand.line}`, borderRadius: '10px', px: 2.25, py: 2, mb: 2 }}>
              {visibleSteps.map((step, i) => {
                const isActive = step.phase === activePhase;
                const isDone = activeIndex === -1 ? false : i < activeIndex || (seenPhases.includes(step.phase) && !isActive);
                return (
                  <Box key={step.phase} sx={{ display: 'flex', alignItems: 'flex-start', mb: i === visibleSteps.length - 1 ? 0 : 1.5 }}>
                    <Box sx={{ width: 22, mt: '1px', display: 'flex', justifyContent: 'center' }}>
                      {isDone ? (
                        <CheckCircleIcon sx={{ fontSize: 17, color: brand.blue }} />
                      ) : isActive ? (
                        <CircularProgress size={14} thickness={5} sx={{ color: brand.blue, mt: '1px' }} />
                      ) : (
                        <Box sx={{ width: 13, height: 13, borderRadius: '50%', border: `1.5px solid ${brand.line}`, mt: '2px' }} />
                      )}
                    </Box>
                    <Box sx={{ flex: 1, ml: 1 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: isActive ? 600 : 500,
                          color: isDone || isActive ? 'text.primary' : brand.faint,
                          ...(isActive ? { animation: `${pulse} 1.8s ease-in-out infinite` } : {}),
                        }}
                      >
                        {step.label}
                        {isActive && <ThinkingDots />}
                      </Typography>
                      <Typography variant="caption" sx={{ color: isActive ? brand.muted : brand.faint, display: 'block' }}>
                        {isActive && progress?.detail ? progress.detail : step.hint}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography variant="caption" sx={{ color: brand.muted, flex: 1 }}>
                {formatElapsed(elapsed)} elapsed · usually 3–6 minutes
              </Typography>
              <Button
                size="small"
                variant="outlined"
                color="error"
                startIcon={<StopCircleOutlinedIcon />}
                onClick={handleStop}
              >
                Stop
              </Button>
            </Box>
          </>
        ) : (
          <>
            <Typography variant="body2" sx={{ color: brand.muted, mb: 0.75 }}>
              Report focus
            </Typography>
            <TextField
              select
              fullWidth
              size="small"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              sx={{ mb: 2.5 }}
            >
              {FOCUS_OPTIONS.map((f) => (
                <MenuItem key={f} value={f}>
                  {f}
                  {f === autoFocus ? ' (auto from title)' : ''}
                </MenuItem>
              ))}
            </TextField>

            <Typography variant="body2" sx={{ color: brand.muted, mb: 0.75 }}>
              Template / tone
            </Typography>
            <TextField
              select
              fullWidth
              size="small"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              sx={{ mb: 2.5 }}
            >
              {REPORT_TEMPLATES.map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </TextField>

            <Typography variant="body2" sx={{ color: brand.muted, mb: 0.75 }}>
              Sections
            </Typography>
            <Box
              sx={{
                border: `1px solid ${brand.line}`,
                borderRadius: '10px',
                px: 2,
                py: 1,
                mb: 3,
                display: 'flex',
                flexWrap: 'wrap',
                columnGap: 1.5,
              }}
            >
              {/* Mandatory structure — always included, server-enforced */}
              {MANDATORY_SECTIONS.map((s) => (
                <FormControlLabel
                  key={s}
                  control={<Checkbox size="small" checked disabled />}
                  label={
                    <Typography variant="body2" sx={{ color: brand.muted }}>
                      {s}
                    </Typography>
                  }
                />
              ))}
              {BODY_SECTIONS.map((s) => (
                <FormControlLabel
                  key={s}
                  control={
                    <Checkbox
                      size="small"
                      checked={sections.includes(s)}
                      onChange={() => toggleSection(s)}
                    />
                  }
                  label={<Typography variant="body2">{s}</Typography>}
                />
              ))}
            </Box>

            {error && (
              <Typography variant="body2" sx={{ color: '#c62828', mb: 1.5, textAlign: 'center' }}>
                {error}
              </Typography>
            )}
            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={<AutoAwesomeOutlinedIcon />}
              onClick={() => void handleGenerate()}
              disabled={sections.length === 0}
            >
              Generate with AI
            </Button>

            <Typography
              variant="caption"
              sx={{ display: 'block', textAlign: 'center', color: brand.faint, mt: 1.5 }}
            >
              AI researches &amp; writes a ~10 page consulting-style briefing personalized to this lead
            </Typography>
          </>
        )}
      </Box>
    </Dialog>
  );
}
