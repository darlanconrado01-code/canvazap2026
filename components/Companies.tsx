
import React from 'react';
import { MOCK_COMPANIES } from '../constants';

const Companies: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center">
        <div className="relative">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
          <input 
            type="text" 
            placeholder="Buscar empresas..." 
            className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64" 
          />
        </div>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center space-x-2 hover:bg-indigo-700">
          <i className="fas fa-plus"></i>
          <span>Nova Empresa</span>
        </button>
      </div>
      <table className="w-full text-left">
        <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase">
          <tr>
            <th className="px-6 py-4">Nome da Empresa</th>
            <th className="px-6 py-4">Plano</th>
            <th className="px-6 py-4">Status</th>
            <th className="px-6 py-4">Módulos Ativos</th>
            <th className="px-6 py-4">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {MOCK_COMPANIES.map((company) => (
            <tr key={company.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-6 py-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                    {company.name.charAt(0)}
                  </div>
                  <span className="font-semibold text-slate-800">{company.name}</span>
                </div>
              </td>
              <td className="px-6 py-4">
                <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">
                  {company.plan}
                </span>
              </td>
              <td className="px-6 py-4">
                <span className={`flex items-center space-x-1.5 ${company.status === 'active' ? 'text-emerald-600' : 'text-slate-400'}`}>
                  <span className={`w-2 h-2 rounded-full ${company.status === 'active' ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                  <span className="text-xs font-bold">{company.status === 'active' ? 'Ativa' : 'Inativa'}</span>
                </span>
              </td>
              <td className="px-6 py-4">
                <div className="flex flex-wrap gap-1">
                  {company.modules.map(mod => (
                    <span key={mod} className="bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded text-[10px] font-bold">
                      {mod}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex space-x-2">
                  <button className="text-slate-400 hover:text-indigo-600"><i className="fas fa-edit"></i></button>
                  <button className="text-slate-400 hover:text-red-600"><i className="fas fa-trash"></i></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Companies;
