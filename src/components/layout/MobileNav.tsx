import React from 'react';
import { 
  LayoutDashboard, 
  Target, 
  BookOpen, 
  Repeat, 
  HelpCircle, 
  UserCircle, 
  CalendarClock, 
  PlayCircle 
} from 'lucide-react';
import { NavigationTab, StudyMethod } from '../../types';

interface MobileNavProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  studyMethod?: StudyMethod;
}

export const MobileNav: React.FC<MobileNavProps> = ({ currentTab, onSelectTab }) => {
  const tabs: { id: NavigationTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Início', icon: LayoutDashboard },
    { id: 'sessao', label: 'Estudar', icon: PlayCircle },
    { id: 'plano', label: 'Plano', icon: CalendarClock },
    { id: 'estudos', label: 'Edital', icon: BookOpen },
    { id: 'revisoes', label: 'Revisões', icon: Repeat },
    { id: 'perfil', label: 'Perfil', icon: UserCircle },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 flex items-center justify-around">
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive = currentTab === tab.id ||
          (tab.id === 'plano' && (currentTab === 'ciclo' || currentTab === 'cronograma' || currentTab === 'plano'));
        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-colors cursor-pointer min-w-12 ${
              isActive
                ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
            <span className="text-[10px] mt-0.5">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
