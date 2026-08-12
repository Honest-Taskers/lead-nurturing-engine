import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import PageHeader from '../components/PageHeader';
import { BODY_SECTIONS, MANDATORY_SECTIONS } from '../data/types';

/** Max custom body sections per report — mirrors the server cap. */
const MAX_BODY_SECTIONS = 6;
import { brand } from '../theme';
import { useApp } from '../context/AppContext';

const MODELS = [
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5 · recommended' },
  { id: 'claude-opus-5', label: 'Claude Opus 5 · most capable' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 · fast & low cost' },
];
const CADENCES = [
  { days: 7, label: 'Every week (7 days)' },
  { days: 14, label: 'Every 2 weeks (14 days)' },
  { days: 30, label: 'Every month (30 days)' },
];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="body2" sx={{ color: brand.muted, mb: 0.5 }}>
      {children}
    </Typography>
  );
}

export default function SettingsPage() {
  const { settings, saveSettings } = useApp();
  const [form, setForm] = useState({ ...settings });
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Settings load async after mount — sync the form when they arrive.
  const [newSection, setNewSection] = useState('');

  useEffect(() => {
    setForm({ ...settings });
  }, [settings]);

  const removeSection = (s: string) =>
    setForm((f) => ({ ...f, defaultSections: f.defaultSections.filter((x) => x !== s) }));

  const addSection = (raw: string) => {
    const name = raw.trim().slice(0, 60).trim();
    if (!name) return;
    setForm((f) =>
      f.defaultSections.includes(name) || f.defaultSections.length >= MAX_BODY_SECTIONS
        ? f
        : { ...f, defaultSections: [...f.defaultSections, name] },
    );
    setNewSection('');
  };

  const handleLogo = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, logoDataUrl: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings({
        companyName: form.companyName,
        defaultRep: form.defaultRep,
        cadenceDays: form.cadenceDays,
        defaultSections: form.defaultSections,
        aiPrompt: form.aiPrompt,
        aiModel: form.aiModel,
        logoDataUrl: form.logoDataUrl ?? null,
        about: form.about ?? null,
        ...(form.brandPrimary ? { brandPrimary: form.brandPrimary } : {}),
        ...(form.brandSecondary ? { brandSecondary: form.brandSecondary } : {}),
        fonts: form.fonts ?? null,
      });
      setMsg('Settings saved');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Could not save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Settings"
        actions={
          <Button size="small" variant="contained" onClick={() => void handleSave()} disabled={saving}>
            Save
          </Button>
        }
      />

      <Box sx={{ p: 3, display: 'flex', gap: 2, alignItems: 'flex-start' }}>
        {/* Left column */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Card sx={{ p: 2.5 }}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Brand
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              {form.logoDataUrl ? (
                <Box
                  component="img"
                  src={form.logoDataUrl}
                  alt="logo"
                  sx={{ width: 56, height: 40, objectFit: 'contain', borderRadius: 1, border: `1px solid ${brand.line}` }}
                />
              ) : (
                <Box sx={{ width: 56, height: 40, borderRadius: 1, bgcolor: brand.surface, border: `1px solid ${brand.line}` }} />
              )}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleLogo(f);
                  e.target.value = '';
                }}
              />
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                sx={{ borderColor: brand.line }}
                onClick={() => logoInputRef.current?.click()}
              >
                Upload logo
              </Button>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <FieldLabel>Company name</FieldLabel>
                <TextField
                  fullWidth
                  size="small"
                  value={form.companyName}
                  onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                />
              </Box>
              <Box>
                <FieldLabel>Default sender / rep</FieldLabel>
                <TextField
                  fullWidth
                  size="small"
                  value={form.defaultRep}
                  onChange={(e) => setForm((f) => ({ ...f, defaultRep: e.target.value }))}
                />
              </Box>
              <Box>
                <FieldLabel>About (grounds the report&apos;s closing note)</FieldLabel>
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  size="small"
                  value={form.about ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, about: e.target.value }))}
                />
              </Box>
              <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-end' }}>
                <Box>
                  <FieldLabel>Primary color</FieldLabel>
                  <input
                    type="color"
                    value={form.brandPrimary ?? '#203667'}
                    onChange={(e) => setForm((f) => ({ ...f, brandPrimary: e.target.value }))}
                    style={{ width: 52, height: 36, border: 'none', background: 'none', cursor: 'pointer' }}
                  />
                </Box>
                <Box>
                  <FieldLabel>Accent color</FieldLabel>
                  <input
                    type="color"
                    value={form.brandSecondary ?? '#F7B84A'}
                    onChange={(e) => setForm((f) => ({ ...f, brandSecondary: e.target.value }))}
                    style={{ width: 52, height: 36, border: 'none', background: 'none', cursor: 'pointer' }}
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <FieldLabel>Fonts (optional)</FieldLabel>
                  <TextField
                    fullWidth
                    size="small"
                    value={form.fonts ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, fonts: e.target.value }))}
                    placeholder="e.g. Inter, Georgia"
                  />
                </Box>
              </Box>
            </Box>
          </Card>

          <TeamCard />

          <Card sx={{ p: 2.5 }}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Cadence
            </Typography>
            <FieldLabel>Report frequency per lead</FieldLabel>
            <TextField
              select
              fullWidth
              size="small"
              value={form.cadenceDays}
              onChange={(e) => setForm((f) => ({ ...f, cadenceDays: Number(e.target.value) }))}
            >
              {CADENCES.map((c) => (
                <MenuItem key={c.days} value={c.days}>
                  {c.label}
                </MenuItem>
              ))}
            </TextField>
          </Card>
        </Box>

        {/* Right column */}
        <Box sx={{ flex: 1.1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Card sx={{ p: 2.5 }}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Report template
            </Typography>
            <FieldLabel>
              Default sections{' '}
              <Typography component="span" variant="caption" sx={{ color: brand.faint }}>
                — name them for your practice, e.g. "Tax & entity considerations"
              </Typography>
            </FieldLabel>
            <Box
              sx={{
                border: `1px solid ${brand.line}`,
                borderRadius: '10px',
                px: 1.5,
                py: 1.25,
                mb: 2,
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 0.75,
              }}
            >
              {/* Mandatory structure — always included, server-enforced */}
              {MANDATORY_SECTIONS.map((s) => (
                <Chip key={s} size="small" label={s} sx={{ bgcolor: brand.surface, color: brand.muted }} />
              ))}
              {form.defaultSections.map((s) => (
                <Chip key={s} size="small" label={s} onDelete={() => removeSection(s)} />
              ))}
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', width: '100%', mt: 0.75 }}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder={
                    form.defaultSections.length >= MAX_BODY_SECTIONS
                      ? `Up to ${MAX_BODY_SECTIONS} body sections`
                      : 'Add a section…'
                  }
                  value={newSection}
                  disabled={form.defaultSections.length >= MAX_BODY_SECTIONS}
                  onChange={(e) => setNewSection(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSection(newSection);
                    }
                  }}
                  slotProps={{ htmlInput: { maxLength: 60 } }}
                />
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => addSection(newSection)}
                  disabled={!newSection.trim() || form.defaultSections.length >= MAX_BODY_SECTIONS}
                >
                  Add
                </Button>
              </Box>
              {form.defaultSections.length === 0 && (
                <Typography variant="caption" sx={{ color: brand.faint, width: '100%' }}>
                  Suggestions:{' '}
                  {BODY_SECTIONS.map((s) => (
                    <Chip
                      key={s}
                      size="small"
                      variant="outlined"
                      label={s}
                      onClick={() => addSection(s)}
                      sx={{ mr: 0.5, mb: 0.5 }}
                    />
                  ))}
                </Typography>
              )}
            </Box>
            <FieldLabel>
              AI prompt / style{' '}
              <Typography component="span" variant="caption" sx={{ color: brand.faint }}>
                — variables: {'{title}'} {'{company}'} {'{industry}'}
              </Typography>
            </FieldLabel>
            <TextField
              fullWidth
              multiline
              minRows={3}
              size="small"
              value={form.aiPrompt}
              onChange={(e) => setForm((f) => ({ ...f, aiPrompt: e.target.value }))}
            />
          </Card>

          <Card sx={{ p: 2.5 }}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              AI
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <Box sx={{ flex: 1 }}>
                <FieldLabel>Model</FieldLabel>
                <TextField
                  select
                  fullWidth
                  size="small"
                  value={MODELS.some((m) => m.id === form.aiModel) ? form.aiModel : 'claude-sonnet-5'}
                  onChange={(e) => setForm((f) => ({ ...f, aiModel: e.target.value }))}
                >
                  {MODELS.map((m) => (
                    <MenuItem key={m.id} value={m.id}>
                      {m.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
              <Box sx={{ flex: 1.4 }}>
                <FieldLabel>API key</FieldLabel>
                {settings.apiKeyConfigured ? (
                  <Chip label="Configured on server" sx={{ bgcolor: brand.okSoft, color: brand.okInk }} />
                ) : (
                  <Typography variant="body2" sx={{ color: brand.warnInk, pt: 0.5 }}>
                    Not configured — set <code>ANTHROPIC_API_KEY</code> in <code>server/.env</code> and restart the
                    server. Reports use a stub until then.
                  </Typography>
                )}
              </Box>
            </Box>
          </Card>
        </Box>
      </Box>

      <Snackbar
        open={Boolean(msg)}
        autoHideDuration={2500}
        onClose={() => setMsg('')}
        message={msg}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
}

/** Team members of the active sender — the "from" identities on reports. */
function TeamCard() {
  const { teamMembers, addTeamMember, updateTeamMember, removeTeamMember } = useApp();
  const [draft, setDraft] = useState({ name: '', title: '', email: '' });
  const [busy, setBusy] = useState(false);

  const handleAdd = async () => {
    if (!draft.name.trim()) return;
    setBusy(true);
    try {
      await addTeamMember({
        name: draft.name.trim(),
        title: draft.title.trim() || null,
        email: draft.email.trim() || null,
        sortOrder: teamMembers.length,
      });
      setDraft({ name: '', title: '', email: '' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card sx={{ p: 2.5 }}>
      <Typography variant="subtitle2" sx={{ mb: 2 }}>
        Team members{' '}
        <Typography component="span" variant="caption" sx={{ color: brand.faint }}>
          (the “from” identities on reports)
        </Typography>
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {teamMembers.map((m) => (
          <Box key={m.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, border: `1px solid ${brand.line}`, borderRadius: '8px', px: 1.5, py: 1 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {m.name}
              </Typography>
              <Typography variant="caption" sx={{ color: brand.muted }}>
                {[m.title, m.email].filter(Boolean).join(' · ') || '—'}
              </Typography>
            </Box>
            <Button
              size="small"
              color="inherit"
              sx={{ color: brand.muted }}
              onClick={() => {
                const title = window.prompt(`Title for ${m.name}:`, m.title ?? '');
                if (title !== null) void updateTeamMember(m.id, { title: title || null });
              }}
            >
              Edit
            </Button>
            <Button size="small" color="inherit" sx={{ color: brand.muted }} onClick={() => void removeTeamMember(m.id)}>
              Remove
            </Button>
          </Box>
        ))}
        {teamMembers.length === 0 && (
          <Typography variant="body2" sx={{ color: brand.faint }}>
            No team members yet.
          </Typography>
        )}
        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
          <TextField size="small" placeholder="Name" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} sx={{ flex: 1 }} />
          <TextField size="small" placeholder="Title" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} sx={{ flex: 1 }} />
          <TextField size="small" placeholder="Email" value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} sx={{ flex: 1 }} />
          <Button size="small" variant="outlined" color="inherit" sx={{ borderColor: brand.line }} disabled={busy || !draft.name.trim()} onClick={() => void handleAdd()}>
            Add
          </Button>
        </Box>
      </Box>
    </Card>
  );
}
