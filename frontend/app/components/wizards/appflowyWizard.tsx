'use client';

import React from 'react';
import ServiceWizard, { WizardFieldConfig } from '../serviceWizard';

const appflowyFields: WizardFieldConfig[] = [
  {
    key: 'postgresPassword',
    label: 'Database Password',
    type: 'password',
    placeholder: 'Enter a secure password',
    description: 'Password for the PostgreSQL database user',
    required: true,
  },
  {
    key: 'gotrueJwtSecret',
    label: 'GoTrue JWT Secret',
    type: 'password',
    placeholder: 'Random string',
    description: 'Secret used for JWT authentication. Use a long random string.',
    required: true,
  },
  {
    key: 'appflowyPort',
    label: 'Application Port',
    type: 'number',
    placeholder: '80',
    description: 'The host port AppFlowy will be accessible on',
    required: false,
  },
  {
    key: 'appflowyCloudUrl',
    label: 'AppFlowy Cloud External URL',
    type: 'url',
    placeholder: 'http://localhost',
    description: 'The URL of your AppFlowy Cloud instance',
    required: true,
  }
];

type AppflowyWizardProps = {
  onComplete?: (data: Record<string, string>) => void;
};

const AppflowyWizard: React.FC<AppflowyWizardProps> = ({ onComplete }) => {
  const handleComplete = async (data: Record<string, string>) => {
    console.log('AppFlowy setup completed with data:', data);
    if (onComplete) {
      onComplete(data);
    }
  };

  return (
    <ServiceWizard
      fields={appflowyFields}
      onComplete={handleComplete}
      serviceName="AppFlowy"
    />
  );
};

export default AppflowyWizard;
