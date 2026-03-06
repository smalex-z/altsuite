'use client';

import React from 'react';
import ServiceWizard, { WizardFieldConfig } from '../serviceWizard';

// Define the fields for RocketChat setup
const rocketChatFields: WizardFieldConfig[] = [
  {
    key: 'mongoDBURL',
    label: 'What is your MongoDB connection URL?',
    type: 'url',
    placeholder: 'mongodb://username:password@localhost:27017/rocketchat',
    description: 'Enter the full MongoDB connection string including credentials',
    required: true,
    validate: (value: string) => {
      if (!value.startsWith('mongodb://') && !value.startsWith('mongodb+srv://')) {
        return 'MongoDB URL must start with mongodb:// or mongodb+srv://';
      }
      return undefined;
    },
  },
  {
    key: 'grafanaURL',
    label: 'What is your Grafana dashboard URL?',
    type: 'url',
    placeholder: 'https://grafana.example.com',
    description: 'Enter the URL where Grafana is accessible',
    required: true,
  },
  {
    key: 'adminEmail',
    label: 'What email should we use for the admin account?',
    type: 'email',
    placeholder: 'admin@example.com',
    description: 'This will be used to create the initial administrator account',
    required: true,
  },
  {
    key: 'siteName',
    label: 'What would you like to name your RocketChat instance?',
    type: 'text',
    placeholder: 'My Company Chat',
    description: 'This name will appear in the title and header',
    required: false,
  },
];

type RocketChatWizardProps = {
  onComplete?: (data: Record<string, string>) => void;
};

const RocketChatWizard: React.FC<RocketChatWizardProps> = ({ onComplete }) => {
  const handleComplete = async (data: Record<string, string>) => {
    console.log('RocketChat setup completed with data:', data);
    
    // TODO: Send to backend API
    // Example:
    // try {
    //   const response = await fetch('/api/services/rocketchat/setup', {
    //     method: 'POST',
    //     headers: {
    //       'Content-Type': 'application/json',
    //       'Authorization': `Bearer ${getAuthToken()}`,
    //     },
    //     body: JSON.stringify(data),
    //   });
    //   
    //   if (!response.ok) {
    //     throw new Error('Setup failed');
    //   }
    //   
    //   const result = await response.json();
    //   console.log('Setup successful:', result);
    // } catch (error) {
    //   console.error('Setup error:', error);
    //   // Handle error (show toast, etc.)
    // }

    // Call parent callback if provided
    if (onComplete) {
      onComplete(data);
    }
  };

  return (
    <ServiceWizard
      fields={rocketChatFields}
      onComplete={handleComplete}
      serviceName="RocketChat"
    />
  );
};

export default RocketChatWizard;
