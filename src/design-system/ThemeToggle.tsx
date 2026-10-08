import React from 'react';
import { Sun, Moon, Laptop } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export const ThemeToggle: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { theme, setTheme } = useTheme();

  if (compact) {
    return (
      <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700/60">
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={`p-1.5 rounded-md transition-all ${
            theme === 'light'
              ? 'bg-white dark:bg-slate-700 text-amber-500 shadow-xs'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
          }`}
          title="Tema Claro"
        >
          <Sun className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={`p-1.5 rounded-md transition-all ${
            theme === 'dark'
              ? 'bg-slate-700 text-[var(--primary-color)] dark:text-[var(--primary-text-dark)] shadow-xs'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
          }`}
          title="Tema Escuro"
        >
          <Moon className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setTheme('system')}
          className={`p-1.5 rounded-md transition-all ${
            theme === 'system'
              ? 'bg-white dark:bg-slate-700 text-sky-500 shadow-xs'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
          }`}
          title="Tema do Sistema"
        >
          <Laptop className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 p-1 bg-slate-100/80 dark:bg-slate-900/80">
      <button
        onClick={() => setTheme('light')}
        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
          theme === 'light'
            ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
            : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
        }`}
      >
        <Sun className="w-3.5 h-3.5 text-amber-500" />
        <span>Claro</span>
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
          theme === 'dark'
            ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
            : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
        }`}
      >
        <Moon className="w-3.5 h-3.5 text-[var(--primary-color)] dark:text-[var(--primary-text-dark)]" />
        <span>Escuro</span>
      </button>
      <button
        onClick={() => setTheme('system')}
        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
          theme === 'system'
            ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
            : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
        }`}
      >
        <Laptop className="w-3.5 h-3.5 text-sky-400" />
        <span>Sistema</span>
      </button>
    </div>
  );
};
