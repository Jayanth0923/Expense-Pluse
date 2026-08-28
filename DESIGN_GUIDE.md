# 🎨 Expense Pulse - Neubrutalist Design System & Style Guide

**Expense Pulse** features a custom **Neubrutalism + Liquid Glass Hybrid Design Language**. It combines bold, high-contrast, black-bordered typography cards with smooth Apple-style backdrop-blur glassmorphism.

---

## 🎨 Color Palette & Design Tokens

### Primary Neubrutalist Pop Colors:
* **Pop Yellow**: #FFE600 (Header banner, Monthly Summary accent)
* **Pop Green**: #00E5A3 (Total Expenses card, Daily Average)
* **Pop Cyan**: #00D2FF (Today's Spend card, Sync action button)
* **Pop Pink**: #FF6B8B (Average spend per expense, Setup guide button)
* **Pop Purple**: #B892FF (Top Category card)
* **Pop Orange**: #FF9F1C (Terms accent)

### Canvas & Surfaces:
* **Canvas Background (--bg-main)**: #F4EFEE with dot grid overlay
* **Card Surface (--card-bg)**: #FFFFFF
* **Borders (--border-color)**: #000000 (Solid 3px / 4px borders)
* **Shadows (--shadow-offset)**: 4px 4px 0px #000000 (Sharp 90° box shadows)

---

## 📐 Typography Rules

* **Headings**: 'Space Grotesk', sans-serif (Font Weight: 700 / 800)
* **Body Text**: 'Outfit', sans-serif (Font Weight: 500 / 600 / 700)

---

## 📱 Components & Architecture

### 1. Header Banner (.header-banner)
* High-contrast pop yellow container with thick 4px solid black border and 6px sharp shadow.
* Contains studio title, subtitle, sync button, and settings toggle.

### 2. Metric Stat Cards (.stat-card)
* 2x2 grid layout on mobile, 4-column row on desktop.
* Colored background pop surfaces with white icon badges (order: 2px solid #000; box-shadow: 2px 2px 0px #000).

### 3. Apple-Style Liquid Glass Bottom Taskbar (.bottom-dock)
* Backdrop blur: lur(24px) saturate(210%) contrast(108%).
* iOS WebKit & Safari mobile compliant floating navigation bar for Home and Cards tabs.

### 4. Compact Side Drawer Menu (.drawer-panel)
* Slide-out menu panel (	ransform: translateX(100%)).
* Contains tightly grouped menu buttons (gap: 8px) with subtle hover elevation (	ransform: translate(-2px, -2px)).
* Anchored studio footer branding (*"Expense Pulse • Developed with ❤️ by FerryPot Studios"*).