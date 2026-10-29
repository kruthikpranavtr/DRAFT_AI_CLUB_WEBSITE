let csrfToken = null;

async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  let lastError;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetch('/api/auth/csrf', { credentials:'include', cache:'no-store' });
      const data = await response.json().catch(() => null);
      if (response.ok && typeof data?.csrfToken === 'string' && data.csrfToken.length > 12) {
        csrfToken = data.csrfToken;
        return csrfToken;
      }
      lastError = new Error(data?.error || 'Security token could not be created.');
      if (response.status >= 400 && response.status < 500 && ![408,429].includes(response.status)) break;
    } catch (error) { lastError = error; }
    if (attempt < 4) await new Promise(resolve => setTimeout(resolve, [1200,2200,4000,6000][attempt]));
  }
  throw new Error('The login security service is temporarily unavailable. Please retry. ' + (lastError?.message || ''));
}

export async function api(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const unsafe = ['POST','PUT','PATCH','DELETE'].includes(method);
  const securityHeaders = unsafe ? { 'X-CSRF-Token':await getCsrfToken() } : {};
  const requestOptions = {
    credentials:'include',
    ...options,
    headers:options.body instanceof FormData
      ? { ...securityHeaders,...options.headers }
      : { 'Content-Type':'application/json',...securityHeaders,...options.headers },
  };
  const response = await fetch(path, requestOptions);
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    // Failed sign-in or an initial session check is not an authenticated session expiry.
    if (response.status === 401 && !['/api/auth/login','/api/auth/admin/login','/api/auth/me'].includes(path) && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('aiclub:session-expired'));
    }
    const error = new Error(data?.error || 'The request could not be completed.');
    error.status = response.status;
    error.issues = data?.issues;
    throw error;
  }
  return data;
}

export function clearClientCsrfToken() {
  csrfToken = null;
}

export const get = path => api(path);
export const post = (path, body) => api(path, { method:'POST',body:body instanceof FormData ? body : JSON.stringify(body) });
export const put = (path, body) => api(path, { method:'PUT',body:body instanceof FormData ? body : JSON.stringify(body) });
export const del = path => api(path, { method:'DELETE' });
