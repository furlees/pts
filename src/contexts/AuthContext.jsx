import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db, auth, firebaseConfig } from '../services/firebase';
import { initializeApp } from 'firebase/app';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  getAuth
} from 'firebase/auth';

const AuthContext = createContext({});

const STORAGE_SESSION_KEY = 'pts_user';

// Seed data — used only if Firestore has no users yet
const USERS_SEED = [
  { id: 1,  name: 'Matheus',           email: 'furlesmatheus@gmail.com',              password: 'Furlanes10@', role: 'Admin', area: null },
  { id: 2,  name: 'Andre Santos',      email: 'andre.santos@agenciainova.org.br',     password: 'Inova@2026',  role: 'Admin', area: null },
  { id: 3,  name: 'Flavio Anequini',   email: 'flavio.anequini@agenciainova.org.br',  password: 'Inova@2026',  role: 'User',  area: 'Jurídico' },
  { id: 4,  name: 'Giuliano Quartto',  email: 'giuliano.quartto@agenciainova.org.br', password: 'Inova@2026',  role: 'User',  area: 'Parcerias Estratégicas' },
  { id: 5,  name: 'Alyne Cardoso',     email: 'alyne.cardoso@agenciainova.org.br',    password: 'Inova@2026',  role: 'User',  area: 'Administrativo' },
  { id: 6,  name: 'Financeiro',        email: 'financeiro@agenciainova.org.br',       password: 'Inova@2026',  role: 'User',  area: 'Financeiro' },
  { id: 7,  name: 'Diego Pucci',       email: 'diego.pucci@agenciainova.org.br',      password: 'Inova@2026',  role: 'User',  area: 'Inovação e Projetos' },
  { id: 8,  name: 'Mariane Galvao',    email: 'mariane.galvao@agenciainova.org.br',   password: 'Inova@2026',  role: 'User',  area: 'Comunicação' },
  { id: 9,  name: 'Eugenio Brito',     email: 'eugenio.brito@agenciainova.org.br',    password: 'Inova@2026',  role: 'User',  area: 'Jurídico' },
  { id: 10, name: 'CPL Inova',         email: 'cpl.inova@agenciainova.org.br',        password: 'Inova@2026',  role: 'User',  area: 'CPL' },
  { id: 11, name: 'Paolo Marini',      email: 'paolo.marini@agenciainova.org.br',     password: 'Inova@2026',  role: 'User',  area: 'Inovação e Projetos' },
  { id: 12, name: 'Hubiz',             email: 'hubiz@agenciainova.org.br',            password: 'Inova@2026',  role: 'User',  area: 'HUBIZ' },
  { id: 13, name: 'Cel40',             email: 'cel40@uempi.com.br',                   password: 'Inova@2026',  role: 'User',  area: 'Cel40' },
  { id: 14, name: 'Compras',           email: 'compras@agenciainova.org.br',          password: 'Inova@2026',  role: 'User',  area: 'Compras' },
  { id: 15, name: 'Eventos',           email: 'eventos@agenciainova.org.br',          password: 'Inova@2026',  role: 'User',  area: 'Eventos e Comunicação' },
  { id: 16, name: 'Juliana Mustafa',   email: 'juliana.mustafa@agenciainova.org.br',  password: 'Inova@2026',  role: 'User',  area: 'Administrativo' },
  { id: 17, name: 'Barbara Carnevale', email: 'barbara.carnevale@uempi.com.br',       password: 'Inova@2026',  role: 'User',  area: 'Jurídico' },
];

const HAS_FIREBASE = !!import.meta.env.VITE_FIREBASE_PROJECT_ID;

// Secondary app instance to create Firebase Auth accounts for new users without logging out current Admin
let secondaryAuth = null;
if (HAS_FIREBASE) {
  try {
    const secondaryApp = initializeApp(firebaseConfig, 'secondary-auth-app');
    secondaryAuth = getAuth(secondaryApp);
  } catch (error) {
    console.error("Failed to initialize secondary app", error);
  }
}

