export async function api(path, options = {}) {
  const requestOptions = {
    credentials:'include',
    ...options,
    headers:options.body instanceof FormData
      ? { ...options.headers }
      : { 'Content-Type':'application/json', ...options.headers },
  };
  const response = await fetch(path, requestOptions);
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.error || 'The request could not be completed.');
    error.status = response.status;
    error.issues = data?.issues;
    throw error;
  }
  return data;
}

export const get = path => api(path);
export const post = (path, body) => api(path, { method:'POST',body:body instanceof FormData ? body : JSON.stringify(body) });
export const put = (path, body) => api(path, { method:'PUT',body:body instanceof FormData ? body : JSON.stringify(body) });
export const del = path => api(path, { method:'DELETE' });
