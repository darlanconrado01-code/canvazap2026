
import React, { useState, useEffect } from 'react';
import { db, auth } from '../services/firebaseConfig';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  CheckCircle,
  XCircle,
  Building2,
  Layout,
  Webhook,
  CreditCard,
  Settings,
  Trash2,
  Wand2
} from 'lucide-react';
import { MODULES } from './SidebarMenu';
import { useAuth } from './AuthContext';

const Companies = () => {
  const navigate = useNavigate();
  const { userData, switchCompany } = useAuth();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingCompany, setEditingCompany] = useState<any>(null);
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [showFinanceModal, setShowFinanceModal] = useState(false);
  const [showArtRulesModal, setShowArtRulesModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: '', code: '' });

  const [financeForm, setFinanceForm] = useState({
    plan: 'monthly',
    status: 'active',
    lastPaymentDate: '',
    expiryDate: '',
    fixedDays: 30,
    audioCredits: 0
  });

  const [artRulesForm, setArtRulesForm] = useState({
    visualAllowed: '',
    visualForbidden: '',
    textAllowed: '',
    textForbidden: ''
  });

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'companies'));
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCompanies(data);
    } catch (e: any) {
      console.error("FIRESTORE ERROR (fetchCompanies)", e);
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCompany = async () => {
    if (!newCompany.name || !newCompany.code) return alert('Preencha nome e código.');

    try {
      const docRef = await addDoc(collection(db, 'companies'), {
        name: newCompany.name,
        code: newCompany.code.toLowerCase().replace(/\s+/g, '-'),
        status: 'active',
        createdAt: serverTimestamp(),
        modules: [],
        ownerId: userData?.uid || 'admin'
      });

      setCompanies([...companies, { id: docRef.id, ...newCompany, status: 'active', modules: [] }]);
      setShowCreateModal(false);
      setNewCompany({ name: '', code: '' });
      alert('Empresa criada com sucesso!');
    } catch (error) {
      console.error("Error creating company:", error);
      alert('Erro ao criar empresa.');
    }
  };


  const handleToggleStatus = async (company: any) => {
    const newStatus = company.status === 'active' ? 'inactive' : 'active';
    try {
      await updateDoc(doc(db, 'companies', company.id), { status: newStatus });
      setCompanies(prev => prev.map(c => c.id === company.id ? { ...c, status: newStatus } : c));
    } catch (error) {
      console.error(error);
    }
  };

  const handleToggleModule = async (company: any, moduleId: string) => {
    const currentModules = company.modules || [];
    const newModules = currentModules.includes(moduleId)
      ? currentModules.filter((id: string) => id !== moduleId)
      : [...currentModules, moduleId];

    try {
      await updateDoc(doc(db, 'companies', company.id), { modules: newModules });
      setCompanies(prev => prev.map(c => c.id === company.id ? { ...c, modules: newModules } : c));
    } catch (error) {
      console.error(error);
    }
  };

  const handleOpenFinance = (company: any) => {
    setEditingCompany(company);
    const sub = company.subscription || {};
    const formatDate = (val: any) => {
      if (!val) return '';
      const d = val.toDate ? val.toDate() : new Date(val);
      return d.toISOString().split('T')[0];
    };
    setFinanceForm({
      plan: sub.plan || 'monthly',
      status: sub.status || 'active',
      lastPaymentDate: formatDate(sub.lastPaymentDate),
      expiryDate: formatDate(sub.expiryDate),
      fixedDays: sub.fixedDays || 30,
      audioCredits: company.audioCredits || 0
    });
    setShowFinanceModal(true);
  };

  const handleSaveFinance = async () => {
    if (!editingCompany) return;
    try {
      const subData = {
        plan: financeForm.plan,
        status: financeForm.status,
        lastPaymentDate: financeForm.lastPaymentDate ? new Date(financeForm.lastPaymentDate) : null,
        expiryDate: financeForm.expiryDate ? new Date(financeForm.expiryDate) : null,
        fixedDays: financeForm.plan === 'fixed_days' ? financeForm.fixedDays : null,
        updatedAt: new Date()
      };
      await updateDoc(doc(db, 'companies', editingCompany.id), {
        subscription: subData,
        audioCredits: Number(financeForm.audioCredits) || 0
      });
      setCompanies(prev => prev.map(c => c.id === editingCompany.id ? { ...c, subscription: subData, audioCredits: financeForm.audioCredits } : c));
      setShowFinanceModal(false);
      alert('Informações financeiras atualizadas!');
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar informações financeiras.');
    }
  };

  const handleOpenArtRules = (company: any) => {
    setEditingCompany(company);
    setArtRulesForm({
      visualAllowed: company.artRules?.visualAllowed || '',
      visualForbidden: company.artRules?.visualForbidden || '',
      textAllowed: company.artRules?.textAllowed || '',
      textForbidden: company.artRules?.textForbidden || ''
    });
    setShowArtRulesModal(true);
  };

  const handleSaveArtRules = async () => {
    if (!editingCompany) return;
    try {
      const artRules = { ...artRulesForm };
      await updateDoc(doc(db, 'companies', editingCompany.id), { artRules });
      setCompanies(prev => prev.map(c => c.id === editingCompany.id ? { ...c, artRules } : c));
      setShowArtRulesModal(false);
      alert('Diretrizes de arte atualizadas!');
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar diretrizes.');
    }
  };

  const handleDeleteCompany = async (company: any) => {
    if (!confirm(`Excluir "${company.name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'companies', company.id));
      setCompanies(prev => prev.filter(c => c.id !== company.id));
    } catch (error) {
      console.error(error);
    }
  };

  const filteredCompanies = companies.filter(c =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (userData?.role !== 'super_admin') return <div className="p-8">Acesso restrito.</div>;

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 className="title" style={{ fontSize: '1.75rem' }}>Gestão de Empresas</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Controle de acesso e configurações globais do sistema.</p>
        </div>
        <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => setShowCreateModal(true)}>
          <Plus size={20} /> Nova Empresa
        </button>
      </div>

      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
            <h3 className="title" style={{ marginBottom: '1.5rem' }}>Nova Empresa</h3>
            <div className="form-group">
              <label className="form-label">Nome da Empresa</label>
              <input
                className="form-input"
                value={newCompany.name}
                onChange={e => {
                  const name = e.target.value;
                  const code = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                  setNewCompany({ name, code });
                }}
                placeholder="Ex: Minha Loja"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Código (Slug)</label>
              <input
                className="form-input"
                value={newCompany.code}
                onChange={e => setNewCompany({ ...newCompany, code: e.target.value })}
                placeholder="ex: minha-loja"
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)} style={{ flex: 1 }}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCreateCompany} style={{ flex: 1 }}>Criar</button>
            </div>
          </div>
        </div>
      )}

      <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ position: 'relative' }}>
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

      <div className="glass-card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-color)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ textAlign: 'left', padding: '1rem 1.5rem' }}>Empresa</th>
              <th style={{ textAlign: 'left', padding: '1rem' }}>Código</th>
              <th style={{ textAlign: 'left', padding: '1rem' }}>Status</th>
              <th style={{ textAlign: 'left', padding: '1rem' }}>Módulos</th>
              <th style={{ textAlign: 'center', padding: '1rem' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center' }}>Carregando...</td></tr>
            ) : filteredCompanies.map(company => (
              <tr key={company.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '1rem 1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)' }}>
                      {company.logoUrl ? <img src={company.logoUrl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Building2 size={20} />}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{company.name}</div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: company.subscription?.status === 'blocked' ? 'var(--error-color)' :
                          company.subscription?.status === 'overdue' ? '#F59E0B' :
                            'var(--text-secondary)',
                        fontWeight: (company.subscription?.status === 'blocked' || company.subscription?.status === 'overdue') ? 600 : 400,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        {company.subscription?.plan?.toUpperCase() || 'SEM PLANO'} • {company.subscription?.status?.toUpperCase() || 'ATIVO'}
                        {company.audioCredits > 0 && (
                          <span style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8B5CF6', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                            {company.audioCredits} offs
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '1rem' }}><code>{company.code}</code></td>
                <td style={{ padding: '1rem' }}>
                  <button onClick={() => handleToggleStatus(company)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: company.status === 'active' ? 'var(--success-color)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {company.status === 'active' ? <CheckCircle size={18} /> : <XCircle size={18} />}
                    <span style={{ fontWeight: 600 }}>{company.status === 'active' ? 'Ativa' : 'Inativa'}</span>
                  </button>
                </td>
                <td style={{ padding: '1rem' }}>
                  <button onClick={() => { setEditingCompany(company); setShowModuleModal(true); }} className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', gap: '8px', alignItems: 'center', width: 'auto' }}>
                    <Layout size={14} />
                    <span>{company.modules?.length || 0} Módulos</span>
                  </button>
                </td>
                <td style={{ padding: '1rem', textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                    <button className="btn-secondary" style={{ width: '32px', height: '32px', padding: 0, color: '#8B5CF6', borderColor: '#8B5CF6' }} onClick={() => handleOpenFinance(company)} title="Financeiro"><CreditCard size={16} /></button>
                    <button className="btn-secondary" style={{ width: '32px', height: '32px', padding: 0, color: '#F59E0B', borderColor: '#F59E0B' }} onClick={() => handleOpenArtRules(company)} title="Diretrizes de Arte IA"><Wand2 size={16} /></button>
                    <button className="btn-secondary" style={{ width: '32px', height: '32px', padding: 0 }} onClick={async (e) => { e.stopPropagation(); await switchCompany(company.id); setTimeout(() => navigate('/company-profile'), 100); }} title="Configurações & Integrações"><Settings size={16} /></button>
                    <button className="btn-secondary" style={{ width: '32px', height: '32px', padding: 0, color: 'var(--error-color)', borderColor: 'var(--error-color)' }} onClick={() => handleDeleteCompany(company)} title="Excluir"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Module Modal */}
      {showModuleModal && editingCompany && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '800px', padding: '2rem', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h3 className="title">Módulos: {editingCompany.name}</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Selecione os módulos disponíveis para esta empresa.</p>
              </div>
              <button onClick={() => setShowModuleModal(false)} style={{ background: 'none', border: 'none' }}><XCircle size={24} /></button>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem' }}>
              <button
                className="btn-secondary"
                style={{ flex: 1, fontSize: '0.8rem', padding: '8px' }}
                onClick={() => {
                  const allModules = MODULES.filter(m => !m.superAdminOnly).map(m => m.id);
                  setEditingCompany({ ...editingCompany, modules: allModules });
                }}
              >
                Habilitar Todos
              </button>
              <button
                className="btn-secondary"
                style={{ flex: 1, fontSize: '0.8rem', padding: '8px' }}
                onClick={() => {
                  setEditingCompany({ ...editingCompany, modules: [] });
                }}
              >
                Desabilitar Todos
              </button>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '1rem',
              overflowY: 'auto',
              paddingRight: '0.5rem',
              marginBottom: '1rem'
            }}>
              {MODULES.filter(m => !m.superAdminOnly).map(module => {
                const isEnabled = (editingCompany.modules || []).includes(module.id);
                return (
                  <div
                    key={module.id}
                    onClick={() => {
                      const current = editingCompany.modules || [];
                      const updated = current.includes(module.id)
                        ? current.filter((id: string) => id !== module.id)
                        : [...current, module.id];
                      setEditingCompany({ ...editingCompany, modules: updated });
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '1rem',
                      borderRadius: '12px',
                      background: isEnabled ? '#f0fdf4' : 'var(--bg-color)',
                      border: isEnabled ? '2px solid #22c55e' : '1px solid var(--border-color)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                      boxShadow: isEnabled ? '0 4px 6px -1px rgba(34, 197, 94, 0.1)' : 'none'
                    }}
                  >
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      background: isEnabled ? '#22c55e' : 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isEnabled ? 'white' : 'var(--text-secondary)',
                      marginRight: '1rem',
                      border: isEnabled ? 'none' : '1px solid var(--border-color)'
                    }}>
                      <module.icon size={22} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: isEnabled ? '#14532d' : 'inherit' }}>{module.name}</div>
                      {isEnabled && <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 600 }}>Habilitado</div>}
                    </div>

                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '6px',
                      border: isEnabled ? 'none' : '2px solid #e2e8f0',
                      background: isEnabled ? '#22c55e' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white'
                    }}>
                      {isEnabled && <CheckCircle size={16} />}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <button className="btn btn-secondary" onClick={() => setShowModuleModal(false)} style={{ flex: 1 }}>Cancelar</button>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  try {
                    await updateDoc(doc(db, 'companies', editingCompany.id), { modules: editingCompany.modules });
                    setCompanies(prev => prev.map(c => c.id === editingCompany.id ? { ...c, modules: editingCompany.modules } : c));
                    setShowModuleModal(false);
                    alert('Módulos atualizados com sucesso!');
                  } catch (e) {
                    console.error(e);
                    alert('Erro ao salvar módulos.');
                  }
                }}
                style={{ flex: 2 }}
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Finance Modal */}
      {showFinanceModal && editingCompany && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '500px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 className="title">Financeiro: {editingCompany.name}</h3>
              <button onClick={() => setShowFinanceModal(false)} style={{ background: 'none', border: 'none' }}><XCircle size={24} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label">Plano</label>
                <select className="form-input" value={financeForm.plan} onChange={e => setFinanceForm({ ...financeForm, plan: e.target.value as any })}>
                  <option value="monthly">Mensal</option>
                  <option value="annual">Anual</option>
                  <option value="fixed_days">Dias Específicos</option>
                  <option value="vitalicio">Vitalício</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Último Pagamento</label>
                  <input type="date" className="form-input" value={financeForm.lastPaymentDate} onChange={e => setFinanceForm({ ...financeForm, lastPaymentDate: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Expiração</label>
                  <input type="date" className="form-input" value={financeForm.expiryDate} onChange={e => setFinanceForm({ ...financeForm, expiryDate: e.target.value })} disabled={financeForm.plan === 'vitalicio'} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Status Financeiro</label>
                <select className="form-input" value={financeForm.status} onChange={e => setFinanceForm({ ...financeForm, status: e.target.value as any })}>
                  <option value="active">Ativo</option>
                  <option value="overdue">Em Atraso (Aviso)</option>
                  <option value="blocked">BLOQUEADO</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Créditos de Locução (Offs)</label>
                <input
                  type="number"
                  className="form-input"
                  value={financeForm.audioCredits}
                  onChange={e => setFinanceForm({ ...financeForm, audioCredits: Number(e.target.value) })}
                  placeholder="Ex: 10"
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowFinanceModal(false)} style={{ flex: 1 }}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSaveFinance} style={{ flex: 2 }}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Art Rules Modal */}
      {showArtRulesModal && editingCompany && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '600px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 className="title">Diretrizes de Arte IA: {editingCompany.name}</h3>
              <button onClick={() => setShowArtRulesModal(false)} style={{ background: 'none', border: 'none' }}><XCircle size={24} /></button>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--primary-color)' }}>VISUAL (Imagem)</h4>
              <div className="form-group">
                <label className="form-label">O que PODE ter (Visual)</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={artRulesForm.visualAllowed}
                  onChange={e => setArtRulesForm({ ...artRulesForm, visualAllowed: e.target.value })}
                  placeholder="Ex: Cores azul e laranja, fotos de pessoas reais..."
                />
              </div>
              <div className="form-group">
                <label className="form-label">O que NÃO PODE ter (Visual)</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={artRulesForm.visualForbidden}
                  onChange={e => setArtRulesForm({ ...artRulesForm, visualForbidden: e.target.value })}
                  placeholder="Ex: Texto na imagem, fundo preto, desenhos 3D..."
                />
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--primary-color)' }}>TEXTO / CONTEXTO</h4>
              <div className="form-group">
                <label className="form-label">O que PODE ter (Texto/Tom)</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={artRulesForm.textAllowed}
                  onChange={e => setArtRulesForm({ ...artRulesForm, textAllowed: e.target.value })}
                  placeholder="Ex: Linguagem formal, emojis, CTA..."
                />
              </div>
              <div className="form-group">
                <label className="form-label">O que NÃO PODE ter (Texto/Tom)</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={artRulesForm.textForbidden}
                  onChange={e => setArtRulesForm({ ...artRulesForm, textForbidden: e.target.value })}
                  placeholder="Ex: Gírias, promessas falsas, preços..."
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowArtRulesModal(false)} style={{ flex: 1 }}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSaveArtRules} style={{ flex: 2 }}>Salvar Diretrizes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Companies;
