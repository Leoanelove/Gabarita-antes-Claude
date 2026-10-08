import React from 'react';
import { 
  LayoutDashboard, 
  Target, 
  BookOpen, 
  Repeat, 
  HelpCircle, 
  Trophy, 
  Award, 
  UserCircle, 
  Flame, 
  LogOut, 
  Sparkles, 
  ChevronRight, 
  Database, 
  CalendarClock, 
  Clock, 
  BarChart3, 
  Shield, 
  Crown,
  BookX
} from 'lucide-react';
import { NavigationTab, StudyMethod } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { isFirebaseInitialized } from '../../services/firebase';
import { GezinhoLogo } from '../common/GezinhoLogo';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  studyMethod?: StudyMethod;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isOpenMobile,
  onCloseMobile,
  studyMethod = 'ciclo',
}) => {
  const { user, logout } = useAuth();

  const navItems: { id: NavigationTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: string }[] = [
    { id: 'dashboard', label: 'Painel Geral', icon: LayoutDashboard },
    { id: 'concursos', label: 'Concursos & Provas', icon: Target },
    { id: 'plano', label: 'Plano de Estudos', icon: CalendarClock },
    { id: 'estudos', label: 'Edital Verticalizado', icon: BookOpen },
    { id: 'revisoes', label: 'Revisões Espaçadas', icon: Repeat, badge: '3 hoje' },
    { id: 'questoes', label: 'Questões', icon: HelpCircle },
    { id: 'caderno_erros', label: 'Caderno de Erros', icon: BookX },
    { id: 'metas', label: 'Metas & Desempenho', icon: Trophy },
    { id: 'analytics', label: 'Estatísticas', icon: BarChart3 },
    { id: 'ai_assistant', label: 'Assistente IA', icon: Sparkles, badge: 'Gemini' },
    { id: 'simulados', label: 'Simulados', icon: Award },
    { id: 'planos_assinatura', label: 'Planos & Assinatura', icon: Crown, badge: 'PRO' },
    { id: 'perfil', label: 'Perfil & Ajustes', icon: UserCircle },
    ...(user?.role === 'admin' ? [{ id: 'admin' as NavigationTab, label: 'Área Administrativa', icon: Shield, badge: 'Admin' }] : []),
  ];

  const handleNavClick = (tab: NavigationTab) => {
    onSelectTab(tab);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {isOpenMobile && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800/80 flex flex-col transition-transform duration-300 lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <GezinhoLogo size={38} withText withBadge className="drop-shadow-xs" />
        </div>

        <div className="sidebar-foco-box px-4 py-3 mx-3 my-3 border rounded-xl">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="flex items-center gap-1 sidebar-foco-title">
              <Sparkles className="w-3.5 h-3.5 sidebar-foco-icon" />
              Foco Atual
            </span>
            <span className="sidebar-nivel-badge text-[10px] font-mono px-1.5 py-0.5 rounded font-bold">
              Nível {user?.level || 1}
            </span>
          </div>
          <p className="text-xs font-medium text-slate-800 dark:text-slate-200 mt-1 truncate">
            {user?.targetConcursoTitle || 'TCU - Auditor Federal'}
          </p>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id || 
              (item.id === 'plano' && (currentTab === 'plano' || currentTab === 'ciclo' || currentTab === 'cronograma'));
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'theme-btn-primary text-white shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'sidebar-badge'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 mx-3 my-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {user?.streakDays || 1} dias seguidos
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {user?.xp || 100} XP acumulados
                </p>
              </div>
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Database className="w-3 h-3 text-emerald-500" />
              {isFirebaseInitialized ? 'Firebase Conectado' : 'Armazenamento Seguro'}
            </span>
          </div>
        </div>

        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <button
            onClick={() => handleNavClick('perfil')}
            className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer hover:opacity-80 transition-opacity"
          >
            <img
              src={user?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=120'}
              alt={user?.name || 'Usuário'}
              className="w-9 h-9 rounded-full object-cover border border-slate-300 dark:border-slate-700"
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                {user?.name || 'Estudante'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {user?.email || 'aluno@gabarita.com'}
              </p>
            </div>
          </button>
          <button
            onClick={logout}
            title="Sair da Conta"
            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>
    </>
  );
};
