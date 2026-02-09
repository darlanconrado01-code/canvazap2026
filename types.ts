
export enum View {
  DASHBOARD = 'dashboard',
  COMPANIES = 'companies',
  USERS = 'users',
  THEMES = 'themes',
  IMAGE_BANK = 'image_bank',
  REQUESTS = 'requests',
  SLIDES = 'slides',

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
  role: 'member' | 'admin' | 'super_admin';
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



export enum WebhookEvent {
  ART_NEW = 'art.new',
  ART_APPROVED = 'art.approved',
  ART_NEW_VERSION = 'art.new_version',
  ART_REVISION_REQUESTED = 'art.revision_requested',

  TASK_ASSIGNED = 'task.assigned',

  LAMINA_UPLOAD_REQUEST = 'lamina.upload_request',
  FLYER_ART_GENERATED = 'flyer.art_generated',

  WHATSAPP_BLAST = 'whatsapp.blast'
}

export interface WebhookConfig {
  id: string;
  url: string;
  name: string;
  events: WebhookEvent[];
  active: boolean;
  createdAt: string;
}
