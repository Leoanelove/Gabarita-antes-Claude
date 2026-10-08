import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthService, AuthState } from '../services/auth';
import { UserProfile } from '../types';

interface AuthContextType extends AuthState {
  loginWithEmail: (email: string, pass: string) => Promise<UserProfile>;
  registerWithEmail: (name: string, email: string, pass: string, consentGiven?: boolean) => Promise<UserProfile>;
  loginWithGoogle: () => Promise<UserProfile>;
  resetPassword: (email: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: (updatedProfile: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    firebaseUser: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  });

  useEffect(() => {
    AuthService.init();
    const unsubscribe = AuthService.subscribe((newState) => {
      setState(newState);
    });
    return () => unsubscribe();
  }, []);

  const loginWithEmail = async (email: string, pass: string) => {
    return await AuthService.loginWithEmail(email, pass);
  };

  const registerWithEmail = async (name: string, email: string, pass: string, consentGiven: boolean = true) => {
    return await AuthService.registerWithEmail(name, email, pass, consentGiven);
  };

  const loginWithGoogle = async () => {
    return await AuthService.loginWithGoogle();
  };

  const resetPassword = async (email: string) => {
    return await AuthService.resetPassword(email);
  };

  const deleteAccount = async () => {
    return await AuthService.deleteAccount();
  };

  const logout = async () => {
    return await AuthService.logout();
  };

  const refreshProfile = (updatedProfile: Partial<UserProfile>) => {
    if (state.user) {
      setState(prev => ({
        ...prev,
        user: { ...prev.user!, ...updatedProfile }
      }));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,
        resetPassword,
        deleteAccount,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
