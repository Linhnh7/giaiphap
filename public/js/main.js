import { db, esc, safeUrl, hostOf } from "./firebase.js";
import {
  collection, query, where, getDocs, doc, getDoc, addDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const $ = (s) => document.querySelector(s);
$("#year").textContent = new Date().getFullYear();

let sites = [];
let activeTag = "";

/* ---------- Ảnh thay thế khi dự án chưa có ảnh ---------- */
export function placeholderStyle(seed = "") {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `background: linear-gradient(135deg, hsl(${h} 70% 48%), hsl(${(h + 40) % 360} 75% 38%));`;
}
function initials(title = "") {
  return title.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "GP";
}

/* ---------- Dự án ---------- */
function cardHtml(s) {
  const url = safeUrl(s.url);
  const img = safeUrl(s.image);
  const tags = (s.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("");
  const shot = img
    ? `<img style="position:relative" src="${esc(img)}" alt="Ảnh chụp ${esc(s.title)}" loading="lazy" onerror="this.remove()" />`
    : "";
  return `
    <article class="card${s.featured ? " featured" : ""}">
      <a class="browser" href="${esc(url)}" target="_blank" rel="noopener" aria-label="Mở ${esc(s.title)}" style="text-decoration:none">
        <div class="browser-bar"><i></i><i></i><i></i><span class="addr">${esc(hostOf(url))}</span></div>
        <div class="shot">
          <div class="ph" style="${placeholderStyle(s.title)}">${esc(initials(s.title))}</div>
          ${shot}
        </div>
      </a>
      <div class="card-body">
        <h3>${esc(s.title)}</h3>
        ${s.description ? `<p>${esc(s.description)}</p>` : ""}
        ${tags ? `<div class="tags">${tags}</div>` : ""}
        <div class="card-foot">
          <a class="visit" href="${esc(url)}" target="_blank" rel="noopener">Trải nghiệm ngay →</a>
          ${s.featured ? '<span class="badge star">Nổi bật</span>' : ""}
        </div>
      </div>
    </article>`;
}

function renderGrid() {
  const list = activeTag ? sites.filter((s) => (s.tags || []).includes(activeTag)) : sites;
  $("#grid").innerHTML = list.length
    ? list.map(cardHtml).join("")
    : `<div class="empty" style="grid-column:1/-1">Chưa có dự án nào được hiển thị.</div>`;
}

function renderFilters() {
  const tags = [...new Set(sites.flatMap((s) => s.tags || []))].sort((a, b) => a.localeCompare(b, "vi"));
  $("#stat-count").textContent = sites.length;
  $("#stat-tags").textContent = tags.length;
  if (tags.length < 2) { $("#filters").innerHTML = ""; return; }
  $("#filters").innerHTML = ["", ...tags]
    .map((t) => `<button class="chip" data-tag="${esc(t)}" aria-pressed="${t === activeTag}">${t ? esc(t) : "Tất cả"}</button>`)
    .join("");
}

$("#filters").addEventListener("click", (e) => {
  const b = e.target.closest(".chip");
  if (!b) return;
  activeTag = b.dataset.tag;
  renderFilters();
  renderGrid();
});

async function loadSites() {
  try {
    // Rules chỉ cho khách đọc dự án visible == true, nên truy vấn phải có điều kiện này.
    const snap = await getDocs(query(collection(db, "sites"), where("visible", "==", true)));
    sites = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    renderFilters();
    renderGrid();
  } catch (err) {
    console.error(err);
    $("#grid").innerHTML = `<div class="empty" style="grid-column:1/-1">Không tải được danh sách dự án. Vui lòng thử lại sau.</div>`;
  }
}

/* ---------- Cài đặt chung + liên hệ ---------- */
const ICONS = {
  email: '<path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  zalo: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12z"/>',
  facebook: '<circle cx="12" cy="12" r="9"/><path d="M13 21v-8h3M13 13v-2a2 2 0 0 1 2-2h1M10 13h3"/>',
  github: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>',
  address: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
};
const icon = (k) => `<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]}</svg></span>`;

function contactItems(c) {
  const items = [];
  if (c.email) items.push(["email", "Email", c.email, `mailto:${c.email}`]);
  if (c.phone) items.push(["phone", "Điện thoại", c.phone, `tel:${c.phone.replace(/[^\d+]/g, "")}`]);
  if (c.zalo) items.push(["zalo", "Zalo", c.zalo, `https://zalo.me/${c.zalo.replace(/[^\d]/g, "")}`]);
  if (c.facebook) items.push(["facebook", "Facebook", hostOf(c.facebook) ? c.facebook.replace(/^https?:\/\/(www\.)?/, "") : c.facebook, safeUrl(c.facebook)]);
  if (c.github) items.push(["github", "GitHub", c.github.replace(/^https?:\/\/(www\.)?/, ""), safeUrl(c.github)]);
  if (c.address) items.push(["address", "Địa chỉ", c.address, ""]);
  return items.map(([k, label, value, href]) => {
    const inner = `${icon(k)}<span><small>${label}</small><b>${esc(value)}</b></span>`;
    return `<li>${href ? `<a href="${esc(href)}" ${href.startsWith("http") ? 'target="_blank" rel="noopener"' : ""}>${inner}</a>` : `<div>${inner}</div>`}</li>`;
  }).join("");
}

async function loadSettings() {
  try {
    const snap = await getDoc(doc(db, "settings", "site"));
    const s = snap.exists() ? snap.data() : {};
    if (s.heroEyebrow) $("#hero-eyebrow").textContent = s.heroEyebrow;
    if (s.heroTitle) {
      // Phần đặt trong [ngoặc vuông] sẽ được tô màu nhấn.
      $("#hero-title").innerHTML = esc(s.heroTitle).replace(/\[(.+?)\]/g, "<em>$1</em>");
    }
    if (s.heroSub) $("#hero-sub").textContent = s.heroSub;
    if (s.contactIntro) $("#contact-intro").textContent = s.contactIntro;
    $("#contact-list").innerHTML = contactItems(s.contact || {});
  } catch (err) {
    console.error(err);
  }
}

/* ---------- Form liên hệ ---------- */
const form = $("#contact-form");
const note = $("#form-note");
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  if (fd.get("website")) return; // bot
  const data = {
    name: String(fd.get("name") || "").trim(),
    contact: String(fd.get("contact") || "").trim(),
    content: String(fd.get("content") || "").trim(),
  };
  if (!data.name || !data.contact || !data.content) {
    note.className = "form-note err";
    note.textContent = "Vui lòng điền đủ các ô.";
    return;
  }
  const btn = form.querySelector("button");
  btn.disabled = true;
  note.className = "form-note";
  note.textContent = "Đang gửi…";
  try {
    await addDoc(collection(db, "messages"), { ...data, read: false, createdAt: serverTimestamp() });
    form.reset();
    note.className = "form-note ok";
    note.textContent = "Đã gửi! Cảm ơn bạn, tôi sẽ liên hệ lại sớm.";
  } catch (err) {
    console.error(err);
    note.className = "form-note err";
    note.textContent = "Gửi chưa được, bạn thử lại hoặc liên hệ trực tiếp nhé.";
  } finally {
    btn.disabled = false;
  }
});

loadSettings();
loadSites();
