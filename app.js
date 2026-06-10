const STORAGE_KEY = "lineage-repairs-expenses";

const icons = {
  dashboard: '<svg viewBox="0 0 24 24"><path d="M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z"/></svg>',
  receipt: '<svg viewBox="0 0 24 24"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Z"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>',
  users: '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  download: '<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/></svg>',
  spark: '<svg viewBox="0 0 24 24"><path d="M13 2 3 14h8l-1 8 11-13h-8l1-7Z"/></svg>',
  refresh: '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 0 1-15.5 6.2"/><path d="M3 12A9 9 0 0 1 18.5 5.8"/><path d="M3 20v-6h6M21 4v6h-6"/></svg>',
  upload: '<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>',
  eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>'
};

const form = document.querySelector("#expenseForm");
const rows = document.querySelector("#expenseRows");
const emptyState = document.querySelector("#emptyState");
const search = document.querySelector("#search");
const categoryFilter = document.querySelector("#categoryFilter");
const receiptInput = document.querySelector("#receipt");
const receiptName = document.querySelector("#receiptName");
const importBackup = document.querySelector("#importBackup");
const receiptDialog = document.querySelector("#receiptDialog");
const receiptPreview = document.querySelector("#receiptPreview");
const dialogTitle = document.querySelector("#dialogTitle");
const downloadReceipt = document.querySelector("#downloadReceipt");

let expenses = loadExpenses();
let activeReceipt = null;

removeOldInterfacePieces();

document.querySelectorAll("[data-icon]").forEach((slot) => {
  slot.innerHTML = icons[slot.dataset.icon] || "";
});

document.querySelector("#date").valueAsDate = new Date();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const receipt = await readReceipt(receiptInput.files[0]);
  const expense = {
    id: createId(),
    merchant: data.get("merchant").trim(),
    amount: Number(data.get("amount")),
    date: data.get("date"),
    category: data.get("category"),
    status: "Saved",
    employee: "Lineage Repairs",
    notes: data.get("notes").trim(),
    receipt
  };

  expenses.unshift(expense);
  saveExpenses();
  form.reset();
  document.querySelector("#date").valueAsDate = new Date();
  receiptName.textContent = "Image or PDF up to browser storage limits";
  render();
});

document.querySelector("#resetForm").addEventListener("click", () => {
  receiptName.textContent = "Image or PDF up to browser storage limits";
  activeReceipt = null;
});

receiptInput.addEventListener("change", () => {
  receiptName.textContent = receiptInput.files[0]?.name || "Image or PDF up to browser storage limits";
});

search.addEventListener("input", render);
categoryFilter.addEventListener("change", render);

document.querySelector("#navDashboard").addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

document.querySelector("#navReceipts").addEventListener("click", () => {
  document.querySelector("#receiptRecordsTitle").scrollIntoView({ behavior: "smooth", block: "start" });
});

document.querySelector("#exportCsv").addEventListener("click", () => {
  const header = ["Date", "Merchant", "Category", "Amount", "Receipt", "Receipt file", "Notes"];
  const lines = expenses.map((expense) => [
    expense.date,
    expense.merchant,
    expense.category,
    expense.amount.toFixed(2),
    expense.receipt ? "Attached" : "Missing",
    expense.receipt?.name || "",
    expense.notes
  ]);
  const csv = [header, ...lines].map((line) => line.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "company-expenses.csv";
  link.click();
  URL.revokeObjectURL(url);
});

document.querySelector("#downloadBackup").addEventListener("click", () => {
  downloadJsonBackup();
});

document.querySelector("#downloadZip").addEventListener("click", () => {
  downloadReceiptZip();
});

importBackup.addEventListener("change", async () => {
  const file = importBackup.files[0];
  if (!file) return;

  try {
    const imported = JSON.parse(await file.text());
    const importedExpenses = Array.isArray(imported) ? imported : imported.expenses;
    if (!Array.isArray(importedExpenses)) throw new Error("Missing expenses");
    expenses = importedExpenses.map(normalizeExpense);
    saveExpenses();
    render();
    alert("Backup imported.");
  } catch {
    alert("That backup file could not be imported.");
  } finally {
    importBackup.value = "";
  }
});

document.querySelector("#closeDialog").addEventListener("click", () => {
  if (receiptDialog.open) receiptDialog.close();
});

rows.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const expense = expenses.find((item) => item.id === button.dataset.id);
  if (!expense) return;

  if (button.dataset.action === "delete") {
    expenses = expenses.filter((item) => item.id !== expense.id);
    saveExpenses();
    render();
    return;
  }

  if (button.dataset.action === "view" && expense.receipt) {
    showReceipt(expense);
  }
});

