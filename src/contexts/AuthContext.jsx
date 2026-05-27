import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext({});

const STORAGE_USERS_KEY = 'pts_users_db';
const STORAGE_SESSION_KEY = 'pts_user';

// Seed data — used only if localStorage has no users yet
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

function loadUsers() {
  try {
    const stored = localStorage.getItem(STORAGE_USERS_KEY);
    if (stored) return JSON.parse(stored);
  } catch (_) {}
  // First run — persist seed
  localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(USERS_SEED));
  return USERS_SEED;
}

function saveUsers(users) {
  localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
}

export function AuthProvider({ children }) {
  const [users, setUsers] = useState(() => loadUsers());
  const [user,  setUser]  = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_SESSION_KEY);
    if (stored) {
      const session = JSON.parse(stored);
      // Refresh session from live users list (in case permissions changed)
      const fresh = loadUsers().find(u => u.id === session.id);
      if (fresh) {
        const refreshed = { id: fresh.id, name: fresh.name, email: fresh.email, role: fresh.role, area: fresh.area };
        setUser(refreshed);
        localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(refreshed));
      } else {
        setUser(session);
      }
    }
    setLoading(false);
  }, []);

  // ── Auth ──────────────────────────────────────────────
  const login = (email, password) => {
    const db = loadUsers();
    const found = db.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (found) {
      const session = { id: found.id, name: found.name, email: found.email, role: found.role, area: found.area };
      setUser(session);
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
      return { success: true };
    }
    return { success: false, message: 'E-mail ou senha incorretos.' };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_SESSION_KEY);
  };

  // ── User management (Admin only) ──────────────────────
  const persistUsers = useCallback((updated) => {
    setUsers(updated);
    saveUsers(updated);
  }, []);

  /** Add a new user */
  const addUser = useCallback((userData) => {
    const db = loadUsers();
    const nextId = db.length > 0 ? Math.max(...db.map(u => u.id)) + 1 : 1;
    const newUser = {
      id: nextId,
      name:     userData.name.trim(),
      email:    userData.email.trim().toLowerCase(),
      password: userData.password,
      role:     userData.role,
      area:     userData.role === 'Admin' ? null : (userData.area || null),
    };
    const updated = [...db, newUser];
    persistUsers(updated);
    return { success: true };
  }, [persistUsers]);

  /** Update an existing user's role, area or name */
  const updateUser = useCallback((id, changes) => {
    const db = loadUsers();
    const updated = db.map(u => {
      if (u.id !== id) return u;
      const merged = { ...u, ...changes };
      if (merged.role === 'Admin') merged.area = null;
      return merged;
    });
    persistUsers(updated);
    // If the edited user is the current session, refresh session
    if (user && user.id === id) {
      const fresh = updated.find(u => u.id === id);
      if (fresh) {
        const session = { id: fresh.id, name: fresh.name, email: fresh.email, role: fresh.role, area: fresh.area };
        setUser(session);
        localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
      }
    }
    return { success: true };
  }, [persistUsers, user]);

  /** Delete a user (cannot delete yourself) */
  const deleteUser = useCallback((id) => {
    if (user && user.id === id) return { success: false, message: 'Você não pode remover sua própria conta.' };
    const db = loadUsers();
    const updated = db.filter(u => u.id !== id);
    persistUsers(updated);
    return { success: true };
  }, [persistUsers, user]);

  /** Reset all users back to seed data */
  const resetUsersToSeed = useCallback(() => {
    persistUsers(USERS_SEED);
  }, [persistUsers]);

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
