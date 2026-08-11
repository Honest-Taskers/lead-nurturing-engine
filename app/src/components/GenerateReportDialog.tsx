import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import { useNavigate } from 'react-router-dom';
import type { Lead } from '../data/types';
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

  const autoFocus = useMemo(() => (lead ? focusFromTitle(lead.personaTitle) : FOCUS_OPTIONS[0]), [lead]);

  useEffect(() => {
    if (open && lead) {
      setFocus(focusFromTitle(lead.personaTitle));
      setTemplate(REPORT_TEMPLATES[0]);
      setSections([...settings.defaultSections]);
      setGenerating(false);
      setError('');
    }
  }, [open, lead, settings.defaultSections]);

  if (!lead) return null;

  const toggleSection = (s: string) =>
    setSections((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      const report = await generateReport(lead.id, { focus, template, sections });
      onClose();
      navigate(`/leads/${lead.id}/report/${report.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Report generation failed');
    } finally {
      setGenerating(false);
    }
  };

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

        {generating ? (
          <Box sx={{ mb: 1 }}>
            <LinearProgress sx={{ borderRadius: 2, height: 6, mb: 1.5 }} />
            <Typography variant="body2" sx={{ textAlign: 'center', color: brand.muted }}>
              ✦ Researching &amp; writing — this can take a few minutes…
            </Typography>
          </Box>
        ) : (
          <>
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
          </>
        )}

        <Typography
          variant="caption"
          sx={{ display: 'block', textAlign: 'center', color: brand.faint, mt: 1.5 }}
        >
          AI researches &amp; writes a 6–10 page report personalized to this lead
        </Typography>
      </Box>
    </Dialog>
  );
}
