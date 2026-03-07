'use client';

import React, { useState } from 'react';
import RocketChatWizard from '@/app/components/wizards/rocketChatWizard';

export default function WizardDemoPage() {
  const [showWizard, setShowWizard] = useState(false);
  const [submittedData, setSubmittedData] = useState<Record<string, string> | null>(null);
  const [isInstalling, setInstalling] = useState(false);

  /*
  can have a useEffect() that calls the API to check installation status and updates isInstalling state accordingly
  would connect to an SSE connection to an API route in the backend
  */

  /*
  Ideally the backend would return some kind of 
  */

  /*
  TODO:
  - should include actual API call
  - should handle accepted state and success state with UI feedback
  - should have enter a loading state that prevents multiple submissions and also shows a spinner or estimated download time 
  - vision is to have some kind of terminal that is running and showing the progress of the installation as long as app is being installed.
  */
  const handleWizardComplete = (data: Record<string, string>) => {
    console.log('Wizard completed with data in page:', data);
    setSubmittedData(data);
    setShowWizard(false);
    
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
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Rocket Chat Wizard</h1>
      <RocketChatWizard onComplete={handleWizardComplete} />
    </div>
  );
}
