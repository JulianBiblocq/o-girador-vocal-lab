/**
 * DeviceSelector.tsx
 * Sélecteur d'entrées et de sorties audio (Carte Son / Micro / Casque) avec flex-1.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Mic, Headphones, RefreshCw, CheckCircle2 } from 'lucide-react';

interface DeviceSelectorProps {
  selectedDeviceId: string;
  onDeviceChange: (deviceId: string) => void;
  selectedOutputDeviceId: string;
  onOutputDeviceChange: (deviceId: string) => void;
  disabled?: boolean;
}

export const DeviceSelector: React.FC<DeviceSelectorProps> = ({
  selectedDeviceId, onDeviceChange, selectedOutputDeviceId,
  onOutputDeviceChange, disabled = false,
}) => {
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const requestPermissionAndEnumerate = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    setIsLoading(true);

    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      tempStream.getTracks().forEach((track) => track.stop());

      const inputs = allDevices.filter((d) => d.kind === 'audioinput');
      const outputs = allDevices.filter((d) => d.kind === 'audiooutput');
      setInputDevices(inputs);
      setOutputDevices(outputs);

      setHasPermission(inputs.some((d) => d.label && d.label.trim().length > 0));

      if (inputs.length > 0 && (!selectedDeviceId || !inputs.some((d) => d.deviceId === selectedDeviceId))) {
        onDeviceChange(inputs[0].deviceId);
      }
      if (outputs.length > 0 && (!selectedOutputDeviceId || !outputs.some((d) => d.deviceId === selectedOutputDeviceId))) {
        onOutputDeviceChange(outputs[0].deviceId);
      }
    } catch (err) {
      console.warn('Autorisation audio non accordée :', err);
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      setInputDevices(allDevices.filter((d) => d.kind === 'audioinput'));
      setOutputDevices(allDevices.filter((d) => d.kind === 'audiooutput'));
    } finally {
      setIsLoading(false);
    }
  }, [onDeviceChange, onOutputDeviceChange, selectedDeviceId, selectedOutputDeviceId]);

  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    navigator.mediaDevices.enumerateDevices().then((allDevices) => {
      const inputs = allDevices.filter((d) => d.kind === 'audioinput');
      const outputs = allDevices.filter((d) => d.kind === 'audiooutput');
      setInputDevices(inputs);
      setOutputDevices(outputs);
      if (inputs.some((d) => d.label && d.label.length > 0)) setHasPermission(true);
      if (inputs.length > 0 && !selectedDeviceId) onDeviceChange(inputs[0].deviceId);
      if (outputs.length > 0 && !selectedOutputDeviceId) onOutputDeviceChange(outputs[0].deviceId);
    });

    const handleDeviceChange = () => requestPermissionAndEnumerate();
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
  }, [requestPermissionAndEnumerate, onDeviceChange, onOutputDeviceChange, selectedDeviceId, selectedOutputDeviceId]);

  return (
    <div className="cordel-card p-3 flex-1 flex flex-col justify-between gap-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-theme-ink">
          <span>Carte Son & Périphériques</span>
          {hasPermission && (
            <span className="text-[10px] text-emerald-400 font-mono tracking-normal flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Connecté</span>
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={requestPermissionAndEnumerate}
          disabled={disabled || isLoading}
          className="cordel-btn px-2 py-0.5 flex items-center gap-1.5 text-xs cursor-pointer"
          title="Détecter les entrées et sorties de la carte son externe"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{hasPermission ? 'Actualiser' : 'Autoriser Audio'}</span>
        </button>
      </div>

      {/* 1. Entrée Micro */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-mono text-theme-ink/80 flex items-center gap-1">
          <Mic className="w-3 h-3 text-theme-accent" />
          <span>Entrée Micro (Pure Direct)</span>
        </label>
        <select
          value={selectedDeviceId}
          onChange={(e) => onDeviceChange(e.target.value)}
          onFocus={() => { if (!hasPermission) requestPermissionAndEnumerate(); }}
          disabled={disabled || inputDevices.length === 0}
          className="w-full bg-black/30 border-2 border-theme-border text-theme-ink text-xs p-1.5 rounded-none font-mono focus:outline-none focus:border-theme-accent cursor-pointer"
        >
          {inputDevices.map((dev, idx) => (
            <option key={dev.deviceId || idx} value={dev.deviceId} className="bg-theme-bg text-theme-ink">
              {dev.label || `Microphone ${idx + 1}`}
            </option>
          ))}
          {inputDevices.length === 0 && <option value="">Cliquez sur « Autoriser Audio »</option>}
        </select>
      </div>

      {/* 2. Sortie Audio / Casque */}
      {outputDevices.length > 0 && (
        <div className="flex flex-col gap-1 pt-1 border-t border-theme-border/20">
          <label className="text-[11px] font-mono text-theme-ink/80 flex items-center gap-1">
            <Headphones className="w-3 h-3 text-theme-accent" />
            <span>Sortie Casque / Écoute (Routing direct)</span>
          </label>
          <select
            value={selectedOutputDeviceId}
            onChange={(e) => onOutputDeviceChange(e.target.value)}
            disabled={disabled}
            className="w-full bg-black/30 border-2 border-theme-border text-theme-ink text-xs p-1.5 rounded-none font-mono focus:outline-none focus:border-theme-accent cursor-pointer"
          >
            {outputDevices.map((dev, idx) => (
              <option key={dev.deviceId || idx} value={dev.deviceId} className="bg-theme-bg text-theme-ink">
                {dev.label || `Sortie audio ${idx + 1}`}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};
