import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';
import CheckIcon from '@mui/icons-material/Check';
import ReplayIcon from '@mui/icons-material/Replay';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import ReportDocument from '../components/ReportDocument';
import { brand } from '../theme';
import { downloadBlob } from '../api/download';
import { useApp } from '../context/AppContext';

function MetaItem({ k, v }: { k: string; v: string }) {
  return (
    <Typography variant="body2" sx={{ mb: 0.75 }}>
      <Typography component="span" variant="body2" sx={{ color: brand.faint }}>
        {k} ·{' '}
      </Typography>
      {v}
    </Typography>
  );
}

export default function ReportPreviewPage() {
  const { leadId, reportId } = useParams();
  const { getLead, reports, loadReportsForLead, markAsSent, settings, generateReport, ready } = useApp();
  const navigate = useNavigate();
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const lead = leadId ? getLead(leadId) : undefined;
  const report = reports.find((r) => r.id === reportId);

  // Deep link / refresh: load the lead's reports if this one isn't cached yet.
  useEffect(() => {
    if (leadId && !report) void loadReportsForLead(leadId);
  }, [leadId, report, loadReportsForLead]);

  if (!lead || !report) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography>{ready ? 'Loading report…' : 'Loading…'}</Typography>
      </Box>
    );
  }

  const shortName = `${lead.personaName.split(' ')[0][0]}. ${lead.personaName.split(' ').slice(1).join(' ')}`;
  const generatedLabel =
    new Date(report.generatedAt + 'T00:00:00').toDateString() === new Date().toDateString()
      ? 'today'
      : report.generatedAt;

  const handleRegenerate = async () => {
    setBusy(true);
    setMsg('Regenerating…');
    try {
      const fresh = await generateReport(lead.id, {
        focus: report.focus,
        template: report.template,
        sections: report.sections.map((s) => s.key),
      });
      navigate(`/leads/${lead.id}/report/${fresh.id}`, { replace: true });
      setMsg('Report regenerated');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Regeneration failed');
    } finally {
      setBusy(false);
    }
  };

  // Downloads the designed print PDF rendered server-side (585×783pt editorial
  // template with live vector text — not a capture of this web preview).
  const handleDownloadPdf = async () => {
    setBusy(true);
    setMsg('Preparing print PDF…');
    try {
      const res = await fetch(`/api/reports/${report.id}/pdf`);
      if (!res.ok) throw new Error('PDF rendering failed');
      const blob = await res.blob();
      const safeName = report.title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'report';
      downloadBlob(blob, `${safeName}.pdf`);
      setMsg('PDF downloaded');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'PDF export failed');
    } finally {
      setBusy(false);
    }
  };

  const handleMarkSent = async () => {
    setBusy(true);
    try {
      await markAsSent(report.id);
      setMsg('Marked as sent — next report auto-scheduled');
      setTimeout(() => navigate(`/leads/${lead.id}`), 1200);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Could not mark as sent');
      setBusy(false);
    }
  };

  return (
    <>
      <Box className="no-print">
        <PageHeader
          breadcrumb={{ label: lead.organization, to: `/leads/${lead.id}` }}
          title="Report preview"
          chip={
            report.status === 'sent' ? (
              <Chip size="small" label="Sent ✓" sx={{ bgcolor: brand.okSoft, color: brand.okInk }} />
            ) : (
              <Chip size="small" label="Generated ✓" sx={{ bgcolor: brand.okSoft, color: brand.okInk }} />
            )
          }
          actions={
            <Box sx={{ display: 'flex', gap: 1.25 }}>
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                startIcon={<ReplayIcon />}
                sx={{ borderColor: brand.line }}
                onClick={() => void handleRegenerate()}
                disabled={busy}
              >
                Regenerate
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                startIcon={<FileDownloadOutlinedIcon />}
                sx={{ borderColor: brand.line }}
                onClick={() => void handleDownloadPdf()}
                disabled={busy}
              >
                Download PDF
              </Button>
              <Button
                size="small"
                variant="contained"
                startIcon={<CheckIcon />}
                onClick={() => void handleMarkSent()}
                disabled={busy || report.status === 'sent'}
              >
                Mark as sent
              </Button>
            </Box>
          }
        />
      </Box>

      <Box sx={{ p: 3, display: 'flex', gap: 2, alignItems: 'flex-start' }} className="report-layout">
        {/* Meta rail */}
        <Box className="no-print" sx={{ width: 230, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Card sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
              Report meta
            </Typography>
            <MetaItem k="Lead" v={shortName} />
            <MetaItem k="Title" v={lead.personaTitle} />
            <MetaItem k="Industry" v={lead.industry} />
            <MetaItem k="Generated" v={generatedLabel} />
            <MetaItem k="Template" v={report.template.split('·')[0].trim()} />
            <MetaItem k="Rep" v={lead.assignedRep} />
            {report.model && <MetaItem k="Model" v={report.model} />}
          </Card>
          <Card sx={{ p: 2, bgcolor: brand.surface }}>
            <Typography variant="body2" sx={{ color: brand.muted }}>
              On <strong>Mark as sent</strong>, next report auto-schedules in{' '}
              {settings.cadenceDays === 14 ? '2 weeks' : `${settings.cadenceDays} days`}.
            </Typography>
          </Card>
        </Box>

        {/* Document */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <ReportDocument lead={lead} report={report} />
        </Box>
      </Box>

      <Snackbar
        open={Boolean(msg)}
        autoHideDuration={3000}
        onClose={() => setMsg('')}
        message={msg}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
}
