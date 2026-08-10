import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import { brand } from '../theme';

interface Props {
  label: string;
  value: string | number;
  highlight?: boolean;
}

export default function StatCard({ label, value, highlight }: Props) {
  return (
    <Card
      sx={{
        flex: 1,
        p: 2,
        bgcolor: highlight ? brand.warnSoft : brand.surface,
        borderColor: highlight ? '#f0dcc0' : brand.line,
      }}
    >
      <Typography variant="caption" sx={{ color: highlight ? brand.warnInk : brand.muted }}>
        {label}
      </Typography>
      <Typography
        variant="h5"
        sx={{ mt: 0.5, color: highlight ? brand.warnInk : brand.ink, fontWeight: 700 }}
      >
        {typeof value === 'number' ? value.toLocaleString() : value}
      </Typography>
    </Card>
  );
}
