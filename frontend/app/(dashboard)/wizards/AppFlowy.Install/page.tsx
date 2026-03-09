'use client';

import AppflowyWizard from '@/app/components/wizards/appflowyWizard';

export default function AppflowyWizardPage() {
  const handleWizardComplete = (data: Record<string, string>) => {
    // eslint-disable-next-line no-console
    console.log('AppFlowy wizard completed with data:', data);
    // In a real app, send data to the backend to start installation
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <AppflowyWizard onComplete={handleWizardComplete} />
    </div>
  );
}
