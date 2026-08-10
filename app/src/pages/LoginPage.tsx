import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import { Navigate, useNavigate } from 'react-router-dom';
import { brand } from '../theme';
import { useApp } from '../context/AppContext';

export default function LoginPage() {
  const { authed, login } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (authed) return <Navigate to="/" replace />;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login(email || 'admin@honesttaskers.com');
    navigate('/');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: `radial-gradient(1200px 600px at 70% -10%, ${brand.accentSoft}, transparent), ${brand.surface}`,
      }}
    >
      <Card sx={{ width: 400, p: 4 }}>
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ textAlign: 'center', mb: 0.5 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                mx: 'auto',
                mb: 1.5,
                borderRadius: '12px',
                background: `linear-gradient(135deg, ${brand.blue}, ${brand.aqua})`,
                display: 'grid',
                placeItems: 'center',
                color: '#fff',
              }}
            >
              <BoltOutlinedIcon />
            </Box>
            <Typography variant="h5">Relationship Engine</Typography>
            <Typography variant="body2" sx={{ color: brand.muted, mt: 0.5 }}>
              AI lead-nurturing · Honest Taskers
            </Typography>
          </Box>
          <TextField
            label="Email"
            type="email"
            size="small"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
          <TextField
            label="Password"
            type="password"
            size="small"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" variant="contained" size="large" fullWidth>
            Log in
          </Button>
          <Typography variant="caption" sx={{ textAlign: 'center', color: brand.faint }}>
            Single admin account (MVP)
          </Typography>
        </Box>
      </Card>
    </Box>
  );
}
