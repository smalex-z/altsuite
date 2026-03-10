'use client';

import MattermostWizard from '@/app/components/wizards/mattermostWizard';

export default function MattermostWizardPage() {
  const handleWizardComplete = (data: Record<string, string>) => {
    // eslint-disable-next-line no-console
    console.log('Mattermost wizard completed with data:', data);
    // In a real app, send data to the backend to start installation
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <MattermostWizard onComplete={handleWizardComplete} />
    </div>
  );
}
