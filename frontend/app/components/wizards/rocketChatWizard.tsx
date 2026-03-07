'use client';

import React from 'react';
import ServiceWizard, { WizardFieldConfig } from '../serviceWizard';

// Define the fields for RocketChat setup

/*
Nice to haves: 
We can set up grafana for rocketChat in bash script ourselves but is non MVP atm 
*/
const rocketChatFields: WizardFieldConfig[] = [
  {
    key: 'mongoDBURL',
    label: 'What is your MongoDB connection URL?',
    type: 'url',
    placeholder: 'mongodb://username:password@localhost:27017/rocketchat',
    description: 'Enter the full MongoDB connection string including credentials',
    required: false,
    validate: (value: string) => {
      if (!value.startsWith('mongodb://') && !value.startsWith('mongodb+srv://')) {
        return 'MongoDB URL must start with mongodb:// or mongodb+srv://';
      }
      return undefined;
    },
  },
  {
    key: 'Release',
    label: 'What version of RocketChat would you like to install? Refer to https://github.com/RocketChat/Rocket.Chat/releases',
    type: 'text',
    placeholder: '8.0.2',
    description: 'Enter the version of RocketChat you want to install',
    required: true,
  },
  {
    key: 'Domain',
    label: 'What is the domain name for your RocketChat instance?',
    type: 'text',
    placeholder: 'localhost',
    description: 'such as localhost or chat.example.com',
    required: true,
  },
  {
    key: 'Registration token',
    label: 'What is the registration token for your RocketChat instance?',
    type: 'text',
    placeholder: 'your-registration-token',
    description: 'Enter the registration token for your RocketChat instance if you recieved one from sales team',
    required: false,
  },
];

type RocketChatWizardProps = {
  onComplete?: (data: Record<string, string>) => void;
};

const RocketChatWizard: React.FC<RocketChatWizardProps> = ({ onComplete }) => {
  const handleComplete = async (data: Record<string, string>) => {
    console.log('RocketChat setup completed with data:', data);
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
