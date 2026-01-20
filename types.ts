
export enum View {
  DASHBOARD = 'dashboard',
  COMPANIES = 'companies',
  USERS = 'users',
  THEMES = 'themes',
  IMAGE_BANK = 'image_bank',
  REQUESTS = 'requests',
  SLIDES = 'slides',
  TASKS = 'tasks'
}

export enum TaskStatus {
  TODO = 'A Fazer',
  DOING = 'Em Andamento',
  DONE = 'Concluído'
}

export interface Company {
  id: string;
  name: string;
  plan: string;
  status: 'active' | 'inactive';
  modules: string[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  companyId: string;
}

export interface Theme {
  id: string;
  name: string;
  category: 'global' | 'local';
  imageUrl: string;
  colors: string[];
}

export interface ProductImage {
  id: string;
  ean: string;
  internalCode: string;
  name: string;
  imageUrl: string;
}

export interface Request {
  id: string;
  productName: string;
  status: 'pending' | 'resolved';
  requestedBy: string;
  date: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  assignee: string;
  priority: 'low' | 'medium' | 'high';
}
