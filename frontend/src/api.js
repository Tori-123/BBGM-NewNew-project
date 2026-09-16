const BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000/api/v1";

export class ApiError extends Error {
  constructor(status, error) {
    super(error?.message || "Request failed.");
    this.name = "ApiError";
    this.status = status;
    this.code = error?.code || "bad_request";
    this.fields = error?.fields || [];
  }
}

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      credentials: "include",
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(0, {
      code: "storage_unavailable",
      message: "Could not reach the server.",
      fields: [],
    });
  }

  if (res.status === 204) return null;

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new ApiError(
      res.status,
      data?.error || { code: "bad_request", message: "Request failed.", fields: [] },
    );
  }
  return data;
}

async function uploadFile(path, file) {
  const body = new FormData();
  body.append("file", file);
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: "POST",
      credentials: "include",
      body,
    });
  } catch {
    throw new ApiError(0, {
      code: "storage_unavailable",
      message: "Could not reach the server.",
      fields: [],
    });
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new ApiError(
      res.status,
      data?.error || { code: "bad_request", message: "Request failed.", fields: [] },
    );
  }
  return data;
}

export const api = {
  me: () => request("/me"),
  setAvatarPreset: (preset) =>
    request("/me/avatar", { method: "PUT", body: JSON.stringify({ preset }) }),
  uploadAvatar: (file) => uploadFile("/me/avatar", file),
  login: (body) => request("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  register: (body) => request("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  logout: () => request("/auth/logout", { method: "POST" }),
  listPosts: ({ category, page = 1, pageSize = 20 } = {}) => {
    const query = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
    });
    if (category) query.set("category", category);
    return request(`/posts?${query}`);
  },
  getPost: (id) => request(`/posts/${encodeURIComponent(id)}`),
  createPost: (body) => request("/posts", { method: "POST", body: JSON.stringify(body) }),
  uploadPostImage: (postId, file) => uploadFile(`/posts/${encodeURIComponent(postId)}/images`, file),
  myPosts: ({ page = 1, pageSize = 20 } = {}) => {
    const query = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
    });
    return request(`/me/posts?${query}`);
  },
  listComments: (postId, { page = 1, pageSize = 20 } = {}) => {
    const query = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
    });
    return request(`/posts/${encodeURIComponent(postId)}/comments?${query}`);
  },
  createComment: (postId, body) =>
    request(`/posts/${encodeURIComponent(postId)}/comments`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  promotePost: (postId, body) =>
    request(`/posts/${encodeURIComponent(postId)}/promote`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listUsers: ({ page = 1, pageSize = 20 } = {}) => {
    const query = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
    });
    return request(`/admin/users?${query}`);
  },
  patchUserRole: (userId, role) =>
    request(`/admin/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),
};

export function fieldMessage(error, field) {
  return error?.fields?.find((item) => item.field === field)?.message || "";
}

export function safeNext(value) {
  if (typeof value !== "string") return "/";
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return "/";
}
