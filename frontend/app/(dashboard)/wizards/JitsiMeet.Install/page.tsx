'use client';

import React, { useState } from 'react';
import JitsiWizard from '@/app/components/wizards/jitsiWizard';

export default function JitsiWizardPage() {
  const [submittedData, setSubmittedData] = useState<Record<string, string> | null>(null);

  const handleWizardComplete = (data: Record<string, string>) => {
    console.log('Jitsi wizard completed with data:', data);
    setSubmittedData(data);
    // In a real app, send data to the backend to start installation
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <JitsiWizard onComplete={handleWizardComplete} />
    </div>
  );
}
