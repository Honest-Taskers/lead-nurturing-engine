import { useMemo, useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Link from '@mui/material/Link';
import Snackbar from '@mui/material/Snackbar';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import AddIcon from '@mui/icons-material/Add';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import DueChip from '../components/StatusChip';
import GenerateReportDialog from '../components/GenerateReportDialog';
import type { Lead } from '../data/types';
import { getDueStatus, isDue } from '../data/types';
import { brand } from '../theme';
import { useApp } from '../context/AppContext';

export default function DashboardPage() {
  const { leads, reportStats, settings, logout, apiError } = useApp();
  const navigate = useNavigate();
  const [genLead, setGenLead] = useState<Lead | null>(null);
  const [bulkMsg, setBulkMsg] = useState('');

  const dueLeads = useMemo(
    () =>
      leads
        .filter((l) => isDue(l))
        .sort((a, b) => (a.nextDueDate ?? '9999').localeCompare(b.nextDueDate ?? '9999')),
    [leads],
  );

  const upcoming = useMemo(
    () =>
      leads
        .filter((l) => !isDue(l) && l.nextDueDate)
        .sort((a, b) => a.nextDueDate!.localeCompare(b.nextDueDate!))
        .slice(0, Math.max(0, 6 - Math.min(dueLeads.length, 4))),
    [leads, dueLeads.length],
  );

  const tableRows = [...dueLeads.slice(0, 4), ...upcoming];


  return (
    <>
      <PageHeader
        title="Dashboard"
        actions={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              startIcon={<FileUploadOutlinedIcon />}
              onClick={() => navigate('/import')}
              sx={{ borderColor: brand.line, color: brand.ink }}
            >
              Import leads
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/leads/new')}
            >
              Add lead
            </Button>
            <Tooltip title="Log out">
              <Avatar
                onClick={logout}
                sx={{
                  width: 34,
                  height: 34,
                  bgcolor: brand.accentSoft,
                  color: brand.blueInk,
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                AB
              </Avatar>
            </Tooltip>
          </Box>
        }
      />

      <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {apiError && (
          <Card sx={{ bgcolor: '#fdecea', borderColor: '#f5c6c0', px: 2.5, py: 1.5 }}>
            <Typography variant="body2" sx={{ color: '#b71c1c' }}>
              Could not reach the API: {apiError}. Is the server running? (<code>cd server &amp;&amp; npm run dev</code>)
            </Typography>
          </Card>
        )}

        {/* KPI row */}
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <StatCard label="Total leads" value={leads.length} />
          <StatCard label="Due this week" value={dueLeads.length} highlight />
          <StatCard label="Reports generated" value={reportStats.total} />
          <StatCard label="Sent this month" value={reportStats.sentThisMonth} />
        </Box>

        {/* Due table */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.25 }}>
            <Typography variant="subtitle2">Leads due for a report</Typography>
            <Box sx={{ flex: 1 }} />
            <Link
              component={RouterLink}
              to="/leads?tab=due"
              underline="hover"
              sx={{ fontSize: '0.85rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
            >
              View all leads <ArrowForwardIcon sx={{ fontSize: 15 }} />
            </Link>
          </Box>
          <Card>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Organization</TableCell>
                  <TableCell>Target persona</TableCell>
                  <TableCell>Industry</TableCell>
                  <TableCell>Next report due</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {tableRows.map((lead) => {
                  const due = isDue(lead);
                  const status = getDueStatus(lead);
                  return (
                    <TableRow key={lead.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{lead.organization}</TableCell>
                      <TableCell>
                        {lead.personaName} · {lead.personaTitle}
                      </TableCell>
                      <TableCell>{lead.industry}</TableCell>
                      <TableCell>
                        <DueChip lead={lead} />
                      </TableCell>
                      <TableCell align="right">
                        {due && status.kind !== 'never' ? (
                          <Button
                            size="small"
                            sx={{
                              bgcolor: brand.okSoft,
                              color: brand.okInk,
                              px: 1.5,
                              '&:hover': { bgcolor: '#d2efe4' },
                            }}
                            onClick={() => setGenLead(lead)}
                          >
                            Generate
                          </Button>
                        ) : (
                          <Link
                            component={RouterLink}
                            to={`/leads/${lead.id}`}
                            underline="hover"
                            sx={{ fontWeight: 600, fontSize: '0.85rem' }}
                          >
                            Open
                          </Link>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </Box>

        {/* Cadence banner */}
        <Card sx={{ bgcolor: brand.surface, px: 2.5, py: 1.75, display: 'flex', alignItems: 'center' }}>
          <Typography variant="body2">
            <strong>Cadence:</strong> each lead gets a fresh, personalized industry report every{' '}
            {settings.cadenceDays === 14 ? '2 weeks' : `${settings.cadenceDays} days`}.
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Button
            variant="outlined"
            color="inherit"
            size="small"
            sx={{ borderColor: brand.line, bgcolor: '#fff' }}
            onClick={() => setBulkMsg(`Queued ${dueLeads.length} reports for generation`)}
            disabled={dueLeads.length === 0}
          >
            Generate all due ({dueLeads.length})
          </Button>
        </Card>
      </Box>

      <GenerateReportDialog lead={genLead} open={Boolean(genLead)} onClose={() => setGenLead(null)} />
      <Snackbar
        open={Boolean(bulkMsg)}
        autoHideDuration={3000}
        onClose={() => setBulkMsg('')}
        message={bulkMsg}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
}
