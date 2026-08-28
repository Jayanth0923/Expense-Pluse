# ⚡ Expense Pulse

> **Track every expense in seconds. Vibrant Neubrutalist Personal Expense Tracker & Native Windows Desktop Application.**  
> Developed with ❤️ by **FerryPot Studios** (errypotstudios@gmail.com)

---

## 🌐 Live Web App & Desktop Downloads

* 📱 **Live iPhone / Web App**: [https://expense-pulse-for-iphone.web.app](https://expense-pulse-for-iphone.web.app)
* 🖥️ **Windows Auto-Installer (.exe)**: [
eleases/Expense Pulse Setup 1.0.0.exe](releases/Expense%20Pulse%20Setup%201.0.0.exe)
* 📦 **Windows Portable Version (.exe)**: [
eleases/Expense Pulse 1.0.0.exe](releases/Expense%20Pulse%201.0.0.exe)

---

## 📖 About Expense Pulse

**Expense Pulse** is a personal finance tracker designed for mobile web (iOS / iPhone Safari PWA) and native Windows desktop. It seamlessly synchronizes with your personal **Google Sheets** spreadsheet using Google Apps Script Web API, ensuring your financial data remains **100% private, free, and under your personal ownership**.

Say the amount, pick a category, add a note—and your Google Sheet updates automatically. No paid subscription. No third-party data tracking. Your data stays in your own personal Google account.

### ✨ What You Get
* **01. One-Tap Entry**: Log the amount, category, and an optional note from your iPhone or desktop in seconds.
* **02. Live Interactive Dashboard**: See total spent, today's spend, daily average, top category metrics, category pie charts, and daily spend bar charts updated live.
* **03. 100% Data Privacy**: The Sheet and API connection live inside your personal Google account. Expense details go directly from your iPhone/Windows app into your Google Sheet.
* **04. Monthly Expense Summaries**: Automatic month-end report card calculations (total spent, daily average, top category).
* **05. Custom Notifications**: Daily spend reminders and month-end report notifications with functional toggle controls.
* **06. Native Windows Desktop Experience**: Built with Electron, featuring System Tray background monitoring and auto-updates (electron-updater).

---

## 🛠️ The Complete Setup (Six Steps — One Time Only) For more details visit web-app

> Use a computer for the Google steps. Finish the Shortcut setup on your iPhone.

---

### 📍 STEP 01: Make your own Sheet
1. Open [Google Sheets](https://sheets.google.com) and create a new spreadsheet named **Expense Tracker**.
2. Sign in to your Google Account if asked.
3. The dashboard and its attached script live inside your personal account.

---

### 📍 STEP 02: Open the built-in script
1. Inside your copied Sheet, open **Extensions** → **Apps Script**. You should see code containing a function named doPost.
2. If the code is already there, leave it exactly as it is and continue.
3. If the editor is blank, copy the fallback script below and paste it into Code.gs:

`javascript
const CATEGORIES = ["🍛 Food", "🛍 Shopping", "🚙 Travel", "🧾 Bills", "🎬 Entertainment", "📦 Other"];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Expenses");
    const data = JSON.parse(e.postData.contents);
    const nextRow = sheet.getLastRow() + 1;
    ensureRows_(sheet, nextRow);
    sheet.getRange(nextRow, 1, 1, 4).setValues([[ new Date(), Number(data.amount), data.category, data.note || "" ]]);
    sheet.getRange(nextRow, 1).setNumberFormat("dd mmm yyyy, hh:mm am/pm");
    sheet.getRange(nextRow, 2).setNumberFormat("₹#,##0");
    return ContentService.createTextOutput(JSON.stringify({status:"success",row:nextRow}))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function ensureRows_(sheet, requiredRow) {
  if (requiredRow > sheet.getMaxRows()) {
    sheet.insertRowsAfter(sheet.getMaxRows(), Math.max(500, requiredRow - sheet.getMaxRows()));
  }
}
`

---

### 📍 STEP 03: Deploy your connector
1. Click **Deploy** → **New deployment**.
2. Tap the gear icon ⚙️ beside *"Select type"* and choose **Web app**.
3. Set **Execute as**: Me.
4. Set **Who has access**: Anyone.
5. Click **Deploy** and approve Google’s permission request.
   * *Google may show an "unverified" warning. Confirm that you are authorizing the script inside your own copied Sheet. Then choose **Advanced** → **Continue to project** → **Allow**.*
6. **Copy the Web app URL**. The correct address ends in /exec.

> **Why "Anyone"?** It lets your iPhone Shortcut or Web App send an expense without making you sign in every time. It does not allow visitors to open or read your Sheet.

---

### 📍 STEP 04: Install and connect the Shortcut
1. Open the Shortcut link on your iPhone, tap **Get Shortcut**, then open it for editing.
2. Scroll near the bottom to the blank URL action immediately above *"Get Contents of URL"*.
3. Paste your Google web-app URL ending in /exec.
4. Tap **Done**.

> **Security Tip**: Treat that URL like a password. Anyone who gets it could add unwanted rows to your Sheet. This script does not provide a way to read your expenses, but you should still never share the URL publicly.

---

### 📍 STEP 05: Add one test expense
1. Run the Shortcut on your iPhone and enter a small test amount.
2. Pick a category and add an optional note.
3. Allow network access if iPhone asks.
4. Open the **Expenses** tab in your Sheet and check the new row.

*See the new row? You're almost done! Continue to Step 6 below to connect your sheet to this web app.*

---

### 📍 STEP 06: Connect your Sheet to Expense Pulse Web App
1. Inside your Google Sheet, click **File** → **Share** → **Publish to web**.
2. Under *"Link"*, select **Comma-separated values (.csv)** and click **Publish**.
3. Copy the published CSV link.
4. Open **Expense Pulse** (on iPhone Safari or Windows App), click the **⚙️ Settings** icon at the top right, paste your published CSV link into the URL field, and tap **Save Connection**.

**Setup Complete!** Expense Pulse will now automatically sync your daily expenses! 🎉

---

### 📲 How to Use Back Tap for 1-Second Expense Entry on iPhone

1. After setting up Shortcuts on your iPhone, open **Settings** → **Accessibility**.
2. Under Accessibility, tap **Physical and Motor** → **Touch**.
3. Scroll down to the bottom and select **Back Tap**.
4. In Back Tap, tap **Double Tap**.
5. Scroll to the very bottom to the **Shortcuts** section. Select the shortcut named **Expense Pulse**.
6. Whenever you need to add an expense, simply **double-tap the back side of your iPhone**!
7. It will instantly prompt you for the **Amount**, **Category**, and an optional **Note** for what you spent.
8. Once submitted, a notification will confirm that your expense was added to your Google Sheet.
9. Open the **Expense Pulse Web App / Windows App** and tap **Sync** (or refresh) to see your live expense dashboard!

> ⚠️ *Make sure your Google Sheet link is correct in ⚙️ Settings and you have published it as CSV!*

---

## ⚡ Quick Fixes (If it doesn’t work)

* 🔴 **Google says “Authorization required”**: Re-open Apps Script, click **Deploy** → **Manage deployments**, and confirm access is set to **Anyone**.
* 🔴 **The Shortcut finishes, but no row appears**: Check if your Web App URL ends in /exec (not /edit).
* 🔴 **The dashboard looks empty**: Ensure your Sheet is published to web as **Comma-separated values (.csv)** and saved in **⚙️ Settings**.

---

## 📄 License & Credits

Developed with ❤️ by **FerryPot Studios** (errypotstudios@gmail.com).  
Free personal finance application for Web, iOS, and Windows.
