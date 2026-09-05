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
import { UserProfile, UserRole, CompanyRecord } from '../types/database';
import {
  getUserProfile,
  createOrUpdateUserProfile,
  getCompanyById,
  ensureMultiTenantMigration,
  DEFAULT_COMPANY_ID,
  INITIAL_DEFAULT_COMPANY,
} from '../lib/dal';
import { PREDEFINED_ACCOUNTS, PredefinedAccount } from '../lib/predefinedAccounts';

const ADMIN_BOOTSTRAP_EMAIL = 'itsyourmujahid@gmail.com';
const LOCAL_STORAGE_SESSION_KEY = 'crm_active_session_v1';
const VIEW_COMPANY_KEY = 'crm_super_admin_view_company_id';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isCompanyAdmin: boolean;
  isSalesman: boolean;
  isActive: boolean;
  currentCompany: CompanyRecord | null;
  companyId: string;
  isCompanyActive: boolean;
  switchCompanyView: (companyId: string | null) => void;
  activeViewingCompanyId: string | null;
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (fullName: string, email: string, pass: string, role?: UserRole) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [currentCompany, setCurrentCompany] = useState<CompanyRecord | null>(INITIAL_DEFAULT_COMPANY);
  const [activeViewingCompanyId, setActiveViewingCompanyId] = useState<string | null>(() => {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(VIEW_COMPANY_KEY) : null;
  });
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = async (user: User, fallbackRole: UserRole = 'SALESMAN', overrideName?: string) => {
    try {
      let profile = await getUserProfile(user.uid);
      const emailLower = (user.email || '').toLowerCase();
      const predefined = PREDEFINED_ACCOUNTS.find((a) => a.email.toLowerCase() === emailLower);
      const isSuperAdminUser =
        emailLower === ADMIN_BOOTSTRAP_EMAIL.toLowerCase() ||
        predefined?.role === 'SUPER_ADMIN' ||
        profile?.role === 'SUPER_ADMIN';

      const defaultRole: UserRole = isSuperAdminUser
        ? 'SUPER_ADMIN'
        : predefined?.role || fallbackRole;
      const defaultName =
        overrideName || predefined?.name || user.displayName || user.email?.split('@')[0] || 'Sales User';
      const targetCompanyId = isSuperAdminUser
        ? profile?.company_id
        : profile?.company_id || predefined?.company_id || DEFAULT_COMPANY_ID;

      if (!profile) {
        profile = await createOrUpdateUserProfile(user.uid, {
          full_name: defaultName,
          email: user.email || '',
          role: defaultRole,
          company_id: targetCompanyId,
          is_active: true,
        });
      } else if (isSuperAdminUser && profile.role !== 'SUPER_ADMIN') {
        // Ensure super admin email always holds SUPER_ADMIN role
        profile = await createOrUpdateUserProfile(user.uid, {
          role: 'SUPER_ADMIN',
        });
      }

      setUserProfile(profile);

      // Load company record
      const compId = profile.company_id || DEFAULT_COMPANY_ID;
      const comp = await getCompanyById(compId);
      if (comp) {
        setCurrentCompany(comp);
      }

      return profile;
    } catch (err) {
      console.error('Failed to load user profile from Firestore:', err);
      // Fallback local profile if offline or rules restricted
      const emailLower = (user.email || '').toLowerCase();
      const predefined = PREDEFINED_ACCOUNTS.find((a) => a.email.toLowerCase() === emailLower);
      const isSuperAdminUser =
        emailLower === ADMIN_BOOTSTRAP_EMAIL.toLowerCase() || predefined?.role === 'SUPER_ADMIN';
      const fallbackRoleToUse: UserRole = isSuperAdminUser
        ? 'SUPER_ADMIN'
        : predefined?.role || fallbackRole;

      const fallback: UserProfile = {
        id: user.uid,
        full_name: overrideName || predefined?.name || user.displayName || 'Sales User',
        email: user.email || emailLower,
        role: fallbackRoleToUse,
        company_id: isSuperAdminUser ? undefined : predefined?.company_id || DEFAULT_COMPANY_ID,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setUserProfile(fallback);
      return fallback;
    }
  };

  useEffect(() => {
    // Run safe multi-tenant migration backfill on app launch
    ensureMultiTenantMigration().catch((err) => {
      console.warn('Initial multi-tenant migration warning:', err);
    });

    // Check local fallback session first
    const cachedSessionStr = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
    let cachedProfile: UserProfile | null = null;
    if (cachedSessionStr) {
      try {
        cachedProfile = JSON.parse(cachedSessionStr);
        if (cachedProfile) {
          if (cachedProfile.email?.toLowerCase() === ADMIN_BOOTSTRAP_EMAIL) {
            cachedProfile.role = 'SUPER_ADMIN';
          }
          setUserProfile(cachedProfile);
          if (cachedProfile.company_id) {
            getCompanyById(cachedProfile.company_id).then((c) => {
              if (c) setCurrentCompany(c);
            });
          }
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

  const switchCompanyView = (companyId: string | null) => {
    if (companyId) {
      localStorage.setItem(VIEW_COMPANY_KEY, companyId);
      setActiveViewingCompanyId(companyId);
      getCompanyById(companyId).then((c) => {
        if (c) setCurrentCompany(c);
      });
    } else {
      localStorage.removeItem(VIEW_COMPANY_KEY);
      setActiveViewingCompanyId(null);
      if (userProfile?.company_id) {
        getCompanyById(userProfile.company_id).then((c) => {
          if (c) setCurrentCompany(c);
        });
      }
    }
  };

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
                company_id: predefined.company_id,
                is_active: true,
              });
              setCurrentUser(userCredential.user);
              setUserProfile(profile);
              localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(profile));
              return;
            }
          } catch (createErr: any) {
            console.warn('Firebase email auth creation fallback:', createErr);
          }
        }
      }

      // If email/password provider is disabled in Firebase console (auth/operation-not-allowed)
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
          const isSuper = emailLower === ADMIN_BOOTSTRAP_EMAIL || predefined?.role === 'SUPER_ADMIN';
          const userRole: UserRole = isSuper
            ? 'SUPER_ADMIN'
            : predefined
            ? predefined.role
            : 'SALESMAN';
          const userCompany = isSuper
            ? undefined
            : predefined?.company_id || DEFAULT_COMPANY_ID;
          const userId = fbUser?.uid || `uid-${userName.toLowerCase()}`;

          // Create / update profile in Firestore
          let profile: UserProfile | null = null;
          try {
            profile = await createOrUpdateUserProfile(userId, {
              full_name: userName,
              email: cleanEmail,
              role: userRole,
              company_id: userCompany,
              is_active: true,
            });
          } catch (e) {
            console.warn('Could not write to firestore directly:', e);
            profile = {
              id: userId,
              full_name: userName,
              email: cleanEmail,
              role: userRole,
              company_id: userCompany,
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

          if (userCompany) {
            getCompanyById(userCompany).then((c) => {
              if (c) setCurrentCompany(c);
            });
          }
          return;
        } catch (anonErr: any) {
          console.error('Anonymous auth fallback error:', anonErr);
          const userName = predefined ? predefined.name : cleanEmail.split('@')[0];
          const isSuper = emailLower === ADMIN_BOOTSTRAP_EMAIL || predefined?.role === 'SUPER_ADMIN';
          const userRole: UserRole = isSuper
            ? 'SUPER_ADMIN'
            : predefined
            ? predefined.role
            : 'SALESMAN';
          const userCompany = isSuper ? undefined : predefined?.company_id || DEFAULT_COMPANY_ID;
          const userId = `uid-${userName.toLowerCase()}`;

          const localProfile: UserProfile = {
            id: userId,
            full_name: userName,
            email: cleanEmail,
            role: userRole,
            company_id: userCompany,
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
    const isBootstrapSuperAdmin = cleanEmail.toLowerCase() === ADMIN_BOOTSTRAP_EMAIL.toLowerCase();
    const finalRole: UserRole = isBootstrapSuperAdmin ? 'SUPER_ADMIN' : role;

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
          company_id: isBootstrapSuperAdmin ? undefined : DEFAULT_COMPANY_ID,
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
          company_id: isBootstrapSuperAdmin ? undefined : DEFAULT_COMPANY_ID,
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
    localStorage.removeItem(VIEW_COMPANY_KEY);
    setCurrentUser(null);
    setUserProfile(null);
  };

  const refreshProfile = async () => {
    if (currentUser) {
      await fetchProfile(currentUser);
    }
  };

  const isSuperAdmin =
    userProfile?.role === 'SUPER_ADMIN' ||
    currentUser?.email?.toLowerCase() === ADMIN_BOOTSTRAP_EMAIL;
  const isCompanyAdmin = userProfile?.role?.toUpperCase() === 'ADMIN' && !isSuperAdmin;
  const isAdmin = isSuperAdmin || userProfile?.role?.toUpperCase() === 'ADMIN';
  const isSalesman = !isAdmin;
  const isActive = userProfile?.is_active !== false;

  const companyId =
    activeViewingCompanyId || userProfile?.company_id || DEFAULT_COMPANY_ID;
  const isCompanyActive = isSuperAdmin || (currentCompany ? currentCompany.status === 'ACTIVE' : true);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        isSuperAdmin,
        isAdmin,
        isCompanyAdmin,
        isSalesman,
        isActive,
        currentCompany,
        companyId,
        isCompanyActive,
        switchCompanyView,
        activeViewingCompanyId,
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




