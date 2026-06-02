import { useState, useEffect, useCallback } from 'react';
import * as authService from '../services/authService.js';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      setLoading(true);
      const redirectResult = await authService.handleOAuthRedirect();
      const current = redirectResult.ok ? redirectResult.user : await authService.getCurrentUser();
      if (isMounted) {
        setUser(current);
        setError(redirectResult.error ?? null);
        setLoading(false);
      }
    };

    const unsubscribe = authService.subscribeToAuthChanges((nextUser, nextError) => {
      if (!isMounted) return;
      setUser(nextUser);
      setError(nextError ?? null);
      setLoading(false);
    });

    bootstrap();
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const register = useCallback(async (data) => {
    setLoading(true);
    setError(null);
    const result = await authService.register(data);
    setLoading(false);
    if (result.ok) {
      setUser(result.user);
    } else {
      setError(result.error);
    }
    return result;
  }, []);

  const login = useCallback(async (data) => {
    setLoading(true);
    setError(null);
    const result = await authService.login(data);
    setLoading(false);
    if (result.ok) {
      setUser(result.user);
    } else {
      setError(result.error);
    }
    return result;
  }, []);

  const loginWithGoogle = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await authService.loginWithGoogleOAuth();
    if (result.redirecting) {
      return result;
    }
    setLoading(false);
    if (result.ok) {
      setUser(result.user);
    } else {
      setError(result.error);
    }
    return result;
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
    setError(null);
  }, []);

  const updateAccount = useCallback(async (data) => {
    setLoading(true);
    setError(null);
    const result = await authService.updateAccount({ ...data, id: user?.id });
    setLoading(false);
    if (result.ok) {
      setUser(result.user);
    } else {
      setError(result.error);
    }
    return result;
  }, [user?.id]);

  const updateChips = useCallback((chips) => {
    setUser((prev) => {
      if (!prev) return prev;
      void authService.saveUserChips(prev.id, chips);
      return { ...prev, chips };
    });
  }, []);

  return {
    user,
    isAuthenticated: !!user,
    loading,
    error,
    setError,
    register,
    login,
    loginWithGoogle,
    logout,
    updateAccount,
    updateChips,
  };
}
