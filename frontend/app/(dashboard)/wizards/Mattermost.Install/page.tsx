'use client';

import React, { useState } from 'react';
import MattermostWizard from '@/app/components/wizards/mattermostWizard';

export default function MattermostWizardPage() {
  const [submittedData, setSubmittedData] = useState<Record<string, string> | null>(null);

  const handleWizardComplete = (data: Record<string, string>) => {
    console.log('Mattermost wizard completed with data:', data);
    setSubmittedData(data);
    // In a real app, send data to the backend to start installation
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <MattermostWizard onComplete={handleWizardComplete} />
    </div>
  );
}
