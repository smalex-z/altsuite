'use client';

import ServiceWizard, { WizardFieldConfig } from '../serviceWizard';

const jitsiFields: WizardFieldConfig[] = [
  {
    key: 'domain',
    label: 'What domain will Jitsi Meet be served on?',
    type: 'text',
    placeholder: 'meet.example.com',
    description: 'The public hostname users will use to join meetings (no http:// prefix). Caddy will be configured automatically, and the public IP will be resolved from this domain.',
    required: true,
    validate: (value: string) => {
      if (value.startsWith('http://') || value.startsWith('https://')) {
        return 'Enter just the hostname, not a full URL (e.g. meet.example.com)';
      }
      if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(value)) {
        return 'Please enter a valid hostname (e.g. meet.example.com)';
      }
      return undefined;
    },
  },
];

type JitsiWizardProps = {
  onComplete?: (data: Record<string, string>) => void;
};

function JitsiWizard({ onComplete }: JitsiWizardProps) {
  const handleComplete = async (data: Record<string, string>) => {
    if (onComplete) {
      onComplete(data);
    }
  };

  return (
    <ServiceWizard
      fields={jitsiFields}
      onComplete={handleComplete}
      serviceName="Jitsi Meet"
    />
  );
}

export default JitsiWizard;
