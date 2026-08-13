import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { getApiBase } from './lib/apiBase.js';

const API_BASE = getApiBase();
const AUTH_REQUEST_TIMEOUT_MS = 15000;
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const AUTH_EVENT = 'alipro:auth-changed';

function storage() {
  try {
    return window.localStorage;
  } catch (_) {
    return null;
  }
}

export function getAuthToken() {
  return storage()?.getItem(TOKEN_KEY) || '';
}

export function getStoredUser() {
  try {
    return JSON.parse(storage()?.getItem(USER_KEY) || 'null');
  } catch (_) {
    return null;
  }
}

export function saveAuthSession(session) {
  const target = storage();
  if (!target || !session?.token) return;
  target.setItem(TOKEN_KEY, session.token);
  target.setItem(USER_KEY, JSON.stringify(session.user || null));
  window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: { user: session.user || null } }));
}

export function saveStoredUser(user) {
  const target = storage();
  if (!target) return;
  target.setItem(USER_KEY, JSON.stringify(user || null));
  window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: { user: user || null } }));
}

export function clearAuthSession() {
  const target = storage();
  target?.removeItem(TOKEN_KEY);
  target?.removeItem(USER_KEY);
  window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: { user: null } }));
}

function parseNativePayload(data) {
  if (typeof data !== 'string') return data || {};
  try {
    return JSON.parse(data);
  } catch (_) {
    return {};
  }
}

function requestBody(body) {
  if (!body) return undefined;
  if (typeof body !== 'string') return body;
  try {
    return JSON.parse(body);
  } catch (_) {
    return body;
  }
}

function timeoutAfter(milliseconds) {
  return new Promise((_, reject) => {
    window.setTimeout(() => {
      const error = new Error('连接云端超时，请检查手机网络后重试');
      error.code = 'AUTH_TIMEOUT';
      reject(error);
    }, milliseconds);
  });
}

async function nativeRequest(url, options, headers) {
  const response = await Promise.race([
    CapacitorHttp.request({
      url,
      method: options.method || 'GET',
      headers: { ...headers, 'X-Alipro-Client': 'android' },
      data: requestBody(options.body),
      connectTimeout: 10000,
      readTimeout: AUTH_REQUEST_TIMEOUT_MS,
      responseType: 'json'
    }),
    timeoutAfter(AUTH_REQUEST_TIMEOUT_MS)
  ]);
  return {
    status: Number(response.status || 0),
    payload: parseNativePayload(response.data)
  };
}

async function webRequest(url, options, headers) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), AUTH_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, headers, signal: controller.signal });
    return {
      status: response.status,
      payload: await response.json().catch(() => ({}))
    };
  } finally {
    window.clearTimeout(timer);
  }
}

async function authRequest(path, options = {}, requireToken = false) {
  const token = getAuthToken();
  if (requireToken && !token) throw new Error('请先登录后继续');
  const url = `${API_BASE}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };
  let result;
  try {
    result = Capacitor.isNativePlatform()
      ? await nativeRequest(url, options, headers)
      : await webRequest(url, options, headers);
  } catch (reason) {
    if (reason?.code === 'AUTH_TIMEOUT') throw reason;
    const error = new Error(reason?.name === 'AbortError'
      ? '连接云端超时，请检查网络后重试'
      : `无法连接云端服务${reason?.message ? `：${reason.message}` : ''}`);
    error.cause = reason;
    throw error;
  }
  const { status, payload } = result;
  if (status === 401 && token) clearAuthSession();
  if (status < 200 || status >= 300 || payload.success === false) {
    const error = new Error(payload.error || `云端服务返回 HTTP ${status || '未知错误'}`);
    error.status = status;
    throw error;
  }
  return payload.data;
}

function json(method, body) {
  return { method, body: JSON.stringify(body || {}) };
}

export const getAuthConfiguration = () => authRequest('/auth/config');
export const getProfile = () => authRequest('/auth/profile', {}, true);
export const sendSmsCode = (phone, purpose) => authRequest('/auth/sms/send', json('POST', { phone, purpose }));
export const registerWithPhone = (input) => authRequest('/auth/phone/register', json('POST', input));
export const loginWithPhone = (input) => authRequest('/auth/phone/login', json('POST', input));
export const loginWithPassword = (input) => authRequest('/auth/login', json('POST', input));
export const updateProfile = (input) => authRequest('/auth/profile', json('PUT', input), true);
export const updateUserSettings = (input) => authRequest('/auth/settings', json('PUT', input), true);
export const changePassword = (input) => authRequest('/auth/password', json('PUT', input), true);
export const bindPhone = (input) => authRequest('/auth/phone/bind', json('POST', input), true);
export const startOAuth = (provider, returnUrl) => authRequest(`/auth/oauth/${provider}/start`, json('POST', { returnUrl }));
export const exchangeOAuthHandoff = (handoff) => authRequest('/auth/oauth/exchange', json('POST', { handoff }));
export const claimLegacyData = () => authRequest('/auth/claim-legacy-data', json('POST'), true);

export async function logoutCurrentSession() {
  try {
    await authRequest('/auth/logout', json('POST'), true);
  } finally {
    clearAuthSession();
  }
}

export async function launchOAuth(provider) {
  const isNative = typeof window !== 'undefined' && Boolean(window.Capacitor?.isNativePlatform?.());
  const returnUrl = isNative ? 'alipro://auth/callback' : buildAuthCallbackUrl();
  const result = await startOAuth(provider, returnUrl);
  if (isNative) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url: result.authUrl, presentationStyle: 'popover' });
    return;
  }
  window.location.assign(result.authUrl);
}

export function buildAuthCallbackUrl() {
  const base = String(import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
  return `${window.location.origin}${base}/auth/callback`;
}

export { AUTH_EVENT };
