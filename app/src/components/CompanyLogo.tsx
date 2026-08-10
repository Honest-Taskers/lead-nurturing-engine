import Avatar from '@mui/material/Avatar';
import type { Lead } from '../data/types';
import { brand } from '../theme';

/**
 * Company logo served by logo.dev (see server/src/services/logo.ts). MUI's
 * Avatar renders its children when the image is missing or fails to load, so
 * unknown domains fall back to a lettermark rather than a broken image.
 */
export default function CompanyLogo({
  lead,
  size = 30,
}: {
  lead: Pick<Lead, 'organization' | 'logoUrl'>;
  size?: number;
}) {
  const initials = lead.organization
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

  return (
    <Avatar
      variant="rounded"
      src={lead.logoUrl ?? undefined}
      alt={`${lead.organization} logo`}
      sx={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        fontWeight: 700,
        bgcolor: lead.logoUrl ? '#fff' : brand.accentSoft,
        color: brand.navy,
        border: `1px solid ${brand.line}`,
        '& img': { objectFit: 'contain', p: '2px' },
      }}
    >
      {initials}
    </Avatar>
  );
}
