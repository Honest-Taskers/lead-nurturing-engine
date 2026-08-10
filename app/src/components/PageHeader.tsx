import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Link from '@mui/material/Link';
import { brand } from '../theme';

interface Props {
  title: ReactNode;
  breadcrumb?: { label: string; to: string };
  chip?: ReactNode;
  actions?: ReactNode;
  /** Extra content rendered right after the title (e.g. filter tabs). */
  afterTitle?: ReactNode;
}

/** Page top bar: breadcrumb › title · chip · [afterTitle] ······ actions */
export default function PageHeader({ title, breadcrumb, chip, actions, afterTitle }: Props) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 3,
        py: 2,
        bgcolor: '#fff',
        borderBottom: `1px solid ${brand.line}`,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      {breadcrumb && (
        <Link
          component={RouterLink}
          to={breadcrumb.to}
          underline="hover"
          sx={{ color: brand.faint, fontSize: '0.85rem', whiteSpace: 'nowrap' }}
        >
          {breadcrumb.label} ›
        </Link>
      )}
      <Typography variant="h6" sx={{ whiteSpace: 'nowrap' }}>
        {title}
      </Typography>
      {chip}
      {afterTitle}
      <Box sx={{ flex: 1 }} />
      {actions}
    </Box>
  );
}