render();

function removeOldInterfacePieces() {
  document.querySelector("#budgetRemaining")?.closest(".sidebar-panel")?.remove();
  document.querySelector("#budgetProgress")?.closest(".sidebar-panel")?.remove();
  document.querySelector("#sampleData")?.remove();
  document.querySelector("[data-icon='users']")?.closest("button")?.remove();
  document.querySelector("#statusFilter")?.remove();
  document.querySelector("#employee")?.closest("label")?.remove();
  document.querySelector("#status")?.closest("label")?.remove();
}

function render() {
  const filtered = getFilteredExpenses();
  rows.innerHTML = filtered.map(rowTemplate).join("");
  emptyState.classList.toggle("is-visible", filtered.length === 0);
  updateMetrics();
}

function getFilteredExpenses() {
  const query = search.value.trim().toLowerCase();
  return expenses.filter((expense) => {
    const text = `${expense.merchant} ${expense.employee} ${expense.category} ${expense.status} ${expense.notes}`.toLowerCase();
    const matchesSearch = !query || text.includes(query);
    const matchesCategory = categoryFilter.value === "All" || expense.category === categoryFilter.value;
    return matchesSearch && matchesCategory;
  });
}

function rowTemplate(expense) {
  const receiptButton = expense.receipt
    ? `<button class="text-button" type="button" data-action="view" data-id="${expense.id}">View</button>`
    : `<span class="muted">Missing</span>`;

  return `
    <tr>
      <td>${formatDate(expense.date)}</td>
      <td><strong>${escapeHtml(expense.merchant)}</strong></td>
      <td><span class="category-pill">${escapeHtml(expense.category)}</span></td>
      <td>${receiptButton}</td>
      <td class="amount-cell"><strong>${formatCurrency(expense.amount)}</strong></td>
      <td>
        <div class="row-actions">
          <button class="icon-button" type="button" data-action="delete" data-id="${expense.id}" aria-label="Delete expense" title="Delete">
            ${icons.trash}
          </button>
        </div>
      </td>
    </tr>
  `;
}

function updateMetrics() {
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const missing = expenses.filter((expense) => !expense.receipt).length;
  const average = expenses.length ? total / expenses.length : 0;

  document.querySelector("#totalSpend").textContent = formatCurrency(total);
  document.querySelector("#recordCount").textContent = expenses.length;
  document.querySelector("#missingReceipts").textContent = missing;
  document.querySelector("#averageExpense").textContent = formatCurrency(average);
  document.querySelector("#receiptTotal").textContent = expenses.length;
}

async function readReceipt(file) {
  if (!file) return null;
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return {
    name: file.name,
    type: file.type || "application/octet-stream",
    dataUrl
  };
}

function showReceipt(expense) {
  activeReceipt = expense.receipt;
  dialogTitle.textContent = `${expense.merchant} receipt`;
  downloadReceipt.href = activeReceipt.dataUrl;
  downloadReceipt.download = activeReceipt.name || `${expense.merchant}-receipt`;
  receiptPreview.innerHTML = activeReceipt.type === "application/pdf"
    ? `<embed src="${activeReceipt.dataUrl}" type="application/pdf" /><a class="primary-button" href="${activeReceipt.dataUrl}" download="${escapeHtml(activeReceipt.name || "receipt.pdf")}">Download PDF</a>`
    : `<img src="${activeReceipt.dataUrl}" alt="Receipt for ${escapeHtml(expense.merchant)}" />`;
  if (typeof receiptDialog.showModal === "function") {
    receiptDialog.showModal();
  } else {
    window.open(activeReceipt.dataUrl, "_blank");
  }
}

function loadExpenses() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveExpenses() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

