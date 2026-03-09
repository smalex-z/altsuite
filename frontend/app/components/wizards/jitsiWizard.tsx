'use client';

import ServiceWizard, { WizardFieldConfig } from '../serviceWizard';

const jitsiFields: WizardFieldConfig[] = [
  {
    key: 'publicUrl',
    label: 'Jitsi Public URL',
    type: 'url',
    placeholder: 'https://meet.example.com',
    description: 'The full URL of your Jitsi Meet instance',
    required: true,
  },
  {
    key: 'email',
    label: 'Admin Email (SSL)',
    type: 'email',
    placeholder: 'admin@example.com',
    description: "Email address used for Let's Encrypt SSL certificate registration",
    required: true,
  },
  {
    key: 'httpPort',
    label: 'HTTP Port',
    type: 'number',
    placeholder: '8000',
    description: 'Host port for HTTP traffic (will redirect to HTTPS)',
    required: false,
  },
  {
    key: 'httpsPort',
    label: 'HTTPS Port',
    type: 'number',
    placeholder: '8443',
    description: 'Host port for HTTPS traffic',
    required: false,
  },
  {
    key: 'dockerHostAddress',
    label: 'Docker Host IP Address',
    type: 'text',
    placeholder: '1.2.3.4',
    description: 'The public IP of the host machine (helps with NAT traversal)',
    required: true,
    validate: (value: string) => {
      const ipPattern = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
      if (!ipPattern.test(value)) {
        return 'Please enter a valid IPv4 address';
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
    console.log('Jitsi setup completed with data:', data);
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
