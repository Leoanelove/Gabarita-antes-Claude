import React, { useState, useRef, useEffect } from 'react';
import { Camera, Image as ImageIcon, X, RefreshCw, AlertCircle, Check } from 'lucide-react';
import { Modal } from '../../design-system/Modal';
import { Button } from '../../design-system/Button';

interface ProfilePhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPhotoSelected: (photoUrl: string) => void;
}

export const ProfilePhotoModal: React.FC<ProfilePhotoModalProps> = ({
  isOpen,
  onClose,
  onPhotoSelected,
}) => {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parar a câmera e limpar stream
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsStreaming(false);
    setCameraError(null);
  };

  // Limpeza ao fechar o modal
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
    }
  }, [isOpen]);

  // Iniciar a câmera nativa do navegador
  const startCamera = async () => {
    setIsCameraActive(true);
    setCameraError(null);
    setIsStreaming(false);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Câmera não suportada neste navegador.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 640 },
          facingMode: 'user',
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsStreaming(true);
        };
      }
    } catch (err: any) {
      console.warn('Erro ao acessar a câmera:', err);
      let message = 'Não foi possível acessar a câmera do dispositivo.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message = 'Permissão para usar a câmera foi negada. Permita o acesso nas configurações do navegador.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message = 'Nenhuma câmera foi encontrada no dispositivo.';
      }
      setCameraError(message);
    }
  };

  // Capturar o frame do vídeo e converter em imagem Base64
  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      const canvas = document.createElement('canvas');
      const width = video.videoWidth || 480;
      const height = video.videoHeight || 480;
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Espelhar horizontalmente para efeito natural de selfie
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      stopCamera();
      onPhotoSelected(dataUrl);
      onClose();
    } catch (e) {
      console.error('Erro ao capturar foto:', e);
      setCameraError('Ocorreu um erro ao processar a captura.');
    }
  };

  // Manipular upload de imagem da galeria/armazenamento
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        stopCamera();
        onPhotoSelected(result);
        onClose();
      };
      reader.readAsDataURL(file);
    }
    // Limpar o input para permitir selecionar o mesmo arquivo novamente se desejar
    e.target.value = '';
  };

  const handleOpenGallery = () => {
    fileInputRef.current?.click();
  };

  const handleModalClose = () => {
    stopCamera();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleModalClose}
      title="Alterar Foto de Perfil"
      description="Escolha como deseja atualizar sua foto de identificação."
      maxWidth="md"
    >
      {/* Input de arquivo nativo oculto */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileInputChange}
      />

      <div className="space-y-4 pt-2">
        {!isCameraActive ? (
          // Menu Principal de Opções
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Botão Tirar Foto (Câmera) */}
              <button
                type="button"
                onClick={startCamera}
                className="flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50 dark:bg-slate-800/40 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 transition-all cursor-pointer group text-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Camera className="w-7 h-7" />
                </div>
                <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Tirar Foto
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Usar a câmera do dispositivo
                </span>
              </button>

              {/* Botão Escolher da Galeria (Upload) */}
              <button
                type="button"
                onClick={handleOpenGallery}
                className="flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-800 hover:border-sky-500 dark:hover:border-sky-500 bg-slate-50 dark:bg-slate-800/40 hover:bg-sky-50/30 dark:hover:bg-sky-950/20 transition-all cursor-pointer group text-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <ImageIcon className="w-7 h-7" />
                </div>
                <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Escolher da Galeria
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Fazer upload de arquivo de imagem
                </span>
              </button>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={handleModalClose}
                size="md"
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          // Interface da Câmera em Tempo Real
          <div className="space-y-4">
            <div className="relative w-full aspect-square max-w-[340px] mx-auto rounded-2xl overflow-hidden bg-black border-2 border-emerald-500/50 shadow-inner flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />

              {!isStreaming && !cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-white gap-2 p-4 text-center">
                  <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
                  <span className="text-xs font-medium">Iniciando câmera...</span>
                </div>
              )}

              {cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 text-white gap-3 p-5 text-center">
                  <AlertCircle className="w-10 h-10 text-rose-500" />
                  <p className="text-xs text-rose-300 font-medium">{cameraError}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={startCamera}
                    leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                  >
                    Tentar Novamente
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={stopCamera}
                size="md"
              >
                Voltar
              </Button>

              <Button
                type="button"
                variant="primary"
                onClick={capturePhoto}
                disabled={!isStreaming}
                size="md"
                leftIcon={<Camera className="w-4 h-4 fill-current" />}
              >
                Capturar Foto
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
