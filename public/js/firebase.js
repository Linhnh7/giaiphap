// Khởi tạo Firebase dùng chung cho mọi trang (SDK dạng module qua CDN, không cần build).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-analytics.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyC3gZucDjHqhghtDSoOx4ZocbUMI8nbruU",
  authDomain: "giaiphap-ba3e2.firebaseapp.com",
  projectId: "giaiphap-ba3e2",
  storageBucket: "giaiphap-ba3e2.firebasestorage.app",
  messagingSenderId: "795322487345",
  appId: "1:795322487345:web:28dfed92434112fa4d3b10",
  measurementId: "G-V0DX4885N0",
};

// Danh sách email Google được vào trang quản trị.
// PHẢI khớp với danh sách trong firestore.rules (rules mới là lớp bảo vệ thật).
export const ADMIN_EMAILS = ["linhnh7@f88.vn"];

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

isSupported().then((ok) => { if (ok) getAnalytics(app); }).catch(() => {});

// Tiện ích dùng chung
export function esc(str = "") {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function safeUrl(url = "") {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : "";
  } catch { return ""; }
}

export function hostOf(url = "") {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}
