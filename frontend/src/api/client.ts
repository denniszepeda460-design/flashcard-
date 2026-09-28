export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message || `Error del servidor (${status})`);
    this.name = 'ApiError';
  }

  override toString() {
    return this.message;
  }
}

export function getBaseUrl(): string {
  // 1. Configuración explícita en Settings UI (localStorage)
  const settingsStr = localStorage.getItem('settings-storage');
  if (settingsStr) {
    try {
      const state = JSON.parse(settingsStr).state;
      if (state && state.backendUrl && state.backendUrl.trim()) {
        let url = state.backendUrl.trim();
        // Si el usuario configuró por error el puerto del frontend (:5173), lo ignoramos
        if (!url.includes(':5173')) {
          if (url.includes(':8000')) {
            url = url.replace(':8000', ':8001');
          }
          return url.replace(/\/+$/, '');
        }
      }
    } catch (e) {
      // ignore
    }
  }

  // 2. Variable de entorno Vite (por ejemplo en Vercel: VITE_API_URL=https://api.tudominio.com)
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // 3. Resolución dinámica para entorno local / red WiFi:
  // Si se abre desde localhost o una IP local (ej. 192.168.1.5, 10.x.x.x),
  // se conecta directamente al backend en el puerto 8001 de ese mismo host.
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isLocalIp =
      /^192\.168\.\d+\.\d+$/.test(hostname) ||
      /^10\.\d+\.\d+\.\d+$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(hostname);

    if (isLocalHost || isLocalIp) {
      return `http://${hostname}:8001`;
    }
  }

  // 4. Fallback por defecto (rutas relativas)
  return '';
}

export function getApiKey(): string {
  const settingsStr = localStorage.getItem('settings-storage');
  if (settingsStr) {
    try {
      const state = JSON.parse(settingsStr).state;
      if (state && state.apiKey) {
        return state.apiKey;
      }
    } catch (e) {
      // ignore
    }
  }
  return 'mi-clave-secreta-123';
}

async function fetchWithRetry(path: string, options: RequestInit = {}, timeoutMs: number = 6000): Promise<Response> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${path}`;
  const apiKey = getApiKey();

  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (apiKey) {
    headers.set('X-API-Key', apiKey);
  }

  // Timeout para no colgar la UI si la laptop o Tailscale están apagados
  let signal = options.signal;
  if (!signal && typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
    signal = AbortSignal.timeout(timeoutMs);
  }

  let res: Response;
  try {
    res = await fetch(url, { ...options, headers, signal });
  } catch (netErr: any) {
    const isTimeout = netErr.name === 'TimeoutError' || (netErr.message && netErr.message.includes('timeout'));
    const msg = isTimeout
      ? `Tiempo de espera agotado conectando con el servidor (${url}). La laptop o Tailscale podrían estar apagados.`
      : `No se pudo conectar con el servidor API (${url}): ${netErr.message || 'Error de conexión'}.`;
    throw new ApiError(0, msg);
  }

  if (!res.ok) {
    if (res.status === 502) {
      throw new ApiError(
        502,
        'Error 502 (Bad Gateway): El servidor backend (puerto 8001) no responde. Asegúrate de tener el backend iniciado ejecutando start.bat.'
      );
    }

    let message = '';
    try {
      const errorText = await res.text();
      try {
        const jsonErr = JSON.parse(errorText);
        if (jsonErr.detail) {
          message = typeof jsonErr.detail === 'string' ? jsonErr.detail : JSON.stringify(jsonErr.detail);
        } else if (jsonErr.message) {
          message = jsonErr.message;
        } else {
          message = errorText;
        }
      } catch {
        message = errorText;
      }
    } catch {
      // ignore
    }
    throw new ApiError(res.status, message || `Error HTTP ${res.status} (${res.statusText || 'Error de red'})`);
  }
  return res;
}

export async function get<T>(path: string, timeoutMs?: number): Promise<T> {
  const res = await fetchWithRetry(path, { method: 'GET' }, timeoutMs);
  return res.json();
}

export async function post<T>(path: string, body?: unknown, timeoutMs?: number): Promise<T> {
  const res = await fetchWithRetry(
    path,
    {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    },
    timeoutMs
  );
  return res.json();
}

export async function patch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetchWithRetry(path, {
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export async function del<T>(path: string): Promise<T> {
  const res = await fetchWithRetry(path, { method: 'DELETE' });
  return res.json();
}
