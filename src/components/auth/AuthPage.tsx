import React, { useState } from 'react';
import { 
  Lock, 
  Mail, 
  User, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles, 
  BookOpen, 
  Scale, 
  Award, 
  AlertCircle 
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../design-system/Button';
import { Input } from '../../design-system/Input';
import { Card, CardBody } from '../../design-system/Card';
import { PrivacyPolicyModal } from '../privacy/PrivacyPolicyModal';
import { GezinhoLogo } from '../common/GezinhoLogo';

type AuthMode = 'login' | 'register' | 'forgot_password';

export const AuthPage: React.FC = () => {
  const { loginWithEmail, registerWithEmail, loginWithGoogle, resetPassword } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consentGiven, setConsentGiven] = useState(true);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email || (!password && mode !== 'forgot_password')) {
      setErrorMsg('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (mode === 'register' && !consentGiven) {
      setErrorMsg('Você deve concordar com a Política de Privacidade e Termos de Uso para criar uma conta.');
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
      } else if (mode === 'register') {
        if (!name.trim()) {
          setErrorMsg('Informe o seu nome completo.');
          setIsLoading(false);
          return;
        }
        if (password.length < 6) {
          setErrorMsg('A senha deve conter no mínimo 6 caracteres.');
          setIsLoading(false);
          return;
        }
        await registerWithEmail(name, email, password, consentGiven);
      } else if (mode === 'forgot_password') {
        await resetPassword(email);
        setSuccessMsg(`Instruções de redefinição de senha enviadas para ${email}!`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ocorreu um erro na autenticação.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setIsLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao autenticar com conta Google.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setIsLoading(true);
    try {
      await loginWithEmail('concurseiro@gabarita.com', '123456');
    } catch (e) {
      console.warn('Erro ao entrar como demo', e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-emerald-500 selection:text-white">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="w-full max-w-md z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-3">
            <GezinhoLogo size={64} className="drop-shadow-2xl" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
            Gabarita
            <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Concursos
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
            Plataforma de alta performance para concurseiros: planejamento, questões, simulados e repetição espaçada.
          </p>
        </div>

        <Card variant="glass" className="bg-slate-900/90 border-slate-800 backdrop-blur-xl shadow-2xl">
          <CardBody className="p-6 sm:p-8">
            <div className="flex border-b border-slate-800 pb-3 mb-6 gap-6 justify-center text-sm font-semibold">
              <button
                type="button"
                onClick={() => { setMode('login'); setErrorMsg(null); setSuccessMsg(null); }}
                className={`pb-2 transition-colors cursor-pointer border-b-2 ${
                  mode === 'login' 
                    ? 'border-emerald-500 text-emerald-400' 
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => { setMode('register'); setErrorMsg(null); setSuccessMsg(null); }}
                className={`pb-2 transition-colors cursor-pointer border-b-2 ${
                  mode === 'register' 
                    ? 'border-emerald-500 text-emerald-400' 
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Criar Conta
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <Input
                    label="Nome Completo"
                    placeholder="Ex: Carlos Eduardo Silveira"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    leftIcon={<User className="w-4 h-4" />}
                    required
                  />
                </div>
              )}

              <div>
                <Input
                  label="E-mail do Concurseiro"
                  type="email"
                  placeholder="seu.email@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  leftIcon={<Mail className="w-4 h-4" />}
                  required
                />
              </div>

              {mode !== 'forgot_password' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-slate-300">
                      Senha
                    </label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => { setMode('forgot_password'); setErrorMsg(null); setSuccessMsg(null); }}
                        className="text-xs text-emerald-400 hover:underline cursor-pointer"
                      >
                        Esqueceu a senha?
                      </button>
                    )}
                  </div>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    leftIcon={<Lock className="w-4 h-4" />}
                    required
                  />
                </div>
              )}

              {mode === 'register' && (
                <div className="flex items-start gap-2 pt-1 text-xs">
                  <input
                    type="checkbox"
                    id="consent"
                    checked={consentGiven}
                    onChange={(e) => setConsentGiven(e.target.checked)}
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-700 cursor-pointer"
                  />
                  <label htmlFor="consent" className="text-slate-400 select-none cursor-pointer">
                    Concordo com a{' '}
                    <button
                      type="button"
                      onClick={() => setIsPrivacyModalOpen(true)}
                      className="text-emerald-400 underline hover:text-emerald-300"
                    >
                      Política de Privacidade & Termos de Uso
                    </button>{' '}
                    e autorizo o isolamento seguro dos meus dados.
                  </label>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isLoading}
                className="w-full mt-2"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                {mode === 'login' ? 'Acessar Plataforma' : mode === 'register' ? 'Começar Meus Estudos' : 'Enviar Link de Redefinição'}
              </Button>
            </form>

            {mode === 'forgot_password' && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-xs text-slate-400 hover:text-emerald-400 underline cursor-pointer"
                >
                  Voltar para o Login
                </button>
              </div>
            )}

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-900 px-3 text-slate-500 font-medium">
                  Ou continue com
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={handleGoogleLogin}
              isLoading={isLoading}
              className="w-full border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-200"
              leftIcon={
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.5.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.1s.7 5.4 1.9 7.8l3.7-2.9z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16.5C3.7 20.2 7.5 23.5 12 23.5z"
                  />
                </svg>
              }
            >
              Entrar com Google
            </Button>

            <div className="mt-4 pt-4 border-t border-slate-800/80 text-center">
              <button
                type="button"
                onClick={handleDemoLogin}
                className="text-xs text-slate-400 hover:text-emerald-400 transition-colors inline-flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Testar como Estudante Demo (Acesso Rápido)</span>
              </button>
            </div>
          </CardBody>
        </Card>
      </div>

      <PrivacyPolicyModal isOpen={isPrivacyModalOpen} onClose={() => setIsPrivacyModalOpen(false)} />
    </div>
  );
};
