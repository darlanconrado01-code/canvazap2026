
import { Company, User, Theme, ProductImage, Request } from './types';

export const MOCK_COMPANIES: Company[] = [
  { id: '1', name: 'Supermercado Aurora', plan: 'Premium', status: 'active', modules: ['Lâminas', 'Encartes'] },
  { id: '2', name: 'Hipermercado Central', plan: 'Básico', status: 'active', modules: ['Lâminas'] },
  { id: '3', name: 'Mini Mix Express', plan: 'Enterprise', status: 'inactive', modules: ['Lâminas', 'Financeiro'] }
];

export const MOCK_USERS: User[] = [
  { id: '1', name: 'Carlos Silva', email: 'carlos@d3.com', role: 'super_admin', companyId: 'all' },
  { id: '2', name: 'Ana Souza', email: 'ana@aurora.com', role: 'admin', companyId: '1' },
  { id: '3', name: 'Pedro Santos', email: 'pedro@central.com', role: 'member', companyId: '2' }
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



export const DEFAULT_LAYOUT_CONFIG = {
  columns: 3, rows: 2, gap: 15,
  marginTop: 350, marginBottom: 20, marginLeft: 20, marginRight: 20,
  colorDescription: '#000000', colorPrice: '#ff0000', colorCode: '#666666',
  colorInternalCode: '#666666', colorEan: '#666666', colorPackaging: '#000000',
  showPriceSeal: true, showInternalCode: true, showEan: true,
  fontInternalCode: 1.2, fontEan: 1.2, fontSizeDescription: 0.9, fontSizePrice: 2.9,
  cardBackgroundMode: 'white', cardOpacity: 0.7, cardRadius: 8, cardPadding: 10,
  spacingBelowPhoto: 34, spacingBelowDescription: 0, spacingAbovePrice: 5,
  priceCentsSpacing: 2, photoScale: 1.05, cardScale: 0.95, photoAreaHeight: 70,
  elementsOrder: ['code', 'description', 'price'],
  logoConfig: { x: 16, y: 150, scale: 1.4, visible: true },
  sideTextConfig: {
    text: 'Imagens meramente ilustrativas', fontSize: 12, color: '#9ca3af',
    x: -11, y: 500, scale: 1, rotation: -90, visible: true
  },
  promoBadge: {
    text: 'Terça da Carne', fontSize: 24, color: '#cc0000',
    x: 50, y: 140, scale: 1.2, visible: false
  },
  promoMonth: {
    text: 'Mês de Janeiro', fontSize: 18, color: '#333333',
    x: 50, y: 110, visible: false
  }
};
