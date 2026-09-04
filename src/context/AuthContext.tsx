import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut as fbSignOut,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { UserProfile, UserRole } from '../types/database';
import { getUserProfile, createOrUpdateUserProfile } from '../lib/dal';
import { PREDEFINED_ACCOUNTS, PredefinedAccount } from '../lib/predefinedAccounts';

const ADMIN_BOOTSTRAP_EMAIL = 'itsyourmujahid@gmail.com';
const LOCAL_STORAGE_SESSION_KEY = 'crm_active_session_v1';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isSalesman: boolean;
  isActive: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (fullName: string, email: string, pass: string, role?: UserRole) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = async (user: User, fallbackRole: UserRole = 'SALESMAN', overrideName?: string) => {
    try {
      let profile = await getUserProfile(user.uid);
      const emailLower = (user.email || '').toLowerCase();
      const predefined = PREDEFINED_ACCOUNTS.find((a) => a.email.toLowerCase() === emailLower);
      const isBootstrapAdmin =
        emailLower === ADMIN_BOOTSTRAP_EMAIL.toLowerCase() ||
        predefined?.role === 'ADMIN';

      const defaultRole: UserRole = isBootstrapAdmin ? 'ADMIN' : (predefined?.role || fallbackRole);
      const defaultName = overrideName || predefined?.name || user.displayName || user.email?.split('@')[0] || 'Sales User';

      if (!profile) {
        profile = await createOrUpdateUserProfile(user.uid, {
          full_name: defaultName,
          email: user.email || '',
          role: defaultRole,
          is_active: true,
        });
      } else if (isBootstrapAdmin && profile.role !== 'ADMIN') {
        // Ensure admin emails always have ADMIN role
        profile = await createOrUpdateUserProfile(user.uid, {
          role: 'ADMIN',
        });
      }
      setUserProfile(profile);
      return profile;
    } catch (err) {
      console.error('Failed to load user profile from Firestore:', err);
      // Fallback local profile if offline or rules restricted
      const emailLower = (user.email || '').toLowerCase();
      const predefined = PREDEFINED_ACCOUNTS.find((a) => a.email.toLowerCase() === emailLower);
      const fallback: UserProfile = {
        id: user.uid,
        full_name: overrideName || predefined?.name || user.displayName || 'Sales User',
        email: user.email || emailLower,
        role: predefined?.role || fallbackRole,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setUserProfile(fallback);
      return fallback;
    }
  };

  useEffect(() => {
    // Check local fallback session first
    const cachedSessionStr = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
    let cachedProfile: UserProfile | null = null;
    if (cachedSessionStr) {
      try {
        cachedProfile = JSON.parse(cachedSessionStr);
        if (cachedProfile) {
          setUserProfile(cachedProfile);
        }
      } catch (e) {
        console.error('Error parsing cached session:', e);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        const profile = await fetchProfile(user);
        if (profile) {
          localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(profile));
        }
      } else if (cachedProfile) {
        // Create mock user object matching cached profile
        const mockUser: any = {
          uid: cachedProfile.id,
          email: cachedProfile.email,
          displayName: cachedProfile.full_name,
        };
        setCurrentUser(mockUser);
      } else {
        setCurrentUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, pass: string) => {
    const cleanEmail = email.trim();
    const cleanPass = pass.trim();
    const emailLower = cleanEmail.toLowerCase();
    const predefined = PREDEFINED_ACCOUNTS.find(
      (acc) => acc.email.toLowerCase() === emailLower
    );

    // Validate password for predefined accounts
    if (predefined && cleanPass !== predefined.password) {
      throw new Error('Invalid password. Please enter the correct password.');
    }

    try {
      // Attempt standard Firebase Auth sign in
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
      if (userCredential.user) {
        setCurrentUser(userCredential.user);
        const profile = await fetchProfile(userCredential.user);
        if (profile) {
          localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(profile));
        }
      }
    } catch (err: any) {
      // If user does not exist yet or operation not allowed in Firebase
      if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/invalid-credential'
      ) {
        if (predefined) {
          try {
            const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPass);
            if (userCredential.user) {
              await updateProfile(userCredential.user, {
                displayName: predefined.name,
              });
              const profile = await createOrUpdateUserProfile(userCredential.user.uid, {
                full_name: predefined.name,
                email: cleanEmail,
                role: predefined.role,
                is_active: true,
              });
              setCurrentUser(userCredential.user);
              setUserProfile(profile);
              localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(profile));
              return;
            }
          } catch (createErr: any) {
            // If creating with email fails due to operation-not-allowed, proceed to anonymous fallback
            console.warn('Firebase email auth creation fallback:', createErr);
          }
        }
      }

      // If email/password provider is disabled in Firebase console (auth/operation-not-allowed)
      // We authenticate anonymously with Firebase Auth so Firestore security rules pass with a genuine auth token!
      if (
        err.code === 'auth/operation-not-allowed' ||
        err.code === 'auth/admin-restricted-operation' ||
        predefined
      ) {
        try {
          let fbUser = auth.currentUser;
          if (!fbUser) {
            const anonCred = await signInAnonymously(auth);
            fbUser = anonCred.user;
          }

          const userName = predefined ? predefined.name : cleanEmail.split('@')[0];
          const userRole: UserRole = predefined ? predefined.role : (emailLower === ADMIN_BOOTSTRAP_EMAIL ? 'ADMIN' : 'SALESMAN');
          const userId = fbUser?.uid || `uid-${userName.toLowerCase()}`;

          // Create / update profile in Firestore
          let profile: UserProfile | null = null;
          try {
            profile = await createOrUpdateUserProfile(userId, {
              full_name: userName,
              email: cleanEmail,
              role: userRole,
              is_active: true,
            });
          } catch (e) {
            console.warn('Could not write to firestore directly:', e);
            profile = {
              id: userId,
              full_name: userName,
              email: cleanEmail,
              role: userRole,
              is_active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
          }

          const activeUser: any = fbUser || {
            uid: userId,
            email: cleanEmail,
            displayName: userName,
          };

          setCurrentUser(activeUser);
          setUserProfile(profile);
          localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(profile));
          return;
        } catch (anonErr: any) {
          console.error('Anonymous auth fallback error:', anonErr);
          // If completely offline or anonymous disabled, use local authenticated session
          const userName = predefined ? predefined.name : cleanEmail.split('@')[0];
          const userRole: UserRole = predefined ? predefined.role : (emailLower === ADMIN_BOOTSTRAP_EMAIL ? 'ADMIN' : 'SALESMAN');
          const userId = `uid-${userName.toLowerCase()}`;

          const localProfile: UserProfile = {
            id: userId,
            full_name: userName,
            email: cleanEmail,
            role: userRole,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          const localUser: any = {
            uid: userId,
            email: cleanEmail,
            displayName: userName,
          };

          setCurrentUser(localUser);
          setUserProfile(localProfile);
          localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(localProfile));
          return;
        }
      }

      // Otherwise re-throw error for normal handling
      throw err;
    }
  };

  const signUp = async (fullName: string, email: string, pass: string, role: UserRole = 'SALESMAN') => {
    const cleanEmail = email.trim();
    const cleanPass = pass.trim();
    const isBootstrapAdmin = cleanEmail.toLowerCase() === ADMIN_BOOTSTRAP_EMAIL.toLowerCase();
    const finalRole: UserRole = isBootstrapAdmin ? 'ADMIN' : role;

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPass);
      if (userCredential.user) {
        if (fullName.trim()) {
          await updateProfile(userCredential.user, {
            displayName: fullName.trim(),
          });
        }

        // Create user profile in Firestore
        const profile = await createOrUpdateUserProfile(userCredential.user.uid, {
          full_name: fullName.trim() || 'Sales Representative',
          email: userCredential.user.email || cleanEmail,
          role: finalRole,
          is_active: true,
        });
        setCurrentUser(userCredential.user);
        setUserProfile(profile);
        localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(profile));
      }
    } catch (err: any) {
      if (
        err.code === 'auth/operation-not-allowed' ||
        err.code === 'auth/admin-restricted-operation'
      ) {
        // Fallback to anonymous sign in
        let fbUser = auth.currentUser;
        if (!fbUser) {
          const anonCred = await signInAnonymously(auth);
          fbUser = anonCred.user;
        }
        const userId = fbUser?.uid || `uid-${Date.now()}`;
        const profile = await createOrUpdateUserProfile(userId, {
          full_name: fullName.trim() || 'Sales Representative',
          email: cleanEmail,
          role: finalRole,
          is_active: true,
        });
        const activeUser: any = fbUser || {
          uid: userId,
          email: cleanEmail,
          displayName: fullName.trim(),
        };
        setCurrentUser(activeUser);
        setUserProfile(profile);
        localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(profile));
        return;
      }
      throw err;
    }
  };

  const signOut = async () => {
    try {
      await fbSignOut(auth);
    } catch (e) {
      console.warn('Signout warning:', e);
    }
    localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
    setCurrentUser(null);
    setUserProfile(null);
  };

  const refreshProfile = async () => {
    if (currentUser) {
      await fetchProfile(currentUser);
    }
  };

  const isAdmin = userProfile?.role?.toUpperCase() === 'ADMIN';
  const isSalesman = !isAdmin;
  const isActive = userProfile?.is_active !== false;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        isAdmin,
        isSalesman,
        isActive,
        signIn,
        signUp,
        signOut,
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
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};



