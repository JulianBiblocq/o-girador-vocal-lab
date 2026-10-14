import React, { useState, useEffect, useCallback } from 'react';
import { Mic, RefreshCw, CheckCircle2 } from 'lucide-react';

interface DeviceSelectorProps {
  selectedDeviceId: string;
  onDeviceChange: (deviceId: string) => void;
  disabled?: boolean;
}

export const DeviceSelector: React.FC<DeviceSelectorProps> = ({
  selectedDeviceId,
  onDeviceChange,
  disabled = false,
}) => {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Découverte des vrais libellés matériels de la carte son sans contraintes bloquantes
  const requestPermissionAndEnumerate = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    setIsLoading(true);

    try {
      // 1. Demande de flux audio standard pour déverrouiller les labels matériels Windows
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // 2. Énumération des périphériques avec labels réels (Focusrite, Behringer, Realtek, etc.)
      const allDevices = await navigator.mediaDevices.enumerateDevices();

      // 3. Coupure immédiate et totale de toutes les pistes audio (zéro flux persistant au repos)
      tempStream.getTracks().forEach((track) => track.stop());

      const audioInputs = allDevices.filter((d) => d.kind === 'audioinput');
      setDevices(audioInputs);

      const hasRealLabels = audioInputs.some((d) => d.label && d.label.trim().length > 0);
      setHasPermission(hasRealLabels);

      // Si un périphérique est trouvé et aucun n'est encore sélectionné, sélectionner le premier
      if (audioInputs.length > 0) {
        const currentStillExists = audioInputs.some((d) => d.deviceId === selectedDeviceId);
        if (!selectedDeviceId || !currentStillExists) {
          onDeviceChange(audioInputs[0].deviceId);
        }
      }
    } catch (err) {
      console.warn('Autorisation microphone non accordée ou annulée :', err);
      // Fallback énumération
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = allDevices.filter((d) => d.kind === 'audioinput');
      setDevices(audioInputs);
    } finally {
      setIsLoading(false);
    }
  }, [onDeviceChange, selectedDeviceId]);

  // Énumération initiale passive & écoute du branchement de cartes son USB
  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;

    navigator.mediaDevices.enumerateDevices().then((allDevices) => {
      const audioInputs = allDevices.filter((d) => d.kind === 'audioinput');
      setDevices(audioInputs);
      if (audioInputs.some((d) => d.label && d.label.length > 0)) {
        setHasPermission(true);
      }
      if (audioInputs.length > 0 && !selectedDeviceId) {
        onDeviceChange(audioInputs[0].deviceId);
      }
    });

    const handleDeviceChange = () => {
      requestPermissionAndEnumerate();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [requestPermissionAndEnumerate, onDeviceChange, selectedDeviceId]);

  return (
    <div className="cordel-card p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-theme-ink">
          <Mic className="w-4 h-4 text-theme-accent" />
          <span>Entrée Carte Son / Micro</span>
          {hasPermission && (
            <span className="text-[10px] text-emerald-400 font-mono tracking-normal flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Connecté</span>
            </span>
          )}
        </label>
        <button
          type="button"
          onClick={requestPermissionAndEnumerate}
          disabled={disabled || isLoading}
          className="cordel-btn px-2 py-0.5 flex items-center gap-1.5 text-xs cursor-pointer"
          title="Détecter ou actualiser les entrées de la carte son externe"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{hasPermission ? 'Actualiser' : 'Autoriser Micro'}</span>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={selectedDeviceId}
          onChange={(e) => onDeviceChange(e.target.value)}
          onFocus={() => {
            if (!hasPermission) requestPermissionAndEnumerate();
          }}
          disabled={disabled || devices.length === 0}
          className="w-full bg-black/30 border-2 border-theme-border text-theme-ink text-xs p-2 rounded-none font-mono focus:outline-none focus:border-theme-accent cursor-pointer"
        >
          {devices.map((dev, idx) => (
            <option key={dev.deviceId || idx} value={dev.deviceId} className="bg-theme-bg text-theme-ink">
              {dev.label || `Entrée audio ${idx + 1}`}
            </option>
          ))}
          {devices.length === 0 && (
            <option value="">Cliquez sur « Autoriser Micro »</option>
          )}
        </select>
      </div>

      <p className="text-[10px] text-theme-ink/60 font-mono">
        Capture Pure Direct : zéro compression ni traitement destructif actif au repos.
      </p>
    </div>
  );
};
