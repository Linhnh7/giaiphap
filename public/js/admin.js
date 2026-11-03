import { db, auth, ADMIN_EMAILS, esc, safeUrl, hostOf } from "./firebase.js";
import {
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, getDoc, setDoc,
  writeBatch, serverTimestamp, query, orderBy,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

/* ---------- Tiện ích giao diện ---------- */
function show(view) {
  for (const v of ["loading", "login", "denied", "dash"]) $(`#view-${v}`).hidden = v !== view;
}
let toastTimer;
function toast(msg, isErr = false) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = `toast show${isErr ? " err" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = "toast"), 2600);
}
function fail(err) {
  console.error(err);
  toast(err?.code === "permission-denied" ? "Không có quyền ghi – kiểm tra email trong firestore.rules." : "Có lỗi xảy ra, thử lại nhé.", true);
}
function placeholderStyle(seed = "") {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `background: linear-gradient(135deg, hsl(${h} 70% 48%), hsl(${(h + 40) % 360} 75% 38%));`;
}

/* ---------- Đăng nhập ---------- */
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

$("#btn-login").addEventListener("click", async () => {
  $("#login-err").textContent = "";
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    if (err.code === "auth/popup-blocked") return signInWithRedirect(auth, provider);
    if (err.code !== "auth/popup-closed-by-user" && err.code !== "auth/cancelled-popup-request") {
      console.error(err);
      $("#login-err").textContent = err.code === "auth/unauthorized-domain"
        ? "Tên miền này chưa được thêm vào Authorized domains trong Firebase Authentication."
        : "Đăng nhập thất bại: " + err.code;
    }
  }
});
for (const id of ["#btn-logout", "#btn-logout-2"]) $(id).addEventListener("click", () => signOut(auth));

let unsubs = [];
onAuthStateChanged(auth, (user) => {
  unsubs.forEach((u) => u());
  unsubs = [];
  $("#userbox").hidden = !user;
  if (!user) return show("login");

  $("#user-photo").src = user.photoURL || "/assets/logo.svg";
  $("#user-name").textContent = user.displayName || user.email;

  const email = (user.email || "").toLowerCase();
  if (!user.emailVerified || !ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email)) {
    $("#denied-email").textContent = user.email;
    return show("denied");
  }
  show("dash");
  startSites();
  startMessages();
  loadSettings();
});

/* ---------- Tabs ---------- */
$(".tabs").addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (!tab) return;
  $$(".tab").forEach((t) => t.setAttribute("aria-selected", t === tab));
  $$("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== tab.dataset.tab));
});

/* ---------- Dự án ---------- */
let sites = [];

function startSites() {
  unsubs.push(onSnapshot(collection(db, "sites"), (snap) => {
    sites = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    renderSites();
  }, fail));
}

function renderSites() {
  $("#count-sites").textContent = sites.length;
  const box = $("#site-rows");
  if (!sites.length) {
    box.innerHTML = `<div class="empty">Chưa có dự án nào. Bấm “+ Thêm dự án” để bắt đầu.</div>`;
    return;
  }
  box.innerHTML = sites.map((s, i) => {
    const img = safeUrl(s.image);
    const initials = (s.title || "GP").split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
    return `
      <div class="row${s.visible ? "" : " hidden-site"}" data-id="${s.id}">
        <div class="order-btns">
          <button data-act="up" ${i === 0 ? "disabled" : ""} aria-label="Lên">▲</button>
          <button data-act="down" ${i === sites.length - 1 ? "disabled" : ""} aria-label="Xuống">▼</button>
        </div>
        <div class="thumb" style="${img ? "" : placeholderStyle(s.title)}">${img ? `<img src="${esc(img)}" alt="" onerror="this.remove()" />` : esc(initials)}</div>
        <div style="min-width:0">
          <h4>${esc(s.title)} ${s.featured ? '<span class="badge star">Nổi bật</span>' : ""}</h4>
          <div class="meta"><a href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener">${esc(hostOf(s.url) || s.url)}</a>${(s.tags || []).length ? " · " + esc(s.tags.join(", ")) : ""}</div>
        </div>
        <div class="actions">
          <label class="switch"><input type="checkbox" data-act="visible" ${s.visible ? "checked" : ""} /><span class="track"></span>Hiển thị</label>
          <button class="btn btn-sm btn-ghost" data-act="edit">Sửa</button>
          <button class="btn btn-sm btn-ghost btn-danger" data-act="delete">Xoá</button>
        </div>
      </div>`;
  }).join("");
}

$("#site-rows").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-act]");
  const row = e.target.closest(".row");
  if (!btn || !row || btn.dataset.act === "visible") return;
  const id = row.dataset.id;
  const site = sites.find((s) => s.id === id);
  const act = btn.dataset.act;

  if (act === "edit") return openDialog(site);
  if (act === "delete") {
    if (!confirm(`Xoá dự án “${site.title}”? Không thể hoàn tác.`)) return;
    try { await deleteDoc(doc(db, "sites", id)); toast("Đã xoá"); } catch (err) { fail(err); }
    return;
  }
  if (act === "up" || act === "down") {
    const i = sites.findIndex((s) => s.id === id);
    const j = act === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= sites.length) return;
    const list = [...sites];
    [list[i], list[j]] = [list[j], list[i]];
    // Đánh lại thứ tự 0..n để không bị trùng số
    const batch = writeBatch(db);
    list.forEach((s, idx) => { if (s.order !== idx) batch.update(doc(db, "sites", s.id), { order: idx }); });
    try { await batch.commit(); } catch (err) { fail(err); }
  }
});

$("#site-rows").addEventListener("change", async (e) => {
  if (e.target.dataset.act !== "visible") return;
  const id = e.target.closest(".row").dataset.id;
  try {
    await updateDoc(doc(db, "sites", id), { visible: e.target.checked, updatedAt: serverTimestamp() });
    toast(e.target.checked ? "Đã bật hiển thị" : "Đã ẩn khỏi trang chủ");
  } catch (err) { e.target.checked = !e.target.checked; fail(err); }
});

/* ---------- Hộp thoại thêm / sửa ---------- */
const dialog = $("#site-dialog");
const siteForm = $("#site-form");
let editingId = null;

function openDialog(site = null) {
  editingId = site?.id || null;
  $("#site-dialog-title").textContent = site ? "Sửa dự án" : "Thêm dự án";
  siteForm.reset();
  const f = siteForm.elements;
  f.title.value = site?.title || "";
  f.url.value = site?.url || "";
  f.description.value = site?.description || "";
  f.image.value = site?.image || "";
  f.tags.value = (site?.tags || []).join(", ");
  f.visible.checked = site ? !!site.visible : true;
  f.featured.checked = !!site?.featured;
  dialog.showModal();
  f.title.focus();
}
$("#btn-add").addEventListener("click", () => openDialog());
$("#btn-cancel").addEventListener("click", () => dialog.close());
$("#btn-autoshot").addEventListener("click", () => {
  const url = safeUrl(siteForm.elements.url.value.trim());
  if (!url) return toast("Nhập đường dẫn web trước đã", true);
  siteForm.elements.image.value = `https://image.thum.io/get/width/1200/crop/675/${url}`;
});

siteForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = siteForm.elements;
  const url = safeUrl(f.url.value.trim());
  const image = f.image.value.trim();
  if (!f.title.value.trim()) return toast("Thiếu tên dự án", true);
  if (!url) return toast("Đường dẫn web không hợp lệ (cần http/https)", true);
  if (image && !safeUrl(image)) return toast("Link ảnh không hợp lệ", true);

  const data = {
    title: f.title.value.trim(),
    url,
    description: f.description.value.trim(),
    image,
    tags: [...new Set(f.tags.value.split(",").map((t) => t.trim()).filter(Boolean))].slice(0, 8),
    visible: f.visible.checked,
    featured: f.featured.checked,
    updatedAt: serverTimestamp(),
  };
  const btn = $("#btn-save");
  btn.disabled = true;
  try {
    if (editingId) {
      await updateDoc(doc(db, "sites", editingId), data);
      toast("Đã lưu thay đổi");
    } else {
      const order = sites.length ? Math.max(...sites.map((s) => s.order ?? 0)) + 1 : 0;
      await addDoc(collection(db, "sites"), { ...data, order, createdAt: serverTimestamp() });
      toast("Đã thêm dự án");
    }
    dialog.close();
  } catch (err) { fail(err); } finally { btn.disabled = false; }
});

