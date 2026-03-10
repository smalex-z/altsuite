'use client';

import ServiceWizard, { WizardFieldConfig } from '../serviceWizard';

const mattermostFields: WizardFieldConfig[] = [
  {
    key: 'siteUrl',
    label: 'What is the Site URL for your Mattermost instance?',
    type: 'url',
    placeholder: 'https://mattermost.example.com',
    description: 'The URL users will use to access Mattermost. Required for email links and SSO.',
    required: true,
    validate: (value: string) => {
      if (!value.startsWith('http://') && !value.startsWith('https://')) {
        return 'Site URL must start with http:// or https://';
      }
      return undefined;
    },
  },
  {
    key: 'postgresPassword',
    label: 'Set a password for the Mattermost Database',
    type: 'password',
    placeholder: 'Minimum 10 characters',
    description: 'Password for the "mmuser" in the PostgreSQL container',
    required: true,
  },
  {
    key: 'mattermostImageTag',
    label: 'Mattermost Release Version',
    type: 'text',
    placeholder: '9.5.0',
    description: 'The Docker image tag/version you wish to deploy',
    required: false,
  },
  {
    key: 'licensePath',
    label: 'Path to License File (Optional)',
    type: 'text',
    placeholder: '/path/to/mattermost.mate',
    description: 'If you have an Enterprise license, provide the local path',
    required: false,
  },
];

type MattermostWizardProps = {
  onComplete?: (data: Record<string, string>) => void;
};

function MattermostWizard({ onComplete }: MattermostWizardProps) {
  const handleComplete = async (data: Record<string, string>) => {
    console.log('Mattermost setup completed with data:', data);
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
