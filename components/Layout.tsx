
import React from 'react';
import { View } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeView: View;
  setView: (view: View) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeView, setView }) => {
  const menuItems = [
    { id: View.DASHBOARD, label: 'Dashboard', icon: 'fa-chart-line' },
    { id: View.COMPANIES, label: 'Empresas', icon: 'fa-building' },
    { id: View.USERS, label: 'Usuários', icon: 'fa-users' },
    { id: View.THEMES, label: 'Temas', icon: 'fa-palette' },
    { id: View.IMAGE_BANK, label: 'Banco de Imagens', icon: 'fa-images' },
    { id: View.REQUESTS, label: 'Solicitações', icon: 'fa-headset' },
    { id: View.SLIDES, label: 'Lâminas', icon: 'fa-file-image' },
    { id: View.TASKS, label: 'Tarefas', icon: 'fa-list-check' },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col transition-all">
        <div className="p-6 flex items-center space-x-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
            <i className="fas fa-link text-white text-xl"></i>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Conexões<span className="text-indigo-400">D3</span></h1>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors duration-200 ${
                activeView === item.id 
                  ? 'bg-indigo-600 text-white' 
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <i className={`fas ${item.icon} w-5`}></i>
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center space-x-3 px-2">
            <img src="https://picsum.photos/seed/user1/40/40" className="rounded-full ring-2 ring-slate-700" alt="Avatar" />
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-white truncate">Carlos Silva</p>
              <p className="text-xs text-slate-400 truncate">admin_master</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-10">
          <h2 className="text-xl font-semibold text-slate-800 capitalize">
            {activeView.replace('_', ' ')}
          </h2>
          <div className="flex items-center space-x-4">
            <button className="p-2 text-slate-400 hover:text-indigo-600">
              <i className="fas fa-bell"></i>
            </button>
            <div className="h-8 w-px bg-slate-200"></div>
            <span className="text-sm text-slate-500 font-medium">Outubro 2023</span>
          </div>
        </header>

        <section className="flex-1 overflow-y-auto p-8 bg-slate-50">
          {children}
        </section>
      </main>
    </div>
  );
};

export default Layout;
