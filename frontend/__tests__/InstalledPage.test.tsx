import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import InstalledAppsPage from '../app/(dashboard)/installed/page';
import {
  getCatalogApps,
  getServiceStatus,
  getServiceStats,
  getServiceConfig,
  getServiceLogs,
  uninstallService,
} from '../lib/api';

jest.mock('../lib/api', () => ({
  getCatalogApps: jest.fn(),
  getServiceStatus: jest.fn(),
  getServiceStats: jest.fn(),
  getServiceConfig: jest.fn(),
  getServiceLogs: jest.fn(),
  uninstallService: jest.fn(),
  serviceAction: jest.fn(),
}));

const mockGetCatalogApps = getCatalogApps as jest.MockedFunction<typeof getCatalogApps>;
const mockGetServiceStatus = getServiceStatus as jest.MockedFunction<typeof getServiceStatus>;
const mockGetServiceStats = getServiceStats as jest.MockedFunction<typeof getServiceStats>;
const mockGetServiceConfig = getServiceConfig as jest.MockedFunction<typeof getServiceConfig>;
const mockGetServiceLogs = getServiceLogs as jest.MockedFunction<typeof getServiceLogs>;
const mockUninstallService = uninstallService as jest.MockedFunction<typeof uninstallService>;

function catalogApp(overrides: { id?: string; name?: string; installed?: boolean } = {}) {
  return {
    id: '1',
    name: 'Mattermost',
    description: 'Chat',
    category: 'chat',
    replaces: 'Slack',
    monthlyCost: 10,
    monthlySavings: 5,
    features: ['messaging'],
    recommended: true,
    installed: true,
    ...overrides,
  };
}

describe('InstalledAppsPage', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading then renders installed apps with status and stats', async () => {
    mockGetCatalogApps.mockResolvedValue([catalogApp()]);
    mockGetServiceStatus.mockResolvedValue({ is_running: true });
    mockGetServiceStats.mockResolvedValue({
      uptime: '1d 2h',
      memory_usage: '256 MB',
      cpu_percent: '2%',
    });

    render(<InstalledAppsPage />);

    expect(screen.getByText(/Loading installed apps/)).toBeInTheDocument();

    expect(await screen.findByText('Mattermost')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('Installed Applications')).toBeInTheDocument();
    expect(screen.getByText('Total Applications')).toBeInTheDocument();
    expect(screen.getByText('Running Services')).toBeInTheDocument();
    const ones = screen.getAllByText('1');
    expect(ones.length).toBeGreaterThanOrEqual(2); // Total Applications + Running Services
    expect(screen.getByText('1d 2h')).toBeInTheDocument();
    expect(screen.getByText('256 MB')).toBeInTheDocument();
    expect(screen.getByText('2%')).toBeInTheDocument();
  });

  it('shows empty state and catalog link when no apps installed', async () => {
    mockGetCatalogApps.mockResolvedValue([catalogApp({ installed: false })]);

    render(<InstalledAppsPage />);

    expect(await screen.findByText('No applications installed yet.')).toBeInTheDocument();
    const catalogLink = screen.getByRole('link', { name: /Browse App Catalog/i });
    expect(catalogLink).toBeInTheDocument();
    expect(catalogLink).toHaveAttribute('href', '/catalog');
  });

  it('shows management controls for an installed app', async () => {
    mockGetCatalogApps.mockResolvedValue([catalogApp()]);
    mockGetServiceStatus.mockResolvedValue({ is_running: true });
    mockGetServiceStats.mockResolvedValue({});

    render(<InstalledAppsPage />);

    await screen.findByText('Mattermost');

    // Start/Stop (Stop when running), Logs, Config, Restart, Uninstall
    const stopButton = screen.getByTitle('Stop');
    expect(stopButton).toBeInTheDocument();

    const logsButton = screen.getByTitle('View logs');
    expect(logsButton).toBeInTheDocument();

    const configButton = screen.getByTitle('Configuration');
    expect(configButton).toBeInTheDocument();

    const restartButton = screen.getByTitle('Restart');
    expect(restartButton).toBeInTheDocument();

    const uninstallButton = screen.getByTitle('Uninstall');
    expect(uninstallButton).toBeInTheDocument();
  });

  it('opens logs panel and fetches logs when Logs is clicked', async () => {
    const user = userEvent.setup();
    mockGetCatalogApps.mockResolvedValue([catalogApp()]);
    mockGetServiceStatus.mockResolvedValue({ is_running: true });
    mockGetServiceStats.mockResolvedValue({});
    mockGetServiceLogs.mockResolvedValue({ logs: 'line1\nline2' });

    render(<InstalledAppsPage />);

    await screen.findByText('Mattermost');
    await user.click(screen.getByTitle('View logs'));

    expect(await screen.findByText(/Log viewer — Mattermost/)).toBeInTheDocument();
    expect(mockGetServiceLogs).toHaveBeenCalledWith('mattermost', 200);
    expect(screen.getByText(/line1/)).toBeInTheDocument();
    expect(screen.getByText(/line2/)).toBeInTheDocument();
  });

  it('opens config panel and shows domain and port', async () => {
    const user = userEvent.setup();
    mockGetCatalogApps.mockResolvedValue([catalogApp()]);
    mockGetServiceStatus.mockResolvedValue({ is_running: true });
    mockGetServiceStats.mockResolvedValue({});
    mockGetServiceConfig.mockResolvedValue({ domain: 'chat.example.com', port: '8065' });

    render(<InstalledAppsPage />);

    await screen.findByText('Mattermost');
    await user.click(screen.getByTitle('Configuration'));

    expect(await screen.findByText(/Configuration — Mattermost/)).toBeInTheDocument();
    expect(mockGetServiceConfig).toHaveBeenCalledWith('mattermost');
    expect(screen.getByText('8065')).toBeInTheDocument();
    expect(screen.getByText('chat.example.com')).toBeInTheDocument();
    const openLink = screen.getByRole('link', { name: /Open https:\/\// });
    expect(openLink).toHaveAttribute('href', 'https://chat.example.com');
  });

  it('shows Confirm/Cancel on Uninstall then removes app after confirm', async () => {
    const user = userEvent.setup();
    mockGetCatalogApps.mockResolvedValue([catalogApp()]);
    mockGetServiceStatus.mockResolvedValue({ is_running: true });
    mockGetServiceStats.mockResolvedValue({});
    mockUninstallService.mockResolvedValue(undefined);

    render(<InstalledAppsPage />);

    await screen.findByText('Mattermost');
    await user.click(screen.getByTitle('Uninstall'));

    expect(screen.getByRole('button', { name: /Confirm/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Confirm/ }));

    expect(mockUninstallService).toHaveBeenCalledWith('mattermost', false);
    expect(await screen.findByText('No applications installed yet.')).toBeInTheDocument();
  });
});
