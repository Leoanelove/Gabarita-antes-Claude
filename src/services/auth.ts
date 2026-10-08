import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  signOut, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  deleteUser,
  User as FirebaseUser 
} from 'firebase/auth';
import { auth, isFirebaseInitialized } from './firebase';
import { UserProfile } from '../types';
import { DatabaseService } from './db';
import { INITIAL_USER } from './seedData';

export interface AuthState {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

const AUTH_STORAGE_KEY = 'gabarita_auth_session';

export class AuthService {
  private static listeners: ((state: AuthState) => void)[] = [];
  private static currentState: AuthState = {
    user: null,
    firebaseUser: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  };

  static init(): void {
    const saved = localStorage.getItem(AUTH_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.user) {
          this.updateState({
            user: parsed.user,
            isAuthenticated: true,
            isLoading: false,
          });
        }
      } catch (e) {
        console.warn('Erro ao restaurar sessão de auth', e);
      }
    }

    if (isFirebaseInitialized && auth) {
      onAuthStateChanged(auth, async (fbUser) => {
        if (fbUser) {
          const profile = await DatabaseService.getUserProfile(fbUser.uid);
          const userProfile: UserProfile = {
            ...profile,
            id: fbUser.uid,
            email: fbUser.email || profile.email,
            name: fbUser.displayName || profile.name,
            photoURL: fbUser.photoURL || profile.photoURL,
          };
          this.persistSession(userProfile, fbUser);
        } else {
          if (isFirebaseInitialized) {
            this.clearSession();
          }
        }
      });
    } else {
      if (!this.currentState.user) {
        this.updateState({
          user: INITIAL_USER,
          isAuthenticated: true,
          isLoading: false,
        });
      }
    }
  }

  static subscribe(callback: (state: AuthState) => void): () => void {
    this.listeners.push(callback);
    callback(this.currentState);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  private static updateState(partial: Partial<AuthState>): void {
    this.currentState = { ...this.currentState, ...partial };
    this.listeners.forEach(cb => cb(this.currentState));
  }

  private static persistSession(user: UserProfile, fbUser: FirebaseUser | null): void {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user }));
    this.updateState({
      user,
      firebaseUser: fbUser,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
  }

  private static clearSession(): void {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    this.updateState({
      user: null,
      firebaseUser: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  }

  static async loginWithEmail(email: string, pass: string): Promise<UserProfile> {
    this.updateState({ isLoading: true, error: null });
    if (isFirebaseInitialized && auth) {
      try {
        const cred = await signInWithEmailAndPassword(auth, email, pass);
        const profile = await DatabaseService.getUserProfile(cred.user.uid);
        this.persistSession(profile, cred.user);
        return profile;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Falha no login com e-mail.';
        this.updateState({ isLoading: false, error: msg });
        throw new Error(msg);
      }
    }

    await new Promise(r => setTimeout(r, 450));
    const user: UserProfile = {
      ...INITIAL_USER,
      email,
      name: email.split('@')[0],
      updatedAt: new Date().toISOString(),
    };
    this.persistSession(user, null);
    return user;
  }

  static async registerWithEmail(name: string, email: string, pass: string, consentGiven: boolean = true): Promise<UserProfile> {
    this.updateState({ isLoading: true, error: null });
    if (isFirebaseInitialized && auth) {
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        const newProfile: UserProfile = {
          ...INITIAL_USER,
          id: cred.user.uid,
          email,
          name,
          preferences: {
            ...INITIAL_USER.preferences,
            consentGiven,
            consentDate: new Date().toISOString(),
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await DatabaseService.updateUserProfile(newProfile);
        this.persistSession(newProfile, cred.user);
        return newProfile;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Falha ao registrar usuário.';
        this.updateState({ isLoading: false, error: msg });
        throw new Error(msg);
      }
    }

    await new Promise(r => setTimeout(r, 450));
    const newProfile: UserProfile = {
      ...INITIAL_USER,
      id: `usr_${Date.now()}`,
      email,
      name,
      preferences: {
        ...INITIAL_USER.preferences,
        consentGiven,
        consentDate: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.persistSession(newProfile, null);
    return newProfile;
  }

  static async loginWithGoogle(): Promise<UserProfile> {
    this.updateState({ isLoading: true, error: null });
    if (isFirebaseInitialized && auth) {
      try {
        const provider = new GoogleAuthProvider();
        const cred = await signInWithPopup(auth, provider);
        const profile = await DatabaseService.getUserProfile(cred.user.uid);
        const updated: UserProfile = {
          ...profile,
          id: cred.user.uid,
          email: cred.user.email || profile.email,
          name: cred.user.displayName || profile.name,
          photoURL: cred.user.photoURL || profile.photoURL,
        };
        await DatabaseService.updateUserProfile(updated);
        this.persistSession(updated, cred.user);
        return updated;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Falha no login com Google.';
        this.updateState({ isLoading: false, error: msg });
        throw new Error(msg);
      }
    }

    await new Promise(r => setTimeout(r, 500));
    const googleProfile: UserProfile = {
      ...INITIAL_USER,
      id: 'google_user_demo',
      email: 'usuario.concursos@gmail.com',
      name: 'Estudante Google',
      photoURL: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=250',
      updatedAt: new Date().toISOString(),
    };
    this.persistSession(googleProfile, null);
    return googleProfile;
  }

  static async resetPassword(email: string): Promise<void> {
    if (isFirebaseInitialized && auth) {
      try {
        await sendPasswordResetEmail(auth, email);
        return;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Não foi possível enviar o e-mail de recuperação.';
        throw new Error(msg);
      }
    }
    await new Promise(r => setTimeout(r, 400));
  }

  static async deleteAccount(): Promise<void> {
    const currentUser = this.currentState.user;
    if (currentUser) {
      await DatabaseService.deleteAccountData(currentUser.id);
    }
    if (isFirebaseInitialized && auth && auth.currentUser) {
      try {
        await deleteUser(auth.currentUser);
      } catch (e) {
        console.warn('Erro ao excluir usuário no Firebase Auth (pode exigir reautenticação):', e);
      }
    }
    this.clearSession();
  }

  static async logout(): Promise<void> {
    if (isFirebaseInitialized && auth) {
      try {
        await signOut(auth);
      } catch (e) {
        console.warn('Erro ao deslogar do Firebase', e);
      }
    }
    this.clearSession();
  }
}