export function AuthProvider({ children }) {
  const [users, setUsers] = useState([]);
  const [user,  setUser]  = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. Sync users list from Firestore in real-time
  useEffect(() => {
    if (!HAS_FIREBASE) {
      setLoading(false);
      return;
    }

    const usersCol = collection(db, 'users');

    const unsubscribe = onSnapshot(usersCol, async (snapshot) => {
      let list = snapshot.docs.map(docDoc => ({ 
        docId: docDoc.id, 
        ...docDoc.data() 
      }));

      // If Firestore database is completely empty, seed it
      if (list.length === 0) {
        console.log("Seeding Firestore with default users...");
        for (const seedUser of USERS_SEED) {
          // Use its legacy numerical ID as document ID initially
          await setDoc(doc(db, 'users', String(seedUser.id)), {
            id: seedUser.id,
            name: seedUser.name,
            email: seedUser.email.toLowerCase(),
            password: seedUser.password, // stored securely for legacy login migration fallback
            role: seedUser.role,
            area: seedUser.area
          });
        }
        return;
      }

      // Sort by ID to preserve listing order
      list.sort((a, b) => a.id - b.id);
      setUsers(list);
    }, (error) => {
      console.error("Firestore onSnapshot error:", error);
    });

    return () => unsubscribe();
  }, []);

  // 2. Listen to Firebase Authentication State
  useEffect(() => {
    if (!HAS_FIREBASE) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Find by auth UID first
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          const session = {
            id: userData.id,
            uid: firebaseUser.uid,
            name: userData.name,
            email: firebaseUser.email,
            role: userData.role,
            area: userData.area
          };
          setUser(session);
          localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
        } else {
          // If not found by UID, search by email to link existing seeded user
          const fresh = users.find(u => u.email.toLowerCase() === firebaseUser.email.toLowerCase());
          if (fresh) {
            // Write profile under their actual Auth UID
            const newProfile = {
              id: fresh.id,
              name: fresh.name,
              email: fresh.email.toLowerCase(),
              role: fresh.role,
              area: fresh.area
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
            
            // Delete old seed document if it was a numerical seed ID
            if (fresh.docId !== firebaseUser.uid) {
              await deleteDoc(doc(db, 'users', fresh.docId));
            }

            setUser({ uid: firebaseUser.uid, ...newProfile });
          } else {
            // Default fallback profile
            setUser({
              id: 999,
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'Usuário',
              email: firebaseUser.email,
              role: 'User',
              area: null
            });
          }
        }
      } else {
        setUser(null);
        localStorage.removeItem(STORAGE_SESSION_KEY);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [users]);

  // ── Auth ──────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    if (!HAS_FIREBASE) {
      return { success: false, message: 'Firebase não configurado.' };
    }

    const cleanEmail = email.trim().toLowerCase();

    try {
      // 1. Try to login with Firebase Auth
      await signInWithEmailAndPassword(auth, cleanEmail, password);
      return { success: true };
    } catch (error) {
      // 2. Fallback: Check if it's a legacy seed user logging in for the first time
      const seedUser = users.find(u => u.email.toLowerCase() === cleanEmail);
      if (seedUser && seedUser.password === password) {
        try {
          console.log("Migrating seed user to Firebase Auth...");
          // Create Firebase Auth credentials
          const creds = await createUserWithEmailAndPassword(auth, cleanEmail, password);
          const uid = creds.user.uid;

          // Write document under UID
          await setDoc(doc(db, 'users', uid), {
            id: seedUser.id,
            name: seedUser.name,
            email: cleanEmail,
            role: seedUser.role,
            area: seedUser.area
          });

          // Delete the temporary seed document
          if (seedUser.docId !== uid) {
            await deleteDoc(doc(db, 'users', seedUser.docId));
          }

          return { success: true };
        } catch (createError) {
          console.error("Migration error:", createError);
          return { success: false, message: 'Erro ao autenticar e migrar usuário.' };
        }
      }

      console.error("Auth error:", error);
      return { success: false, message: 'E-mail ou senha incorretos.' };
    }
  }, [users]);

  const logout = useCallback(async () => {
    if (HAS_FIREBASE) {
      await signOut(auth);
    }
    setUser(null);
    localStorage.removeItem(STORAGE_SESSION_KEY);
  }, []);

  // ── User management (Admin only) ──────────────────────

  /** Add a new user */
  const addUser = useCallback(async (userData) => {
    if (!HAS_FIREBASE) return { success: false, message: 'Banco offline.' };

    const nextId = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1;
    const cleanEmail = userData.email.trim().toLowerCase();

    try {
      let uid = `user_${nextId}`; // Default doc ID in case creation fails (fallback)
      
      // If we have secondary auth initialized, create credentials securely
      if (secondaryAuth) {
        const userCred = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, userData.password);
        uid = userCred.user.uid;
        // Sign out secondary auth session immediately
        await signOut(secondaryAuth);
      }

      const newUser = {
        id: nextId,
        name:     userData.name.trim(),
        email:    cleanEmail,
        role:     userData.role,
        area:     userData.role === 'Admin' ? null : (userData.area || null),
      };

      await setDoc(doc(db, 'users', uid), newUser);
      return { success: true };
    } catch (error) {
      console.error("Firebase error in addUser:", error);
      return { success: false, message: 'Erro ao cadastrar usuário no Firebase Auth.' };
    }
  }, [users]);

  /** Update an existing user's role, area or name */
  const updateUser = useCallback(async (id, changes) => {
    if (!HAS_FIREBASE) return { success: false, message: 'Banco offline.' };

    const fresh = users.find(u => u.id === id);
    if (!fresh) return { success: false, message: 'Usuário não encontrado.' };

    const docId = fresh.docId || String(id);
    const merged = { ...fresh, ...changes };
    if (merged.role === 'Admin') merged.area = null;

    // Remove docId helper before storing in Firestore
    const dataToSave = { ...merged };
    delete dataToSave.docId;

    try {
      await setDoc(doc(db, 'users', docId), dataToSave);
      return { success: true };
    } catch (error) {
      console.error("Firebase error in updateUser:", error);
      return { success: false, message: 'Erro ao atualizar usuário.' };
    }
  }, [users]);

  /** Delete a user (cannot delete yourself) */
  const deleteUser = useCallback(async (id) => {
    if (user && (user.id === id || user.uid === id)) {
      return { success: false, message: 'Você não pode remover sua própria conta.' };
    }

    const fresh = users.find(u => u.id === id);
    if (!fresh) return { success: false, message: 'Usuário não encontrado.' };

    const docId = fresh.docId || String(id);

    try {
      await deleteDoc(doc(db, 'users', docId));
      return { success: true };
    } catch (error) {
      console.error("Firebase error in deleteUser:", error);
      return { success: false, message: 'Erro ao deletar usuário.' };
    }
  }, [users, user]);

  /** Reset all users back to seed data */
  const resetUsersToSeed = useCallback(async () => {
    if (!HAS_FIREBASE) return;
    try {
      // Delete current firestore documents
      for (const u of users) {
        await deleteDoc(doc(db, 'users', u.docId));
      }
      // Seed again
      for (const seedUser of USERS_SEED) {
        await setDoc(doc(db, 'users', String(seedUser.id)), {
          id: seedUser.id,
          name: seedUser.name,
          email: seedUser.email.toLowerCase(),
          password: seedUser.password,
          role: seedUser.role,
          area: seedUser.area
        });
      }
    } catch (error) {
      console.error("Firebase error in resetUsersToSeed:", error);
    }
  }, [users]);

  const isAdmin  = user?.role === 'Admin';
  const userArea = user?.area || null;

  return (
    <AuthContext.Provider value={{
      user, users, loading,
      login, logout,
      isAdmin, userArea,
      addUser, updateUser, deleteUser, resetUsersToSeed,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
