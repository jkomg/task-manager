import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { DEFAULT_FEATURE_FLAGS, DEFAULT_SETTINGS } from '../lib/focusFlowData.js';

const DEFAULT_AUTH_FORM = {
  displayName: '',
  email: '',
  password: '',
};

const DEFAULT_AUTH_CONFIG = {
  mode: 'local',
  passwordSignInEnabled: true,
  registrationEnabled: true,
  managedProvider: null,
};

export function useAuthSession({ onAuthenticated, onSignedOut } = {}) {
  const [authChecked, setAuthChecked] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authPending, setAuthPending] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authForm, setAuthForm] = useState(DEFAULT_AUTH_FORM);
  const [authConfig, setAuthConfig] = useState(DEFAULT_AUTH_CONFIG);
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [featureFlags, setFeatureFlags] = useState(DEFAULT_FEATURE_FLAGS);
  const loadedSettingsRef = useRef(false);
  const onAuthenticatedRef = useRef(onAuthenticated);
  const onSignedOutRef = useRef(onSignedOut);

  useEffect(() => {
    onAuthenticatedRef.current = onAuthenticated;
  }, [onAuthenticated]);

  useEffect(() => {
    onSignedOutRef.current = onSignedOut;
  }, [onSignedOut]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapSession() {
      const authMeta = await api('/api/auth/config')
        .then((data) => data?.auth ?? DEFAULT_AUTH_CONFIG)
        .catch(() => DEFAULT_AUTH_CONFIG);

      if (!cancelled) {
        setAuthConfig(authMeta);
      }

      try {
        const data = await api('/api/auth/session');
        if (cancelled) {
          return;
        }
        setUser(data.user);
        setSettings(data.settings);
        setFeatureFlags(data.featureFlags ?? DEFAULT_FEATURE_FLAGS);
        setAuthConfig(data.auth ?? authMeta);
        loadedSettingsRef.current = true;
        onAuthenticatedRef.current?.(data);
      } catch {
        if (!cancelled) {
          loadedSettingsRef.current = false;
        }
      } finally {
        if (!cancelled) {
          setAuthChecked(true);
        }
      }
    }

    bootstrapSession();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAuthSubmit(event) {
    event.preventDefault();
    if (!authConfig.passwordSignInEnabled) {
      setAuthError('Password sign-in is disabled for this environment.');
      return;
    }
    setAuthPending(true);
    setAuthError('');
    try {
      const path = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const data = await api(path, {
        method: 'POST',
        body: JSON.stringify(authForm),
      });
      setUser(data.user);
      setSettings(data.settings);
      setFeatureFlags(data.featureFlags ?? DEFAULT_FEATURE_FLAGS);
      setAuthConfig(data.auth ?? DEFAULT_AUTH_CONFIG);
      loadedSettingsRef.current = true;
      setAuthChecked(true);
      setAuthForm(DEFAULT_AUTH_FORM);
      onAuthenticatedRef.current?.(data);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthPending(false);
    }
  }

  async function handleLogout() {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore logout failures and clear local state
    }
    loadedSettingsRef.current = false;
    setUser(null);
    setSettings(DEFAULT_SETTINGS);
    setFeatureFlags(DEFAULT_FEATURE_FLAGS);
    setAuthMode('login');
    setAuthError('');
    onSignedOutRef.current?.();
  }

  function updateAuthForm(event) {
    setAuthForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  return {
    authChecked,
    authMode,
    setAuthMode,
    authPending,
    authError,
    authForm,
    authConfig,
    user,
    settings,
    setSettings,
    featureFlags,
    setFeatureFlags,
    loadedSettingsRef,
    handleAuthSubmit,
    handleLogout,
    updateAuthForm,
  };
}
