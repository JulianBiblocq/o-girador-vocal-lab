/**
 * ecosystemUrls.ts
 * Résolution unifiée des URLs de l'écosystème O Girador avec support sous-domaines et fallback Firebase (< 85 lignes).
 * Note : Orthographe SSOT « orquestrador » avec 'qu'.
 */

export type EcosystemApp = 'orquestrador' | 'sequenciador' | 'organizador' | 'mostrador' | 'dancador' | 'cantador' | 'afinador';

export interface AppUrlMapping {
  localPort: number;
  customDomain: string;
  firebaseDomain: string;
  enabled: boolean;
  comingSoon?: boolean;
}

export const ECOSYSTEM_MAP: Record<EcosystemApp, AppUrlMapping> = {
  orquestrador: {
    localPort: 5170,
    customDomain: 'https://o-girador.com',
    firebaseDomain: 'https://o-girador.web.app',
    enabled: true,
  },
  sequenciador: {
    localPort: 5174,
    customDomain: 'https://sequenciador.o-girador.com',
    firebaseDomain: 'https://o-girador-sequenciador.web.app',
    enabled: true,
  },
  organizador: {
    localPort: 5175,
    customDomain: 'https://organizador.o-girador.com',
    firebaseDomain: 'https://o-girador-organizador.web.app',
    enabled: true,
  },
  mostrador: {
    localPort: 5175,
    customDomain: 'https://mostrador.o-girador.com',
    firebaseDomain: 'https://o-girador-mostrador.web.app',
    enabled: true,
  },
  dancador: {
    localPort: 5176,
    customDomain: 'https://dancador.o-girador.com',
    firebaseDomain: 'https://o-girador-dancador.web.app',
    enabled: true,
  },
  cantador: {
    localPort: 5177,
    customDomain: 'https://cantador.o-girador.com',
    firebaseDomain: 'https://o-girador-vocal-lab.web.app',
    enabled: true,
  },
  afinador: {
    localPort: 5178,
    customDomain: 'https://afinador.o-girador.com',
    firebaseDomain: 'https://o-girador-afinador.web.app',
    enabled: false,
    comingSoon: true,
  },
};

export function getEnabledEcosystemApps(): EcosystemApp[] {
  return (Object.keys(ECOSYSTEM_MAP) as EcosystemApp[]).filter((k) => ECOSYSTEM_MAP[k].enabled !== false);
}

export function isLocalEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

export function isCustomDomainEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.endsWith('o-girador.com');
}

export function getEcosystemAppUrl(app: EcosystemApp): string {
  const config = ECOSYSTEM_MAP[app];
  if (isLocalEnvironment()) {
    return `http://localhost:${config.localPort}`;
  }
  if (isCustomDomainEnvironment()) {
    return config.customDomain;
  }
  return config.firebaseDomain;
}

export function getCantadorBaseUrl(): string {
  return getEcosystemAppUrl('cantador');
}

export function getSequenciadorToadaUrl(toadaId: string): string {
  const base = getEcosystemAppUrl('sequenciador');
  return `${base}/?loadToadaId=${encodeURIComponent(toadaId)}`;
}
