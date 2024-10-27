import axios from "axios";
const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL;

const api = axios.create({
  baseURL: BACKEND_BASE_URL,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  withCredentials: true, // Ensure cookies are sent with requests
});
export default api;
