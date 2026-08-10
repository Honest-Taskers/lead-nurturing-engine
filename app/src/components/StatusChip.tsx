import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import type { Lead } from '../data/types';
import { formatShortDate, getDueStatus } from '../data/types';
import { brand } from '../theme';

/** Next-due state chip: warn pill (Today / N days / Overdue), grey pill (Never sent), or plain date. */
export default function DueChip({ lead }: { lead: Lead }) {
  const status = getDueStatus(lead);
  switch (status.kind) {
    case 'never':
      return (
        <Chip
          size="small"
          label="Never sent"
          sx={{ bgcolor: '#efefec', color: brand.muted, fontWeight: 600 }}
        />
      );
    case 'today':
    case 'overdue':
      return (
        <Chip
          size="small"
          label={status.kind === 'today' ? 'Today' : `Overdue ${status.days}d`}
          sx={{ bgcolor: brand.warnSoft, color: brand.warnInk }}
        />
      );
    case 'soon':
      return (
        <Chip
          size="small"
          label={`In ${status.days} day${status.days === 1 ? '' : 's'}`}
          sx={{ bgcolor: brand.warnSoft, color: brand.warnInk }}
        />
      );
    case 'scheduled':
      return <Typography variant="body2">{formatShortDate(status.date)}</Typography>;
  }
}
