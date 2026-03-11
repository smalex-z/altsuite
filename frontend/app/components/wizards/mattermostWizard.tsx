'use client';

import ServiceWizard, { WizardFieldConfig } from '../serviceWizard';

const mattermostFields: WizardFieldConfig[] = [
  {
    key: 'domain',
    label: 'What domain will Mattermost be served on?',
    type: 'text',
    placeholder: 'chat.example.com',
    description: 'The public hostname users will use to access Mattermost (no http:// prefix). Caddy will be configured automatically.',
    required: true,
    validate: (value: string) => {
      if (value.startsWith('http://') || value.startsWith('https://')) {
        return 'Enter just the hostname, not a full URL (e.g. chat.example.com)';
      }
      if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(value)) {
        return 'Please enter a valid hostname (e.g. chat.example.com)';
      }
      return undefined;
    },
  },
  {
    key: 'postgresPassword',
    label: 'Database Password',
    type: 'password',
    placeholder: 'Choose a strong password',
    description: 'Password for the Mattermost PostgreSQL database (mmuser). Use letters, numbers, and - _ . @ characters only.',
    required: true,
    validate: (value: string) => {
      if (value.length < 8) return 'Password must be at least 8 characters';
      if (!/^[a-zA-Z0-9_.@-]+$/.test(value)) return 'Only letters, numbers, and - _ . @ characters are allowed';
      return undefined;
    },
  },
  {
    key: 'supportEmail',
    label: 'Support Email (Optional)',
    type: 'email',
    placeholder: 'support@example.com',
    description: 'The email address users will contact when they need help. Shown in Mattermost\'s help menu.',
    required: false,
  },
];

type MattermostWizardProps = {
  onComplete?: (data: Record<string, string>) => void;
};

function MattermostWizard({ onComplete }: MattermostWizardProps) {
  const handleComplete = async (data: Record<string, string>) => {
    if (onComplete) {
      onComplete(data);
    }
  };

  return (
    <ServiceWizard
      fields={mattermostFields}
      onComplete={handleComplete}
      serviceName="Mattermost"
    />
  );
}

export default MattermostWizard;
