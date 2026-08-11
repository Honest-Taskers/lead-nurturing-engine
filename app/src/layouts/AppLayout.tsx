import { useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import SpaceDashboardOutlinedIcon from '@mui/icons-material/SpaceDashboardOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { brand } from '../theme';
import { useApp } from '../context/AppContext';

/** Active-sender switcher: which organization the portal is operating as. */
function SenderSwitcher() {
  const { senders, activeSender, switchSender } = useApp();
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  if (!activeSender) return null;

  return (
    <>
      <Box
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{
          mx: 1.25,
          mb: 1,
          px: 1.25,
          py: 1,
          borderRadius: '10px',
          bgcolor: 'rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          cursor: 'pointer',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
        }}
      >
        <Avatar
          variant="rounded"
          src={activeSender.logoDataUrl ?? activeSender.logoUrl ?? undefined}
          sx={{ width: 26, height: 26, fontSize: 12, fontWeight: 700, bgcolor: activeSender.brandSecondary, color: activeSender.brandPrimary }}
        >
          {activeSender.name[0]?.toUpperCase()}
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography noWrap sx={{ color: '#fff', fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.2 }}>
            {activeSender.name}
          </Typography>
          <Typography sx={{ color: '#8d94c4', fontSize: '0.65rem' }}>Sender workspace</Typography>
        </Box>
        <UnfoldMoreIcon sx={{ fontSize: 16, color: '#8d94c4' }} />
      </Box>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {senders.map((s) => (
          <MenuItem
            key={s.id}
            selected={s.id === activeSender.id}
            onClick={() => {
              setAnchor(null);
              if (s.id !== activeSender.id) void switchSender(s.id);
            }}
            sx={{ minWidth: 220, gap: 1 }}
          >
            <Avatar
              variant="rounded"
              src={s.logoDataUrl ?? s.logoUrl ?? undefined}
              sx={{ width: 22, height: 22, fontSize: 11, fontWeight: 700, bgcolor: s.brandSecondary, color: s.brandPrimary }}
            >
              {s.name[0]?.toUpperCase()}
            </Avatar>
            <Typography variant="body2" sx={{ flex: 1 }}>{s.name}</Typography>
            {s.id === activeSender.id && <CheckIcon sx={{ fontSize: 16, color: brand.blue }} />}
          </MenuItem>
        ))}
        <Divider />
        <MenuItem
          onClick={() => {
            setAnchor(null);
            navigate('/onboarding');
          }}
          sx={{ gap: 1 }}
        >
          <AddIcon sx={{ fontSize: 18 }} />
          <Typography variant="body2">New sender…</Typography>
        </MenuItem>
      </Menu>
    </>
  );
}

const NAV = [
  { label: 'Dashboard', to: '/', icon: <SpaceDashboardOutlinedIcon fontSize="small" /> },
  { label: 'Leads', to: '/leads', icon: <PeopleAltOutlinedIcon fontSize="small" /> },
  { label: 'Import', to: '/import', icon: <FileUploadOutlinedIcon fontSize="small" /> },
  { label: 'Settings', to: '/settings', icon: <SettingsOutlinedIcon fontSize="small" /> },
];

const SIDEBAR_WIDTH = 224;

export default function AppLayout() {
  const { authed, activeSender } = useApp();
  const location = useLocation();

  if (!authed) return <Navigate to="/login" replace />;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: brand.surface }}>
      {/* Sidebar */}
      <Box
        sx={{
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          bgcolor: brand.sidebar,
          color: '#cdd3f0',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          bottom: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2.25, py: 2.5 }}>
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: '8px',
              background: `linear-gradient(135deg, ${brand.blue}, ${brand.aqua})`,
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
            }}
          >
            <BoltOutlinedIcon sx={{ fontSize: 18 }} />
          </Box>
          <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '1rem', lineHeight: 1.1 }}>
            Relationship Engine
          </Typography>
        </Box>
        <SenderSwitcher />
        <List sx={{ px: 1.25, pt: 0.5 }}>
          {NAV.map((item) => {
            const active =
              item.to === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.to);
            return (
              <ListItemButton
                key={item.to}
                component={NavLink}
                to={item.to}
                sx={{
                  borderRadius: '8px',
                  mb: 0.5,
                  py: 0.9,
                  color: active ? '#fff' : '#cdd3f0',
                  bgcolor: active ? brand.blue : 'transparent',
                  '&:hover': { bgcolor: active ? brand.blue : 'rgba(255,255,255,0.06)' },
                }}
              >
                <ListItemIcon sx={{ color: 'inherit', minWidth: 34 }}>{item.icon}</ListItemIcon>
                <ListItemText
                  primary={item.label}
                  slotProps={{ primary: { sx: { fontSize: '0.9rem', fontWeight: active ? 600 : 500 } } }}
                />
              </ListItemButton>
            );
          })}
        </List>
        <Box sx={{ mt: 'auto', px: 2.25, py: 2 }}>
          <Typography sx={{ fontSize: '0.68rem', letterSpacing: '0.14em', color: '#8d94c4' }}>
            {(activeSender?.name ?? 'HONEST TASKERS').toUpperCase()}
          </Typography>
        </Box>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, ml: `${SIDEBAR_WIDTH}px`, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
