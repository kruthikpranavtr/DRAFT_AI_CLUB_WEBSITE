let csrfToken = null;

async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  const response = await fetch('/api/auth/csrf',{ credentials:'include' });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.csrfToken) throw new Error(data?.error || 'Security token could not be created.');
  csrfToken = data.csrfToken;
  return csrfToken;
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
    if (response.status === 401 && typeof window !== 'undefined') window.dispatchEvent(new Event('aiclub:session-expired'));
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
