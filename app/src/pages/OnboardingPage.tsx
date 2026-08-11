import { useRef, useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import IconButton from '@mui/material/IconButton';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { brand } from '../theme';
import { useApp } from '../context/AppContext';

interface MemberDraft {
  name: string;
  title: string;
  email: string;
  phone: string;
  bio: string;
}

const emptyMember = (): MemberDraft => ({ name: '', title: '', email: '', phone: '', bio: '' });

function Field(props: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean; multiline?: boolean }) {
  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography variant="body2" sx={{ color: brand.muted, mb: 0.5 }}>
        {props.label}
      </Typography>
      <TextField
        fullWidth
        size="small"
        required={props.required}
        multiline={props.multiline}
        minRows={props.multiline ? 3 : undefined}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </Box>
  );
}

/**
 * New-sender onboarding (meeting 08/11): brand identity → team members → done.
 * Creates the sender, adds the team, and switches the workspace to it.
 */
export default function OnboardingPage() {
  const { createSender, addTeamMember, switchSender } = useApp();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Step 1 — brand identity
  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [brandPrimary, setBrandPrimary] = useState('#203667');
  const [brandSecondary, setBrandSecondary] = useState('#F7B84A');
  const [fonts, setFonts] = useState('');
  const [defaultRep, setDefaultRep] = useState('');

  // Step 2 — team
  const [members, setMembers] = useState<MemberDraft[]>([emptyMember()]);

  const handleLogoFile = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(String(reader.result));
    reader.readAsDataURL(f);
  };

  const setMember = (i: number, patch: Partial<MemberDraft>) =>
    setMembers((ms) => ms.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));

  const handleFinish = async () => {
    setSaving(true);
    setError('');
    try {
      const filled = members.filter((m) => m.name.trim());
      const sender = await createSender({
        name: name.trim(),
        about: about.trim() || null,
        logoDataUrl,
        brandPrimary,
        brandSecondary,
        fonts: fonts.trim() || null,
        defaultRep: defaultRep.trim() || filled[0]?.name.trim() || '',
      });
      for (const [i, m] of filled.entries()) {
        await addTeamMember({
          name: m.name.trim(),
          title: m.title.trim() || null,
          email: m.email.trim() || null,
          phone: m.phone.trim() || null,
          bio: m.bio.trim() || null,
          sortOrder: i,
        });
      }
      await switchSender(sender.id);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the sender');
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Set up a new sender" />
      <Box sx={{ p: 3, maxWidth: 760 }}>
        <Stepper activeStep={step} sx={{ mb: 3 }}>
          {['Brand identity', 'Team members', 'Review'].map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {step === 0 && (
          <Card sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle2">Who is sending these reports?</Typography>
            <Field label="Company name" required value={name} onChange={setName} placeholder="Sterling Financial Partners" />
            <Field
              label="About (grounds the report's closing note)"
              multiline
              value={about}
              onChange={setAbout}
              placeholder="Independent wealth advisory serving founders and family offices."
            />
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
              <Box>
                <Typography variant="body2" sx={{ color: brand.muted, mb: 0.5 }}>
                  Logo
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Avatar variant="rounded" src={logoDataUrl ?? undefined} sx={{ width: 52, height: 52, bgcolor: brandSecondary, color: brandPrimary, fontWeight: 700 }}>
                    {name[0]?.toUpperCase() ?? '?'}
                  </Avatar>
                  <Button size="small" variant="outlined" color="inherit" sx={{ borderColor: brand.line }} onClick={() => fileRef.current?.click()}>
                    Upload logo
                  </Button>
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && handleLogoFile(e.target.files[0])} />
                </Box>
              </Box>
              <Box>
                <Typography variant="body2" sx={{ color: brand.muted, mb: 0.5 }}>
                  Primary color
                </Typography>
                <input type="color" value={brandPrimary} onChange={(e) => setBrandPrimary(e.target.value)} style={{ width: 52, height: 36, border: 'none', background: 'none', cursor: 'pointer' }} />
              </Box>
              <Box>
                <Typography variant="body2" sx={{ color: brand.muted, mb: 0.5 }}>
                  Accent color
                </Typography>
                <input type="color" value={brandSecondary} onChange={(e) => setBrandSecondary(e.target.value)} style={{ width: 52, height: 36, border: 'none', background: 'none', cursor: 'pointer' }} />
              </Box>
              <Field label="Fonts (optional)" value={fonts} onChange={setFonts} placeholder="e.g. Inter, Georgia" />
            </Box>
            <Field label="Default sender / rep" value={defaultRep} onChange={setDefaultRep} placeholder="Morgan" />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="contained" disabled={!name.trim()} onClick={() => setStep(1)}>
                Next · Team
              </Button>
            </Box>
          </Card>
        )}

        {step === 1 && (
          <Card sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle2">Team members (the “from” identities on reports)</Typography>
            {members.map((m, i) => (
              <Box key={i} sx={{ border: `1px solid ${brand.line}`, borderRadius: '10px', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Field label="Name" value={m.name} onChange={(v) => setMember(i, { name: v })} placeholder="Diana" />
                  <Field label="Title" value={m.title} onChange={(v) => setMember(i, { title: v })} placeholder="Client Partnerships" />
                  <IconButton size="small" sx={{ alignSelf: 'flex-end', mb: 0.5 }} onClick={() => setMembers((ms) => ms.filter((_, idx) => idx !== i))} disabled={members.length === 1}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Box>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Field label="Email" value={m.email} onChange={(v) => setMember(i, { email: v })} placeholder="diana@company.com" />
                  <Field label="Phone" value={m.phone} onChange={(v) => setMember(i, { phone: v })} placeholder="(214) 555-0100" />
                </Box>
                <Field label="Short bio" value={m.bio} onChange={(v) => setMember(i, { bio: v })} placeholder="10 years in healthcare operations…" />
              </Box>
            ))}
            <Button size="small" startIcon={<AddIcon />} onClick={() => setMembers((ms) => [...ms, emptyMember()])} sx={{ alignSelf: 'flex-start' }}>
              Add another member
            </Button>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button color="inherit" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button variant="contained" onClick={() => setStep(2)}>
                Next · Review
              </Button>
            </Box>
          </Card>
        )}

        {step === 2 && (
          <Card sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle2">Review</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Avatar variant="rounded" src={logoDataUrl ?? undefined} sx={{ width: 44, height: 44, bgcolor: brandSecondary, color: brandPrimary, fontWeight: 700 }}>
                {name[0]?.toUpperCase()}
              </Avatar>
              <Box>
                <Typography sx={{ fontWeight: 700 }}>{name}</Typography>
                <Typography variant="body2" sx={{ color: brand.muted }}>
                  {members.filter((m) => m.name.trim()).length} team member(s) · colors{' '}
                  <Box component="span" sx={{ display: 'inline-block', width: 12, height: 12, bgcolor: brandPrimary, borderRadius: '3px', verticalAlign: 'middle' }} />{' '}
                  <Box component="span" sx={{ display: 'inline-block', width: 12, height: 12, bgcolor: brandSecondary, borderRadius: '3px', verticalAlign: 'middle' }} />
                </Typography>
              </Box>
            </Box>
            {about && (
              <Typography variant="body2" sx={{ color: brand.muted }}>
                {about}
              </Typography>
            )}
            {error && (
              <Typography variant="body2" sx={{ color: '#c62828' }}>
                {error}
              </Typography>
            )}
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button color="inherit" onClick={() => setStep(1)} disabled={saving}>
                Back
              </Button>
              <Button variant="contained" onClick={() => void handleFinish()} disabled={saving}>
                {saving ? 'Creating…' : 'Create sender & switch'}
              </Button>
            </Box>
          </Card>
        )}
      </Box>
    </>
  );
}
