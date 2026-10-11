import React, { useState } from 'react';
import { SessaoEstudo, Disciplina } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';

interface StudyChartsProps {
  sessoes: SessaoEstudo[];
  disciplinas: Disciplina[];
}

export const StudyCharts: React.FC<StudyChartsProps> = ({ sessoes, disciplinas }) => {
  const { palette, colorSkin } = useTheme();
  const [activeTab, setActiveTab] = useState<'semanal' | 'disciplinas'>('semanal');

  const last7DaysData = React.useMemo(() => {
    const days: { dateStr: string; label: string; hours: number; questions: number; correct: number }[] = [];
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split('T')[0];
      const dayLabel = dayNames[d.getDay()];

      const daySessoes = sessoes.filter(s => {
        const sDate = s.completedAt ? s.completedAt.split('T')[0] : s.createdAt.split('T')[0];
        return sDate === dateKey;
      });
      const totalMinutes = daySessoes.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
      const totalQuestions = daySessoes.reduce((acc, s) => acc + (s.questionsAttempted || 0), 0);
      const totalCorrect = daySessoes.reduce((acc, s) => acc + (s.questionsCorrect || 0), 0);
      days.push({
        dateStr: dateKey,
        label: i === 0 ? 'Hoje' : dayLabel,
        hours: parseFloat((totalMinutes / 60).toFixed(1)),
        questions: totalQuestions,
        correct: totalCorrect,
      });
    }
    return days;
  }, [sessoes]);

  const maxHours = Math.max(4, ...last7DaysData.map(d => d.hours));

  const discStats = React.useMemo(() => {
    const totalMinutes = disciplinas.reduce((acc, d) => acc + (d.totalStudyMinutes || 0), 0) || 1;
    return disciplinas.map(d => {
      const percent = Math.round(((d.totalStudyMinutes || 0) / totalMinutes) * 100);
      return {
        ...d,
        percent,
        hours: ((d.totalStudyMinutes || 0) / 60).toFixed(1),
      };
    }).sort((a, b) => (b.totalStudyMinutes || 0) - (a.totalStudyMinutes || 0));
  }, [disciplinas]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('semanal')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'semanal'
                ? 'theme-btn-primary shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            Horas nos Últimos 7 Dias
          </button>
          <button
            onClick={() => setActiveTab('disciplinas')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'disciplinas'
                ? 'theme-btn-primary shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            Distribuição por Disciplina
          </button>
        </div>
      </div>

      {activeTab === 'semanal' ? (
        <div className="space-y-4">
          <div className="flex items-end justify-between gap-2 h-44 pt-6 pb-2 px-2">
            {last7DaysData.map((day, idx) => {
              const heightPercent = Math.min(100, Math.max(10, Math.round((day.hours / maxHours) * 100)));
              const isToday = day.label === 'Hoje';
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -translate-y-28 bg-slate-900 text-white text-[10px] rounded-lg py-1 px-2 pointer-events-none shadow-md border border-slate-800 z-20 text-center whitespace-nowrap">
                    <p className="font-bold">{day.hours}h líquidas</p>
                    <p className="theme-primary-text font-bold">{day.questions} questões ({day.correct} acertos)</p>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    {day.hours > 0 ? `${day.hours}h` : ''}
                  </span>
                  <div className="w-full max-w-9 bg-slate-100 dark:bg-slate-800 rounded-t-lg h-32 flex items-end overflow-hidden p-0.5">
                    <div
                      className={`w-full rounded-t-md transition-all duration-500 ${
                        isToday 
                          ? (colorSkin === 'roxo' || colorSkin === 'purple')
                            ? 'bg-gradient-to-t from-[#6D28D9] to-[#C4B5FD] shadow-sm'
                            : (colorSkin === 'laranja' || colorSkin === 'orange' || colorSkin === 'dbz')
                              ? 'bg-gradient-to-t from-[#D83100] to-[#FFCC00] shadow-sm'
                              : (colorSkin === 'azul')
                                ? 'bg-gradient-to-t from-[#1d4ed8] to-[#60a5fa] shadow-sm'
                                : (colorSkin === 'rosa')
                                  ? 'bg-gradient-to-t from-[#be185d] to-[#f472b6] shadow-sm'
                                  : 'bg-gradient-to-t from-emerald-600 to-teal-400 shadow-sm'
                          : (colorSkin === 'azul')
                            ? 'bg-gradient-to-t from-blue-700/80 to-blue-500/80'
                            : (colorSkin === 'rosa')
                              ? 'bg-gradient-to-t from-pink-700/80 to-pink-500/80'
                              : (colorSkin === 'roxo' || colorSkin === 'purple')
                                ? 'bg-gradient-to-t from-[#5B21B6]/85 to-[#8B5CF6]/85'
                                : (colorSkin === 'laranja' || colorSkin === 'orange' || colorSkin === 'dbz')
                                  ? 'bg-gradient-to-t from-[#C2410C]/85 to-[#FF8533]/85'
                                  : 'bg-gradient-to-t from-emerald-700/80 to-emerald-500/80'
                      }`}
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>
                  <span className={`text-[11px] font-semibold ${
                    isToday ? 'theme-primary-text font-bold' : 'text-slate-500 dark:text-slate-400'
                  }`}>
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Média da semana: {(last7DaysData.reduce((acc, d) => acc + d.hours, 0) / 7).toFixed(1)}h/dia</span>
            <div className="px-3 py-1 rounded-full text-xs font-bold border shadow-sm transition-all bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700">
              Total: {last7DaysData.reduce((acc, d) => acc + d.hours, 0).toFixed(1)}h • {last7DaysData.reduce((acc, d) => acc + d.questions, 0)} questões
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3 pt-2">
          {discStats.map(disc => (
            <div key={disc.id} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: disc.color }} />
                  {disc.name}
                </span>
                <span className="text-slate-500 dark:text-slate-400 font-mono">
                  {disc.hours}h ({disc.percent}%)
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${disc.percent}%`,
                    backgroundColor: disc.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
