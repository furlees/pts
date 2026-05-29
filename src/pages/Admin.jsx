import { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Users, UserPlus, Shield, ShieldOff, Pencil, Trash2,
  Check, X, Search, Building2, Key, AlertCircle, RotateCcw,
  ChevronDown, UserCog,
} from 'lucide-react';

const AREAS_LIST = [
  'Administrativo', 'Cel40', 'Comunicação', 'Compras', 'CPL',
  'Eventos e Comunicação', 'Financeiro', 'HUBIZ', 'Inovação e Projetos',
  'Jurídico', 'Parcerias Estratégicas',
];

const AREA_COLORS = {
  'Jurídico':               '#8b5cf6',
  'Parcerias Estratégicas':  '#3b82f6',
  'Administrativo':          '#10b981',
  'Financeiro':              '#f59e0b',
  'Inovação e Projetos':     '#ec4899',
  'Comunicação':             '#14b8a6',
  'CPL':                     '#6366f1',
  'HUBIZ':                   '#f97316',
  'Cel40':                   '#64748b',
  'Compras':                 '#84cc16',
  'Eventos e Comunicação':   '#06b6d4',
};

const EMPTY_FORM = { name: '', email: '', password: '', role: 'User', area: '' };

// ── Helpers ────────────────────────────────────────────────
function RoleBadge({ role }) {
  const isAdmin = role === 'Admin';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '3px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700,
      background: isAdmin ? 'rgba(139,92,246,0.12)' : 'rgba(59,130,246,0.1)',
      color: isAdmin ? '#8b5cf6' : '#3b82f6',
      border: `1px solid ${isAdmin ? 'rgba(139,92,246,0.3)' : 'rgba(59,130,246,0.2)'}`,
    }}>
      {isAdmin ? <Shield size={11} /> : <ShieldOff size={11} />}
      {role === 'Admin' ? 'Administrador' : 'Usuário de Área'}
    </span>
  );
}

function AreaBadge({ area }) {
  if (!area) return <span style={{ color: 'var(--color-text-tertiary)', fontSize: '0.8rem' }}>—</span>;
  const color = AREA_COLORS[area] || '#64748b';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '3px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700,
      background: `${color}18`, color, border: `1px solid ${color}35`,
    }}>
      <Building2 size={10} />
      {area}
    </span>
  );
}

