import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db } from '../services/firebase';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';

const AuthContext = createContext({});

const STORAGE_USERS_KEY = 'pts_users_db';
const STORAGE_SESSION_KEY = 'pts_user';

// Seed data — used only if localStorage/Firestore has no users yet
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

// Local fallback helpers
function loadLocalUsers() {
  try {
    const stored = localStorage.getItem(STORAGE_USERS_KEY);
    if (stored) return JSON.parse(stored);
  } catch (_) {}
  localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(USERS_SEED));
  return USERS_SEED;
}

function saveLocalUsers(usersList) {
  localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(usersList));
}

export function AuthProvider({ children }) {
  const [users, setUsers] = useState([]);
  const [user,  setUser]  = useState(null);
  const [loading, setLoading] = useState(true);

  // Sync users list real-time
  useEffect(() => {
    if (!HAS_FIREBASE) {
      console.warn("Firebase config not found. Running AuthProvider with localStorage fallback.");
      setUsers(loadLocalUsers());
      setLoading(false);
      return;
    }

    const usersCol = collection(db, 'users');

    // Real-time listener
    const unsubscribe = onSnapshot(usersCol, async (snapshot) => {
      let list = snapshot.docs.map(doc => ({ id: Number(doc.id), ...doc.data() }));
      
      // If Firestore database is completely empty, seed it
      if (list.length === 0) {
        console.log("Seeding Firestore with default users...");
        for (const seedUser of USERS_SEED) {
          await setDoc(doc(db, 'users', String(seedUser.id)), seedUser);
        }
        // The onSnapshot will trigger again after these setDocs, so we just return
        return;
      }

      // Sort by ID to preserve order
      list.sort((a, b) => a.id - b.id);
      setUsers(list);
      setLoading(false);
    }, (error) => {
      console.error("Firestore onSnapshot error, falling back to localStorage:", error);
      setUsers(loadLocalUsers());
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Sync session / current user details on mount and whenever users database changes
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_SESSION_KEY);
    if (stored && users.length > 0) {
      const session = JSON.parse(stored);
      const fresh = users.find(u => u.id === session.id);
      if (fresh) {
        const refreshed = { id: fresh.id, name: fresh.name, email: fresh.email, role: fresh.role, area: fresh.area };
        setUser(refreshed);
        localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(refreshed));
      } else {
        setUser(session);
      }
    }
  }, [users]);

  // ── Auth ──────────────────────────────────────────────
  const login = useCallback((email, password) => {
    const found = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (found) {
      const session = { id: found.id, name: found.name, email: found.email, role: found.role, area: found.area };
      setUser(session);
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
      return { success: true };
    }
    return { success: false, message: 'E-mail ou senha incorretos.' };
  }, [users]);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(STORAGE_SESSION_KEY);
  }, []);

  // ── User management (Admin only) ──────────────────────

  /** Add a new user */
  const addUser = useCallback(async (userData) => {
    const nextId = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1;
    const newUser = {
      id: nextId,
      name:     userData.name.trim(),
      email:    userData.email.trim().toLowerCase(),
      password: userData.password,
      role:     userData.role,
      area:     userData.role === 'Admin' ? null : (userData.area || null),
    };

    if (HAS_FIREBASE) {
      try {
        await setDoc(doc(db, 'users', String(nextId)), newUser);
      } catch (error) {
        console.error("Firebase error in addUser:", error);
        return { success: false, message: 'Erro ao salvar no banco de dados.' };
      }
    } else {
      const updated = [...users, newUser];
      setUsers(updated);
      saveLocalUsers(updated);
    }
    return { success: true };
  }, [users]);

  /** Update an existing user's role, area or name */
  const updateUser = useCallback(async (id, changes) => {
    const fresh = users.find(u => u.id === id);
    if (!fresh) return { success: false, message: 'Usuário não encontrado.' };

    const merged = { ...fresh, ...changes };
    if (merged.role === 'Admin') merged.area = null;

    if (HAS_FIREBASE) {
      try {
        await setDoc(doc(db, 'users', String(id)), merged);
      } catch (error) {
        console.error("Firebase error in updateUser:", error);
        return { success: false, message: 'Erro ao atualizar no banco de dados.' };
      }
    } else {
      const updated = users.map(u => u.id === id ? merged : u);
      setUsers(updated);
      saveLocalUsers(updated);
    }

    return { success: true };
  }, [users]);

  /** Delete a user (cannot delete yourself) */
  const deleteUser = useCallback(async (id) => {
    if (user && user.id === id) return { success: false, message: 'Você não pode remover sua própria conta.' };

    if (HAS_FIREBASE) {
      try {
        await deleteDoc(doc(db, 'users', String(id)));
      } catch (error) {
        console.error("Firebase error in deleteUser:", error);
        return { success: false, message: 'Erro ao deletar no banco de dados.' };
      }
    } else {
      const updated = users.filter(u => u.id !== id);
      setUsers(updated);
      saveLocalUsers(updated);
    }
    return { success: true };
  }, [users, user]);

  /** Reset all users back to seed data */
  const resetUsersToSeed = useCallback(async () => {
    if (HAS_FIREBASE) {
      try {
        // Delete all current docs
        for (const u of users) {
          await deleteDoc(doc(db, 'users', String(u.id)));
        }
        // Seed again
        for (const seedUser of USERS_SEED) {
          await setDoc(doc(db, 'users', String(seedUser.id)), seedUser);
        }
      } catch (error) {
        console.error("Firebase error in resetUsersToSeed:", error);
      }
    } else {
      setUsers(USERS_SEED);
      saveLocalUsers(USERS_SEED);
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
