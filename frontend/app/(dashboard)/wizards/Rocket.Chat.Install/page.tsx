'use client';

import RocketChatWizard from '@/app/components/wizards/rocketChatWizard';

export default function WizardDemoPage() {
  /*
  TODO:
  - should include actual API call
  - should handle accepted state and success state with UI feedback
  - vision is to have a terminal showing installation progress
  */
  const handleWizardComplete = (data: Record<string, string>) => {
    // eslint-disable-next-line no-console
    console.log('Wizard completed with data in page:', data);

    // In a real app, you would send this to your backend:
    // await fetch('/api/admin/services/rocketchat/configure', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${authToken}`,
    //   },
    //   body: JSON.stringify(data),
    // });
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <RocketChatWizard onComplete={handleWizardComplete} />
    </div>
  );
}