// ── Inline edit row ────────────────────────────────────────
function EditableUserRow({ u, currentUserId, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState({ name: u.name, role: u.role, area: u.area || '', password: '' });
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving]   = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await onSave(u.docId || String(u.id), {
        name: form.name.trim() || u.name,
        role: form.role,
        area: form.role === 'Admin' ? null : (form.area || null),
        ...(form.password ? { password: form.password } : {}),
      });
      if (res && res.success === false) {
        alert(res.message || 'Erro ao salvar usuário.');
      } else {
        setEditing(false);
      }
    } catch (err) {
      alert(err.message || 'Erro ao salvar usuário.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (confirm) {
      try {
        const res = await onDelete(u.docId || String(u.id));
        if (res && res.success === false) {
          alert(res.message || 'Erro ao remover usuário.');
        }
      } catch (err) {
        alert(err.message || 'Erro ao remover usuário.');
      }
      setConfirm(false);
    } else {
      setConfirm(true);
    }
  };

  const isSelf = u.id === currentUserId;

  if (!editing) {
    return (
      <tr
        style={{ borderBottom: '1px solid var(--color-border-light)', transition: 'background 0.15s' }}
        onMouseOver={e  => e.currentTarget.style.background = 'var(--color-bg-hover)'}
        onMouseOut={e   => e.currentTarget.style.background = 'transparent'}
      >
        <td style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
              background: u.role === 'Admin' ? '#8b5cf6' : (AREA_COLORS[u.area] || 'var(--color-accent)'),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: '0.8rem',
            }}>
              {u.name.split(' ').slice(0,2).map(n => n[0]).join('').toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                {u.name} {isSelf && <span style={{ fontSize: '0.72rem', color: 'var(--color-accent)', fontWeight: 500 }}>(você)</span>}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{u.email}</div>
            </div>
          </div>
        </td>
        <td style={{ padding: '14px 16px' }}><RoleBadge role={u.role} /></td>
        <td style={{ padding: '14px 16px' }}><AreaBadge area={u.area} /></td>
        <td style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
            <button
              id={`edit-user-${u.id}`}
              onClick={() => { setForm({ name: u.name, role: u.role, area: u.area || '', password: '' }); setEditing(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-input)', color: 'var(--color-text-secondary)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.color = 'var(--color-accent)'; }}
              onMouseOut={e  => { e.currentTarget.style.borderColor = 'var(--color-border)';  e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
            >
              <Pencil size={13} /> Editar
            </button>
            {!isSelf && (
              <button
                id={`delete-user-${u.id}`}
                onClick={handleDelete}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: 'var(--radius-md)', border: `1px solid ${confirm ? '#ef4444' : 'var(--color-border)'}`, background: confirm ? 'rgba(239,68,68,0.08)' : 'var(--color-bg-input)', color: confirm ? '#ef4444' : 'var(--color-text-tertiary)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
              >
                <Trash2 size={13} /> {confirm ? 'Confirmar?' : 'Remover'}
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  }

  // ── Edit mode ──
  return (
    <tr style={{ background: 'var(--color-accent-light)', borderBottom: '1px solid var(--color-border)' }}>
      <td style={{ padding: '12px 16px' }} colSpan={4}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
          {/* Name */}
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nome</label>
            <input
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', fontSize: '0.85rem', outline: 'none' }}
            />
          </div>
          {/* Role */}
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nível de Acesso</label>
            <select
              value={form.role}
              onChange={e => setForm(p => ({ ...p, role: e.target.value, area: e.target.value === 'Admin' ? '' : p.area }))}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}
            >
              <option value="Admin">Administrador</option>
              <option value="User">Usuário de Área</option>
            </select>
          </div>
          {/* Area */}
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Área</label>
            <select
              value={form.area}
              disabled={form.role === 'Admin'}
              onChange={e => setForm(p => ({ ...p, area: e.target.value }))}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', fontSize: '0.85rem', outline: 'none', cursor: form.role === 'Admin' ? 'not-allowed' : 'pointer', opacity: form.role === 'Admin' ? 0.4 : 1 }}
            >
              <option value="">Sem área</option>
              {AREAS_LIST.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          {/* New password */}
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nova Senha <span style={{ fontWeight: 400, opacity: 0.6 }}>(opcional)</span></label>
            <input
              type="password"
              placeholder="Deixe em branco para manter"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', fontSize: '0.85rem', outline: 'none' }}
            />
          </div>
          {/* Actions */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 14px', borderRadius: 'var(--radius-md)', background: 'var(--color-accent)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
            >
              <Check size={14} /> {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              onClick={() => setEditing(false)}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-input)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── Add User Modal ─────────────────────────────────────────
function AddUserModal({ onClose, onAdd }) {
  const [form, setForm]     = useState(EMPTY_FORM);
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setError('Nome, e-mail e senha são obrigatórios.');
      return;
    }
    if (form.role === 'User' && !form.area) {
      setError('Selecione a área para usuários não-administradores.');
      return;
    }
    setSaving(true);
    try {
      const res = await onAdd(form);
      if (res && res.success === false) {
        setError(res.message || 'Erro ao adicionar usuário.');
      } else {
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Erro ao adicionar usuário.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'var(--color-bg-card)', borderRadius: 'var(--radius-xl, 16px)', boxShadow: '0 24px 64px rgba(0,0,0,0.3)', width: '100%', maxWidth: '520px', overflow: 'hidden', animation: 'slideDown 0.2s ease-out' }}>
        {/* Header */}
        <div style={{ padding: '24px 28px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-md)', background: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserPlus size={18} color="#fff" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>Novo Usuário</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-tertiary)' }}>Preencha os dados de acesso</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', color: '#ef4444', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={15} /> {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {/* Name */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px' }}>Nome completo *</label>
              <input
                id="new-user-name"
                autoFocus
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Ex: João Silva"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            {/* Email */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px' }}>E-mail *</label>
              <input
                id="new-user-email"
                type="email"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="usuario@agenciainova.org.br"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            {/* Password */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px' }}>Senha *</label>
              <input
                id="new-user-password"
                type="password"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder="Senha de acesso"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            {/* Role */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px' }}>Nível de Acesso *</label>
              <select
                id="new-user-role"
                value={form.role}
                onChange={e => setForm(p => ({ ...p, role: e.target.value, area: e.target.value === 'Admin' ? '' : p.area }))}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', fontSize: '0.9rem', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}
              >
                <option value="Admin">Administrador</option>
                <option value="User">Usuário de Área</option>
              </select>
            </div>
            {/* Area */}
            {form.role === 'User' && (
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px' }}>Área *</label>
                <select
                  id="new-user-area"
                  value={form.area}
                  onChange={e => setForm(p => ({ ...p, area: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', fontSize: '0.9rem', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}
                >
                  <option value="">Selecione a área...</option>
                  {AREAS_LIST.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '8px', borderTop: '1px solid var(--color-border-light)' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-input)', color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer' }}>
              Cancelar
            </button>
            <button
              id="submit-new-user"
              type="submit"
              disabled={saving}
              style={{ padding: '10px 22px', borderRadius: 'var(--radius-md)', background: 'var(--color-accent)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px' }}
            >
              <UserPlus size={15} /> {saving ? 'Adicionando...' : 'Adicionar Usuário'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────
export default function AdminPage() {
  const { users, user: currentUser, addUser, updateUser, deleteUser, resetUsersToSeed, isAdmin } = useAuth();
  const [search, setSearch]       = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);

  if (!isAdmin) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', flexDirection: 'column', gap: '12px', color: 'var(--color-text-tertiary)' }}>
        <Shield size={48} opacity={0.25} />
        <p>Acesso restrito a administradores.</p>
      </div>
    );
  }

  const filtered = useMemo(() => {
    return (users || []).filter(u => {
      const q = search.toLowerCase();
      const matchSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.area || '').toLowerCase().includes(q);
      const matchRole   = !roleFilter || u.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [users, search, roleFilter]);

  const totalAdmins = (users || []).filter(u => u.role === 'Admin').length;
  const totalUsers  = (users || []).filter(u => u.role === 'User').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── Header banner ─────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(59,130,246,0.06) 100%)',
        border: '1px solid rgba(139,92,246,0.2)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: 'var(--radius-md)', background: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <UserCog size={26} color="#fff" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>Gestão de Usuários</h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
              Gerencie permissões, áreas e acessos da plataforma
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {[
            { label: 'Total',          value: (users || []).length, color: '#8b5cf6' },
            { label: 'Administradores', value: totalAdmins,          color: '#8b5cf6' },
            { label: 'Usuários de Área', value: totalUsers,          color: '#3b82f6' },
          ].map(k => (
            <div key={k.label} style={{ background: 'var(--color-bg-card)', border: `1px solid ${k.color}25`, borderTop: `3px solid ${k.color}`, borderRadius: 'var(--radius-md)', padding: '10px 18px', textAlign: 'center', minWidth: '80px' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text-primary)', lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-tertiary)', marginTop: '3px', fontWeight: 500 }}>{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Toolbar ───────────────────────────────── */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '8px 14px', minWidth: '220px' }}>
            <Search size={15} color="var(--color-text-tertiary)" />
            <input
              id="admin-search"
              placeholder="Buscar por nome, e-mail ou área..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ border: 'none', background: 'transparent', color: 'var(--color-text-primary)', outline: 'none', fontSize: '0.85rem', width: '100%' }}
            />
          </div>
          {/* Role filter */}
          <select
            id="admin-role-filter"
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-card)', color: 'var(--color-text-primary)', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}
          >
            <option value="">Todos os perfis</option>
            <option value="Admin">Administradores</option>
            <option value="User">Usuários de Área</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {/* Reset to seed */}
          <button
            id="reset-users-btn"
            onClick={() => { if (resetConfirm) { resetUsersToSeed(); setResetConfirm(false); } else setResetConfirm(true); }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: 'var(--radius-md)', border: `1px solid ${resetConfirm ? '#ef4444' : 'var(--color-border)'}`, background: resetConfirm ? 'rgba(239,68,68,0.08)' : 'var(--color-bg-card)', color: resetConfirm ? '#ef4444' : 'var(--color-text-tertiary)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
          >
            <RotateCcw size={14} /> {resetConfirm ? 'Confirmar reset?' : 'Restaurar padrão'}
          </button>
          {/* Add user */}
          <button
            id="add-user-btn"
            onClick={() => setShowModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 18px', borderRadius: 'var(--radius-md)', background: 'var(--color-accent)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', boxShadow: '0 2px 8px rgba(37,99,235,0.25)', transition: 'all 0.2s' }}
            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
            onMouseOut={e  => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <UserPlus size={15} /> Novo Usuário
          </button>
        </div>
      </div>

      {/* ── Table ─────────────────────────────────── */}
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '0.88rem' }}>
              Nenhum usuário encontrado.
            </div>
          ) : (
            <table style={{ width: '100%', minWidth: '640px', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr style={{ background: 'var(--color-bg-hover)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Usuário</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nível de Acesso</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Área</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--color-text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <EditableUserRow
                    key={u.id}
                    u={u}
                    currentUserId={currentUser?.id}
                    onSave={updateUser}
                    onDelete={deleteUser}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Add User Modal ─────────────────────────── */}
      {showModal && (
        <AddUserModal
          onClose={() => setShowModal(false)}
          onAdd={addUser}
        />
      )}

    </div>
  );
}
