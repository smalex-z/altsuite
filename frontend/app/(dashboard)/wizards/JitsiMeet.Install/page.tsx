'use client';

import { useState } from 'react';
import JitsiWizard from '@/app/components/wizards/jitsiWizard';
import { installService } from '@/lib/api';

type InstallState = 'idle' | 'installing' | 'success' | 'error';

export default function JitsiWizardPage() {
  const [installState, setInstallState] = useState<InstallState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [domain, setDomain] = useState('');

  const handleWizardComplete = async (data: Record<string, string>) => {
    setDomain(data.domain);
    setInstallState('installing');
    try {
      await installService('jitsimeet', data.domain, {});
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Installing Jitsi Meet…</h2>
          <p className="text-gray-500">
            Downloading containers and generating secure passwords. This may take several minutes.
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
              <h2 className="text-2xl font-bold text-gray-900">Jitsi Meet is running!</h2>
              <p className="text-gray-500">{domain}</p>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <p className="text-sm font-semibold text-amber-800 mb-1">⚠️ Action required: open UDP port 10001</p>
            <p className="text-sm text-amber-700">
              Jitsi Meet streams video directly over UDP. You must open port
              {' '}
              <strong>10001/UDP</strong>
              {' '}
              on your router or firewall (and in rathole/tunnel config if applicable).
              Without this, meetings with more than 2 participants will not work.
            </p>
          </div>
          <p className="text-sm text-gray-500 mb-6">
            Caddy has been configured with WebSocket support for
            {' '}
            <strong>{domain}</strong>
            . Click below to start your first meeting.
          </p>
          <a
            href={`https://${domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Open Jitsi Meet ↗
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
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
        <p className="text-sm font-semibold text-amber-800 mb-1">⚠️ UDP port required before installing</p>
        <p className="text-sm text-amber-700">
          Jitsi streams video directly over UDP — this cannot go through an HTTP-only tunnel.
          Make sure port
          {' '}
          <strong>10001/UDP</strong>
          {' '}
          is open on your router/firewall and forwarded to this server before proceeding.
        </p>
      </div>
      <JitsiWizard onComplete={handleWizardComplete} />
    </div>
  );
}
