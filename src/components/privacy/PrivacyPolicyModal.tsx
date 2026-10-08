import React from 'react';
import { ShieldCheck, Lock, Eye, FileText, CheckCircle2 } from 'lucide-react';
import { Modal } from '../../design-system/Modal';
import { Button } from '../../design-system/Button';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Política de Privacidade & Termos de Uso"
      description="Compromisso do Gabarita com a segurança, anonimização e isolamento dos seus dados de estudo."
      maxWidth="lg"
    >
      <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300 max-h-96 overflow-y-auto pr-2 leading-relaxed">
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
          <span>Seus dados de estudo, questões resolvidas e simulados são estritamente isolados e privados para o seu usuário.</span>
        </div>

        <div className="space-y-2">
          <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-indigo-500" /> 1. Isolamento de Dados e Segurança
          </h4>
          <p>
            O Gabarita opera sob estritos princípios de privacidade. O armazenamento local e em nuvem (Firestore) garante que suas informações de desempenho, notas, caderno de erros e planejamento sejam acessíveis apenas por você.
          </p>
        </div>

        <div className="space-y-2">
          <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <Eye className="w-4 h-4 text-sky-500" /> 2. Uso de Inteligência Artificial (Gemini)
          </h4>
          <p>
            Ao utilizar o Assistente Inteligente ou o Importador de Editais por IA, apenas os dados agregados necessários para o diagnóstico acadêmico são transmitidos de forma segura e criptografada para o modelo Gemini, sem exposição de credenciais ou senhas.
          </p>
        </div>

        <div className="space-y-2">
          <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-amber-500" /> 3. Seus Direitos (LGPD)
          </h4>
          <p>
            Você tem direito total de acesso, exportação completa (formato JSON) e exclusão permanente de sua conta e dados a qualquer momento através da aba de Perfil & Ajustes.
          </p>
        </div>

        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <Button variant="primary" size="sm" onClick={onClose} leftIcon={<CheckCircle2 className="w-4 h-4" />}>
            Compreendido & Fechar
          </Button>
        </div>
      </div>
    </Modal>
  );
};
