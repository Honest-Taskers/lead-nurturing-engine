import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import CompanyLogo from '../components/CompanyLogo';
import GenerateReportDialog from '../components/GenerateReportDialog';
import { formatShortDate, getDueStatus } from '../data/types';
import { brand } from '../theme';
import { useApp } from '../context/AppContext';

function MetaRow({ items }: { items: Array<[string, string | null | undefined]> }) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 3, rowGap: 0.75 }}>
      {items
        .filter(([, v]) => v)
        .map(([k, v]) => (
          <Typography key={k} variant="body2">
            <Typography component="span" variant="body2" sx={{ color: brand.faint }}>
              {k} ·{' '}
            </Typography>
            {v}
          </Typography>
        ))}
    </Box>
  );
}

export default function LeadDetailPage() {
  const { id } = useParams();
  const { getLead, reportsForLead, loadReportsForLead, settings, ready } = useApp();
  const navigate = useNavigate();
  const [genOpen, setGenOpen] = useState(false);

  const lead = id ? getLead(id) : undefined;

  useEffect(() => {
    if (lead?.id) void loadReportsForLead(lead.id);
  }, [lead?.id, loadReportsForLead]);

  if (!lead) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography>{ready ? 'Lead not found.' : 'Loading…'}</Typography>
        <Link component={RouterLink} to="/leads">
          Back to leads
        </Link>
      </Box>
    );
  }

  const reports = reportsForLead(lead.id);
  const due = getDueStatus(lead);
  const dueLabel =
    due.kind === 'today'
      ? 'Due today'
      : due.kind === 'overdue'
        ? `Overdue by ${due.days} day${due.days === 1 ? '' : 's'}`
        : due.kind === 'soon'
          ? `Due in ${due.days} day${due.days === 1 ? '' : 's'}`
          : due.kind === 'never'
            ? 'No report yet'
            : `Due ${formatShortDate(due.date)}`;

  return (
    <>
      <PageHeader
        breadcrumb={{ label: 'Leads', to: '/leads' }}
        title={lead.organization}
        chip={<Chip size="small" label={lead.industry} sx={{ bgcolor: brand.surface, color: brand.muted }} />}
        actions={
          <Box sx={{ display: 'flex', gap: 1.25 }}>
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              startIcon={<EditOutlinedIcon />}
              sx={{ borderColor: brand.line }}
              onClick={() => navigate(`/leads/${lead.id}/edit`)}
            >
              Edit
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<AutoAwesomeOutlinedIcon />}
              onClick={() => setGenOpen(true)}
            >
              Generate report
            </Button>
          </Box>
        }
      />

      <Box sx={{ p: 3, display: 'flex', gap: 2, alignItems: 'flex-start' }}>
        {/* Left column */}
        <Box sx={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: 2.5, minWidth: 0 }}>
          <Card sx={{ p: 2.5 }}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Target persona
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.75, alignItems: 'center', mb: 2 }}>
              {lead.photoUrl ? (
                <Box
                  component="img"
                  src={lead.photoUrl}
                  alt={lead.personaName}
                  sx={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: `1px solid ${brand.line}` }}
                />
              ) : (
                <CompanyLogo lead={lead} size={44} />
              )}
              <Box>
                <Typography sx={{ fontWeight: 700 }}>{lead.personaName}</Typography>
                <Typography variant="body2" sx={{ color: brand.muted }}>
                  {lead.personaTitle} · {lead.organization}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <MetaRow
                items={[
                  ['Vertical', lead.industry],
                  ['Size', lead.orgSize],
                  ['HQ', lead.headquarters],
                ]}
              />
              <MetaRow
                items={[
                  ['Website', lead.website],
                  ['Reach', lead.locationsReach],
                ]}
              />
              <MetaRow
                items={[
                  ['Email', lead.emails],
                  ['Phone', lead.phone],
                ]}
              />
              <MetaRow
                items={[
                  ['LinkedIn', lead.linkedinUrl],
                  ['Contact path', lead.contactPath],
                ]}
              />
              <MetaRow
                items={[
                  ['Mailing address', lead.mailingAddress],
                  ['Rep', lead.assignedRep],
                ]}
              />
              <MetaRow items={[['Signal', lead.hiringSignal]]} />
            </Box>
          </Card>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1.25 }}>
              Report history
            </Typography>
            <Card>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Report</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reports.map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell>{formatShortDate(r.generatedAt)}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{r.title}</TableCell>
                      <TableCell>
                        {r.status === 'sent' ? (
                          <Chip size="small" label="Sent" sx={{ bgcolor: brand.okSoft, color: brand.okInk }} />
                        ) : (
                          <Chip size="small" label="Generated" sx={{ bgcolor: brand.accentSoft, color: brand.blueInk }} />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Link
                          component={RouterLink}
                          to={`/leads/${lead.id}/report/${r.id}`}
                          underline="hover"
                          sx={{ fontWeight: 600, fontSize: '0.85rem' }}
                        >
                          {r.status === 'sent' ? 'Download' : 'Open'}
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                  {reports.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} sx={{ textAlign: 'center', py: 4, color: brand.faint }}>
                        No reports yet — generate the first one.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </Box>
        </Box>

        {/* Right column */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <Card sx={{ p: 2.5, bgcolor: brand.accentSoft, borderColor: brand.sky }}>
            <Typography variant="body2" sx={{ color: brand.blueInk, fontWeight: 700, mb: 0.5 }}>
              Next report
            </Typography>
            <Typography variant="h5" sx={{ mb: 0.5 }}>
              {dueLabel}
            </Typography>
            <Typography variant="body2" sx={{ color: brand.muted, mb: 2 }}>
              Cadence: every {settings.cadenceDays === 14 ? '2 weeks' : `${settings.cadenceDays} days`}
            </Typography>
            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={<AutoAwesomeOutlinedIcon />}
              onClick={() => setGenOpen(true)}
            >
              Generate now
            </Button>
            <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: brand.muted, mt: 1.25 }}>
              Personalized to {lead.personaTitle} · {lead.industry}
            </Typography>
          </Card>

          <Card sx={{ p: 2.5 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              After generating
            </Typography>
            <Typography variant="body2" sx={{ color: brand.muted }}>
              Preview → Download PDF → print &amp; mail → <strong>Mark as sent</strong> (sets next due +
              {settings.cadenceDays === 14 ? '2 weeks' : `${settings.cadenceDays} days`}).
            </Typography>
          </Card>
        </Box>
      </Box>

      <GenerateReportDialog lead={genOpen ? lead : null} open={genOpen} onClose={() => setGenOpen(false)} />
    </>
  );
}
