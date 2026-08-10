import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import SpaceDashboardOutlinedIcon from '@mui/icons-material/SpaceDashboardOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { brand } from '../theme';
import { useApp } from '../context/AppContext';

const NAV = [
  { label: 'Dashboard', to: '/', icon: <SpaceDashboardOutlinedIcon fontSize="small" /> },
  { label: 'Leads', to: '/leads', icon: <PeopleAltOutlinedIcon fontSize="small" /> },
  { label: 'Import', to: '/import', icon: <FileUploadOutlinedIcon fontSize="small" /> },
  { label: 'Settings', to: '/settings', icon: <SettingsOutlinedIcon fontSize="small" /> },
];

const SIDEBAR_WIDTH = 224;

export default function AppLayout() {
  const { authed } = useApp();
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
            HONEST TASKERS
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
