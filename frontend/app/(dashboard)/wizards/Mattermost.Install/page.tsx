'use client';

import { useState } from 'react';
import MattermostWizard from '@/app/components/wizards/mattermostWizard';
import { installService } from '@/lib/api';

type InstallState = 'idle' | 'installing' | 'success' | 'error';

export default function MattermostWizardPage() {
  const [installState, setInstallState] = useState<InstallState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [domain, setDomain] = useState('');

  const handleWizardComplete = async (data: Record<string, string>) => {
    setDomain(data.domain);
    setInstallState('installing');
    try {
      await installService('mattermost', data.domain, {
        postgresPassword: data.postgresPassword,
        supportEmail: data.supportEmail,
      });
      setInstallState('success');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Installation failed');
      setInstallState('error');
    }
  };

  if (installState === 'installing') {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <div className="bg-white rounded-lg border border-gray-200 p-10 text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Installing Mattermost…</h2>
          <p className="text-gray-500">
            Docker containers are being pulled and started. This may take a few minutes.
          </p>
        </div>
      </div>
    );
  }

  if (installState === 'success') {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <div className="bg-white rounded-lg border-2 border-green-200 p-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600 text-2xl font-bold">
              ✓
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Mattermost is running!</h2>
              <p className="text-gray-500">{domain}</p>
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-6">
            {'Caddy has been configured to proxy '}
            <strong>{domain}</strong>
            {' → Mattermost. Create your first admin account at the link below.'}
          </p>
          <a
            href={`https://${domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Open Mattermost ↗
          </a>
        </div>
      </div>
    );
  }

  if (installState === 'error') {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <div className="bg-white rounded-lg border-2 border-red-200 p-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Installation failed</h2>
          <pre className="text-sm bg-red-50 border border-red-200 rounded p-4 overflow-x-auto text-red-800 mb-6 whitespace-pre-wrap">
            {errorMessage}
          </pre>
          <button
            type="button"
            onClick={() => setInstallState('idle')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <MattermostWizard onComplete={handleWizardComplete} />
    </div>
  );
}
