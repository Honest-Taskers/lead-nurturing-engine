import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Pagination from '@mui/material/Pagination';
import Snackbar from '@mui/material/Snackbar';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import CompanyLogo from '../components/CompanyLogo';
import DueChip from '../components/StatusChip';
import { defaultFocus } from '../components/GenerateReportDialog';
import { REPORT_TEMPLATES, formatShortDate, isDue } from '../data/types';
import { brand } from '../theme';
import { useApp } from '../context/AppContext';

const PAGE_SIZE = 12;

export default function LeadsPage() {
  const { leads, generateReport, settings } = useApp();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'all';
  const [search, setSearch] = useState('');
  const [industry, setIndustry] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [bulkMsg, setBulkMsg] = useState('');

  const industries = useMemo(
    () => Array.from(new Set(leads.map((l) => l.industry))).sort(),
    [leads],
  );

  const filtered = useMemo(() => {
    let rows = leads;
    if (tab === 'due') rows = rows.filter((l) => isDue(l));
    if (tab === 'sent') rows = rows.filter((l) => l.lastReportDate);
    if (industry !== 'all') rows = rows.filter((l) => l.industry === industry);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (l) =>
          l.organization.toLowerCase().includes(q) ||
          l.personaName.toLowerCase().includes(q) ||
          l.personaTitle.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [leads, tab, industry, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allChecked = pageRows.length > 0 && pageRows.every((l) => selected.has(l.id));

  const setTab = (value: string) => {
    setParams(value === 'all' ? {} : { tab: value });
    setPage(1);
    setSelected(new Set());
  };

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) pageRows.forEach((l) => next.delete(l.id));
      else pageRows.forEach((l) => next.add(l.id));
      return next;
    });
  };

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const bulkGenerate = async () => {
    const chosen = leads.filter((l) => selected.has(l.id));
    setBulkMsg(`Generating ${chosen.length} report${chosen.length === 1 ? '' : 's'}…`);
    let done = 0;
    let failed = 0;
    for (const l of chosen) {
      try {
        await generateReport(l.id, {
          focus: defaultFocus(l),
          template: REPORT_TEMPLATES[0],
          sections: [...settings.defaultSections],
        });
        done += 1;
      } catch {
        failed += 1;
      }
    }
    setBulkMsg(
      `Generated ${done} report${done === 1 ? '' : 's'}${failed ? ` · ${failed} failed` : ''} — open a lead to preview`,
    );
    setSelected(new Set());
  };

  return (
    <>
      <PageHeader
        title="Leads"
        afterTitle={
          <ToggleButtonGroup
            exclusive
            size="small"
            value={tab}
            onChange={(_, v) => v && setTab(v)}
            sx={{
              ml: 1,
              '& .MuiToggleButton-root': {
                px: 1.75,
                py: 0.4,
                border: `1px solid ${brand.line}`,
                borderRadius: '8px !important',
                mx: 0.25,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.82rem',
                '&.Mui-selected': {
                  bgcolor: brand.accentSoft,
                  color: brand.blueInk,
                  borderColor: brand.sky,
                },
              },
            }}
          >
            <ToggleButton value="all">All</ToggleButton>
            <ToggleButton value="due">Due</ToggleButton>
            <ToggleButton value="sent">Sent</ToggleButton>
          </ToggleButtonGroup>
        }
        actions={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <TextField
              size="small"
              placeholder="Search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" sx={{ color: brand.faint }} />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ width: 210 }}
            />
            <TextField
              select
              size="small"
              value={industry}
              onChange={(e) => {
                setIndustry(e.target.value);
                setPage(1);
              }}
              sx={{ width: 170 }}
            >
              <MenuItem value="all">Vertical · All</MenuItem>
              {industries.map((i) => (
                <MenuItem key={i} value={i}>
                  {i}
                </MenuItem>
              ))}
            </TextField>
            <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/leads/new')}>
              Add lead
            </Button>
          </Box>
        }
      />

      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.25 }}>
          <Typography variant="body2" sx={{ color: brand.faint }}>
            {filtered.length.toLocaleString()} lead{filtered.length === 1 ? '' : 's'}
          </Typography>
          <Box sx={{ flex: 1 }} />
          {selected.size > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Chip size="small" label={`${selected.size} selected`} sx={{ bgcolor: brand.surface }} />
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                sx={{ borderColor: brand.line, bgcolor: '#fff' }}
                onClick={() => void bulkGenerate()}
              >
                Generate reports ({selected.size})
              </Button>
            </Box>
          )}
        </Box>

        <Card>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox size="small" checked={allChecked} onChange={toggleAll} />
                </TableCell>
                <TableCell>Organization</TableCell>
                <TableCell>Vertical</TableCell>
                <TableCell>Target persona</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Last report</TableCell>
                <TableCell>Next due</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {pageRows.map((lead) => (
                <TableRow key={lead.id} hover selected={selected.has(lead.id)}>
                  <TableCell padding="checkbox">
                    <Checkbox size="small" checked={selected.has(lead.id)} onChange={() => toggleOne(lead.id)} />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                      <CompanyLogo lead={lead} size={28} />
                      {lead.organization}
                    </Box>
                  </TableCell>
                  <TableCell>{lead.industry}</TableCell>
                  <TableCell>{lead.personaName}</TableCell>
                  <TableCell sx={{ color: brand.muted }}>{lead.personaTitle}</TableCell>
                  <TableCell>{formatShortDate(lead.lastReportDate)}</TableCell>
                  <TableCell>
                    <DueChip lead={lead} />
                  </TableCell>
                  <TableCell align="right">
                    <Link
                      component={RouterLink}
                      to={`/leads/${lead.id}`}
                      underline="hover"
                      sx={{ fontWeight: 600, fontSize: '0.85rem' }}
                    >
                      Open
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {pageRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} sx={{ textAlign: 'center', py: 5, color: brand.faint }}>
                    No leads match — adjust filters or import a list.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        <Box sx={{ display: 'flex', alignItems: 'center', mt: 1.5 }}>
          <Typography variant="body2" sx={{ color: brand.faint }}>
            Page {page} of {pageCount}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Pagination count={pageCount} page={page} onChange={(_, p) => setPage(p)} size="small" />
        </Box>
      </Box>

      <Snackbar
        open={Boolean(bulkMsg)}
        autoHideDuration={3500}
        onClose={() => setBulkMsg('')}
        message={bulkMsg}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
}
