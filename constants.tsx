
import { Company, User, Theme, ProductImage, Request, Task, TaskStatus } from './types';

export const MOCK_COMPANIES: Company[] = [
  { id: '1', name: 'Supermercado Aurora', plan: 'Premium', status: 'active', modules: ['Lâminas', 'Encartes', 'Tarefas'] },
  { id: '2', name: 'Hipermercado Central', plan: 'Básico', status: 'active', modules: ['Lâminas'] },
  { id: '3', name: 'Mini Mix Express', plan: 'Enterprise', status: 'inactive', modules: ['Lâminas', 'Tarefas', 'Financeiro'] }
];

export const MOCK_USERS: User[] = [
  { id: '1', name: 'Carlos Silva', email: 'carlos@d3.com', role: 'admin_master', companyId: 'all' },
  { id: '2', name: 'Ana Souza', email: 'ana@aurora.com', role: 'admin_empresa', companyId: '1' },
  { id: '3', name: 'Pedro Santos', email: 'pedro@central.com', role: 'colaborador', companyId: '2' }
];

export const MOCK_THEMES: Theme[] = [
  { id: '1', name: 'Ofertas de Verão', category: 'global', imageUrl: 'https://picsum.photos/seed/summer/400/300', colors: ['#f59e0b', '#ef4444'] },
  { id: '2', name: 'Black Friday D3', category: 'global', imageUrl: 'https://picsum.photos/seed/black/400/300', colors: ['#000000', '#facc15'] },
  { id: '3', name: 'Natal Mágico', category: 'local', imageUrl: 'https://picsum.photos/seed/xmas/400/300', colors: ['#b91c1c', '#15803d'] }
];

export const MOCK_IMAGE_BANK: ProductImage[] = [
  { id: '1', ean: '7891000123456', internalCode: 'PROD-001', name: 'Arroz Tio João 5kg', imageUrl: 'https://picsum.photos/seed/rice/200/200' },
  { id: '2', ean: '7891000654321', internalCode: 'PROD-002', name: 'Feijão Carioca Kicaldo 1kg', imageUrl: 'https://picsum.photos/seed/beans/200/200' },
  { id: '3', ean: '7891000999999', internalCode: 'PROD-003', name: 'Óleo de Soja Liza 900ml', imageUrl: 'https://picsum.photos/seed/oil/200/200' }
];

export const MOCK_REQUESTS: Request[] = [
  { id: '1', productName: 'Cerveja Skol 350ml Pack', status: 'pending', requestedBy: 'Pedro Santos', date: '2023-10-25' },
  { id: '2', productName: 'Detergente Ipê Maçã', status: 'resolved', requestedBy: 'Ana Souza', date: '2023-10-24' }
];

export const MOCK_TASKS: Task[] = [
  { id: '1', title: 'Cadastrar Imagem Skol', description: 'Buscar imagem oficial e remover fundo.', status: TaskStatus.TODO, assignee: 'Carlos Silva', priority: 'high' },
  { id: '2', title: 'Revisar Tema Natal', description: 'Ajustar contraste das fontes no fundo vermelho.', status: TaskStatus.DOING, assignee: 'Juliana Designer', priority: 'medium' },
  { id: '3', title: 'Atualização de Planos', description: 'Migrar Aurora para Enterprise.', status: TaskStatus.DONE, assignee: 'Carlos Silva', priority: 'low' }
];
