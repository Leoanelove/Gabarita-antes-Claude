import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Bot, User, Loader2 } from 'lucide-react';
import { AIService } from '../../services/aiService';
import { Card, CardBody } from '../../design-system/Card';
import { Button } from '../../design-system/Button';
import { Badge } from '../../design-system/Badge';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export const AIAssistantView: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'msg_init',
      sender: 'assistant',
      text: '### 🤖 Olá! Sou o seu Assistente de Estudos Inteligente (Gemini)\n\nEstou conectado aos seus dados reais de estudo. Como posso te orientar hoje?',
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const quickPrompts = [
    'O que estudar hoje?',
    'Quais são minhas matérias atrasadas?',
    'Quais assuntos têm mais erros?',
    'Como está minha evolução semanal?',
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: Message = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, userMsg]);
    if (!queryText) setInputQuery('');
    setIsLoading(true);

    try {
      const response = await AIService.queryAssistant(textToSend);
      const aiMsg: Message = {
        id: `ai_${Date.now()}`,
        sender: 'assistant',
        text: response.reply,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch {
      setMessages(prev => [...prev, {
        id: `err_${Date.now()}`,
        sender: 'assistant',
        text: 'Desculpe, ocorreu um erro ao processar sua pergunta.',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto h-[calc(100vh-140px)] flex flex-col pb-6">
      <div className="flex items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-600 dark:text-indigo-400 fill-current" />
            Assistente Inteligente (Gemini)
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Diagnóstico baseado em seus dados reais de estudo.
          </p>
        </div>
        <Badge variant="purple" size="md">Modo Seguro</Badge>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 shrink-0">
        <span className="text-xs font-bold text-slate-400 whitespace-nowrap">Sugestões:</span>
        {quickPrompts.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(prompt)}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer"
          >
            {prompt}
          </button>
        ))}
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden border-2 border-indigo-100 dark:border-indigo-950 shadow-md">
        <CardBody className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${msg.sender === 'user' ? 'bg-indigo-600 text-white' : 'bg-gradient-to-br from-indigo-500 to-teal-500 text-white'}`}>
                {msg.sender === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
              </div>
              <div className={`max-w-[85%] rounded-2xl p-4 space-y-1 ${msg.sender === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-50 dark:bg-slate-800/80 border text-slate-900 dark:text-slate-100'}`}>
                <div className="flex items-center justify-between text-[10px] opacity-75">
                  <span className="font-bold">{msg.sender === 'user' ? 'Você' : 'Assistente IA'}</span>
                  <span>{msg.timestamp}</span>
                </div>
                <div className="text-xs sm:text-sm whitespace-pre-wrap">{msg.text}</div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500 text-white flex items-center justify-center">
                <Bot className="w-5 h-5 animate-pulse" />
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 border rounded-2xl p-4 flex items-center gap-2 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                <span>Analisando dados reais...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </CardBody>

        <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 border-t shrink-0">
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Digite sua pergunta..."
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              disabled={isLoading}
              className="flex-1 rounded-xl border bg-slate-50 dark:bg-slate-950 text-xs sm:text-sm px-4 py-3"
            />
            <Button type="submit" variant="primary" isLoading={isLoading} disabled={!inputQuery.trim()} rightIcon={<Send className="w-4 h-4" />}>
              Enviar
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
};
