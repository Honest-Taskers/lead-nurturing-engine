import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import type { Lead } from '../data/types';
import { brand } from '../theme';
import { useApp } from '../context/AppContext';

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography variant="body2" sx={{ color: brand.muted, mb: 0.5 }}>
        {props.label}
        {props.hint && (
          <Typography component="span" variant="caption" sx={{ color: brand.faint }}>
            {' '}
            {props.hint}
          </Typography>
        )}
      </Typography>
      <TextField
        fullWidth
        size="small"
        required={props.required}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </Box>
  );
}

export default function LeadFormPage() {
  const { id } = useParams();
  const { getLead, saveLead, settings } = useApp();
  const navigate = useNavigate();
  const existing = id ? getLead(id) : undefined;

  const [form, setForm] = useState<Partial<Lead>>(
    existing ?? { assignedRep: settings.defaultRep },
  );
  const set = (k: keyof Lead) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const val = (k: keyof Lead) => (form[k] as string | undefined) ?? '';

  const [saveError, setSaveError] = useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    void (async () => {
      try {
        const saved = await saveLead(existing ? { ...form, id: existing.id } : form);
        navigate(`/leads/${saved.id}`);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Could not save lead');
      }
    })();
  };

  return (
    <Box component="form" onSubmit={handleSave} sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <PageHeader
        breadcrumb={{ label: 'Leads', to: '/leads' }}
        title={existing ? 'Edit lead' : 'Add lead'}
        actions={
          <Box sx={{ display: 'flex', gap: 1.25 }}>
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              sx={{ borderColor: brand.line }}
              onClick={() => navigate(existing ? `/leads/${existing.id}` : '/leads')}
            >
              Cancel
            </Button>
            <Button size="small" variant="contained" type="submit">
              Save lead
            </Button>
          </Box>
        }
      />

      {saveError && (
        <Typography variant="body2" sx={{ color: '#b71c1c', px: 3, pt: 2 }}>
          {saveError}
        </Typography>
      )}
      <Box sx={{ p: 3, display: 'flex', gap: 2, alignItems: 'flex-start' }}>
        {/* Organization */}
        <Card sx={{ flex: 1, p: 2.5 }}>
          <Typography variant="subtitle2" sx={{ mb: 2 }}>
            Organization
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Field
              label="Organization name"
              required
              value={val('organization')}
              onChange={set('organization')}
              placeholder="CommonSpirit Health"
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Field
                label="Vertical / industry"
                required
                value={val('industry')}
                onChange={set('industry')}
                placeholder="Hospital System"
              />
              <Field
                label="Website"
                value={val('website')}
                onChange={set('website')}
                placeholder="commonspirit.org"
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Field
                label="Headquarters"
                value={val('headquarters')}
                onChange={set('headquarters')}
                placeholder="Chicago, IL"
              />
              <Field
                label="Org size"
                value={val('orgSize')}
                onChange={set('orgSize')}
                placeholder="Enterprise; 150,000+"
              />
            </Box>
            <Field
              label="Locations / reach"
              value={val('locationsReach')}
              onChange={set('locationsReach')}
              placeholder="140+ hospitals; 700+ care sites"
            />
            <Field
              label="Open positions / hiring signal"
              value={val('hiringSignal')}
              onChange={set('hiringSignal')}
              placeholder="Ongoing enterprise healthcare hiring"
            />
            <Field
              label="Logo URL"
              hint="(auto-filled from the website via logo.dev)"
              value={val('logoUrl')}
              onChange={set('logoUrl')}
              placeholder="https://img.logo.dev/commonspirit.org"
            />
          </Box>
        </Card>

        {/* Target persona */}
        <Card sx={{ flex: 1, p: 2.5 }}>
          <Typography variant="subtitle2" sx={{ mb: 2 }}>
            Target persona{' '}
            <Typography component="span" variant="caption" sx={{ color: brand.faint }}>
              (drives personalization)
            </Typography>
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Field
                label="Name"
                required
                value={val('personaName')}
                onChange={set('personaName')}
                placeholder="Steve Scharmann"
              />
              <Field
                label="Title"
                required
                value={val('personaTitle')}
                onChange={set('personaTitle')}
                placeholder="VP of Revenue Cycle"
              />
            </Box>
            <Field
              label="Email(s)"
              value={val('emails')}
              onChange={set('emails')}
              placeholder="steve.scharmann@commonspirit.org"
            />
            <Field
              label="LinkedIn URL"
              value={val('linkedinUrl')}
              onChange={set('linkedinUrl')}
              placeholder="linkedin.com/in/steve-scharmann"
            />
            <Field
              label="LinkedIn / contact path"
              hint="(profile or company page to reach them through)"
              value={val('contactPath')}
              onChange={set('contactPath')}
              placeholder="linkedin.com/company/commonspirit-health/"
            />
            <Field
              label="Photo URL"
              hint="(headshot for the personalized report cover — optional)"
              value={val('photoUrl')}
              onChange={set('photoUrl')}
              placeholder="https://example.com/steve-scharmann.jpg"
            />
            <Field
              label="Phone"
              value={val('phone')}
              onChange={set('phone')}
              placeholder="(312) 741-7000"
            />
            <Field
              label="Mailing address"
              value={val('mailingAddress')}
              onChange={set('mailingAddress')}
              placeholder="Sacramento, CA 95834"
            />
            <Field
              label="Assigned rep"
              hint='(report appears "from")'
              value={val('assignedRep')}
              onChange={set('assignedRep')}
              placeholder="Jaya"
            />
          </Box>
        </Card>
      </Box>
    </Box>
  );
}
