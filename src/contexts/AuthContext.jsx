import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db, auth, firebaseConfig } from '../services/firebase';
import { initializeApp, getApps } from 'firebase/app';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  getFirestore
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
let secondaryApp = null;
let secondaryAuth = null;
if (HAS_FIREBASE) {
  try {
    const existingApps = getApps();
    secondaryApp = existingApps.find(a => a.name === 'secondary-auth-app')
      || initializeApp(firebaseConfig, 'secondary-auth-app');
    secondaryAuth = getAuth(secondaryApp);
  } catch (error) {
    console.error("Failed to initialize secondary app", error);
  }
}

export function AuthProvider({ children }) {
  const [users, setUsers] = useState([]);
  const [areas, setAreas] = useState([]);
  const [user,  setUser]  = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. One-off seeding when app boots (avoids overwriting edits on lists refresh)
  useEffect(() => {
    if (!HAS_FIREBASE) return;

    const checkAndSeed = async () => {
      try {
        const usersCol = collection(db, 'users');
        const snapshot = await getDocs(usersCol);
        
        // If collection is completely empty, populate it
        if (snapshot.empty) {
          console.log("Firestore users collection is empty. Seeding...");
          for (const seedUser of USERS_SEED) {
            await setDoc(doc(db, 'users', String(seedUser.id)), {
              id: seedUser.id,
              name: seedUser.name,
              email: seedUser.email.toLowerCase(),
              password: seedUser.password, // Stored temporarily for migration
              role: seedUser.role,
              area: seedUser.area
            });
          }
        }

        // Seed areas
        const areasCol = collection(db, 'areas');
        const areasSnapshot = await getDocs(areasCol);
        if (areasSnapshot.empty) {
          console.log("Firestore areas collection is empty. Seeding...");
          const DEFAULT_AREAS = [
            { name: 'Administrativo', color: '#10b981' },
            { name: 'CEFI', color: '#64748b' },
            { name: 'CET', color: '#06b6d4' },
            { name: 'Comercial', color: '#3b82f6' },
            { name: 'Comunicação', color: '#14b8a6' },
            { name: 'Compras', color: '#84cc16' },
            { name: 'CPL', color: '#6366f1' },
            { name: 'Eventos', color: '#06b6d4' },
            { name: 'Financeiro', color: '#f59e0b' },
            { name: 'Jurídico', color: '#8b5cf6' },
            { name: 'Hubiz', color: '#f97316' },
            { name: 'Inovação e Projetos', color: '#ec4899' },
            { name: 'Parcerias Estratégicas', color: '#3b82f6' },
            { name: 'RH', color: '#ec4899' },
            { name: 'Cel40', color: '#6b7280' } // Seed Cel40 so it exists initially
          ];
          for (let i = 0; i < DEFAULT_AREAS.length; i++) {
            const area = DEFAULT_AREAS[i];
            await setDoc(doc(db, 'areas', `area_${i + 1}`), {
              id: i + 1,
              name: area.name,
              color: area.color
            });
          }
        }
      } catch (error) {
        console.error("Error during checkAndSeed:", error);
      }
    };

    checkAndSeed();
  }, []);

  // 2. Listen to Firebase Authentication State
  useEffect(() => {
    if (!HAS_FIREBASE) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
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
          // If not found by UID, search local USERS_SEED list to link existing user
          const fresh = USERS_SEED.find(u => u.email.toLowerCase() === firebaseUser.email.toLowerCase());
          if (fresh) {
            const newProfile = {
              id: fresh.id,
              name: fresh.name,
              email: fresh.email.toLowerCase(),
              role: fresh.role,
              area: fresh.area
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
            setUser({ uid: firebaseUser.uid, ...newProfile });
          } else {
            // Default profile
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
  }, []);

  // 3. Sync users list from Firestore in real-time — ONLY when authenticated!
  useEffect(() => {
    if (!HAS_FIREBASE || !user) {
      setUsers([]);
      return;
    }

    const usersCol = collection(db, 'users');

    const unsubscribe = onSnapshot(usersCol, (snapshot) => {
      let list = snapshot.docs.map(docDoc => ({ 
        docId: docDoc.id, 
        ...docDoc.data() 
      }));

      // Sort by ID to preserve listing order
      list.sort((a, b) => a.id - b.id);
      setUsers(list);
    }, (error) => {
      console.error("Firestore onSnapshot error:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // 4. Sync areas list from Firestore in real-time
  useEffect(() => {
    if (!HAS_FIREBASE || !user) {
      setAreas([]);
      return;
    }

    const areasCol = collection(db, 'areas');

    const unsubscribe = onSnapshot(areasCol, (snapshot) => {
      let list = snapshot.docs.map(docDoc => ({ 
        docId: docDoc.id, 
        ...docDoc.data() 
      }));

      // Sort by ID to preserve listing order
      list.sort((a, b) => a.id - b.id);
      setAreas(list);
    }, (error) => {
      console.error("Firestore onSnapshot error (areas):", error);
    });

    return () => unsubscribe();
  }, [user]);

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
      const seedUser = USERS_SEED.find(u => u.email.toLowerCase() === cleanEmail);
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

          // Delete the temporary seed document if it exists in Firestore
          try {
            await deleteDoc(doc(db, 'users', String(seedUser.id)));
          } catch (_) {}

          return { success: true };
        } catch (createError) {
          console.error("Migration error:", createError);
          return { success: false, message: 'Erro ao autenticar e migrar usuário.' };
        }
      }

      console.error("Auth error:", error);
      return { success: false, message: 'E-mail ou senha incorretos.' };
    }
  }, []);

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

    const nextId = users.length > 0 ? Math.max(...users.map(u => u.id || 0)) + 1 : 1;
    const cleanEmail = userData.email.trim().toLowerCase();

    const newUser = {
      id: nextId,
      name:  userData.name.trim(),
      email: cleanEmail,
      role:  userData.role,
      area:  userData.area || null,
    };

    try {
      let uid = `user_${nextId}`;

      if (secondaryAuth && secondaryApp) {
        let userCred = null;
        try {
          userCred = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, userData.password);
        } catch (authErr) {
          if (authErr.code === 'auth/email-already-in-use') {
            // O usuário já foi criado no Firebase Auth (por exemplo na tentativa anterior).
            // Conecta na secondaryAuth para recuperar o UID do usuário e salvar no Firestore.
            try {
              userCred = await signInWithEmailAndPassword(secondaryAuth, cleanEmail, userData.password);
            } catch (loginErr) {
              console.warn("Usuário já existe no Auth com outra senha:", loginErr);
              return { success: false, message: 'Este e-mail já está cadastrado no sistema com outra senha.' };
            }
          } else if (authErr.code === 'auth/weak-password') {
            return { success: false, message: 'A senha deve ter no mínimo 6 caracteres.' };
          } else if (authErr.code === 'auth/invalid-email') {
            return { success: false, message: 'O formato do e-mail é inválido.' };
          } else {
            console.error("Firebase Auth error:", authErr);
            return { success: false, message: authErr.message || 'Erro ao cadastrar usuário no Firebase Auth.' };
          }
        }

        if (userCred && userCred.user) {
          uid = userCred.user.uid;

          // 1. Grava no Firestore através da instância secondaryDb enquanto o usuário ainda está autenticado nela.
          // Isso atende à regra de segurança `request.auth.uid == userId`.
          try {
            const secondaryDb = getFirestore(secondaryApp);
            await setDoc(doc(secondaryDb, 'users', uid), newUser);
          } catch (secDbErr) {
            console.warn("Tentativa de escrita via secondaryDb falhou, tentando db principal:", secDbErr);
            // 2. Fallback via db principal autenticado como Admin
            await setDoc(doc(db, 'users', uid), newUser);
          }

          // 3. Desloga o usuário recém-criado da instância secundária
          await signOut(secondaryAuth);
        }
      } else {
        // Fallback caso secondaryAuth não esteja disponível
        await setDoc(doc(db, 'users', uid), newUser);
      }

      return { success: true };
    } catch (error) {
      console.error("Firebase error in addUser:", error);
      const isPermissionDenied = error.code === 'permission-denied' || error.message?.includes('permission');
      return { 
        success: false, 
        message: isPermissionDenied 
          ? 'Permissão negada no Firestore ao salvar o perfil do usuário.' 
          : (error.message || 'Erro ao cadastrar usuário.') 
      };
    }
  }, [users]);

  /** Update an existing user's role, area or name using their document ID */
  const updateUser = useCallback(async (docId, changes) => {
    if (!HAS_FIREBASE) return { success: false, message: 'Banco offline.' };

    const fresh = users.find(u => u.docId === docId || String(u.id) === String(docId));
    if (!fresh) return { success: false, message: 'Usuário não encontrado.' };

    const targetDocId = fresh.docId || docId;
    const merged = { ...fresh, ...changes };

    const dataToSave = { ...merged };
    delete dataToSave.docId;

    try {
      await setDoc(doc(db, 'users', targetDocId), dataToSave);
      return { success: true };
    } catch (error) {
      console.error("Firebase error in updateUser:", error);
      return { success: false, message: 'Erro ao atualizar usuário.' };
    }
  }, [users]);

  /** Delete a user using their document ID */
  const deleteUser = useCallback(async (docId) => {
    if (user && (user.id === docId || user.uid === docId || user.docId === docId)) {
      return { success: false, message: 'Você não pode remover sua própria conta.' };
    }

    const fresh = users.find(u => u.docId === docId || String(u.id) === String(docId));
    if (!fresh) return { success: false, message: 'Usuário não encontrado.' };

    const targetDocId = fresh.docId || docId;

    try {
      await deleteDoc(doc(db, 'users', targetDocId));
      return { success: true };
    } catch (error) {
      console.error("Firebase error in deleteUser:", error);
      return { success: false, message: 'Erro ao deletar usuário.' };
    }
  }, [users, user]);

  /** Add a new area */
  const addArea = useCallback(async (areaData) => {
    if (!HAS_FIREBASE) return { success: false, message: 'Banco offline.' };

    const nextId = areas.length > 0 ? Math.max(...areas.map(a => a.id)) + 1 : 1;
    const cleanName = areaData.name.trim();

    if (areas.some(a => a.name.toLowerCase() === cleanName.toLowerCase())) {
      return { success: false, message: 'Já existe uma área com este nome.' };
    }

    try {
      const docId = `area_${nextId}`;
      const newArea = {
        id: nextId,
        name: cleanName,
        color: areaData.color || '#64748b'
      };

      await setDoc(doc(db, 'areas', docId), newArea);
      return { success: true };
    } catch (error) {
      console.error("Firebase error in addArea:", error);
      return { success: false, message: 'Erro ao cadastrar área no Firestore.' };
    }
  }, [areas]);

  /** Update an existing area */
  const updateArea = useCallback(async (docId, changes) => {
    if (!HAS_FIREBASE) return { success: false, message: 'Banco offline.' };

    const fresh = areas.find(a => a.docId === docId || String(a.id) === String(docId));
    if (!fresh) return { success: false, message: 'Área não encontrada.' };

    const targetDocId = fresh.docId || docId;
    const cleanName = changes.name ? changes.name.trim() : fresh.name;

    if (changes.name && areas.some(a => a.name.toLowerCase() === cleanName.toLowerCase() && a.docId !== targetDocId)) {
      return { success: false, message: 'Já existe outra área com este nome.' };
    }

    const merged = { ...fresh, ...changes, name: cleanName };
    const dataToSave = { ...merged };
    delete dataToSave.docId;

    try {
      await setDoc(doc(db, 'areas', targetDocId), dataToSave);

      // Propagate name change to users' areas
      if (changes.name && fresh.name !== cleanName) {
        const usersToUpdate = users.filter(u => u.area && u.area.split(',').map(a => a.trim()).includes(fresh.name));
        for (const u of usersToUpdate) {
          const newAreas = u.area.split(',').map(a => {
            const trimmed = a.trim();
            return trimmed === fresh.name ? cleanName : trimmed;
          }).filter(Boolean).join(', ');
          
          const uData = { ...u, area: newAreas || null };
          const uDocId = u.docId;
          delete uData.docId;
          await setDoc(doc(db, 'users', uDocId), uData);
        }
      }

      return { success: true };
    } catch (error) {
      console.error("Firebase error in updateArea:", error);
      return { success: false, message: 'Erro ao atualizar área.' };
    }
  }, [areas, users]);

  /** Delete an area */
  const deleteArea = useCallback(async (docId) => {
    const fresh = areas.find(a => a.docId === docId || String(a.id) === String(docId));
    if (!fresh) return { success: false, message: 'Área não encontrada.' };

    const targetDocId = fresh.docId || docId;

    try {
      await deleteDoc(doc(db, 'areas', targetDocId));

      // Remove this area from users
      const usersToUpdate = users.filter(u => u.area && u.area.split(',').map(a => a.trim()).includes(fresh.name));
      for (const u of usersToUpdate) {
        const newAreas = u.area.split(',').map(a => a.trim()).filter(a => a !== fresh.name).join(', ');
        const dataToSave = { ...u, area: newAreas || null };
        const uDocId = u.docId;
        delete dataToSave.docId;
        await setDoc(doc(db, 'users', uDocId), dataToSave);
      }

      return { success: true };
    } catch (error) {
      console.error("Firebase error in deleteArea:", error);
      return { success: false, message: 'Erro ao deletar área.' };
    }
  }, [areas, users]);

  /** Reset all users back to seed data */
  const resetUsersToSeed = useCallback(async () => {
    if (!HAS_FIREBASE) return;
    try {
      // 1. Delete users
      for (const u of users) {
        if (u.docId) {
          await deleteDoc(doc(db, 'users', u.docId));
        }
      }
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

      // 2. Delete areas
      for (const a of areas) {
        if (a.docId) {
          await deleteDoc(doc(db, 'areas', a.docId));
        }
      }
      const DEFAULT_AREAS = [
        { name: 'Administrativo', color: '#10b981' },
        { name: 'CEFI', color: '#64748b' },
        { name: 'CET', color: '#06b6d4' },
        { name: 'Comercial', color: '#3b82f6' },
        { name: 'Comunicação', color: '#14b8a6' },
        { name: 'Compras', color: '#84cc16' },
        { name: 'CPL', color: '#6366f1' },
        { name: 'Eventos', color: '#06b6d4' },
        { name: 'Financeiro', color: '#f59e0b' },
        { name: 'Jurídico', color: '#8b5cf6' },
        { name: 'Hubiz', color: '#f97316' },
        { name: 'Inovação e Projetos', color: '#ec4899' },
        { name: 'Parcerias Estratégicas', color: '#3b82f6' },
        { name: 'RH', color: '#ec4899' },
        { name: 'Cel40', color: '#6b7280' }
      ];
      for (let i = 0; i < DEFAULT_AREAS.length; i++) {
        const area = DEFAULT_AREAS[i];
        await setDoc(doc(db, 'areas', `area_${i + 1}`), {
          id: i + 1,
          name: area.name,
          color: area.color
        });
      }
    } catch (error) {
      console.error("Firebase error in resetUsersToSeed:", error);
    }
  }, [users, areas]);

  const isAdmin  = user?.role === 'Admin';
  const userArea = user?.area || null;

  return (
    <AuthContext.Provider value={{
      user, users, areas, loading,
      login, logout,
      isAdmin, userArea,
      addUser, updateUser, deleteUser, resetUsersToSeed,
      addArea, updateArea, deleteArea
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
