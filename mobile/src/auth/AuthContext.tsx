import React, { createContext, useContext, useEffect, useState } from 'react';
import { getToken, removeToken, setToken } from '../api/client';
import { authApi, usersApi } from '../api/endpoints';
import { User, UserUpdate } from '../api/types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  signIn: (phone: string, password: string) => Promise<void>;
  signUp: (
    name: string,
    phone: string,
    password: string,
    electric_price?: number,
    water_price?: number
  ) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (data: UserUpdate) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadSession = async () => {
    try {
      const savedToken = await getToken();
      if (savedToken) {
        setTokenState(savedToken);
        const me = await usersApi.getMe();
        setUser(me);
      }
    } catch {
      await removeToken();
      setTokenState(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSession();
  }, []);

  const signIn = async (phone: string, password: string) => {
    const res = await authApi.login({ phone, password });
    await setToken(res.access_token);
    setTokenState(res.access_token);
    setUser(res.user);
  };

  const signUp = async (
    name: string,
    phone: string,
    password: string,
    electric_price?: number,
    water_price?: number
  ) => {
    const res = await authApi.register({
      name,
      phone,
      password,
      electric_price: electric_price || 0,
      water_price: water_price || 10000,
    });
    await setToken(res.access_token);
    setTokenState(res.access_token);
    setUser(res.user);
  };

  const signOut = async () => {
    await removeToken();
    setTokenState(null);
    setUser(null);
  };

  const updateUser = async (data: UserUpdate) => {
    const updated = await usersApi.updateMe(data);
    setUser(updated);
  };

  const refreshUser = async () => {
    try {
      const me = await usersApi.getMe();
      setUser(me);
    } catch {
      // Ignored if offline
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        signIn,
        signUp,
        signOut,
        updateUser,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
