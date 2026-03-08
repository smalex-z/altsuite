'use client';

import React, { useState } from 'react';
import AppflowyWizard from '@/app/components/wizards/appflowyWizard';

export default function AppflowyWizardPage() {
  const [submittedData, setSubmittedData] = useState<Record<string, string> | null>(null);

  const handleWizardComplete = (data: Record<string, string>) => {
    console.log('AppFlowy wizard completed with data:', data);
    setSubmittedData(data);
    // In a real app, send data to the backend to start installation
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <AppflowyWizard onComplete={handleWizardComplete} />
    </div>
  );
}
