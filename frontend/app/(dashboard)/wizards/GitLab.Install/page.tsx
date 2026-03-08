'use client';

import React, { useState } from 'react';
import GitlabWizard from '@/app/components/wizards/gitlabWizard';

export default function GitlabWizardPage() {
  const [submittedData, setSubmittedData] = useState<Record<string, string> | null>(null);

  const handleWizardComplete = (data: Record<string, string>) => {
    console.log('GitLab wizard completed with data:', data);
    setSubmittedData(data);
    // In a real app, send data to the backend to start installation
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <GitlabWizard onComplete={handleWizardComplete} />
    </div>
  );
}
