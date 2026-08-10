import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import DueChip from './StatusChip';
import { theme } from '../theme';
import type { Lead } from '../data/types';
import { addDays, todayIso } from '../data/types';

const base: Lead = {
  id: 'l1',
  organization: 'Test Org',
  industry: 'Hospital System',
  personaName: 'Pat Tester',
  personaTitle: 'VP',
  assignedRep: 'Jaya',
} as Lead;

function renderChip(lead: Lead) {
  return render(
    <ThemeProvider theme={theme}>
      <DueChip lead={lead} />
    </ThemeProvider>,
  );
}

describe('DueChip', () => {
  it('shows "Never sent" without a due date', () => {
    renderChip({ ...base, nextDueDate: undefined });
    expect(screen.getByText('Never sent')).toBeInTheDocument();
  });

  it('shows "Today" when due today', () => {
    renderChip({ ...base, nextDueDate: todayIso() });
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('shows an overdue pill with day count', () => {
    renderChip({ ...base, nextDueDate: addDays(todayIso(), -3) });
    expect(screen.getByText('Overdue 3d')).toBeInTheDocument();
  });
});
