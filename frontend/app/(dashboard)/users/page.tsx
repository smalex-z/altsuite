'use client';

import { useState, useEffect } from 'react';
import { Users as UsersIcon, UserPlus, KeyRound } from 'lucide-react';
import {
  getUsers,
  createUser,
  changePassword,
  type User,
} from '@/lib/api';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [changingId, setChangingId] = useState<number | null>(null);
  const [newPasswordFor, setNewPasswordFor] = useState<Record<number, string>>({});
  const [changeError, setChangeError] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getUsers();
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword) {
      setCreateError('Username and password are required');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      await createUser(newUsername.trim(), newPassword);
      setNewUsername('');
      setNewPassword('');
      await loadUsers();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const handleChangePassword = async (userId: number) => {
    const password = newPasswordFor[userId];
    if (!password) {
      setChangeError('Enter a new password');
      return;
    }
    setChangeError(null);
    try {
      await changePassword(userId, password);
      setChangingId(null);
      setNewPasswordFor((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    } catch (err) {
      setChangeError(err instanceof Error ? err.message : 'Failed to change password');
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <UsersIcon className="w-6 h-6 text-blue-600" />
          </div>
          User Management
        </h1>
        <p className="text-gray-600">
          Create users and change passwords. Users are stored in the Postgres database.
        </p>
      </div>

      {error && (
        <div className="mb-6 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Users</h2>
            {loading && <p className="text-gray-500">Loading...</p>}
            {!loading && users.length === 0 && (
              <p className="text-gray-500">No users yet. Create one below.</p>
            )}
            {!loading && users.length > 0 && (
              <ul className="divide-y divide-gray-200">
                {users.map((u) => (
                  <li key={u.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-medium text-gray-900">{u.username}</span>
                        <span className="text-gray-500 text-sm ml-2">
                          Created
                          {' '}
                          {formatDate(u.created_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {changingId === u.id ? (
                          <>
                            <input
                              type="password"
                              placeholder="New password"
                              value={newPasswordFor[u.id] ?? ''}
                              onChange={(e) => {
                                setNewPasswordFor((prev) => ({
                                  ...prev,
                                  [u.id]: e.target.value,
                                }));
                              }}
                              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => handleChangePassword(u.id)}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setChangingId(null);
                                setNewPasswordFor((prev) => {
                                  const next = { ...prev };
                                  delete next[u.id];
                                  return next;
                                });
                              }}
                              className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setChangingId(u.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            <KeyRound className="w-4 h-4" />
                            Change password
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {changeError && (
              <p className="mt-3 text-sm text-red-600">{changeError}</p>
            )}
          </div>
        </div>

        <div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Add user
            </h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label htmlFor="users-username" className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                  <input
                    id="users-username"
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    placeholder="jane"
                    autoComplete="username"
                  />
                </label>
              </div>
              <div>
                <label htmlFor="users-password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                  <input
                    id="users-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </label>
              </div>
              {createError && (
                <p className="text-sm text-red-600">{createError}</p>
              )}
              <button
                type="submit"
                disabled={creating}
                className="w-full rounded-lg bg-blue-600 text-white py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create user'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