function downloadJsonBackup() {
  const backup = {
    app: "Lineage Repairs Expense Tracker",
    exportedAt: new Date().toISOString(),
    expenses
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `lineage-receipts-backup-${todayStamp()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadReceiptZip() {
  const receiptExpenses = expenses.filter((expense) => expense.receipt?.dataUrl);
  if (!receiptExpenses.length) {
    alert("No receipt files are saved yet.");
    return;
  }

  const files = [
    {
      name: "receipt-summary.csv",
      bytes: textBytes(receiptCsv(receiptExpenses))
    },
    {
      name: "receipt-backup.json",
      bytes: textBytes(JSON.stringify({ exportedAt: new Date().toISOString(), expenses }, null, 2))
    }
  ];

  receiptExpenses.forEach((expense, index) => {
    files.push({
      name: receiptFileName(expense, index),
      bytes: dataUrlBytes(expense.receipt.dataUrl)
    });
  });

  const blob = createZip(files);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `lineage-receipts-${todayStamp()}.zip`;
  link.click();
  URL.revokeObjectURL(url);
}

function normalizeExpense(expense) {
  return {
    id: expense.id || createId(),
    merchant: expense.merchant || "",
    amount: Number(expense.amount || 0),
    date: expense.date || new Date().toISOString().slice(0, 10),
    category: expense.category || "Other",
    status: expense.status || "Saved",
    employee: expense.employee || "Lineage Repairs",
    notes: expense.notes || "",
    receipt: expense.receipt || null
  };
}

function csvEscape(value) {
  const clean = String(value ?? "");
  return `"${clean.replaceAll('"', '""')}"`;
}

function receiptCsv(receiptExpenses) {
  const header = ["Date", "Merchant", "Category", "Amount", "Receipt file", "Notes"];
  const lines = receiptExpenses.map((expense, index) => [
    expense.date,
    expense.merchant,
    expense.category,
    expense.amount.toFixed(2),
    receiptFileName(expense, index),
    expense.notes
  ]);
  return [header, ...lines].map((line) => line.map(csvEscape).join(",")).join("\n");
}

function receiptFileName(expense, index) {
  const original = expense.receipt?.name || "receipt";
  const extension = fileExtension(original, expense.receipt?.type);
  const merchant = slug(expense.merchant || "receipt");
  const date = expense.date || todayStamp();
  return `${date}-${merchant}-${String(index + 1).padStart(2, "0")}${extension}`;
}

function fileExtension(name, type) {
  const match = String(name).match(/\.[a-z0-9]+$/i);
  if (match) return match[0].toLowerCase();
  if (type === "application/pdf") return ".pdf";
  if (type === "image/png") return ".png";
  if (type === "image/webp") return ".webp";
  return ".jpg";
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "receipt";
}

function textBytes(value) {
  return new TextEncoder().encode(value);
}

function dataUrlBytes(dataUrl) {
  const base64 = String(dataUrl).split(",")[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function createZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  files.forEach((file) => {
    const nameBytes = textBytes(file.name);
    const bytes = file.bytes;
    const crc = crc32(bytes);
    const localHeader = zipLocalHeader(nameBytes, bytes.length, crc);
    localParts.push(localHeader, bytes);
    centralParts.push(zipCentralHeader(nameBytes, bytes.length, crc, offset));
    offset += localHeader.length + bytes.length;
  });

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = zipEnd(files.length, centralSize, offset);
  return new Blob([...localParts, ...centralParts, end], { type: "application/zip" });
}

function zipLocalHeader(nameBytes, size, crc) {
  const header = new Uint8Array(30 + nameBytes.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0x0800, true);
  view.setUint16(8, 0, true);
  setZipDate(view, 10);
  view.setUint32(14, crc, true);
  view.setUint32(18, size, true);
  view.setUint32(22, size, true);
  view.setUint16(26, nameBytes.length, true);
  header.set(nameBytes, 30);
  return header;
}

function zipCentralHeader(nameBytes, size, crc, offset) {
  const header = new Uint8Array(46 + nameBytes.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0x0800, true);
  view.setUint16(10, 0, true);
  setZipDate(view, 12);
  view.setUint32(16, crc, true);
  view.setUint32(20, size, true);
  view.setUint32(24, size, true);
  view.setUint16(28, nameBytes.length, true);
  view.setUint32(42, offset, true);
  header.set(nameBytes, 46);
  return header;
}

function zipEnd(fileCount, centralSize, centralOffset) {
  const header = new Uint8Array(22);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, fileCount, true);
  view.setUint16(10, fileCount, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, centralOffset, true);
  return header;
}

function setZipDate(view, offset) {
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  view.setUint16(offset, time, true);
  view.setUint16(offset + 2, date, true);
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function createId() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
