'use client';

import ServiceWizard, { WizardFieldConfig } from '../serviceWizard';

const giteaFields: WizardFieldConfig[] = [
  {
    key: 'domain',
    label: 'What domain will Gitea be served on?',
    type: 'text',
    placeholder: 'git.example.com',
    description: 'The public hostname users will use to access Gitea (no http:// prefix). Caddy will be configured automatically.',
    required: true,
    validate: (value: string) => {
      if (value.startsWith('http://') || value.startsWith('https://')) {
        return 'Enter just the hostname, not a full URL (e.g. git.example.com)';
      }
      if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(value)) {
        return 'Please enter a valid hostname (e.g. git.example.com)';
      }
      return undefined;
    },
  },
  {
    key: 'postgresPassword',
    label: 'Database Password',
    type: 'password',
    placeholder: 'Choose a strong password',
    description: 'Password for the Gitea PostgreSQL database. Leave blank to generate one automatically. Use letters, numbers, and - _ . @ characters only.',
    required: false,
    validate: (value: string) => {
      if (value && value.length < 8) return 'Password must be at least 8 characters';
      if (value && !/^[a-zA-Z0-9_.@-]+$/.test(value)) return 'Only letters, numbers, and - _ . @ characters are allowed';
      return undefined;
    },
  },
];

type GiteaWizardProps = {
  onComplete?: (data: Record<string, string>) => void;
};

function GiteaWizard({ onComplete }: GiteaWizardProps) {
  const handleComplete = async (data: Record<string, string>) => {
    if (onComplete) {
      onComplete(data);
    }
  };

  return (
    <ServiceWizard
      fields={giteaFields}
      onComplete={handleComplete}
      serviceName="Gitea"
    />
  );
}

export default GiteaWizard;
