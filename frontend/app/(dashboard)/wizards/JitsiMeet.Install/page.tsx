'use client';

import JitsiWizard from '@/app/components/wizards/jitsiWizard';

export default function JitsiWizardPage() {
  const handleWizardComplete = (data: Record<string, string>) => {
    // eslint-disable-next-line no-console
    console.log('Jitsi wizard completed with data:', data);
    // In a real app, send data to the backend to start installation
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <JitsiWizard onComplete={handleWizardComplete} />
    </div>
  );
}
