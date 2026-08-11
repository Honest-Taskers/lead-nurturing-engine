import { useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { contactForPersona, parseContact, parsePersonas, splitBlocks } from '../data/importParse';
import type { Lead } from '../data/types';
import { brand } from '../theme';
import { useApp } from '../context/AppContext';

/** Mirrors the target-account spreadsheet's columns. */
const TARGET_FIELDS = [
  { value: 'organization', label: 'Organization' },
  { value: 'industry', label: 'Vertical' },
  { value: 'website', label: 'Website' },
  { value: 'headquarters', label: 'Headquarters' },
  { value: 'locationsReach', label: 'Locations / reach' },
  { value: 'orgSize', label: 'Provider / organization size' },
  { value: 'persona', label: 'RCM leader / target persona' },
  { value: 'contact', label: 'LinkedIn / target (emails, phones)' },
  { value: 'contactPath', label: 'LinkedIn / contact path' },
  { value: 'photoUrl', label: 'Photo URL (headshot)' },
  { value: 'hiringSignal', label: 'Open positions / hiring signal' },
  { value: 'skip', label: 'Do not import' },
] as const;

interface ParsedFile {
  name: string;
  headers: string[];
  rows: string[][];
}

/** Minimal CSV parser: quoted fields, commas, CRLF. (Excel parsing arrives with the API phase.) */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') inQuotes = false;
      else cell += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (cell !== '' || row.length) {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      }
      if (c === '\r' && text[i + 1] === '\n') i++;
    } else cell += c;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function guessMapping(header: string): (typeof TARGET_FIELDS)[number]['value'] {
  const h = header.toLowerCase();
  // Order matters: "Provider / Organization Size" must not match the
  // organization rule, and "LinkedIn / Contact Path" must not match contact.
  if (h.includes('size')) return 'orgSize';
  if (h.includes('photo') || h.includes('headshot') || h.includes('picture')) return 'photoUrl';
  if (h.includes('contact path') || h.includes('path')) return 'contactPath';
  if (h.includes('persona') || h.includes('leader') || h.includes('name') || h.includes('title')) return 'persona';
  if (h.includes('vertical') || h.includes('industry')) return 'industry';
  if (h.includes('website') || h.includes('domain') || h.includes('url')) return 'website';
  if (h.includes('headquarter') || h === 'hq') return 'headquarters';
  if (h.includes('location') || h.includes('reach')) return 'locationsReach';
  if (h.includes('hiring') || h.includes('position') || h.includes('opening')) return 'hiringSignal';
  if (h.includes('linkedin') || h.includes('email') || h.includes('contact') || h.includes('target')) return 'contact';
  if (h.includes('organi') || h.includes('company') || h.includes('account')) return 'organization';
  return 'skip';
}

