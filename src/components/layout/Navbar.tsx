import React, { useState, useEffect } from 'react';
import { 
  Menu, 
  Bell, 
  Check, 
  ExternalLink, 
  Clock, 
  ShieldCheck, 
  Sun,
  Moon,
  Palette,
} from 'lucide-react';
import { NavigationTab, Notificacao, ColorSkin } from '../../types';
import { DatabaseService } from '../../services/db';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme, SKINS_CONFIG } from '../../contexts/ThemeContext';
import { GezinhoLogo } from '../common/GezinhoLogo';

interface NavbarProps {
  currentTab: NavigationTab;
  onOpenMobileMenu: () => void;
  onOpenStudyTimer?: () => void;
  onNavigateTab: (tab: NavigationTab) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onOpenMobileMenu,
  onNavigateTab,
}) => {
  const { user } = useAuth();
  const { effectiveTheme, setTheme, colorSkin, setColorSkin, palette } = useTheme();
  const [notifications, setNotifications] = useState<Notificacao[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  useEffect(() => {
    DatabaseService.getNotificacoes().then(setNotifications);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = async (id: string) => {
    const updated = await DatabaseService.markNotificationAsRead(id);
    setNotifications(updated);
  };

  const handleMarkAllRead = async () => {
    const updated = await DatabaseService.markAllNotificationsAsRead();
    setNotifications(updated);
  };

  const titles: Record<NavigationTab, { title: string; subtitle: string }> = {
    dashboard: { title: 'Painel Geral de Estudos', subtitle: 'Acompanhe seu ritmo, metas e próximas revisões' },
    sessao: { title: 'Próximo Estudo & Cronômetro', subtitle: 'Execução de estudo em foco, horas líquidas, registro de questões e histórico' },
    concursos: { title: 'Concursos, Cargos & Provas', subtitle: 'Certames acompanhados, cargos pretendidos e cadernos anteriores' },
    plano: { title: 'Plano de Estudos & Cronograma', subtitle: 'Balanceamento multi-fatorial, detecção de conflitos e gestão de rotina' },
    ciclo: { title: 'Ciclo de Estudos Dinâmico', subtitle: 'Esteira giratória flexível de alto rendimento proporcional por peso' },
    cronograma: { title: 'Cronograma Fixo de Estudos', subtitle: 'Grade semanal e calendário executível balanceado' },
    estudos: { title: 'Edital Verticalizado & Disciplinas', subtitle: 'Concurso > Cargo > Disciplina > Tópico > Subtópico com progresso detalhado' },
    revisoes: { title: 'Revisões Espaçadas', subtitle: 'Curva de esquecimento e repetição sistemática (24h, 7d, 30d)' },
    flashcards: { title: 'Flashcards & Repetição Espaçada', subtitle: 'Domine conceitos-chave com memorização ativa e revisões inteligentes' },
    questoes: { title: 'Banco de Questões', subtitle: 'Treino intensivo com gabaritos fundamentados e estatísticas' },
    caderno_erros: { title: 'Caderno de Erros & Reincidências', subtitle: 'Diagnóstico de falhas, pontos de atenção e consolidação de aprendizado' },
    metas: { title: 'Metas & Desempenho', subtitle: 'Horas líquidas, percentuais de acerto e evolução semanal' },
    analytics: { title: 'Estatísticas & Relatórios', subtitle: 'Métricas completas, horas, acertos, desempenho por disciplina e exportação' },
    ai_assistant: { title: 'Assistente Inteligente (Gemini)', subtitle: 'Diagnóstico e orientações baseadas em seus dados reais de estudo' },
    simulados: { title: 'Simulados Cronometrados', subtitle: 'Simulações reais de prova para avaliação de ritmo' },
    planos_assinatura: { title: 'Planos & Assinatura (Gratuito, Teste, Mensal, Anual)', subtitle: 'Escolha o plano ideal para sua aprovação com recursos dedicados' },
    perfil: { title: 'Perfil & Configurações', subtitle: 'Ajustes de conta, rotina de estudo e preferências' },
    admin: { title: 'Área Administrativa Global (RBAC)', subtitle: 'Gestão de usuários, bloqueio de contas, concursos, editais, disciplinas, planos e logs' },
  };

  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80 px-4 sm:px-6 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Abrir menu lateral"
          >
            <Menu className="w-5 h-5" />
          </button>
          <GezinhoLogo size={28} className="lg:hidden drop-shadow-xs" />
          <div>
            <h1 className="text-base sm:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              {titles[currentTab]?.title || 'Gabarita'}
            </h1>
            <p className="hidden md:block text-xs text-slate-500 dark:text-slate-400">
              {titles[currentTab]?.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Botão de Alternância de Modo Claro / Escuro (Sun / Moon) */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-xs">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                effectiveTheme === 'light'
                  ? 'bg-white dark:bg-slate-700 text-amber-500 shadow-xs ring-1 ring-slate-200/50'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
              title="Ativar Modo Claro (Light Mode)"
              aria-label="Ativar Modo Claro"
            >
              <Sun className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                effectiveTheme === 'dark'
                  ? 'bg-slate-700 theme-mode-active shadow-xs ring-1 ring-slate-600'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
              title="Ativar Modo Escuro (Dark Mode)"
              aria-label="Ativar Modo Escuro"
            >
              <Moon className="w-4 h-4 theme-moon-icon" />
            </button>
          </div>

          {/* Seletor de Temas Visuais (Skins: Verde, Azul, Rosa) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/70 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-all cursor-pointer text-xs font-semibold shadow-xs"
              title="Escolher Tema Visual (Skins)"
              aria-label="Escolher Tema Visual"
            >
              <Palette className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <span
                className="w-2.5 h-2.5 rounded-full ring-1 ring-white dark:ring-slate-900"
                style={{ backgroundColor: palette.primary }}
              />
              <span className="hidden md:inline text-xs font-bold text-slate-700 dark:text-slate-300">
                {palette.shortLabel}
              </span>
            </button>

            {showThemeMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowThemeMenu(false)} 
                />
                <div className="absolute right-0 mt-2 w-64 p-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 space-y-1.5">
                  <div className="px-2.5 py-2 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                        Temas Visuais (Skins)
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">
                        Personalize cores e gráficos
                      </p>
                    </div>
                    <Palette className="w-4 h-4 text-slate-400" />
                  </div>

                  {(['verde', 'azul', 'rosa', 'roxo', 'laranja'] as ColorSkin[]).map((skinKey) => {
                    const skin = SKINS_CONFIG[skinKey];
                    const isSelected = colorSkin === skinKey || 
                      (skinKey === 'laranja' && (colorSkin === 'orange' || colorSkin === 'dbz')) ||
                      (skinKey === 'roxo' && colorSkin === 'purple');
                    return (
                      <button
                        key={skinKey}
                        onClick={() => {
                          setColorSkin(skinKey);
                          setShowThemeMenu(false);
                        }}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-slate-100 dark:bg-slate-800/90 ring-1 ring-slate-300 dark:ring-slate-700'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-4 h-4 rounded-full shadow-xs shrink-0 flex items-center justify-center text-white"
                            style={{ backgroundColor: skin.primary }}
                          >
                            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {skin.name}
                            </div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">
                              {skin.description}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: skin.primary }} />
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: skin.secondary }} />
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: skin.accent }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Notificações"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
              )}
            </button>

            {showNotifications && (
              <>
                <div 
                  className="fixed inset-0 z-40"
                  onClick={() => setShowNotifications(false)}
                />
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-4 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-slate-100">Notificações</span>
                      {unreadCount > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
                          {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium cursor-pointer"
                      >
                        Marcar lidas
                      </button>
                    )}
                  </div>
                  <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800/60 max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-center py-6 text-xs text-slate-400">Nenhuma notificação no momento.</p>
                    ) : (
                      notifications.map(notif => (
                        <div 
                          key={notif.id}
                          className={`py-2.5 px-2 rounded-lg transition-colors flex items-start gap-2.5 ${
                            notif.read ? 'opacity-70' : 'bg-emerald-50/40 dark:bg-emerald-950/20'
                          }`}
                        >
                          <div className="mt-0.5 shrink-0">
                            {notif.type === 'revisao' ? (
                              <Clock className="w-4 h-4 text-emerald-500" />
                            ) : notif.type === 'meta' ? (
                              <Check className="w-4 h-4 text-amber-500" />
                            ) : (
                              <ShieldCheck className="w-4 h-4 text-sky-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                                {notif.title}
                              </h4>
                              {!notif.read && (
                                <button
                                  onClick={() => handleMarkAsRead(notif.id)}
                                  className="text-[10px] text-slate-400 hover:text-emerald-500"
                                  title="Marcar como lida"
                                >
                                  OK
                                </button>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2">
                              {notif.message}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => onNavigateTab('perfil')}
            className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <img
              src={user?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=120'}
              alt={user?.name || 'Usuário'}
              className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700"
            />
          </button>
        </div>
      </div>
    </header>
  );
};
