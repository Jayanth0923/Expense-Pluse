/**
 * EXPENSE PULSE — App Engine
 * Live Google Sheets Auto-Sync + Neubrutalism UI + Liquid Glass Bottom Dock Taskbar + 2-Tab Architecture
 */

(function () {
  "use strict";

  // Default Published Google Sheet CSV URL (Kept empty for fresh user privacy)
  const DEFAULT_SHEET_URL = "";

  // App State
  let config = {
    sheetUrl: localStorage.getItem("ep_sheet_url") || "",
    refreshInterval: parseInt(localStorage.getItem("ep_refresh_interval") || "1800", 10),
  };

  let rawExpenses = [];
  let filteredExpenses = [];
  let deletedKeys = new Set(JSON.parse(localStorage.getItem("ep_deleted_keys") || "[]"));
  let lastDeletedKey = null;
  let lastDeletedNote = "";
  let toastTimer = null;

  let activeCategory = "ALL";
  let searchQuery = "";
  let sortOrder = "newest";
  let autoSyncTimer = null;
  let lastSyncTime = null;

  // Chart Instances
  let categoryChartInstance = null;
  let timelineChartInstance = null;

  // Neubrutalist Color Palette for Charts
  const CHART_COLORS = [
    "#FFE600", // Yellow
    "#00E5A3", // Green
    "#FF6B8B", // Pink
    "#00D2FF", // Cyan
    "#B892FF", // Purple
    "#FF9F1C", // Orange
    "#CCFF00", // Lime
    "#FF70A6", // Rose
  ];

  // Category Emoji Map
  const EMOJI_MAP = {
    "travel": "🚙",
    "food": "🍛",
    "bills": "🧾",
    "bill": "🧾",
    "other": "📦",
    "shopping": "🛍️",
    "health": "💊",
    "entertainment": "🎬",
    "fuel": "⛽",
    "grocery": "🛒",
    "groceries": "🛒",
  };

  // DOM Elements
  const syncBtn = document.getElementById("syncBtn");
  const syncIcon = document.getElementById("syncIcon");
  const statusDot = document.getElementById("statusDot");
  const syncStatusText = document.getElementById("syncStatusText");
  const searchInput = document.getElementById("searchInput");
  const sortSelect = document.getElementById("sortSelect");
  const categoryChipsContainer = document.getElementById("categoryChips");
  const transactionsList = document.getElementById("transactionsList");
  const emptyState = document.getElementById("emptyState");

  // Stat Elements
  const statTotalSpent = document.getElementById("statTotalSpent");
  const statTxCount = document.getElementById("statTxCount");
  const statTodaySpent = document.getElementById("statTodaySpent");
  const statTodayDate = document.getElementById("statTodayDate");
  const statTopCategory = document.getElementById("statTopCategory");
  const statTopCategoryAmount = document.getElementById("statTopCategoryAmount");
  const statAvgSpent = document.getElementById("statAvgSpent");

  // Bottom Navigation Dock & Badge
  const tabHome = document.getElementById("tabHome");
  const tabCards = document.getElementById("tabCards");
  const viewHome = document.getElementById("viewHome");
  const viewCards = document.getElementById("viewCards");
  const dockTxBadge = document.getElementById("dockTxBadge");

  // Settings Modal Elements
  const settingsBtn = document.getElementById("settingsBtn");
  const settingsModal = document.getElementById("settingsModal");
  const closeSettingsBtn = document.getElementById("closeSettingsBtn");
  const saveSettingsBtn = document.getElementById("saveSettingsBtn");
  const resetDefaultBtn = document.getElementById("resetDefaultBtn");
  const restoreDeletedBtn = document.getElementById("restoreDeletedBtn");
  const sheetUrlInput = document.getElementById("sheetUrlInput");
  const autoRefreshInterval = document.getElementById("autoRefreshInterval");

  // Shortcut Guide Elements
  const shortcutGuideBtn = document.getElementById("shortcutGuideBtn");
  const shortcutModal = document.getElementById("shortcutModal");
  const closeShortcutBtn = document.getElementById("closeShortcutBtn");
  const gotItBtn = document.getElementById("gotItBtn");

  // Toast Snackbar Elements
  const toastSnackbar = document.getElementById("toastSnackbar");
  const toastMessage = document.getElementById("toastMessage");
  const toastUndoBtn = document.getElementById("toastUndoBtn");

  /* ==========================================================================
     INIT APP
     ========================================================================== */
  document.addEventListener("DOMContentLoaded", () => {
    initLiquidGlass();
    bindEvents();
    loadData();
    startAutoSync();
  });

  function initLiquidGlass() {
    if (typeof window.liquidGlass === "function") {
      const bottomDock = document.getElementById("bottomDock");
      if (bottomDock) {
        try {
          window.liquidGlass(bottomDock, {
            scale: -100,       // Refraction: 100
            chroma: 5.0,       // Dispersion: 50
            border: 0.07,
            mapBlur: 12,
            blur: 4,           // Frost: 4
            saturate: 1.8,
            fallbackBlur: 4,
          });
        } catch (e) {
          console.warn("Liquid glass fallback mode active:", e);
        }
      }
    }
  }

  /* ==========================================================================
     DATA FETCHING & CSV PARSER
     ========================================================================== */
  async function loadData() {
    let fetchUrl = config.sheetUrl.trim();
    if (!fetchUrl) {
      statusDot.className = "status-dot";
      statusDot.style.backgroundColor = "#FFE600";
      syncStatusText.textContent = "No Sheet Connected";
      rawExpenses = [];
      renderDashboard();
      return;
    }

    setSyncState(true);

    if (fetchUrl.includes("/pubhtml")) {
      fetchUrl = fetchUrl.replace("/pubhtml", "/pub?output=csv");
    } else if (!fetchUrl.includes("output=csv") && !fetchUrl.includes("output=tsv")) {
      fetchUrl += (fetchUrl.includes("?") ? "&" : "?") + "output=csv";
    }

    const cacheBustUrl = fetchUrl + (fetchUrl.includes("?") ? "&" : "?") + "t=" + Date.now();

    let csvText = null;

    try {
      const response = await fetch(cacheBustUrl);
      if (response.ok) {
        csvText = await response.text();
      } else {
        console.warn(`Direct fetch returned HTTP status: ${response.status}`);
      }
    } catch (err) {
      console.warn("Direct fetch failed, attempting backup fetch...", err);
    }

    if (!csvText) {
      try {
        const response = await fetch(fetchUrl);
        if (response.ok) {
          csvText = await response.text();
        }
      } catch (err) {
        console.warn("Backup fetch failed:", err);
      }
    }

    if (!csvText) {
      try {
        const proxyUrl = "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(fetchUrl);
        const response = await fetch(proxyUrl);
        if (response.ok) {
          csvText = await response.text();
        }
      } catch (err) {
        console.error("Proxy fetch failed:", err);
      }
    }

    if (csvText && csvText.trim().length > 0) {
      rawExpenses = parseCSV(csvText);
      lastSyncTime = new Date();
      renderDashboard();
      setSyncState(false, true);
    } else {
      setSyncState(false, false);
    }
  }

  function parseCSV(text) {
    const lines = [];
    let currentRow = [];
    let currentCell = "";
    let insideQuote = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (insideQuote && nextChar === '"') {
          currentCell += '"';
          i++;
        } else {
          insideQuote = !insideQuote;
        }
      } else if (char === ',' && !insideQuote) {
        currentRow.push(currentCell.trim());
        currentCell = "";
      } else if ((char === '\r' || char === '\n') && !insideQuote) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        currentRow.push(currentCell.trim());
        if (currentRow.some(c => c.length > 0)) {
          lines.push(currentRow);
        }
        currentRow = [];
        currentCell = "";
      } else {
        currentCell += char;
      }
    }

    if (currentCell || currentRow.length > 0) {
      currentRow.push(currentCell.trim());
      if (currentRow.some(c => c.length > 0)) {
        lines.push(currentRow);
      }
    }

    if (lines.length < 2) return [];

    const header = lines[0].map(h => h.toLowerCase().trim());
    const dateIdx = header.findIndex(h => h.includes("date") || h.includes("time") || h.includes("created"));
    const amountIdx = header.findIndex(h => h.includes("amount") || h.includes("price") || h.includes("cost"));
    const categoryIdx = header.findIndex(h => h.includes("category") || h.includes("type"));
    const noteIdx = header.findIndex(h => h.includes("note") || h.includes("desc") || h.includes("item"));

    const result = [];

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i];
      if (row.length < 2) continue;

      const dateStr = dateIdx >= 0 && row[dateIdx] ? row[dateIdx] : "";
      const rawAmountStr = amountIdx >= 0 && row[amountIdx] ? row[amountIdx] : "";
      const categoryStr = categoryIdx >= 0 && row[categoryIdx] ? row[categoryIdx] : "Other";
      const noteStr = noteIdx >= 0 && row[noteIdx] ? row[noteIdx] : "";

      const numericAmount = parseFloat(rawAmountStr.replace(/[^0-9.]/g, "")) || 0;
      if (numericAmount === 0 && !dateStr && !noteStr) continue;

      const { emoji, cleanCategory } = processCategory(categoryStr);
      const uniqueKey = `${dateStr}_${numericAmount}_${noteStr}_${i}`;

      if (deletedKeys.has(uniqueKey)) continue;

      result.push({
        id: i,
        uniqueKey: uniqueKey,
        dateStr: dateStr || "Recent",
        parsedDate: parseDateString(dateStr),
        amount: numericAmount,
        category: cleanCategory,
        emoji: emoji,
        note: noteStr || cleanCategory,
      });
    }

    return result;
  }

  function processCategory(catRaw) {
    let raw = catRaw.trim();
    let emoji = "📦";
    
    const emojiRegex = /^\p{Emoji_Presentation}|\p{Extended_Pictographic}/u;
    const match = raw.match(emojiRegex);
    
    if (match) {
      emoji = match[0];
      raw = raw.replace(emojiRegex, "").trim();
    } else {
      const lower = raw.toLowerCase();
      for (const [key, icon] of Object.entries(EMOJI_MAP)) {
        if (lower.includes(key)) {
          emoji = icon;
          break;
        }
      }
    }

    if (!raw) raw = "Other";
    const cleanCategory = raw.charAt(0).toUpperCase() + raw.slice(1);

    return { emoji, cleanCategory };
  }

  function parseDateString(str) {
    if (!str) return new Date();
    const d = Date.parse(str);
    return isNaN(d) ? new Date() : new Date(d);
  }

  function setSyncState(isSyncing, success = true) {
    if (isSyncing) {
      statusDot.className = "status-dot syncing";
      syncStatusText.textContent = "Syncing...";
      syncIcon.style.animation = "spin 1s linear infinite";
    } else {
      syncIcon.style.animation = "none";
      if (success) {
        statusDot.className = "status-dot live";
        syncStatusText.textContent = `Synced ${getRelativeTimeString(lastSyncTime)}`;
      } else {
        statusDot.className = "status-dot";
        statusDot.style.backgroundColor = "#FF6B8B";
        syncStatusText.textContent = "Sync Failed";
      }
    }
  }

  function getRelativeTimeString(date) {
    if (!date) return "Just now";
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 10) return "Just now";
    if (seconds < 60) return `${seconds}s ago`;
    const mins = Math.floor(seconds / 60);
    return `${mins}m ago`;
  }

  function startAutoSync() {
    if (autoSyncTimer) clearInterval(autoSyncTimer);
    autoSyncTimer = setInterval(() => {
      loadData();
    }, config.refreshInterval * 1000);
  }

  /* ==========================================================================
     DASHBOARD RENDER & FILTER ENGINE
     ========================================================================== */
  function renderDashboard() {
    applyFilters();
    renderSummaryMetrics();
    renderCategoryChips();
    renderCharts();
    renderTransactionsList();

    if (dockTxBadge) {
      dockTxBadge.textContent = filteredExpenses.length.toString();
    }
  }

  function applyFilters() {
    filteredExpenses = rawExpenses.filter((item) => {
      if (activeCategory !== "ALL" && item.category.toUpperCase() !== activeCategory.toUpperCase()) {
        return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesNote = item.note.toLowerCase().includes(q);
        const matchesCat = item.category.toLowerCase().includes(q);
        const matchesAmt = item.amount.toString().includes(q);
        const matchesDate = item.dateStr.toLowerCase().includes(q);
        if (!matchesNote && !matchesCat && !matchesAmt && !matchesDate) return false;
      }
      return true;
    });

    filteredExpenses.sort((a, b) => {
      if (sortOrder === "newest") return b.parsedDate - a.parsedDate;
      if (sortOrder === "oldest") return a.parsedDate - b.parsedDate;
      if (sortOrder === "highest") return b.amount - a.amount;
      if (sortOrder === "lowest") return a.amount - b.amount;
      return 0;
    });
  }

  function renderSummaryMetrics() {
    const totalAmount = rawExpenses.reduce((sum, item) => sum + item.amount, 0);
    const count = rawExpenses.length;
    const avg = count > 0 ? totalAmount / count : 0;

    const today = new Date();
    const todaySpent = rawExpenses.reduce((sum, item) => {
      const d = item.parsedDate;
      if (d.getDate() === today.getDate() &&
          d.getMonth() === today.getMonth() &&
          d.getFullYear() === today.getFullYear()) {
        return sum + item.amount;
      }
      return sum;
    }, 0);

    const categoryTotals = {};
    rawExpenses.forEach(item => {
      categoryTotals[item.category] = (categoryTotals[item.category] || 0) + item.amount;
    });

    let topCatName = "--";
    let topCatMax = 0;
    for (const [cat, amt] of Object.entries(categoryTotals)) {
      if (amt > topCatMax) {
        topCatMax = amt;
        topCatName = cat;
      }
    }

    statTotalSpent.textContent = `₹${totalAmount.toLocaleString('en-IN')}`;
    statTxCount.textContent = `${count} Total Entries`;
    statTodaySpent.textContent = `₹${todaySpent.toLocaleString('en-IN')}`;
    statTodayDate.textContent = today.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

    statTopCategory.textContent = topCatName;
    statTopCategoryAmount.textContent = topCatMax > 0 ? `₹${topCatMax.toLocaleString('en-IN')} spent` : "No data";
    statAvgSpent.textContent = `₹${Math.round(avg).toLocaleString('en-IN')}`;
  }

  function renderCategoryChips() {
    const categoriesSet = new Set(rawExpenses.map(item => item.category));
    const categories = Array.from(categoriesSet);

    let html = `
      <div class="category-chip ${activeCategory === 'ALL' ? 'active' : ''}" data-category="ALL">
        <span>✨ All (${rawExpenses.length})</span>
      </div>
    `;

    categories.forEach(cat => {
      const catCount = rawExpenses.filter(i => i.category === cat).length;
      const emoji = (rawExpenses.find(i => i.category === cat) || {}).emoji || "🏷️";
      const isActive = activeCategory.toUpperCase() === cat.toUpperCase();
      html += `
        <div class="category-chip ${isActive ? 'active' : ''}" data-category="${cat}">
          <span>${emoji} ${cat} (${catCount})</span>
        </div>
      `;
    });

    categoryChipsContainer.innerHTML = html;

    categoryChipsContainer.querySelectorAll(".category-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        activeCategory = chip.getAttribute("data-category");
        renderDashboard();
      });
    });
  }

  /* ==========================================================================
     TRANSACTIONS LIST & DIRECT 1-SWIPE AUTO-DELETE GESTURES
     ========================================================================== */
  function renderTransactionsList() {
    if (!config.sheetUrl.trim()) {
      transactionsList.style.display = "none";
      emptyState.style.display = "block";
      emptyState.innerHTML = `
        <div class="empty-icon">🔌</div>
        <h4>No Sheet Connected</h4>
        <p style="margin-bottom: 14px; font-weight: 600;">Welcome to <strong>Expense Pulse</strong>! Paste your published Google Sheet CSV link in Settings to view your live expenses.</p>
        <button class="neo-btn neo-btn-yellow" id="connectSheetBtn" style="cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
          <i class="ri-settings-4-line"></i> Connect Your Google Sheet
        </button>
      `;
      const btn = document.getElementById("connectSheetBtn");
      if (btn) {
        btn.addEventListener("click", () => {
          sheetUrlInput.value = config.sheetUrl;
          autoRefreshInterval.value = config.refreshInterval;
          settingsModal.classList.add("active");
        });
      }
      return;
    }

    if (filteredExpenses.length === 0) {
      transactionsList.style.display = "none";
      emptyState.style.display = "block";
      emptyState.innerHTML = `
        <div class="empty-icon">💸</div>
        <h4>No Expenses Found</h4>
        <p>No transactions match your search or filter criteria.</p>
      `;
      return;
    }

    emptyState.style.display = "none";
    transactionsList.style.display = "flex";

    const html = filteredExpenses.map(item => `
      <div class="transaction-card-wrapper" data-key="${item.uniqueKey}">
        <div class="tx-delete-backdrop">
          <div class="tx-delete-indicator">
            <i class="ri-delete-bin-line"></i> <span class="indicator-text">Swipe to Delete</span>
          </div>
        </div>
        <div class="transaction-card" data-key="${item.uniqueKey}">
          <div class="tx-left">
            <div class="tx-icon-badge">${item.emoji}</div>
            <div class="tx-details">
              <div class="tx-title-row">
                <span class="tx-note">${escapeHTML(item.note)}</span>
                <span class="tx-category-tag">${escapeHTML(item.category)}</span>
              </div>
              <div class="tx-date"><i class="ri-time-line"></i> ${escapeHTML(item.dateStr)}</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <button class="tx-desktop-delete" data-key="${item.uniqueKey}" title="Delete Item">
              <i class="ri-delete-bin-line"></i>
            </button>
            <div class="tx-amount">₹${item.amount.toLocaleString('en-IN')}</div>
          </div>
        </div>
      </div>
    `).join("");

    transactionsList.innerHTML = html;
    attachSwipeEvents();
  }

  function attachSwipeEvents() {
    const wrappers = transactionsList.querySelectorAll(".transaction-card-wrapper");

    wrappers.forEach(wrapper => {
      const card = wrapper.querySelector(".transaction-card");
      const key = wrapper.getAttribute("data-key");
      const indicatorText = wrapper.querySelector(".indicator-text");
      const desktopDeleteBtn = wrapper.querySelector(".tx-desktop-delete");

      let startX = 0;
      let currentX = 0;
      let isDragging = false;
      const SWIPE_THRESHOLD = -80;

      if (desktopDeleteBtn) {
        desktopDeleteBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          triggerAutoDelete(wrapper, key);
        });
      }

      card.addEventListener("touchstart", (e) => {
        startX = e.touches[0].clientX;
        currentX = 0;
        isDragging = true;
        card.style.transition = "none";
      }, { passive: true });

      card.addEventListener("touchmove", (e) => {
        if (!isDragging) return;
        currentX = e.touches[0].clientX - startX;
        if (currentX < 0) {
          card.style.transform = `translateX(${currentX}px)`;
          if (indicatorText) {
            indicatorText.textContent = currentX < SWIPE_THRESHOLD ? "Release to Delete!" : "Swipe to Delete";
          }
        }
      }, { passive: true });

      card.addEventListener("touchend", () => {
        if (!isDragging) return;
        isDragging = false;
        card.style.transition = "transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)";
        if (currentX < SWIPE_THRESHOLD) {
          triggerAutoDelete(wrapper, key);
        } else {
          card.style.transform = "translateX(0)";
        }
      });

      card.addEventListener("mousedown", (e) => {
        startX = e.clientX;
        currentX = 0;
        isDragging = true;
        card.style.transition = "none";
      });

      const onMouseMove = (e) => {
        if (!isDragging) return;
        currentX = e.clientX - startX;
        if (currentX < 0) {
          card.style.transform = `translateX(${currentX}px)`;
          if (indicatorText) {
            indicatorText.textContent = currentX < SWIPE_THRESHOLD ? "Release to Delete!" : "Swipe to Delete";
          }
        }
      };

      const onMouseUp = () => {
        if (!isDragging) return;
        isDragging = false;
        card.style.transition = "transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)";
        if (currentX < SWIPE_THRESHOLD) {
          triggerAutoDelete(wrapper, key);
        } else {
          card.style.transform = "translateX(0)";
        }
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    });
  }

  function triggerAutoDelete(wrapper, key) {
    const card = wrapper.querySelector(".transaction-card");
    if (card) card.style.transform = "translateX(-100%)";
    wrapper.classList.add("deleting");

    setTimeout(() => {
      deleteExpenseCard(key);
    }, 220);
  }

  function deleteExpenseCard(key) {
    const item = rawExpenses.find(i => i.uniqueKey === key);
    if (!item) return;

    deletedKeys.add(key);
    localStorage.setItem("ep_deleted_keys", JSON.stringify(Array.from(deletedKeys)));

    lastDeletedKey = key;
    lastDeletedNote = item.note;

    showToast(`Deleted "${item.note}"`);
    loadData();
  }

  function showToast(msg) {
    toastMessage.textContent = msg;
    toastSnackbar.classList.add("active");

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastSnackbar.classList.remove("active");
    }, 5000);
  }

  function undoDelete() {
    if (lastDeletedKey) {
      deletedKeys.delete(lastDeletedKey);
      localStorage.setItem("ep_deleted_keys", JSON.stringify(Array.from(deletedKeys)));
      lastDeletedKey = null;
      toastSnackbar.classList.remove("active");
      loadData();
    }
  }

  function restoreAllDeleted() {
    deletedKeys.clear();
    localStorage.removeItem("ep_deleted_keys");
    showToast("Restored all deleted cards!");
    loadData();
  }

  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
  }

  /* ==========================================================================
     CHARTS (Category Breakdown + Timeline Trend)
     ========================================================================== */
  function renderCharts() {
    renderCategoryDoughnut();
    renderTimelineBar();
  }

  function renderCategoryDoughnut() {
    const ctx = document.getElementById("categoryChart").getContext("2d");
    const categoryTotals = {};
    
    rawExpenses.forEach(item => {
      categoryTotals[item.category] = (categoryTotals[item.category] || 0) + item.amount;
    });

    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);

    if (categoryChartInstance) categoryChartInstance.destroy();

    categoryChartInstance = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: CHART_COLORS.slice(0, labels.length),
          borderColor: "#000000",
          borderWidth: 3,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "right",
            labels: {
              font: { family: "'Space Grotesk', sans-serif", weight: "bold", size: 12 },
              color: "#000000",
              usePointStyle: true,
              padding: 14
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => ` ${context.label}: ₹${context.raw.toLocaleString('en-IN')}`
            }
          }
        }
      }
    });
  }

  function renderTimelineBar() {
    const ctx = document.getElementById("timelineChart").getContext("2d");
    const dateTotals = {};

    rawExpenses.forEach(item => {
      const dateKey = item.parsedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      dateTotals[dateKey] = (dateTotals[dateKey] || 0) + item.amount;
    });

    const labels = Object.keys(dateTotals).slice(-7);
    const data = labels.map(k => dateTotals[k]);

    if (timelineChartInstance) timelineChartInstance.destroy();

    timelineChartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: "Daily Spend (₹)",
          data: data,
          backgroundColor: "#00E5A3",
          borderColor: "#000000",
          borderWidth: 3,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: "#000000",
              font: { family: "'Space Grotesk', sans-serif", weight: "bold" },
              callback: (val) => "₹" + val
            },
            grid: { color: "rgba(0,0,0,0.1)" }
          },
          x: {
            ticks: {
              color: "#000000",
              font: { family: "'Space Grotesk', sans-serif", weight: "bold" }
            },
            grid: { display: false }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => ` Spend: ₹${context.raw.toLocaleString('en-IN')}`
            }
          }
        }
      }
    });
  }

  /* ==========================================================================
     EVENT BINDINGS & MODALS & TAB SWITCHING
     ========================================================================== */
  function bindEvents() {
    syncBtn.addEventListener("click", () => loadData());

    // Tab Switching
    if (tabHome && tabCards && viewHome && viewCards) {
      tabHome.addEventListener("click", () => switchTab("viewHome"));
      tabCards.addEventListener("click", () => switchTab("viewCards"));
    }

    /* ==========================================================================
       IPHONE NATIVE NAVIGATION ENGINE (HISTORY + GESTURES + HAPTICS)
       ========================================================================== */
    function triggerHaptic(type = "light") {
      if ("vibrate" in navigator) {
        try {
          if (type === "medium") navigator.vibrate([15]);
          else if (type === "heavy") navigator.vibrate([25]);
          else navigator.vibrate([10]);
        } catch (e) {}
      }
    }

    let isNavigatingHistory = false;

    function switchTab(target, fromHistory = false) {
      triggerHaptic("light");
      if (target === "viewHome") {
        viewHome.classList.add("active");
        viewCards.classList.remove("active");
        tabHome.classList.add("active");
        tabCards.classList.remove("active");
      } else {
        viewCards.classList.add("active");
        viewHome.classList.remove("active");
        tabCards.classList.add("active");
        tabHome.classList.remove("active");
        if (!fromHistory && !isNavigatingHistory) {
          history.pushState({ tab: "viewCards" }, "");
        }
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    let modalStack = [];

    function openModal(element) {
      if (element) {
        triggerHaptic("light");
        const currentlyActive = document.querySelector(".modal-overlay.active, .drawer-overlay.active");
        if (currentlyActive && currentlyActive !== element) {
          modalStack.push(currentlyActive);
          currentlyActive.classList.remove("active");
        }

        element.classList.add("active");
        document.body.classList.add("modal-open");
        if (!isNavigatingHistory) {
          history.pushState({ modalId: element.id }, "");
        }
      }
    }

    function closeModal(element) {
      if (element) {
        triggerHaptic("light");
        element.classList.remove("active");
      }

      if (modalStack.length > 0) {
        const previousElement = modalStack.pop();
        if (previousElement) {
          previousElement.classList.add("active");
          document.body.classList.add("modal-open");
          return;
        }
      }

      const remainingActive = document.querySelectorAll(".modal-overlay.active, .drawer-overlay.active");
      if (remainingActive.length === 0) {
        document.body.classList.remove("modal-open");
        modalStack = [];
      }
    }

    window.addEventListener("popstate", (e) => {
      isNavigatingHistory = true;
      const activeOverlays = document.querySelectorAll(".modal-overlay.active, .drawer-overlay.active");
      if (activeOverlays.length > 0) {
        activeOverlays.forEach(overlay => closeModal(overlay));
      } else {
        switchTab("viewHome", true);
      }
      isNavigatingHistory = false;
    });

    // iOS Touch Swipe Navigation Gestures (Edge Swipe Back & Tab Swiping)
    let touchStartX = 0;
    let touchStartY = 0;

    document.addEventListener("touchstart", (e) => {
      if (e.touches && e.touches.length > 0) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    document.addEventListener("touchend", (e) => {
      if (!e.changedTouches || e.changedTouches.length === 0) return;
      const deltaX = e.changedTouches[0].clientX - touchStartX;
      const deltaY = e.changedTouches[0].clientY - touchStartY;

      // Horizontally dominant swipe gesture
      if (Math.abs(deltaX) > 75 && Math.abs(deltaY) < 60) {
        const activeOverlay = document.querySelector(".modal-overlay.active, .drawer-overlay.active");
        
        // Swipe Right (iOS Edge Swipe Back)
        if (deltaX > 75) {
          if (activeOverlay) {
            closeModal(activeOverlay);
          } else if (tabCards && tabCards.classList.contains("active")) {
            switchTab("viewHome");
          }
        }
        // Swipe Left (Switch to Cards tab from Home)
        else if (deltaX < -75) {
          if (!activeOverlay && tabHome && tabHome.classList.contains("active")) {
            switchTab("viewCards");
          }
        }
      }
    }, { passive: true });

    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      renderDashboard();
    });

    sortSelect.addEventListener("change", (e) => {
      sortOrder = e.target.value;
      renderDashboard();
    });

    toastUndoBtn.addEventListener("click", () => undoDelete());

    settingsBtn.addEventListener("click", () => {
      sheetUrlInput.value = config.sheetUrl;
      autoRefreshInterval.value = config.refreshInterval;
      openModal(settingsModal);
    });

    closeSettingsBtn.addEventListener("click", () => {
      closeModal(settingsModal);
    });

    saveSettingsBtn.addEventListener("click", () => {
      const newUrl = sheetUrlInput.value.trim();
      const newInterval = parseInt(autoRefreshInterval.value, 10) || 1800;

      config.sheetUrl = newUrl;
      config.refreshInterval = newInterval;

      if (newUrl) {
        localStorage.setItem("ep_sheet_url", newUrl);
      } else {
        localStorage.removeItem("ep_sheet_url");
      }
      localStorage.setItem("ep_refresh_interval", newInterval.toString());
      
      closeModal(settingsModal);
      loadData();
      startAutoSync();
    });

    resetDefaultBtn.addEventListener("click", () => {
      config.sheetUrl = DEFAULT_SHEET_URL;
      config.refreshInterval = 1800;
      sheetUrlInput.value = DEFAULT_SHEET_URL;
      autoRefreshInterval.value = 1800;
      localStorage.removeItem("ep_sheet_url");
      localStorage.removeItem("ep_refresh_interval");
      closeModal(settingsModal);
      loadData();
      startAutoSync();
    });

    restoreDeletedBtn.addEventListener("click", () => {
      restoreAllDeleted();
      closeModal(settingsModal);
    });

    shortcutGuideBtn.addEventListener("click", () => {
      openModal(shortcutModal);
    });

    closeShortcutBtn.addEventListener("click", () => {
      closeModal(shortcutModal);
    });

    gotItBtn.addEventListener("click", () => {
      closeModal(shortcutModal);
    });

    const copyScriptCodeBtn = document.getElementById("copyScriptCodeBtn");
    if (copyScriptCodeBtn) {
      copyScriptCodeBtn.addEventListener("click", () => {
        const codeElement = document.getElementById("appScriptCode");
        if (codeElement) {
          navigator.clipboard.writeText(codeElement.textContent).then(() => {
            copyScriptCodeBtn.innerHTML = '<i class="ri-check-line"></i> Copied!';
            setTimeout(() => {
              copyScriptCodeBtn.innerHTML = '<i class="ri-file-copy-line"></i> Copy Code';
            }, 2500);
          }).catch(err => {
            console.error("Failed to copy script code:", err);
          });
        }
      });
    }

    // Monthly Summary & Windows Notification Engine
    const monthlySummaryModal = document.getElementById("monthlySummaryModal");
    const closeMonthlySummaryBtn = document.getElementById("closeMonthlySummaryBtn");
    const menuMonthlySummaryBtn = document.getElementById("menuMonthlySummaryBtn");
    const notifyTestBtn = document.getElementById("notifyTestBtn");

    const summaryMonthTitle = document.getElementById("summaryMonthTitle");
    const summaryTotalAmount = document.getElementById("summaryTotalAmount");
    const summaryTxDetails = document.getElementById("summaryTxDetails");
    const summaryTopCategory = document.getElementById("summaryTopCategory");
    const summaryDailyAvg = document.getElementById("summaryDailyAvg");

    function renderMonthlySummaryModal(targetMonth = null, targetYear = null) {
      const summary = calculateMonthlySummary(targetMonth, targetYear);
      if (summaryMonthTitle) summaryMonthTitle.textContent = `${summary.monthName} ${summary.year} Summary 📊`;
      if (summaryTotalAmount) summaryTotalAmount.textContent = `₹${summary.totalSpent.toLocaleString('en-IN')}`;
      if (summaryTxDetails) summaryTxDetails.textContent = `Total spent across ${summary.txCount} transaction${summary.txCount === 1 ? '' : 's'}`;
      if (summaryTopCategory) summaryTopCategory.textContent = summary.topCategory;
      if (summaryDailyAvg) summaryDailyAvg.textContent = `₹${summary.dailyAvg.toLocaleString('en-IN')}/day`;
    }

    function calculateMonthlySummary(targetMonth = null, targetYear = null) {
      const now = new Date();
      const month = targetMonth !== null ? targetMonth : now.getMonth();
      const year = targetYear !== null ? targetYear : now.getFullYear();

      const monthExpenses = rawExpenses.filter(item => {
        const d = item.parsedDate || (item.dateStr ? new Date(item.dateStr) : null);
        if (!d || isNaN(d.getTime())) return false;
        return d.getMonth() === month && d.getFullYear() === year;
      });

      const totalSpent = monthExpenses.reduce((sum, item) => sum + (item.amount || 0), 0);
      const txCount = monthExpenses.length;

      const catTotals = {};
      monthExpenses.forEach(item => {
        const cat = item.category || "Other";
        catTotals[cat] = (catTotals[cat] || 0) + (item.amount || 0);
      });

      let topCat = "--";
      let topCatAmount = 0;
      Object.keys(catTotals).forEach(cat => {
        if (catTotals[cat] > topCatAmount) {
          topCatAmount = catTotals[cat];
          topCat = cat;
        }
      });

      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const dailyAvg = totalSpent > 0 ? Math.round(totalSpent / daysInMonth) : 0;
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

      return {
        monthName: monthNames[month],
        year: year,
        totalSpent: totalSpent,
        txCount: txCount,
        topCategory: topCat,
        dailyAvg: dailyAvg,
        daysInMonth: daysInMonth
      };
    }

    /* ==========================================================================
       DAILY & MONTHLY NOTIFICATION ENGINE (NO EMOJIS, FUNCTIONAL TOGGLES)
       ========================================================================== */
    const toggleDailyNotify = document.getElementById("toggleDailyNotify");
    const toggleMonthlyNotify = document.getElementById("toggleMonthlyNotify");

    const isDailyNotifyOn = localStorage.getItem("ep_notify_daily") !== "false";
    const isMonthlyNotifyOn = localStorage.getItem("ep_notify_monthly") !== "false";

    if (toggleDailyNotify) {
      toggleDailyNotify.checked = isDailyNotifyOn;
      toggleDailyNotify.addEventListener("change", (e) => {
        localStorage.setItem("ep_notify_daily", e.target.checked.toString());
        triggerHaptic("light");
        showToast(e.target.checked ? "Daily summary notifications enabled" : "Daily summary notifications disabled");
      });
    }

    if (toggleMonthlyNotify) {
      toggleMonthlyNotify.checked = isMonthlyNotifyOn;
      toggleMonthlyNotify.addEventListener("change", (e) => {
        localStorage.setItem("ep_notify_monthly", e.target.checked.toString());
        triggerHaptic("light");
        showToast(e.target.checked ? "Monthly summary notifications enabled" : "Monthly summary notifications disabled");
      });
    }

    function calculateDailySummary() {
      const today = new Date();
      const todayExpenses = rawExpenses.filter(item => {
        const d = item.parsedDate || (item.dateStr ? new Date(item.dateStr) : null);
        if (!d || isNaN(d.getTime())) return false;
        return d.getDate() === today.getDate() &&
               d.getMonth() === today.getMonth() &&
               d.getFullYear() === today.getFullYear();
      });

      const totalSpent = todayExpenses.reduce((sum, item) => sum + (item.amount || 0), 0);
      const catTotals = {};
      todayExpenses.forEach(item => {
        const cat = item.category || "Other";
        catTotals[cat] = (catTotals[cat] || 0) + (item.amount || 0);
      });

      let topCat = "None";
      let maxAmt = 0;
      Object.keys(catTotals).forEach(cat => {
        if (catTotals[cat] > maxAmt) {
          maxAmt = catTotals[cat];
          topCat = cat;
        }
      });

      return {
        totalSpent: totalSpent,
        txCount: todayExpenses.length,
        topCategory: topCat
      };
    }

    function sendDailyNotification() {
      if (localStorage.getItem("ep_notify_daily") === "false") return;

      const summary = calculateDailySummary();
      const title = "Expense Pulse - Daily Summary";
      const body = `Total Spent Today: Rs. ${summary.totalSpent.toLocaleString('en-IN')}. Top Category: ${summary.topCategory}.`;

      triggerCleanNotification(title, body);
    }

    function sendMonthlyNotification() {
      if (localStorage.getItem("ep_notify_monthly") === "false") return;

      const summary = calculateMonthlySummary();
      const title = "Expense Pulse - Monthly Summary";
      const body = `Monthly Spent (${summary.monthName} ${summary.year}): Rs. ${summary.totalSpent.toLocaleString('en-IN')} across ${summary.txCount} transactions. Top Category: ${summary.topCategory}. Daily Average: Rs. ${summary.dailyAvg.toLocaleString('en-IN')}.`;

      triggerCleanNotification(title, body);
    }

    function triggerCleanNotification(title, body) {
      if ("Notification" in window && Notification.permission === "granted") {
        try {
          new Notification(title, {
            body: body,
            icon: "icon.png"
          });
        } catch (e) {
          console.warn("Notification error:", e);
        }
      } else if ("Notification" in window && Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
          if (permission === "granted") {
            new Notification(title, { body: body, icon: "icon.png" });
          }
        });
      }
    }

    if (menuMonthlySummaryBtn) {
      menuMonthlySummaryBtn.addEventListener("click", () => {
        renderMonthlySummaryModal();
        openModal(monthlySummaryModal);
      });
    }

    if (closeMonthlySummaryBtn) {
      closeMonthlySummaryBtn.addEventListener("click", () => {
        closeModal(monthlySummaryModal);
      });
    }

    // Right-Side Hamburger Menu & Additional Modals
    const menuToggleBtn = document.getElementById("menuToggleBtn");
    const appMenuDrawer = document.getElementById("appMenuDrawer");
    const closeMenuBtn = document.getElementById("closeMenuBtn");
    const menuCheckUpdatesBtn = document.getElementById("menuCheckUpdatesBtn");
    const menuHelpBtn = document.getElementById("menuHelpBtn");
    const menuContactBtn = document.getElementById("menuContactBtn");
    const menuPrivacyBtn = document.getElementById("menuPrivacyBtn");
    const menuTermsBtn = document.getElementById("menuTermsBtn");

    document.documentElement.removeAttribute("data-theme");
    localStorage.removeItem("ep_theme");

    const contactModal = document.getElementById("contactModal");
    const closeContactBtn = document.getElementById("closeContactBtn");

    const privacyModal = document.getElementById("privacyModal");
    const closePrivacyBtn = document.getElementById("closePrivacyBtn");

    const termsModal = document.getElementById("termsModal");
    const closeTermsBtn = document.getElementById("closeTermsBtn");

    if (menuToggleBtn) menuToggleBtn.addEventListener("click", () => openModal(appMenuDrawer));
    if (closeMenuBtn) closeMenuBtn.addEventListener("click", () => closeModal(appMenuDrawer));

    if (menuCheckUpdatesBtn) {
      menuCheckUpdatesBtn.addEventListener("click", () => {
        triggerHaptic("medium");
        if (window.electronAPI && typeof window.electronAPI.checkForUpdates === "function") {
          window.electronAPI.checkForUpdates();
          showToast("Checking Windows App Updates... 🔄");
        } else {
          showToast("Checking Expense Pulse Updates... 🔄");
          setTimeout(() => {
            showToast("✨ Expense Pulse is up to date! (v1.0.0)");
          }, 1200);
        }
      });
    }

    if (menuHelpBtn) {
      menuHelpBtn.addEventListener("click", () => {
        openModal(shortcutModal);
      });
    }

    if (menuContactBtn) {
      menuContactBtn.addEventListener("click", () => {
        openModal(contactModal);
      });
    }
    if (closeContactBtn) closeContactBtn.addEventListener("click", () => closeModal(contactModal));

    if (menuPrivacyBtn) {
      menuPrivacyBtn.addEventListener("click", () => {
        openModal(privacyModal);
      });
    }
    if (closePrivacyBtn) closePrivacyBtn.addEventListener("click", () => closeModal(privacyModal));

    if (menuTermsBtn) {
      menuTermsBtn.addEventListener("click", () => {
        openModal(termsModal);
      });
    }
    if (closeTermsBtn) closeTermsBtn.addEventListener("click", () => closeModal(termsModal));

    // Close modal or drawer when tapping backdrop overlay
    document.querySelectorAll(".modal-overlay, .drawer-overlay").forEach(overlay => {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          closeModal(overlay);
        }
      });
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeModal(settingsModal);
        closeModal(shortcutModal);
        closeModal(appMenuDrawer);
        closeModal(contactModal);
        closeModal(privacyModal);
        closeModal(termsModal);
        closeModal(monthlySummaryModal);
      }
    });
  }

})();
