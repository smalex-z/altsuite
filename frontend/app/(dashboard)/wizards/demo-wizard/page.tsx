'use client';

import React, { useState } from 'react';
import RocketChatWizard from '@/app/components/wizards/rocketChatWizard';

export default function WizardDemoPage() {
  const [showWizard, setShowWizard] = useState(false);
  const [submittedData, setSubmittedData] = useState<Record<string, string> | null>(null);

  const handleWizardComplete = (data: Record<string, string>) => {
    console.log('Wizard completed with data:', data);
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

  if (showWizard) {
    return <RocketChatWizard onComplete={handleWizardComplete} />;
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Service Wizard Demo</h1>
      
      <div className="bg-white rounded-lg border-2 border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">Try the RocketChat Setup Wizard</h2>
        <p className="text-gray-600 mb-4">
          This is a Typeform-style wizard that collects configuration for RocketChat.
          It demonstrates:
        </p>
        <ul className="list-disc list-inside text-gray-600 mb-6 space-y-2">
          <li>One field per step with large, focused inputs</li>
          <li>Progress bar showing completion percentage</li>
          <li>Field validation (required, URL format, email format, etc.)</li>
          <li>Keyboard navigation (press Enter to advance)</li>
          <li>Dynamic field configuration via JSON</li>
          <li>Accumulated state passed to parent on completion</li>
        </ul>
        
        <button
          onClick={() => setShowWizard(true)}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Launch Wizard
        </button>
      </div>

      {submittedData && (
        <div className="bg-green-50 rounded-lg p-6 border-2 border-green-200">
          <h2 className="text-xl font-semibold text-green-800 mb-4">
            ✅ Wizard Completed!
          </h2>
          <p className="text-gray-700 mb-4">
            The wizard collected the following data:
          </p>
          <pre className="bg-white border border-gray-200 p-4 rounded overflow-x-auto text-sm">
            {JSON.stringify(submittedData, null, 2)}
          </pre>
          <p className="text-sm text-gray-600 mt-4">
            💡 In a real application, this data would be sent to your backend API
            at <code className="bg-gray-100 text-gray-700 px-2 py-1 rounded border border-gray-200">/api/admin/services/rocketchat/configure</code>
          </p>
        </div>
      )}

      <div className="bg-blue-50 rounded-lg p-6 border-2 border-blue-200 mt-6">
        <h2 className="text-xl font-semibold text-blue-800 mb-4">
          How to Create Your Own Wizard
        </h2>
        <div className="text-gray-700 space-y-4">
          <p>1. Define your field configuration:</p>
          <pre className="bg-white border border-gray-200 p-4 rounded overflow-x-auto text-sm">
{`const myFields: WizardFieldConfig[] = [
  {
    key: 'databaseURL',
    label: 'What is your database URL?',
    type: 'url',
    placeholder: 'postgres://...',
    description: 'Connection string for your database',
    required: true,
  },
  // ... more fields
];`}
          </pre>

          <p>2. Use the ServiceWizard component:</p>
          <pre className="bg-white border border-gray-200 p-4 rounded overflow-x-auto text-sm">
{`<ServiceWizard
  fields={myFields}
  serviceName="My Service"
  onComplete={(data) => {
    // Send to backend API
    console.log(data);
  }}
/>`}
          </pre>
        </div>
      </div>
    </div>
  );
}
