import React, { useState } from 'react';
import { 
  User, 
  Mail, 
  Clock, 
  Target, 
  Bell, 
  Shield, 
  Palette, 
  Save, 
  CheckCircle2, 
  LogOut, 
  Sparkles, 
  Database,
  Download,
  Trash2,
  AlertTriangle,
  FileText,
  Camera
} from 'lucide-react';
import { UserProfile, Concurso } from '../../types';
import { Card, CardHeader, CardBody } from '../../design-system/Card';
import { Button } from '../../design-system/Button';
import { Input } from '../../design-system/Input';
import { Badge } from '../../design-system/Badge';
import { ThemeToggle } from '../../design-system/ThemeToggle';
import { Modal } from '../../design-system/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { DatabaseService } from '../../services/db';
import { isFirebaseInitialized } from '../../services/firebase';
import { PrivacyPolicyModal } from '../privacy/PrivacyPolicyModal';
import { ProfilePhotoModal } from './ProfilePhotoModal';

interface PerfilViewProps {
  user: UserProfile;
  concursos: Concurso[];
  onUpdateProfile: (updated: Partial<UserProfile>) => Promise<void>;
}

export const PerfilView: React.FC<PerfilViewProps> = ({
  user,
  concursos,
  onUpdateProfile,
}) => {
  const { logout, deleteAccount } = useAuth();

  const MOCK_AVATARS = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=250',
    'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=250',
    'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&q=80&w=250',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=250',
  ];

  const [currentPhotoURL, setCurrentPhotoURL] = useState(
    user.photoURL || MOCK_AVATARS[0]
  );
  const [photoFeedback, setPhotoFeedback] = useState<string | null>(null);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  const handlePhotoSelected = (photoUrl: string) => {
    setCurrentPhotoURL(photoUrl);
    onUpdateProfile({ photoURL: photoUrl });
    setPhotoFeedback('Foto de perfil atualizada com sucesso!');
    setTimeout(() => setPhotoFeedback(null), 3500);
  };

  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio || '');
  const [studyHoursPerDay, setStudyHoursPerDay] = useState(String(user.studyHoursPerDay || 4));
  const [targetConcursoId, setTargetConcursoId] = useState(user.targetConcursoId || '');
  const [pomodoroWork, setPomodoroWork] = useState(String(user.preferences?.pomodoroWorkMin || 50));
  const [pomodoroBreak, setPomodoroBreak] = useState(String(user.preferences?.pomodoroBreakMin || 10));
  const [notificationsEnabled, setNotificationsEnabled] = useState(user.preferences?.notificationsEnabled ?? true);
  const [emailAlerts, setEmailAlerts] = useState(user.preferences?.emailAlerts ?? true);
  
  const [notifPrefs, setNotifPrefs] = useState(user.preferences?.notificationPreferences || {
    inApp: {
      estudoProgramado: true,
      revisao: true,
      meta: true,
      simulado: true,
      provaProxima: true,
      sessaoAtrasada: true,
      conquistas: true,
    },
    push: {
      estudoProgramado: false,
      revisao: true,
      meta: false,
      simulado: true,
      provaProxima: true,
      sessaoAtrasada: true,
      conquistas: false,
    }
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const selectedConcurso = concursos.find(c => c.id === targetConcursoId);
      await onUpdateProfile({
        name,
        bio,
        photoURL: currentPhotoURL,
        studyHoursPerDay: parseFloat(studyHoursPerDay) || 4,
        targetConcursoId: targetConcursoId || undefined,
        targetConcursoTitle: selectedConcurso ? selectedConcurso.title : user.targetConcursoTitle,
        preferences: {
          ...user.preferences,
          pomodoroWorkMin: parseInt(pomodoroWork, 10) || 50,
          pomodoroBreakMin: parseInt(pomodoroBreak, 10) || 10,
          notificationsEnabled,
          emailAlerts,
          notificationPreferences: notifPrefs,
        },
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (e) {
      console.error('Erro ao atualizar perfil', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const jsonStr = await DatabaseService.exportUserData(user.id);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gabarita_dados_usuario_${user.id}_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Erro ao exportar dados:', e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccountConfirm = async () => {
    try {
      await deleteAccount();
    } catch (e) {
      console.error('Erro ao excluir conta:', e);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <Card>
        <CardBody className="p-6 flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Foto de Perfil Interativa com Efeito Hover e Abertura do Modal de Câmera/Galeria */}
          <div className="relative group shrink-0">
            <button
              type="button"
              onClick={() => setIsPhotoModalOpen(true)}
              className="relative block rounded-2xl overflow-hidden focus:outline-none focus:ring-4 focus:ring-emerald-500/40 cursor-pointer shadow-md transition-all group-hover:scale-105"
              title="Clique para alterar a foto de perfil"
              aria-label="Alterar foto de perfil"
            >
              <img
                src={currentPhotoURL}
                alt={user.name}
                className="w-24 h-24 object-cover border-2 border-emerald-500 group-hover:brightness-75 transition-all duration-200"
              />
              {/* Overlay sutil ao passar o mouse ou focar */}
              <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
                <Camera className="w-6 h-6 stroke-[2.2] animate-bounce" />
                <span className="text-[10px] font-bold mt-1 tracking-tight">Alterar foto</span>
              </div>
            </button>

            {/* Ícone de câmera sobreposto fixo no canto inferior */}
            <button
              type="button"
              onClick={() => setIsPhotoModalOpen(true)}
              className="absolute -bottom-1 -right-1 p-2 rounded-xl bg-emerald-500 text-white shadow-lg border-2 border-white dark:border-slate-900 group-hover:bg-emerald-600 transition-all cursor-pointer hover:scale-110"
              title="Alterar foto de perfil"
              aria-label="Alterar foto de perfil"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>

            {photoFeedback && (
              <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] bg-emerald-900/90 text-emerald-200 px-2 py-0.5 rounded-md font-medium shadow-md animate-fade-in z-20">
                {photoFeedback}
              </span>
            )}
          </div>
          <div className="flex-1 text-center sm:text-left space-y-1.5">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                {user.name}
              </h2>
              <Badge variant="emerald" size="sm">
                Nível {user.level} Concurseiro
              </Badge>
              <Badge variant="purple" size="sm">
                {user.role?.toUpperCase()}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {user.email}
            </p>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 italic pt-1">
              "{user.bio || 'Focado na aprovação constante e disciplina diária.'}"
            </p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 pt-2 text-xs text-slate-500 dark:text-slate-400 font-semibold">
              <span>🔥 {user.streakDays} dias de sequência</span>
              <span>⚡ {user.xp} XP totais</span>
              <span>🎯 {user.targetConcursoTitle || 'Plano Personalizado'}</span>
            </div>
          </div>
        </CardBody>
      </Card>

      <form onSubmit={handleSave} className="space-y-6">
        {saveSuccess && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>Perfil e preferências atualizados com sucesso!</span>
          </div>
        )}

        <Card>
          <CardHeader
            title="Dados do Concurseiro"
            subtitle="Suas informações principais de identificação e rotina"
          />
          <CardBody className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Nome de Exibição"
                value={name}
                onChange={(e) => setName(e.target.value)}
                leftIcon={<User className="w-4 h-4" />}
                required
              />
              <Input
                label="E-mail Cadastrado"
                value={user.email}
                disabled
                leftIcon={<Mail className="w-4 h-4" />}
                helperText="O e-mail é vinculado ao seu login e não pode ser alterado diretamente."
              />
            </div>
            <Input
              label="Bio / Lema de Estudo"
              placeholder="Ex: Não pare até ser nomeado."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Concurso-Alvo Principal
                </label>
                <select
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm px-3.5 py-2.5"
                  value={targetConcursoId}
                  onChange={(e) => setTargetConcursoId(e.target.value)}
                >
                  <option value="">Selecione seu concurso foco...</option>
                  {concursos.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({c.banca})
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Meta de Horas Líquidas Diárias"
                type="number"
                step="0.5"
                value={studyHoursPerDay}
                onChange={(e) => setStudyHoursPerDay(e.target.value)}
                leftIcon={<Clock className="w-4 h-4" />}
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Configurações de Foco (Pomodoro)"
            subtitle="Ajuste os blocos de estudo profundo e descanso"
          />
          <CardBody className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Tempo de Foco (Minutos)"
                type="number"
                value={pomodoroWork}
                onChange={(e) => setPomodoroWork(e.target.value)}
              />
              <Input
                label="Descanso Curto (Minutos)"
                type="number"
                value={pomodoroBreak}
                onChange={(e) => setPomodoroBreak(e.target.value)}
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Aparência & Tema"
            subtitle="Escolha entre o modo escuro, claro ou automático do sistema"
          />
          <CardBody className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Tema da Interface
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                O modo escuro reduz a fadiga visual durante longas sessões de leitura.
              </p>
            </div>
            <ThemeToggle />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Privacidade, LGPD & Dados do Usuário"
            subtitle="Exportação completa de dados e termos de privacidade"
          />
          <CardBody className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-emerald-500" />
                <div>
                  <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                    Política de Privacidade & Termos de Uso
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Consulte como seus dados de estudo são isolados e protegidos.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsPrivacyModalOpen(true)}
              >
                Ver Política
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/60">
              <div className="flex items-center gap-3">
                <Download className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                    Exportar Meus Dados (Backup JSON)
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Baixe uma cópia completa de todo o seu histórico de estudos, questões e plano.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                isLoading={isExporting}
                onClick={handleExportData}
                leftIcon={<Download className="w-3.5 h-3.5" />}
              >
                Exportar JSON
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Infraestrutura & Armazenamento"
            subtitle="Status da conexão de dados do Gabarita"
          />
          <CardBody className="p-6 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-500" />
              <div>
                <p className="font-bold text-slate-900 dark:text-slate-100">
                  {isFirebaseInitialized ? 'Firebase Firestore & Auth Ativo (Isolamento por Usuário)' : 'Armazenamento Local Persistente (Offline/Web)'}
                </p>
                <p className="text-slate-500">
                  {isFirebaseInitialized 
                    ? 'Dados sincronizados em nuvem com regras de segurança ativas.'
                    : 'Dados persistidos localmente no navegador sem perda de progresso.'}
                </p>
              </div>
            </div>
            <Badge variant={isFirebaseInitialized ? 'emerald' : 'sky'} size="sm">
              {isFirebaseInitialized ? 'Online Cloud' : 'Local Storage'}
            </Badge>
          </CardBody>
        </Card>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={logout}
              className="w-full sm:w-auto text-slate-600 dark:text-slate-300"
              leftIcon={<LogOut className="w-4 h-4" />}
            >
              Sair da Conta
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => setIsDeleteModalOpen(true)}
              className="w-full sm:w-auto text-rose-600 hover:border-rose-400 dark:text-rose-400"
              leftIcon={<Trash2 className="w-4 h-4" />}
            >
              Excluir Conta
            </Button>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSaving}
            className="w-full sm:w-auto"
            leftIcon={<Save className="w-4 h-4" />}
          >
            Salvar Alterações
          </Button>
        </div>
      </form>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Excluir Conta Permanentemente"
        description="Esta ação é irreversível e removerá todos os seus dados de estudo."
        maxWidth="sm"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200 rounded-xl flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
            <span>Todos os seus registros de estudo, simulados e plano serão apagados definitivamente.</span>
          </div>
          <p className="text-slate-600 dark:text-slate-300">
            Tem certeza de que deseja prosseguir com a exclusão de sua conta?
          </p>
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDeleteAccountConfirm}
            >
              Sim, Excluir Conta
            </Button>
          </div>
        </div>
      </Modal>

      <PrivacyPolicyModal isOpen={isPrivacyModalOpen} onClose={() => setIsPrivacyModalOpen(false)} />

      {/* Modal de Alteração Real da Foto de Perfil (Câmera ou Galeria) */}
      <ProfilePhotoModal
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        onPhotoSelected={handlePhotoSelected}
      />
    </div>
  );
};
