'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Server, UserPlus, Globe } from 'lucide-react';
import {
  getAuthStatus, setupFirstUser, configureDashboard, type AuthStatus,
} from '@/lib/api';

type Step = 'loading' | 'create-user' | 'configure-domain' | 'done';

function validateDomain(value: string): string {
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
  const [step, setStep] = useState<Step>('loading');
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [configuredDomain, setConfiguredDomain] = useState('');

  // Create-user step state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userError, setUserError] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);

  // Configure-domain step state
  const [domain, setDomain] = useState('');
  const [domainFieldError, setDomainFieldError] = useState('');
  const [domainError, setDomainError] = useState('');
  const [configuringDomain, setConfiguringDomain] = useState(false);

  useEffect(() => {
    getAuthStatus()
      .then((status) => {
        setAuthStatus(status);
        if (status.userMgmtConfigured && !status.hasUsers) {
          setStep('create-user');
        } else if (!status.setupComplete) {
          if (status.userMgmtConfigured && !status.authenticated) {
            router.replace('/login');
          } else {
            setStep('configure-domain');
          }
        } else {
          router.replace('/');
        }
      })
      .catch(() => setStep('configure-domain'));
  }, [router]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setUserError('Username and password are required');
      return;
    }
    if (password !== confirmPassword) {
      setUserError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setUserError('Password must be at least 8 characters');
      return;
    }
    setCreatingUser(true);
    setUserError('');
    try {
      await setupFirstUser(username.trim(), password);
      const status = await getAuthStatus();
      if (!status.setupComplete) {
        setStep('configure-domain');
      } else {
        router.replace('/');
      }
    } catch (err) {
      setUserError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleConfigureDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateDomain(domain);
    if (err) {
      setDomainFieldError(err);
      return;
    }
    setDomainFieldError('');
    setDomainError('');
    setConfiguringDomain(true);
    try {
      await configureDashboard(domain.trim());
      setConfiguredDomain(domain.trim());
      setStep('done');
      setTimeout(() => { window.location.href = `https://${domain.trim()}`; }, 2500);
    } catch (setupErr) {
      setDomainError(setupErr instanceof Error ? setupErr.message : 'Configuration failed');
    } finally {
      setConfiguringDomain(false);
    }
  };

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (step === 'done') {
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mb-4">
            <Server className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">AltSuite Setup</h1>
          <p className="text-gray-500 text-sm mt-1">Let&apos;s get your dashboard configured</p>
        </div>

        {/* Step indicators (only shown when both steps apply) */}
        {authStatus?.userMgmtConfigured && (
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className={`flex items-center gap-2 text-sm font-medium ${step === 'create-user' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === 'create-user' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>1</div>
              Create Admin
            </div>
            <div className="h-px w-8 bg-gray-300" />
            <div className={`flex items-center gap-2 text-sm font-medium ${step === 'configure-domain' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === 'configure-domain' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
              Configure Domain
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">

          {/* Step 1: Create admin user */}
          {step === 'create-user' && (
            <form onSubmit={handleCreateUser} className="space-y-4" noValidate>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">Create Admin Account</h2>
                  <p className="text-xs text-gray-500">This will be your login to AltSuite</p>
                </div>
              </div>

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                  <input
                    id="username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="admin"
                  />
                </label>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                  <input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Minimum 8 characters"
                  />
                </label>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                  <input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="••••••••"
                  />
                </label>
              </div>

              {userError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {userError}
                </p>
              )}

              <button
                type="submit"
                disabled={creatingUser}
                className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {creatingUser ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating account…
                  </span>
                ) : 'Create Account & Continue'}
              </button>
            </form>
          )}

          {/* Step 2: Configure domain */}
          {step === 'configure-domain' && (
            <form onSubmit={handleConfigureDomain} noValidate>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Globe className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">Set your dashboard domain</h2>
                  <p className="text-xs text-gray-500">Caddy will handle TLS automatically</p>
                </div>
              </div>

              <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-1">
                Dashboard domain
                <input
                  id="domain"
                  type="text"
                  value={domain}
                  onChange={(e) => {
                    setDomain(e.target.value);
                    if (domainFieldError) setDomainFieldError(validateDomain(e.target.value));
                  }}
                  placeholder="dashboard.example.com"
                  className={`mt-1 w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${domainFieldError ? 'border-red-400' : 'border-gray-300'}`}
                  disabled={configuringDomain}
                />
              </label>
              {domainFieldError && (
                <p className="mt-1 text-sm text-red-600">{domainFieldError}</p>
              )}

              <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800 space-y-1">
                <p className="font-semibold">DNS setup required</p>
                <p>
                  Add a wildcard
                  {' '}
                  <strong>A record</strong>
                  {' '}
                  pointing
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
              </div>

              {domainError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {domainError}
                </div>
              )}

              <button
                type="submit"
                disabled={configuringDomain}
                className="mt-6 w-full py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {configuringDomain ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Configuring…
                  </span>
                ) : 'Configure dashboard'}
              </button>

              <button
                type="button"
                onClick={() => router.replace('/')}
                className="mt-3 w-full text-gray-500 text-sm hover:text-gray-700 py-2 transition-colors"
              >
                Skip for now
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
