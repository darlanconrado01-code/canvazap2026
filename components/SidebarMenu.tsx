
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
    CheckCircle2
} from 'lucide-react';

export const MODULES = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { id: 'laminas', name: 'Lâminas', icon: FileImage, path: '/laminas' },
    { id: 'artes-vagas', name: 'Artes Vagas', icon: Layers, path: '/artes-vagas' },
    { id: 'banco-imagens', name: 'Banco de Imagens', icon: Image, path: '/banco-imagens' },
    { id: 'encartes', name: 'Encartes', icon: BookOpen, path: '/encartes' },
    { id: 'artes-postagens', name: 'Aprovação de Artes', icon: CheckCircle2, path: '/artes-postagens' },
    { id: 'crachas', name: 'Crachás', icon: CreditCard, path: '/crachas' },
    { id: 'temas', name: 'Temas', icon: Palette, path: '/temas' },
    { id: 'usuarios', name: 'Usuários', icon: Users, path: '/usuarios', adminOnly: true },
    { id: 'solicitacoes', name: 'Solicitações de Imagens', icon: Inbox, path: '/solicitacoes', adminOnly: true },
    { id: 'tarefas', name: 'Tarefas', icon: CheckSquare, path: '/tarefas' },
    { id: 'empresas', name: 'Empresas', icon: Building2, path: '/empresas', superAdminOnly: true },
];
