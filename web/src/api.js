async function call(method, url, body) {
  const res = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || `${method} ${url} failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function upload(url, formData) {
  const res = await fetch(url, { method: "POST", credentials: "same-origin", body: formData });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) throw new Error((data && data.error) || `upload ${url} failed (${res.status})`);
  return data;
}

export const api = {
  get: (url) => call("GET", url),
  post: (url, body) => call("POST", url, body || {}),
  patch: (url, body) => call("PATCH", url, body || {}),
  del: (url) => call("DELETE", url),
  upload,
};
