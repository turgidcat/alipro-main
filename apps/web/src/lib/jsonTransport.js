import { Capacitor, CapacitorHttp } from '@capacitor/core';

const responseCache = new Map();
const inFlightRequests = new Map();
const DEFAULT_GET_CACHE_TTL_MS = 30 * 1000;

function getHeader(headers = {}, targetName = '') {
  const expected = String(targetName || '').toLowerCase();
  const entry = Object.entries(headers || {}).find(([name]) => String(name).toLowerCase() === expected);
  return entry?.[1] || '';
}

function buildRequestKey(url, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const authorization = getHeader(options.headers, 'authorization');
  return `${method}:${url}:${authorization}`;
}

function readCachedResponse(key) {
  const cached = responseCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    responseCache.delete(key);
    return null;
  }
  return cached.value;
}

export function clearJsonTransportCache() {
  responseCache.clear();
}

function parseBody(body) {
  if (!body || typeof body !== 'string') return body;
  try {
    return JSON.parse(body);
  } catch (_) {
    return body;
  }
}

function parsePayload(data) {
  if (typeof data !== 'string') return data || {};
  try {
    return JSON.parse(data);
  } catch (_) {
    return {};
  }
}

export async function requestJsonTransport(url, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const isGet = method === 'GET';
  const cacheTtl = Number(options.cacheTtl ?? DEFAULT_GET_CACHE_TTL_MS);
  const requestKey = buildRequestKey(url, options);

  if (!isGet) {
    clearJsonTransportCache();
  } else if (!options.forceRefresh && cacheTtl > 0) {
    const cached = readCachedResponse(requestKey);
    if (cached) return cached;
    const pending = inFlightRequests.get(requestKey);
    if (pending) return pending;
  }

  const requestPromise = (async () => {
    if (!Capacitor.isNativePlatform()) {
      const { cacheTtl: _cacheTtl, forceRefresh: _forceRefresh, ...fetchOptions } = options;
      const response = await fetch(url, fetchOptions);
      return {
        status: response.status,
        ok: response.ok,
        payload: await response.json().catch(() => ({}))
      };
    }

    try {
      const response = await CapacitorHttp.request({
        url,
        method,
        headers: {
          ...(options.headers || {}),
          'X-Alipro-Client': 'android'
        },
        data: parseBody(options.body),
        connectTimeout: 10000,
        readTimeout: 600000,
        responseType: 'json'
      });
      const status = Number(response.status || 0);
      return {
        status,
        ok: status >= 200 && status < 300,
        payload: parsePayload(response.data)
      };
    } catch (reason) {
      throw new Error(`无法连接云端服务${reason?.message ? `：${reason.message}` : ''}`);
    }
  })();

  if (isGet) inFlightRequests.set(requestKey, requestPromise);

  try {
    const result = await requestPromise;
    if (isGet && result.ok && cacheTtl > 0) {
      responseCache.set(requestKey, {
        value: result,
        expiresAt: Date.now() + cacheTtl
      });
    }
    return result;
  } finally {
    if (isGet && inFlightRequests.get(requestKey) === requestPromise) {
      inFlightRequests.delete(requestKey);
    }
  }
}
