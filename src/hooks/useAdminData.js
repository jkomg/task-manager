import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { DEFAULT_FEATURE_FLAGS } from '../lib/focusFlowData.js';

export function useAdminData({ user, siteView, onFeatureFlagsChange, refreshAuthenticatedSession }) {
  const [adminSummary, setAdminSummary] = useState({
    flags: DEFAULT_FEATURE_FLAGS,
    metrics: null,
    recentEvents: [],
    auth: null,
  });
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminQuery, setAdminQuery] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminStatus, setAdminStatus] = useState('');
  const [selectedAdminUser, setSelectedAdminUser] = useState(null);

  async function refreshAdminSummary() {
    if (user?.role !== 'admin') {
      return;
    }
    setAdminLoading(true);
    setAdminStatus('');
    try {
      const data = await api('/api/admin/summary');
      setAdminSummary(data);
      onFeatureFlagsChange?.(data.flags ?? DEFAULT_FEATURE_FLAGS);
    } catch (error) {
      setAdminStatus(error.message);
    } finally {
      setAdminLoading(false);
    }
  }

  async function searchAdminUsers(nextQuery = adminQuery) {
    if (user?.role !== 'admin') {
      return;
    }
    setAdminLoading(true);
    setAdminStatus('');
    try {
      const params = new URLSearchParams();
      if (nextQuery.trim()) {
        params.set('query', nextQuery.trim());
      }
      const data = await api(`/api/admin/users${params.toString() ? `?${params.toString()}` : ''}`);
      setAdminUsers(data.users ?? []);
    } catch (error) {
      setAdminStatus(error.message);
    } finally {
      setAdminLoading(false);
    }
  }

  async function toggleFeatureFlag(key, enabled) {
    setAdminStatus('');
    try {
      const data = await api(`/api/admin/flags/${encodeURIComponent(key)}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled }),
      });
      onFeatureFlagsChange?.(data.flags ?? DEFAULT_FEATURE_FLAGS);
      setAdminSummary((current) => ({
        ...current,
        flags: data.flags ?? DEFAULT_FEATURE_FLAGS,
      }));
    } catch (error) {
      setAdminStatus(error.message);
    }
  }

  async function resetUserState(targetUserId, options = {}) {
    setAdminStatus('');
    try {
      await api(`/api/admin/users/${encodeURIComponent(targetUserId)}/reset`, {
        method: 'POST',
        body: JSON.stringify(options),
      });
      if (options.preserveCurrentSession && targetUserId === user?.id) {
        await refreshAuthenticatedSession?.();
      }
      setAdminStatus(options.preserveCurrentSession ? 'Your state was reset and your current session was preserved.' : 'User state reset.');
      await Promise.all([refreshAdminSummary(), searchAdminUsers()]);
      if (selectedAdminUser?.user?.id === targetUserId) {
        await inspectUser(targetUserId);
      }
    } catch (error) {
      setAdminStatus(error.message);
    }
  }

  async function inspectUser(targetUserId) {
    setAdminStatus('');
    setAdminLoading(true);
    try {
      const data = await api(`/api/admin/users/${encodeURIComponent(targetUserId)}`);
      setSelectedAdminUser(data);
    } catch (error) {
      setAdminStatus(error.message);
    } finally {
      setAdminLoading(false);
    }
  }

  async function setUserAccountStatus(targetUserId, accountStatus) {
    setAdminStatus('');
    setAdminLoading(true);
    try {
      const data = await api(`/api/admin/users/${encodeURIComponent(targetUserId)}/status`, {
        method: 'PUT',
        body: JSON.stringify({ accountStatus }),
      });
      setAdminStatus(
        data.changed
          ? `User status set to ${data.user?.accountStatus ?? accountStatus}.`
          : `User is already ${accountStatus}.`
      );
      await Promise.all([refreshAdminSummary(), searchAdminUsers()]);
      if (selectedAdminUser?.user?.id === targetUserId) {
        await inspectUser(targetUserId);
      }
    } catch (error) {
      setAdminStatus(error.message);
    } finally {
      setAdminLoading(false);
    }
  }

  async function revokeUserSessions(targetUserId) {
    setAdminStatus('');
    setAdminLoading(true);
    try {
      const data = await api(`/api/admin/users/${encodeURIComponent(targetUserId)}/revoke-sessions`, {
        method: 'POST',
      });
      setAdminStatus(
        data.preservedCurrentSession
          ? `Revoked ${data.revokedSessions} sessions and kept your current session.`
          : `Revoked ${data.revokedSessions} sessions.`
      );
      await Promise.all([refreshAdminSummary(), searchAdminUsers()]);
      if (selectedAdminUser?.user?.id === targetUserId) {
        await inspectUser(targetUserId);
      }
    } catch (error) {
      setAdminStatus(error.message);
    } finally {
      setAdminLoading(false);
    }
  }

  async function seedDemoState(targetUserId) {
    setAdminStatus('');
    setAdminLoading(true);
    try {
      await api(`/api/admin/users/${encodeURIComponent(targetUserId)}/seed-demo`, {
        method: 'POST',
      });
      setAdminStatus('Seeded demo planner state.');
      await Promise.all([refreshAdminSummary(), searchAdminUsers()]);
      if (selectedAdminUser?.user?.id === targetUserId) {
        await inspectUser(targetUserId);
      }
    } catch (error) {
      setAdminStatus(error.message);
    } finally {
      setAdminLoading(false);
    }
  }

  async function clearUserActivity(targetUserId) {
    setAdminStatus('');
    setAdminLoading(true);
    try {
      await api(`/api/admin/users/${encodeURIComponent(targetUserId)}/clear-activity`, {
        method: 'POST',
      });
      setAdminStatus('Cleared planner activity.');
      await Promise.all([refreshAdminSummary(), searchAdminUsers()]);
      if (selectedAdminUser?.user?.id === targetUserId) {
        await inspectUser(targetUserId);
      }
    } catch (error) {
      setAdminStatus(error.message);
    } finally {
      setAdminLoading(false);
    }
  }

  async function unlockUserAuth(targetUserId) {
    setAdminStatus('');
    setAdminLoading(true);
    try {
      const data = await api(`/api/admin/users/${encodeURIComponent(targetUserId)}/unlock`, {
        method: 'POST',
      });
      setAdminStatus(data.changed ? 'Auth lock state cleared.' : 'No lock state to clear.');
      await Promise.all([refreshAdminSummary(), searchAdminUsers()]);
      if (selectedAdminUser?.user?.id === targetUserId) {
        await inspectUser(targetUserId);
      }
    } catch (error) {
      setAdminStatus(error.message);
    } finally {
      setAdminLoading(false);
    }
  }

  async function createAdminUser(payload) {
    setAdminStatus('');
    setAdminLoading(true);
    try {
      const data = await api('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setAdminStatus(`Created user ${data.user?.email ?? payload.email}.`);
      await Promise.all([refreshAdminSummary(), searchAdminUsers()]);
      return true;
    } catch (error) {
      setAdminStatus(error.message);
      return false;
    } finally {
      setAdminLoading(false);
    }
  }

  async function resetUserPassword(targetUserId, password) {
    setAdminStatus('');
    setAdminLoading(true);
    try {
      const data = await api(`/api/admin/users/${encodeURIComponent(targetUserId)}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      setAdminStatus(
        data.preservedCurrentSession
          ? `Password reset. Revoked ${data.revokedSessions} other sessions and preserved your current session.`
          : `Password reset. Revoked ${data.revokedSessions} active sessions.`
      );
      await Promise.all([refreshAdminSummary(), searchAdminUsers()]);
      if (selectedAdminUser?.user?.id === targetUserId) {
        await inspectUser(targetUserId);
      }
      if (data.preservedCurrentSession && targetUserId === user?.id) {
        await refreshAuthenticatedSession?.();
      }
      return true;
    } catch (error) {
      setAdminStatus(error.message);
      return false;
    } finally {
      setAdminLoading(false);
    }
  }

  async function deleteUserAccount(targetUserId) {
    setAdminStatus('');
    setAdminLoading(true);
    try {
      const data = await api(`/api/admin/users/${encodeURIComponent(targetUserId)}`, {
        method: 'DELETE',
      });
      setAdminStatus(`Deleted user ${data.user?.email ?? targetUserId}.`);
      if (selectedAdminUser?.user?.id === targetUserId) {
        setSelectedAdminUser(null);
      }
      await Promise.all([refreshAdminSummary(), searchAdminUsers()]);
      return true;
    } catch (error) {
      setAdminStatus(error.message);
      return false;
    } finally {
      setAdminLoading(false);
    }
  }

  useEffect(() => {
    if (siteView === 'admin' && user?.role === 'admin') {
      refreshAdminSummary();
      searchAdminUsers('');
      setSelectedAdminUser(null);
    }
  }, [siteView, user?.role]);

  return {
    adminSummary,
    adminUsers,
    adminQuery,
    adminLoading,
    adminStatus,
    selectedAdminUser,
    setAdminQuery,
    refreshAdminSummary,
    searchAdminUsers,
    toggleFeatureFlag,
    resetUserState,
    inspectUser,
    setUserAccountStatus,
    revokeUserSessions,
    seedDemoState,
    clearUserActivity,
    unlockUserAuth,
    createAdminUser,
    resetUserPassword,
    deleteUserAccount,
  };
}
