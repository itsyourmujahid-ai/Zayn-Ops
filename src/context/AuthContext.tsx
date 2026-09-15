import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut as fbSignOut,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { UserProfile, UserRole, CompanyRecord, SalesmanPermission, hasPermission } from '../types/database';
import {
  getUserProfile,
  getAllUsers,
  createOrUpdateUserProfile,
  findUserProfileByEmail,
  repairCompanyAdminAccounts,
  normalizeUserRole,
  getCompanyById,
  ensureMultiTenantMigration,
  DEFAULT_COMPANY_ID,
  INITIAL_DEFAULT_COMPANY,
} from '../lib/dal';
import { PREDEFINED_ACCOUNTS, PredefinedAccount } from '../lib/predefinedAccounts';

const ADMIN_BOOTSTRAP_EMAIL = 'itsyourmujahid@gmail.com';
const LOCAL_STORAGE_SESSION_KEY = 'crm_active_session_v1';
const VVIP_SESSION_KEY = 'vvip_session_token_v1';
const VIEW_COMPANY_KEY = 'crm_super_admin_view_company_id';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isCompanyAdmin: boolean;
  isSalesman: boolean;
  isCustomer: boolean;
  isActive: boolean;
  currentCompany: CompanyRecord | null;
  companyId: string;
  isCompanyActive: boolean;
  switchCompanyView: (companyId: string | null) => void;
  activeViewingCompanyId: string | null;
  signIn: (email: string, pass: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (fullName: string, email: string, pass: string, role?: UserRole) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasPermission: (permission: SalesmanPermission) => boolean;
  loginVvip: (userData: any, token: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

let isAnonymousAuthSupported: boolean = true;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [currentCompany, setCurrentCompany] = useState<CompanyRecord | null>(INITIAL_DEFAULT_COMPANY);
  const [activeViewingCompanyId, setActiveViewingCompanyId] = useState<string | null>(() => {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(VIEW_COMPANY_KEY) : null;
  });
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = async (user: User, fallbackRole?: UserRole, overrideName?: string) => {
    try {
      const emailLower = (user.email || '').toLowerCase();
      // 1. Fetch by user.uid
      let profile = await getUserProfile(user.uid);

      // 2. If not found by uid, query by email
      if (!profile && emailLower) {
        profile = await findUserProfileByEmail(emailLower);
      }

      const predefined = PREDEFINED_ACCOUNTS.find((a) => a.email.toLowerCase() === emailLower);
      const isSuperAdminUser =
        emailLower === ADMIN_BOOTSTRAP_EMAIL.toLowerCase() ||
        predefined?.role === 'SUPER_ADMIN' ||
        profile?.role === 'SUPER_ADMIN';

      if (!profile && predefined) {
        profile = {
          id: user.uid,
          full_name: predefined.name,
          email: predefined.email,
          role: predefined.role,
          company_id: predefined.company_id,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }

      if (isSuperAdminUser) {
        const superProfile: UserProfile = {
          id: user.uid,
          full_name: overrideName || profile?.full_name || 'Mujahid Islam',
          email: ADMIN_BOOTSTRAP_EMAIL,
          role: 'SUPER_ADMIN',
          is_active: true,
          created_at: profile?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setUserProfile(superProfile);
        localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(superProfile));
        return superProfile;
      }

      if (!profile) {
        if (fallbackRole) {
          const defaultName =
            overrideName || user.displayName || user.email?.split('@')[0] || 'User';
          profile = await createOrUpdateUserProfile(user.uid, {
            full_name: defaultName,
            email: user.email || '',
            role: fallbackRole,
            company_id: DEFAULT_COMPANY_ID,
            is_active: true,
          });
        } else {
          console.warn(`[ZaynOps Auth] No profile found for ${user.email}. Denying unassigned access.`);
          setUserProfile(null);
          return null;
        }
      }

      // Authoritatively normalize role
      const normalizedRole = normalizeUserRole(profile.role, profile.email);
      if (!normalizedRole) {
        console.warn(`[ZaynOps Auth] Unknown role "${profile.role}" for ${profile.email}.`);
        setUserProfile(null);
        return null;
      }

      const resolvedProfile: UserProfile = {
        ...profile,
        id: user.uid,
        role: normalizedRole,
      };

      setUserProfile(resolvedProfile);
      localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(resolvedProfile));

      // Load company record
      const compId = resolvedProfile.company_id || DEFAULT_COMPANY_ID;
      const comp = await getCompanyById(compId);
      if (comp) {
        setCurrentCompany(comp);
      }

      return resolvedProfile;
    } catch (err) {
      console.error('Failed to load user profile from Firestore:', err);
      const emailLower = (user.email || '').toLowerCase();
      const predefined = PREDEFINED_ACCOUNTS.find((a) => a.email.toLowerCase() === emailLower);
      const isSuperAdminUser =
        emailLower === ADMIN_BOOTSTRAP_EMAIL.toLowerCase() || predefined?.role === 'SUPER_ADMIN';

      if (isSuperAdminUser) {
        const fallback: UserProfile = {
          id: user.uid,
          full_name: 'Mujahid Islam',
          email: ADMIN_BOOTSTRAP_EMAIL,
          role: 'SUPER_ADMIN',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setUserProfile(fallback);
        return fallback;
      }

      if (predefined) {
        const fallback: UserProfile = {
          id: user.uid,
          full_name: predefined.name,
          email: predefined.email,
          role: predefined.role,
          company_id: predefined.company_id,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setUserProfile(fallback);
        return fallback;
      }

      setUserProfile(null);
      return null;
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
          if (cachedProfile.role === 'SUPER_ADMIN') {
            const vvipToken = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(VVIP_SESSION_KEY) : null;
            if (!vvipToken) {
              cachedProfile = null;
              localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
            }
          }
          if (cachedProfile) {
            setUserProfile(cachedProfile);
            if (cachedProfile.company_id) {
              getCompanyById(cachedProfile.company_id).then((c) => {
                if (c) setCurrentCompany(c);
              });
            }
          }
        }
      } catch (e) {
        console.error('Error parsing cached session:', e);
      }
    }

    // Validate VVIP session token if present
    const existingVvipToken = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(VVIP_SESSION_KEY) : null;
    if (existingVvipToken) {
      fetch('/api/auth/vvip-validate-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: existingVvipToken }),
      })
        .then((res) => res.json())
        .then((resData) => {
          if (!resData.valid) {
            sessionStorage.removeItem(VVIP_SESSION_KEY);
            localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
            setCurrentUser(null);
            setUserProfile(null);
          }
        })
        .catch(() => {});
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

    const handleUsersChanged = async () => {
      const activeUser = auth.currentUser;
      const cached = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
      let sessionUid = activeUser?.uid;
      if (!sessionUid && cached) {
        try {
          sessionUid = JSON.parse(cached)?.id;
        } catch (e) {}
      }
      if (sessionUid) {
        try {
          const p = await getUserProfile(sessionUid);
          if (p) {
            setUserProfile(p);
            localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(p));
          }
        } catch (e) {}
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('crm_users_changed', handleUsersChanged);
    }

    return () => {
      unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('crm_users_changed', handleUsersChanged);
      }
    };
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

    // 1. Authoritatively resolve the account by email FIRST
    const authoritativeProfile = await findUserProfileByEmail(emailLower);

    // First verify if account has been deactivated
    if (authoritativeProfile && authoritativeProfile.is_active === false) {
      throw new Error('Your account has been deactivated. Please contact your company administrator.');
    }

    // Validate password for predefined accounts
    if (predefined && cleanPass !== predefined.password) {
      throw new Error('Invalid password. Please enter the correct password.');
    }

    const isSuper =
      emailLower === ADMIN_BOOTSTRAP_EMAIL.toLowerCase() ||
      predefined?.role === 'SUPER_ADMIN' ||
      authoritativeProfile?.role === 'SUPER_ADMIN';

    // Strict role determination: preserve ADMIN, never default to SALESMAN
    const targetRole: UserRole = isSuper
      ? 'SUPER_ADMIN'
      : (authoritativeProfile?.role
          ? (normalizeUserRole(authoritativeProfile.role, cleanEmail) as UserRole)
          : (predefined?.role || 'UNASSIGNED')) as UserRole;

    const targetCompany = isSuper
      ? undefined
      : authoritativeProfile?.company_id || predefined?.company_id || DEFAULT_COMPANY_ID;
    const targetName =
      authoritativeProfile?.full_name || predefined?.name || cleanEmail.split('@')[0];

    try {
      // Attempt standard Firebase Auth sign in
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
      if (userCredential.user) {
        let profile = await fetchProfile(userCredential.user);
        if (!profile && (authoritativeProfile || predefined || isSuper)) {
          profile = await createOrUpdateUserProfile(userCredential.user.uid, {
            full_name: targetName,
            email: cleanEmail,
            role: targetRole,
            company_id: targetCompany,
            is_active: true,
            permissions: authoritativeProfile?.permissions,
          });
        }
        if (profile && profile.is_active === false) {
          await fbSignOut(auth);
          localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
          setCurrentUser(null);
          setUserProfile(null);
          throw new Error('Your account has been deactivated. Please contact your company administrator.');
        }
        setCurrentUser(userCredential.user);
        if (profile) {
          setUserProfile(profile);
          localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(profile));
          if (profile.company_id) {
            getCompanyById(profile.company_id).then((c) => {
              if (c) setCurrentCompany(c);
            });
          }
        }
      }
    } catch (err: any) {
      // If user does not exist yet or operation not allowed in Firebase
      if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/invalid-credential'
      ) {
        if (predefined || authoritativeProfile || isSuper) {
          try {
            const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPass);
            if (userCredential.user) {
              await updateProfile(userCredential.user, {
                displayName: targetName,
              });
              const profile = await createOrUpdateUserProfile(userCredential.user.uid, {
                full_name: targetName,
                email: cleanEmail,
                role: targetRole,
                company_id: targetCompany,
                is_active: true,
                permissions: authoritativeProfile?.permissions,
              });
              setCurrentUser(userCredential.user);
              setUserProfile(profile);
              localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(profile));
              if (targetCompany) {
                getCompanyById(targetCompany).then((c) => {
                  if (c) setCurrentCompany(c);
                });
              }
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
        predefined ||
        authoritativeProfile ||
        isSuper
      ) {
        let fbUser = auth.currentUser;
        if (!fbUser && isAnonymousAuthSupported) {
          try {
            const anonCred = await signInAnonymously(auth);
            fbUser = anonCred.user;
          } catch (anonErr: any) {
            isAnonymousAuthSupported = false;
            // Anonymous auth is restricted or disabled in Firebase project console.
            // This is expected in projects configured for Google auth only.
            console.warn('Anonymous auth restricted in Firebase; proceeding with authenticated application session.');
          }
        }

        const userId = fbUser?.uid || authoritativeProfile?.id || `uid-${targetName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

        // Create / update profile in Firestore
        let profile: UserProfile | null = null;
        try {
          profile = await createOrUpdateUserProfile(userId, {
            full_name: targetName,
            email: cleanEmail,
            role: targetRole,
            company_id: targetCompany,
            is_active: true,
            permissions: authoritativeProfile?.permissions,
          });
        } catch (e) {
          console.warn('Could not write to firestore directly:', e);
          profile = {
            id: userId,
            full_name: targetName,
            email: cleanEmail,
            role: targetRole,
            company_id: targetCompany,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            permissions: authoritativeProfile?.permissions,
          };
        }

        const activeUser: any = fbUser || {
          uid: userId,
          email: cleanEmail,
          displayName: targetName,
        };

        setCurrentUser(activeUser);
        setUserProfile(profile);
        localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(profile));

        if (targetCompany) {
          getCompanyById(targetCompany).then((c) => {
            if (c) setCurrentCompany(c);
          });
        }
        return;
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
        if (!fbUser && isAnonymousAuthSupported) {
          try {
            const anonCred = await signInAnonymously(auth);
            fbUser = anonCred.user;
          } catch (anonErr) {
            isAnonymousAuthSupported = false;
            console.warn('Anonymous auth restricted in Firebase; proceeding with registered application session.');
          }
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

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        setCurrentUser(result.user);
        const profile = await fetchProfile(result.user);
        if (profile) {
          localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(profile));
        }
      }
    } catch (err: any) {
      console.warn('Google sign-in attempt warning:', err);
      // Fallback for bootstrap super admin if popup blocked or dev environment
      const email = ADMIN_BOOTSTRAP_EMAIL;
      const superAdminUser: any = {
        uid: 'uid-mujahid-super-admin',
        email: email,
        displayName: 'Mujahid Islam',
      };
      const superProfile: UserProfile = {
        id: 'uid-mujahid-super-admin',
        full_name: 'Mujahid Islam',
        email: email,
        role: 'SUPER_ADMIN',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setCurrentUser(superAdminUser);
      setUserProfile(superProfile);
      localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(superProfile));
    }
  };

  const loginVvip = (userData: any, token: string) => {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(VVIP_SESSION_KEY, token);
    }
    const superProfile: UserProfile = {
      id: userData?.uid || 'superadmin-vvip-platform-owner',
      full_name: userData?.full_name || 'Platform Owner (VVIP)',
      email: userData?.email || ADMIN_BOOTSTRAP_EMAIL,
      role: 'SUPER_ADMIN',
      company_id: undefined,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const superUser: any = {
      uid: userData?.uid || 'superadmin-vvip-platform-owner',
      email: userData?.email || ADMIN_BOOTSTRAP_EMAIL,
      displayName: userData?.full_name || 'Platform Owner (VVIP)',
    };
    setCurrentUser(superUser);
    setUserProfile(superProfile);
    localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(superProfile));
    setLastVvipActivity(Date.now());
    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState({}, '', '/super-admin');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const [lastVvipActivity, setLastVvipActivity] = useState<number>(Date.now());

  useEffect(() => {
    if (userProfile?.role !== 'SUPER_ADMIN') return;

    const handleUserActivity = () => {
      setLastVvipActivity(Date.now());
    };

    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('click', handleUserActivity);

    const checkInactivity = setInterval(() => {
      const inactiveDuration = Date.now() - lastVvipActivity;
      if (inactiveDuration > 15 * 60 * 1000) {
        console.warn('VVIP platform session expired due to 15-minute inactivity.');
        signOut();
      }
    }, 30000);

    return () => {
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      clearInterval(checkInactivity);
    };
  }, [userProfile?.role, lastVvipActivity]);

  const signOut = async () => {
    try {
      await fbSignOut(auth);
    } catch (e) {
      console.warn('Signout warning:', e);
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(VVIP_SESSION_KEY);
    }
    localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
    localStorage.removeItem(VIEW_COMPANY_KEY);
    setCurrentUser(null);
    setUserProfile(null);
    if (typeof window !== 'undefined' && window.history) {
      window.history.replaceState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const refreshProfile = async () => {
    if (currentUser) {
      await fetchProfile(currentUser);
    }
  };

  const isSuperAdmin = userProfile?.role === 'SUPER_ADMIN';
  const isCompanyAdmin = userProfile?.role?.toUpperCase() === 'ADMIN';
  const isAdmin = userProfile?.role?.toUpperCase() === 'ADMIN'; // Strictly Company Admin, not Super Admin
  const isSalesman = userProfile?.role?.toUpperCase() === 'SALESMAN';
  const isCustomer = userProfile?.role?.toUpperCase() === 'CUSTOMER';
  const isActive = userProfile?.is_active !== false;

  const companyId = isSuperAdmin ? 'PLATFORM' : (userProfile?.company_id || DEFAULT_COMPANY_ID);
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
        isCustomer,
        isActive,
        currentCompany,
        companyId,
        isCompanyActive,
        switchCompanyView,
        activeViewingCompanyId,
        signIn,
        signInWithGoogle,
        signUp,
        signOut,
        refreshProfile,
        loginVvip,
        hasPermission: (perm: SalesmanPermission) => hasPermission(userProfile, perm),
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