/* ---------- Cài đặt ---------- */
const settingsForm = $("#settings-form");
const SETTING_KEYS = ["heroEyebrow", "heroTitle", "heroSub", "contactIntro"];
const CONTACT_KEYS = ["email", "phone", "zalo", "facebook", "github", "address"];

async function loadSettings() {
  try {
    const snap = await getDoc(doc(db, "settings", "site"));
    const s = snap.exists() ? snap.data() : {};
    for (const k of SETTING_KEYS) settingsForm.elements[k].value = s[k] || "";
    for (const k of CONTACT_KEYS) settingsForm.elements[k].value = s.contact?.[k] || "";
  } catch (err) { fail(err); }
}

settingsForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = settingsForm.elements;
  for (const k of ["facebook", "github"]) {
    if (f[k].value.trim() && !safeUrl(f[k].value.trim())) return toast(`Link ${k} cần bắt đầu bằng https://`, true);
  }
  const data = { updatedAt: serverTimestamp(), contact: {} };
  for (const k of SETTING_KEYS) data[k] = f[k].value.trim();
  for (const k of CONTACT_KEYS) data.contact[k] = f[k].value.trim();
  const btn = settingsForm.querySelector("button[type=submit]");
  btn.disabled = true;
  try {
    await setDoc(doc(db, "settings", "site"), data);
    toast("Đã lưu cài đặt");
  } catch (err) { fail(err); } finally { btn.disabled = false; }
});

/* ---------- Tin nhắn ---------- */
let messages = [];
function startMessages() {
  unsubs.push(onSnapshot(query(collection(db, "messages"), orderBy("createdAt", "desc")), (snap) => {
    messages = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderMessages();
  }, fail));
}

function fmtTime(ts) {
  const d = ts?.toDate?.();
  return d ? d.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "";
}

function renderMessages() {
  const unread = messages.filter((m) => !m.read).length;
  $("#count-msg").textContent = unread || messages.length;
  const box = $("#msg-rows");
  if (!messages.length) { box.innerHTML = `<div class="empty">Chưa có tin nhắn nào.</div>`; return; }
  box.innerHTML = messages.map((m) => `
    <div class="msg" data-id="${m.id}" style="${m.read ? "" : "border-color: var(--accent)"}">
      <header>
        <b>${esc(m.name)} ${m.read ? "" : '<span class="badge star">Mới</span>'}</b>
        <span>${esc(fmtTime(m.createdAt))}</span>
      </header>
      <div class="meta" style="font-family:var(--mono);font-size:13px">${esc(m.contact)}</div>
      <p>${esc(m.content)}</p>
      <div style="display:flex;gap:6px">
        ${m.read ? "" : '<button class="btn btn-sm" data-act="read">Đánh dấu đã đọc</button>'}
        <button class="btn btn-sm btn-ghost btn-danger" data-act="delete">Xoá</button>
      </div>
    </div>`).join("");
}

$("#msg-rows").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const id = e.target.closest(".msg").dataset.id;
  try {
    if (btn.dataset.act === "read") await updateDoc(doc(db, "messages", id), { read: true });
    if (btn.dataset.act === "delete" && confirm("Xoá tin nhắn này?")) await deleteDoc(doc(db, "messages", id));
  } catch (err) { fail(err); }
});
