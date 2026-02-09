
import {
    LayoutDashboard,
    FileImage,
    Layers,
    Image,
    BookOpen,
    CreditCard,
    Palette,
    Users,
    Inbox,
    Building2,
    CheckSquare,
    CheckCircle2,
    Tags,
    Smartphone,
    Target,
    Mic
} from 'lucide-react';

export const MODULES = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { id: 'laminas', name: 'Lâminas', icon: FileImage, path: '/laminas' },
    { id: 'artes-vagas', name: 'Artes Vagas', icon: Layers, path: '/artes-vagas' },
    { id: 'banco-imagens', name: 'Banco de Imagens', icon: Image, path: '/banco-imagens' },
    { id: 'encartes', name: 'Encartes', icon: BookOpen, path: '/encartes' },
    { id: 'catalogos', name: 'Catálogos', icon: BookOpen, path: '/catalogos' },
    { id: 'artes-postagens', name: 'Aprovação de Artes', icon: CheckCircle2, path: '/artes-postagens' },
    { id: 'crachas', name: 'Crachás', icon: CreditCard, path: '/crachas' },
    { id: 'temas', name: 'Temas', icon: Palette, path: '/temas' },
    { id: 'categorias', name: 'Categorias de Negócio', icon: Tags, path: '/admin/categorias', superAdminOnly: true },
    { id: 'usuarios', name: 'Usuários', icon: Users, path: '/usuarios', adminOnly: true },
    { id: 'solicitacoes', name: 'Solicitações de Imagens', icon: Inbox, path: '/solicitacoes', adminOnly: true },

    { id: 'disparos-petville', name: 'Disparos PetVille', icon: Smartphone, path: '/disparos-petville' },
    { id: 'meta-leads', name: 'Leads do Meta', icon: Target, path: '/meta-leads' },
    { id: 'locucoes', name: 'Locuções', icon: Mic, path: '/locucoes' },
    { id: 'tutoriais', name: 'Tutoriais', icon: BookOpen, path: '/tutoriais' },
    { id: 'empresas', name: 'Empresas', icon: Building2, path: '/empresas', superAdminOnly: true },
];
