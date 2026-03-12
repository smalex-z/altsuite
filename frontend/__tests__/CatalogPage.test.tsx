import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import CatalogPage from '../app/(dashboard)/catalog/page';
import { getCatalogApps } from '../lib/api';

// Mock API and next/navigation
jest.mock('../lib/api', () => ({
  getCatalogApps: jest.fn(),
}));


describe('CatalogPage', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders apps, filters by category', async () => {
    const apps = [
      {
        id: '1',
        name: 'AppOne',
        description: 'First app',
        category: 'chat',
        replaces: 'Slack',
        monthlyCost: 10,
        monthlySavings: 5,
        features: ['messaging', 'rooms'],
        recommended: true,
        installed: false,
      },
      {
        id: '2',
        name: 'AppTwo',
        description: 'Second app',
        category: 'video',
        replaces: 'Zoom',
        monthlyCost: 20,
        monthlySavings: 10,
        features: ['calls', 'screen share'],
        recommended: false,
        installed: false,
      },
    ];

    (getCatalogApps as unknown as jest.Mock).mockResolvedValue(apps);

    render(<CatalogPage />);

    // Wait for app names to appear
    expect(await screen.findByText('AppOne')).toBeInTheDocument();
    expect(screen.getByText('AppTwo')).toBeInTheDocument();

    // Category buttons: All + chat + video
    const chatBtn = screen.getByRole('button', { name: /chat/i });
    await userEvent.click(chatBtn);
    // After filtering, AppTwo (video) should not be visible
    expect(screen.queryByText('AppTwo')).not.toBeInTheDocument();
    expect(screen.getByText('AppOne')).toBeInTheDocument();

    // Install button should be present and active
    const installButtons = screen.getAllByRole('button', { name: /Ready to Install/i });
    expect(installButtons.length).toBe(1);
  });
});
