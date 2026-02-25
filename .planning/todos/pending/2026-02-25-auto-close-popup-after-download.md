---
created: 2026-02-25T17:30
title: Auto-close popup after download completes
area: ui
files:
  - extension/popup.js
  - extension/popup.html
  - extension/popup.css
---

## Problem

After a download completes, the popup stays open indefinitely. The user has to manually close it. Since the download is done, the popup should auto-close after a brief delay so the user can get back to browsing.

## Solution

On download complete, show a visible countdown timer (5 seconds) in the popup. After the countdown expires, call `window.close()` to dismiss the popup. The countdown should be visually apparent so the user knows it's about to close. Consider allowing the user to cancel the auto-close by clicking the timer or a "Keep open" action.
