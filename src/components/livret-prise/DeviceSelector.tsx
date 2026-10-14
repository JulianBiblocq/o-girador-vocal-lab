import React, { useState, useEffect, useCallback } from 'react';
import { Mic, RefreshCw } from 'lucide-react';

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

  // Énumération sécurisée avec coupure immédiate des pistes (Protection carte son)
  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    setIsLoading(true);

    try {
      // Demande éphémère pour libérer les libellés de périphériques
      const tempStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      // Coupure immédiate et absolue de toutes les pistes audio (zéro flux actif au repos)
      tempStream.getTracks().forEach((track) => track.stop());
      setHasPermission(true);

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = allDevices.filter((d) => d.kind === 'audioinput');
      setDevices(audioInputs);

      if (audioInputs.length > 0 && !selectedDeviceId) {
        onDeviceChange(audioInputs[0].deviceId);
      }
    } catch (err) {
      console.warn('Impossible d\'accéder aux entrées micro :', err);
      // Fallback si permission refusée
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      setDevices(allDevices.filter((d) => d.kind === 'audioinput'));
    } finally {
      setIsLoading(false);
    }
  }, [onDeviceChange, selectedDeviceId]);

  useEffect(() => {
    refreshDevices();
  }, [refreshDevices]);

  return (
    <div className="cordel-card p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-theme-ink">
          <Mic className="w-4 h-4 text-theme-accent" />
          <span>Entrée Micro (Pure Direct)</span>
          {hasPermission && (
            <span className="text-[10px] text-emerald-400 font-mono tracking-normal">
              ● Détecté
            </span>
          )}
        </label>
        <button
          type="button"
          onClick={refreshDevices}
          disabled={disabled || isLoading}
          className="cordel-btn p-1 flex items-center gap-1 text-xs"
          title="Rafraîchir les périphériques"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={selectedDeviceId}
          onChange={(e) => onDeviceChange(e.target.value)}
          disabled={disabled || devices.length === 0}
          className="w-full bg-black/30 border-2 border-theme-border text-theme-ink text-xs p-2 rounded-none font-mono focus:outline-none focus:border-theme-accent"
        >
          {devices.map((dev, idx) => (
            <option key={dev.deviceId || idx} value={dev.deviceId} className="bg-theme-bg text-theme-ink">
              {dev.label || `Microphone ${idx + 1}`}
            </option>
          ))}
          {devices.length === 0 && (
            <option value="">Aucun microphone détecté</option>
          )}
        </select>
      </div>

      <p className="text-[10px] text-theme-ink/60 font-mono">
        Filtres matériels désactivés (AGC/AEC off) pour un timbre acoustique fidèle.
      </p>
    </div>
  );
};
