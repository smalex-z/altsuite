'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Server } from 'lucide-react';
import { getSetupStatus, configureDashboard } from '@/lib/api';

type SetupState = 'loading' | 'idle' | 'submitting' | 'done';

function validate(value: string): string {
  if (!value.trim()) return 'Domain is required';
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return 'Enter just the hostname, not a full URL (e.g. dashboard.example.com)';
  }
  if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(value)) {
    return 'Please enter a valid hostname (e.g. dashboard.example.com)';
  }
  return '';
}

export default function SetupPage() {
  const router = useRouter();
  const [state, setState] = useState<SetupState>('loading');
  const [domain, setDomain] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [configuredDomain, setConfiguredDomain] = useState('');

  // If already configured, redirect to dashboard
  useEffect(() => {
    getSetupStatus()
      .then((status) => {
        if (status.configured) {
          router.replace('/');
        } else {
          setState('idle');
        }
      })
      .catch(() => setState('idle'));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate(domain);
    if (err) {
      setFieldError(err);
      return;
    }
    setFieldError('');
    setSubmitError('');
    setState('submitting');
    try {
      await configureDashboard(domain);
      setConfiguredDomain(domain);
      setState('done');
      // Give Caddy ~2 s to reload, then redirect to the proper domain
      setTimeout(() => {
        window.location.href = `https://${domain}`;
      }, 2500);
    } catch (setupErr) {
      setSubmitError(setupErr instanceof Error ? setupErr.message : 'Configuration failed');
      setState('idle');
    }
  };

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (state === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl border-2 border-green-200 p-10 max-w-md w-full text-center shadow-sm">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center text-green-600 text-2xl font-bold mx-auto mb-4">
            ✓
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Setup complete!</h2>
          <p className="text-gray-500 mb-1">
            {'Caddy is now routing '}
            <strong>{configuredDomain}</strong>
            {' to the dashboard.'}
          </p>
          <p className="text-sm text-gray-400">
            Redirecting to
            {' '}
            <strong>
              https://
              {configuredDomain}
            </strong>
            …
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl border border-gray-200 p-10 max-w-md w-full shadow-sm">
        {/* Branding */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
            <Server className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AltSuite</h1>
            <p className="text-sm text-gray-500">First-time setup</p>
          </div>
        </div>

        <h2 className="text-lg font-semibold text-gray-900 mb-1">Set your dashboard domain</h2>
        <p className="text-sm text-gray-500 mb-6">
          Enter the hostname you want to use for the AltSuite dashboard. Caddy will be configured to
          proxy this domain to the dashboard running on port 8080.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <label
            htmlFor="domain"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Dashboard domain
            <input
              id="domain"
              type="text"
              value={domain}
              onChange={(e) => {
                setDomain(e.target.value);
                if (fieldError) setFieldError(validate(e.target.value));
              }}
              placeholder="dashboard.example.com"
              className={`mt-1 w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                fieldError ? 'border-red-400' : 'border-gray-300'
              }`}
              disabled={state === 'submitting'}
            />
          </label>
          {fieldError && (
            <p className="mt-1 text-sm text-red-600">{fieldError}</p>
          )}
          <p className="mt-2 text-xs text-gray-400">
            e.g.
            {' '}
            <code>dashboard.example.com</code>
          </p>
          <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800 space-y-1">
            <p className="font-semibold">DNS setup required</p>
            <p>
              Add a wildcard
              {' '}
              <strong>A record</strong>
              {' '}
              in your DNS provider pointing
              {' '}
              <code>*</code>
              {' '}
              to this server&apos;s IP address.
            </p>
            <p className="text-blue-600">
              Name:
              {' '}
              <code>*</code>
              {'  ·  '}
              Type:
              {' '}
              <code>A</code>
              {'  ·  '}
              Value:
              {' '}
              <code>&lt;server IP&gt;</code>
            </p>
            <p className="text-blue-600">
              This lets any subdomain (dashboard, mattermost, outline…) resolve here automatically.
            </p>
          </div>

          {submitError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {submitError}
            </div>
          )}

          <button
            type="submit"
            disabled={state === 'submitting'}
            className="mt-6 w-full py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {state === 'submitting' ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Configuring…
              </span>
            ) : (
              'Configure dashboard'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
