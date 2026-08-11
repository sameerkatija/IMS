import axios from "axios";

const api = axios.create({
  baseURL: "", // Defaults to relative paths which Vite proxies to backend
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor: attach token from localStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor: automatically redirect on 401 Unauthorized & detect Period Closed 400 errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem("token");
      if (!window.location.pathname.endsWith("/login")) {
        window.location.href = "/login";
      }
    } else if (
      error.response &&
      error.response.status === 400 &&
      error.response.data &&
      typeof error.response.data.error === "string" &&
      error.response.data.error.includes("is closed")
    ) {
      window.dispatchEvent(
        new CustomEvent("period-closed-error", {
          detail: { message: error.response.data.error },
        })
      );
    }
    return Promise.reject(error);
  }
);

export default api;
