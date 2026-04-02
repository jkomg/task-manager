import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { DEFAULT_FEATURE_FLAGS } from '../lib/focusFlowData.js';

export function useAdminData({ user, siteView, onFeatureFlagsChange }) {
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

  async function resetUserState(targetUserId) {
    setAdminStatus('');
    try {
      await api(`/api/admin/users/${encodeURIComponent(targetUserId)}/reset`, {
        method: 'POST',
      });
      setAdminStatus('User state reset.');
      await Promise.all([refreshAdminSummary(), searchAdminUsers()]);
    } catch (error) {
      setAdminStatus(error.message);
    }
  }

  useEffect(() => {
    if (siteView === 'admin' && user?.role === 'admin') {
      refreshAdminSummary();
      searchAdminUsers('');
    }
  }, [siteView, user?.role]);

  return {
    adminSummary,
    adminUsers,
    adminQuery,
    adminLoading,
    adminStatus,
    setAdminQuery,
    refreshAdminSummary,
    searchAdminUsers,
    toggleFeatureFlag,
    resetUserState,
  };
}
