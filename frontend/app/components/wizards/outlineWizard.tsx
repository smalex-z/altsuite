'use client';

import ServiceWizard, { WizardFieldConfig } from '../serviceWizard';

const outlineFields: WizardFieldConfig[] = [
  {
    key: 'domain',
    label: 'What domain will Outline be served on?',
    type: 'text',
    placeholder: 'wiki.example.com',
    description: 'The public hostname users will use to access Outline (no http:// prefix). Caddy will be configured automatically.',
    required: true,
    validate: (value: string) => {
      if (value.startsWith('http://') || value.startsWith('https://')) {
        return 'Enter just the hostname, not a full URL (e.g. wiki.example.com)';
      }
      if (!/^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/.test(value)) {
        return 'Please enter a valid hostname (e.g. wiki.example.com)';
      }
      return undefined;
    },
  },
  {
    key: 'googleClientId',
    label: 'Google OAuth Client ID',
    type: 'text',
    placeholder: '123456789012-abc.apps.googleusercontent.com',
    description: 'From Google Cloud Console → APIs & Services → Credentials. Set the authorised redirect URI to https://<your-domain>/auth/google.callback',
    required: true,
  },
  {
    key: 'googleClientSecret',
    label: 'Google OAuth Client Secret',
    type: 'password',
    placeholder: 'GOCSPX-...',
    description: 'The client secret from the same Google OAuth 2.0 credential.',
    required: true,
  },
  {
    key: 'postgresPassword',
    label: 'Database Password',
    type: 'password',
    placeholder: 'Choose a strong password',
    description: 'Password for the Outline PostgreSQL database. Use letters, numbers, and - _ . @ / characters only.',
    required: true,
    validate: (value: string) => {
      if (value.length < 8) return 'Password must be at least 8 characters';
      if (!/^[a-zA-Z0-9\-_.@/]+$/.test(value)) return 'Only letters, numbers, and - _ . @ / characters are allowed';
      return undefined;
    },
  },
];

type OutlineWizardProps = {
  onComplete?: (data: Record<string, string>) => void;
};

function OutlineWizard({ onComplete }: OutlineWizardProps) {
  const handleComplete = async (data: Record<string, string>) => {
    if (onComplete) {
      onComplete(data);
    }
  };

  return (
    <ServiceWizard
      fields={outlineFields}
      onComplete={handleComplete}
      serviceName="Outline"
    />
  );
}

export default OutlineWizard;