export default function ImportPage() {
  const { importLeads } = useApp();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState('');

  const handleFile = async (f: File) => {
    const text = await f.text();
    const parsed = parseCsv(text);
    if (parsed.length < 2) {
      setMsg('Could not read that file — export it as CSV with a header row.');
      return;
    }
    const headers = parsed[0];
    setFile({ name: f.name, headers, rows: parsed.slice(1) });
    setMapping(Object.fromEntries(headers.map((h, i) => [i, guessMapping(h)])));
  };

  const sample = useMemo(() => (file ? file.rows[0] ?? [] : []), [file]);

  /**
   * One spreadsheet row can list several people for the same organization, and
   * each person becomes their own lead (own cadence, own reports) — so the
   * lead count is usually higher than the row count.
   */
  const plannedLeads = useMemo(() => {
    if (!file) return [];
    const rows: Array<Partial<Lead>> = file.rows.flatMap((r) => {
      const shared: Partial<Lead> = {};
      let personaCell = '';
      let contactCell = '';

      file.headers.forEach((_, i) => {
        const value = (r[i] ?? '').trim();
        if (!value) return;
        switch (mapping[i]) {
          case 'organization':
            shared.organization = value;
            break;
          case 'industry':
            shared.industry = value;
            break;
          case 'website':
            shared.website = value;
            break;
          case 'headquarters':
            shared.headquarters = value;
            break;
          case 'locationsReach':
            shared.locationsReach = value;
            break;
          case 'orgSize':
            shared.orgSize = value;
            break;
          case 'hiringSignal':
            shared.hiringSignal = value;
            break;
          case 'contactPath':
            shared.contactPath = value.replace(/\s*\r?\n\s*/g, ' ');
            break;
          case 'photoUrl':
            shared.photoUrl = value.split(/\s+/)[0];
            break;
          case 'persona':
            personaCell = personaCell ? `${personaCell}\n\n${value}` : value;
            break;
          case 'contact':
            contactCell = contactCell ? `${contactCell}\n\n${value}` : value;
            break;
        }
      });

      const personas = parsePersonas(personaCell);
      const contactBlocks = splitBlocks(contactCell);
      if (personas.length === 0) {
        // No named contact — still import the organization with any contact details.
        return [{ ...shared, ...parseContact(contactCell) }];
      }
      return personas.map((persona, index) => ({
        ...shared,
        personaName: persona.name,
        personaTitle: persona.title,
        ...contactForPersona(persona, index, contactBlocks),
      }));
    });
    return rows.filter((r) => r.organization);
  }, [file, mapping]);

  const handleImport = async () => {
    if (!file) return;
    try {
      const { imported, skipped } = await importLeads(plannedLeads);
      setMsg(
        `Imported ${imported.toLocaleString()} lead${imported === 1 ? '' : 's'}` +
          (skipped ? ` · ${skipped} duplicate${skipped === 1 ? '' : 's'} skipped` : ''),
      );
      setTimeout(() => navigate('/leads'), 1400);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Import failed');
    }
  };

  return (
    <>
      <PageHeader title="Import leads" />

      <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* Dropzone */}
        <Box
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void handleFile(f);
          }}
          sx={{
            border: `2px dashed ${dragOver ? brand.blue : brand.line}`,
            bgcolor: dragOver ? brand.accentSoft : '#fff',
            borderRadius: '12px',
            py: 5,
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 120ms ease',
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.txt"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = '';
            }}
          />
          <ArrowUpwardIcon sx={{ color: brand.faint, mb: 1 }} />
          <Typography sx={{ fontWeight: 700 }}>Drop your CSV or Excel here</Typography>
          <Typography variant="body2" sx={{ color: brand.faint, mt: 0.5 }}>
            or click to browse
          </Typography>
          {file && (
            <Chip
              label={`${file.name} · ${file.rows.length.toLocaleString()} rows detected`}
              sx={{ mt: 2, bgcolor: brand.okSoft, color: brand.okInk }}
            />
          )}
        </Box>

        {file && (
          <>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1.25 }}>
                Map columns → fields
              </Typography>
              <Card>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Your column</TableCell>
                      <TableCell>→ Maps to</TableCell>
                      <TableCell>Sample</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {file.headers.map((h, i) => (
                      <TableRow key={i}>
                        <TableCell sx={{ fontWeight: 600 }}>{h}</TableCell>
                        <TableCell sx={{ width: 260 }}>
                          <TextField
                            select
                            size="small"
                            fullWidth
                            value={mapping[i] ?? 'skip'}
                            onChange={(e) => setMapping((m) => ({ ...m, [i]: e.target.value }))}
                          >
                            {TARGET_FIELDS.map((t) => (
                              <MenuItem key={t.value} value={t.value}>
                                {t.label}
                              </MenuItem>
                            ))}
                          </TextField>
                        </TableCell>
                        <TableCell sx={{ color: brand.faint }}>{sample[i] ?? ''}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="body2" sx={{ color: brand.faint }}>
                A row listing several people becomes one lead each. Duplicates matched on{' '}
                <strong>Organization + persona</strong> will be skipped.
              </Typography>
              <Box sx={{ flex: 1 }} />
              <Button variant="contained" disabled={plannedLeads.length === 0} onClick={() => void handleImport()}>
                Import {plannedLeads.length.toLocaleString()} lead{plannedLeads.length === 1 ? '' : 's'}
              </Button>
            </Box>
          </>
        )}
      </Box>

      <Snackbar
        open={Boolean(msg)}
        autoHideDuration={3500}
        onClose={() => setMsg('')}
        message={msg}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
}
