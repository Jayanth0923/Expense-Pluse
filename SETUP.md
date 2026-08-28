# ??? Expense Pulse - Full Setup Guide

This guide walks you through setting up **Expense Pulse** from scratch, configuring your Google Sheets backend, deploying the Web App, and building the Windows Desktop Application.

---

## ?? Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [Step 1: Google Sheets & Apps Script Backend](#step-1-google-sheets--apps-script-backend)
3. [Step 2: Local Web Application Setup](#step-2-local-web-application-setup)
4. [Step 3: Deploying to Firebase Hosting](#step-3-deploying-to-firebase-hosting)
5. [Step 4: Building the Windows Desktop App (.exe)](#step-4-building-the-windows-desktop-app-exe)
6. [Step 5: Configuring Auto-Updates](#step-5-configuring-auto-updates)

---

## 1. Prerequisites

Before starting, ensure you have:
* A **Google Account** (to host Google Sheets).
* **Node.js** (v18+ recommended) installed on your system.
* **Git** installed.
* **Firebase CLI** installed (`npm install -g firebase-tools`).

---

## Step 1: Google Sheets & Apps Script Backend

Expense Pulse uses a Google Sheet as its database.

### 1. Create Google Sheet
1. Open [Google Sheets](https://sheets.google.com) and create a new blank spreadsheet named `Expense Tracker`.
2. Name the first sheet tab **`Transactions`**.
3. Create the following column headers in Row 1:
   | A | B | C | D | E | F |
   |---|---|---|---|---|---|
   | **Date** | **Description** | **Category** | **Amount** | **Payment Method** | **ID** |

### 2. Add Google Apps Script
1. Click **Extensions** > **Apps Script** in your Google Sheet.
2. Replace the script content with the following Google Apps Script code:

```javascript
function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Transactions");
  var data = sheet.getDataRange().getValues();
  var rows = data.slice(1);
  var result = rows.map(function(row) {
    return {
      date: row[0],
      description: row[1],
      category: row[2],
      amount: row[3],
      paymentMethod: row[4],
      id: row[5]
    };
  });
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Transactions");
  var params = JSON.parse(e.postData.contents);
  if (params.action === "add") {
    sheet.appendRow([params.date, params.description, params.category, params.amount, params.paymentMethod, params.id]);
  } else if (params.action === "delete") {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][5] == params.id) {
        sheet.deleteRow(i + 1);
        break;
      }
    }
  }
  return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

3. Click **Deploy** > **New deployment**.
4. Select **Web app**.
5. Set **Execute as**: *Me*.
6. Set **Who has access**: *Anyone*.
7. Copy the generated Web App URL (`https://script.google.com/macros/s/.../exec`).

---

## Step 2: Local Web Application Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/Jayanth0923/Expense-Pluse.git
   cd Expense-Pluse
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Open `app.js` and paste your Google Apps Script Web App URL into the `SCRIPT_URL` constant:
   ```javascript
   const SCRIPT_URL = "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL";
   ```

---

## Step 3: Deploying to Firebase Hosting

1. Log in to Firebase:
   ```bash
   firebase login
   ```

2. Deploy hosting:
   ```bash
   firebase deploy --only hosting --project expense-pulse-for-iphone
   ```

---

## Step 4: Building the Windows Desktop App (.exe)

1. Test local Electron window:
   ```bash
   npm start
   ```

2. Build the Windows installer and portable executables:
   ```bash
   npm run build:win
   ```
   *Output files will be generated in `dist/`:*
   * `Expense Pulse Setup 1.0.0.exe` (NSIS Auto-Installer)
   * `Expense Pulse 1.0.0.exe` (Portable Executable)

---

## Step 5: Configuring Auto-Updates

The Windows app includes built-in `electron-updater` auto-updates.

1. Updates check against GitHub Releases or Firebase Hosting.
2. Clicking **"Check for Updates"** in the side menu triggers IPC communication with Electron main process to download and install updates automatically.

