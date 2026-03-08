'use client';

import React from 'react';
import ServiceWizard, { WizardFieldConfig } from '../serviceWizard';

const gitlabFields: WizardFieldConfig[] = [
  {
    key: 'externalUrl',
    label: 'External URL',
    type: 'url',
    placeholder: 'https://gitlab.internal.example.com',
    description: 'The base URL where GitLab will be reachable',
    required: true,
  },
  {
    key: 'gitlabHome',
    label: 'GitLab Home Directory',
    type: 'text',
    placeholder: '/srv/gitlab',
    description: 'The host path where GitLab will store data, logs, and config files',
    required: true,
  },
  {
    key: 'httpPort',
    label: 'HTTP Port Mapping',
    type: 'number',
    placeholder: '80',
    description: 'The port on the host machine to map to GitLab HTTP (default 80)',
    required: false,
  },
  {
    key: 'registryUrl',
    label: 'Private Container Registry URL',
    type: 'url',
    placeholder: 'registry.example.com',
    description: 'For offline installs, the address of your local container registry',
    required: false,
  },
];

type GitlabWizardProps = {
  onComplete?: (data: Record<string, string>) => void;
};

const GitlabWizard: React.FC<GitlabWizardProps> = ({ onComplete }) => {
  const handleComplete = async (data: Record<string, string>) => {
    console.log('GitLab setup completed with data:', data);
    if (onComplete) {
      onComplete(data);
    }
  };

  return (
    <ServiceWizard
      fields={gitlabFields}
      onComplete={handleComplete}
      serviceName="GitLab"
    />
  );
};

export default GitlabWizard;
