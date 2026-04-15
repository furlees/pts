import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext({});

// Hardcoded users database
const USERS_DB = [
  {
    id: 1,
    name: 'Matheus',
    email: 'furlesmatheus@gmail.com',
    password: 'Furlanes10@',
    role: 'Admin',
  },
  {
    id: 2,
    name: 'Andre Santos',
    email: 'andre.santos@agenciainova.org.br',
    password: 'Inova@2026',
    role: 'User',
  },
  {
    id: 3,
    name: 'Flavio Anequini',
    email: 'flavio.anequini@agenciainova.org.br',
    password: 'Inova@2026',
    role: 'User',
  },
  {
    id: 4,
    name: 'Giuliano Quartto',
    email: 'giuliano.quartto@agenciainova.org.br',
    password: 'Inova@2026',
    role: 'User',
  },
  {
    id: 5,
    name: 'Alyne Cardoso',
    email: 'alyne.cardoso@agenciainova.org.br',
    password: 'Inova@2026',
    role: 'User',
  },
  {
    id: 6,
    name: 'Financeiro',
    email: 'financeiro@agenciainova.org.br',
    password: 'Inova@2026',
    role: 'User',
  },
  {
    id: 7,
    name: 'Diego Pucci',
    email: 'diego.pucci@agenciainova.org.br',
    password: 'Inova@2026',
    role: 'User',
  },
  {
    id: 8,
    name: 'Mariane Galvao',
    email: 'mariane.galvao@agenciainova.org.br',
    password: 'Inova@2026',
    role: 'User',
  },
  {
    id: 9,
    name: 'Eugenio Brito',
    email: 'eugenio.brito@agenciainova.org.br',
    password: 'Inova@2026',
    role: 'User',
  },
  {
    id: 10,
    name: 'CPL Inova',
    email: 'cpl.inova@agenciainova.org.br',
    password: 'Inova@2026',
    role: 'User',
  },
  {
    id: 11,
    name: 'Paolo Marini',
    email: 'paolo.marini@agenciainova.org.br',
    password: 'Inova@2026',
    role: 'User',
  },
  {
    id: 12,
    name: 'Hubiz',
    email: 'hubiz@agenciainova.org.br',
    password: 'Inova@2026',
    role: 'User',
  },
  {
    id: 13,
    name: 'Cel40',
    email: 'cel40@uempi.com.br',
    password: 'Inova@2026',
    role: 'User',
  },
  {
    id: 14,
    name: 'Compras',
    email: 'compras@agenciainova.org.br',
    password: 'Inova@2026',
    role: 'User',
  },
  {
    id: 15,
    name: 'Eventos',
    email: 'eventos@agenciainova.org.br',
    password: 'Inova@2026',
    role: 'User',
  },
  {
    id: 16,
    name: 'Juliana Mustafa',
    email: 'juliana.mustafa@agenciainova.org.br',
    password: 'Inova@2026',
    role: 'User',
  },
  {
    id: 17,
    name: 'Barbara Carnevale',
    email: 'barbara.carnevale@uempi.com.br',
    password: 'Inova@2026',
    role: 'User',
  }
];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const storedUser = localStorage.getItem('pts_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = (email, password) => {
    const foundUser = USERS_DB.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );

    if (foundUser) {
      // Create user session object without storing the password
      const userSession = {
        id: foundUser.id,
        name: foundUser.name,
        email: foundUser.email,
        role: foundUser.role,
      };
      
      setUser(userSession);
      localStorage.setItem('pts_user', JSON.stringify(userSession));
      return { success: true };
    } else {
      return { success: false, message: 'E-mail ou senha incorretos.' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('pts_user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
