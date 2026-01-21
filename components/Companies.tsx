
import React, { useState, useEffect } from 'react';
import { db } from '../services/firebaseConfig';
import { collection, query, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Shield,
  Settings,
  MoreVertical,
  Building2,
  Users,
  Layout
} from 'lucide-react';
import { MODULES } from './SidebarMenu';
import { useAuth } from './AuthContext';

const Companies = () => {
  const { userData } = useAuth();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingCompany, setEditingCompany] = useState<any>(null);
  const [showModuleModal, setShowModuleModal] = useState(false);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'companies'));
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCompanies(data);
    } catch (error) {
      console.error("Error fetching companies:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (company: any) => {
    const newStatus = company.status === 'active' ? 'inactive' : 'active';
    try {
      await updateDoc(doc(db, 'companies', company.id), {
        status: newStatus
      });
      setCompanies(prev => prev.map(c => c.id === company.id ? { ...c, status: newStatus } : c));
    } catch (error) {
      console.error(error);
    }
  };

  const handleToggleModule = async (company: any, moduleId: string) => {
    const currentModules = company.modules || [];
    let newModules;
    if (currentModules.includes(moduleId)) {
      newModules = currentModules.filter((id: string) => id !== moduleId);
    } else {
      newModules = [...currentModules, moduleId];
    }

    try {
      await updateDoc(doc(db, 'companies', company.id), {
        modules: newModules
      });
      setCompanies(prev => prev.map(c => c.id === company.id ? { ...c, modules: newModules } : c));
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteCompany = async (company: any) => {
    if (!confirm(`Tem certeza que deseja excluir a empresa "${company.name}"? Esta ação é irreversível e todos os dados associados serão perdidos.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'companies', company.id));
      setCompanies(prev => prev.filter(c => c.id !== company.id));
      alert('Empresa excluída com sucesso.');
    } catch (error) {
      console.error("Erro ao excluir empresa:", error);
      alert('Erro ao excluir empresa. Verifique o console para mais detalhes.');
    }
  };

  const filteredCompanies = companies.filter(c =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (userData?.role !== 'super_admin') {
    return <div className="p-8">Acesso restrito.</div>;
  }

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 className="title" style={{ fontSize: '1.75rem' }}>Gestão de Empresas</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Controle de acesso e configurações globais do sistema.</p>
        </div>
        {/* Future implementation: Add manual company creation */}
      </div>

      <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)' }} />
            <input
              type="text"
              placeholder="Buscar por nome ou código..."
              className="form-input"
              style={{ paddingLeft: '2.5rem' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-color)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Empresa</th>
              <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Código</th>
              <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Status</th>
              <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Módulos</th>
              <th style={{ textAlign: 'center', padding: '1rem', fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center' }}>
                  <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
                </td>
              </tr>
            ) : filteredCompanies.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Nenhuma empresa encontrada.
                </td>
              </tr>
            ) : (
              filteredCompanies.map(company => (
                <tr key={company.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)' }}>
                        <Building2 size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{company.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ID: {company.id?.substring(0, 8)}...</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <code style={{ background: 'var(--bg-color)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.9rem' }}>{company.code}</code>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <button
                      onClick={() => handleToggleStatus(company)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        border: 'none',
                        background: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        color: company.status === 'active' ? 'var(--success-color)' : 'var(--text-secondary)'
                      }}
                    >
                      {company.status === 'active' ? <CheckCircle size={18} /> : <XCircle size={18} />}
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                        {company.status === 'active' ? 'Ativa' : 'Inativa'}
                      </span>
                    </button>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {(company.modules || []).map((modId: string) => {
                        const mod = MODULES.find(m => m.id === modId);
                        return (
                          <span key={modId} style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            background: 'rgba(67, 24, 255, 0.08)',
                            color: 'var(--primary-color)',
                            padding: '2px 8px',
                            borderRadius: '4px'
                          }}>
                            {mod?.name || modId}
                          </span>
                        );
                      })}
                      <button
                        onClick={() => {
                          setEditingCompany(company);
                          setShowModuleModal(true);
                        }}
                        style={{ border: 'none', background: 'none', color: 'var(--primary-color)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                      <button
                        className="btn-secondary"
                        style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        onClick={() => {
                          setEditingCompany(company);
                          setShowModuleModal(true);
                        }}
                        title="Configurar Módulos"
                      >
                        <Settings size={16} />
                      </button>
                      <button
                        className="btn-secondary"
                        style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--error-color)', borderColor: 'var(--error-color)' }}
                        onClick={() => handleDeleteCompany(company)}
                        title="Excluir Empresa"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Module Management Modal */}
      {showModuleModal && editingCompany && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '500px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 className="title">Configurar Módulos</h3>
              <button onClick={() => setShowModuleModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)' }}>
                <XCircle size={24} />
              </button>
            </div>

            <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Ative ou desative os módulos disponíveis para <strong>{editingCompany.name}</strong>.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto' }}>
              {MODULES.filter(m => !m.superAdminOnly).map(module => {
                const isEnabled = (editingCompany.modules || []).includes(module.id);
                return (
                  <div
                    key={module.id}
                    onClick={() => handleToggleModule(editingCompany, module.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '1rem',
                      borderRadius: '12px',
                      background: isEnabled ? 'var(--primary-light)' : 'var(--bg-color)',
                      border: isEnabled ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isEnabled ? 'var(--primary-color)' : 'var(--text-secondary)',
                      marginRight: '1rem'
                    }}>
                      <module.icon size={20} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: isEnabled ? 'var(--text-color)' : 'var(--text-secondary)' }}>{module.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Acesso ao módulo de {module.name.toLowerCase()}</div>
                    </div>
                    {isEnabled && <CheckCircle size={20} color="var(--primary-color)" />}
                  </div>
                );
              })}
            </div>

            <button
              className="btn btn-primary"
              style={{ marginTop: '2rem' }}
              onClick={() => setShowModuleModal(false)}
            >
              Concluir
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Companies;
