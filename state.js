// state.js - Centralized state management for shopping app
// Manages all global state variables and state-related UI updates

"use strict";

// ================= State Variables =================
let allLists = [];   // {name}
let currentList = null;
let currentListLastModified = null; // Last-Modified header from server
let saveTimeout;
let focusItem = null;
let isSaving = false;
let isModified = false;

// ================= DOM Elements (for status updates) =================
// These will be set by shopping.js after DOM is created
let listStatusElement = null;
let errorBannerElement = null;

// ================= State Management Functions =================

function updateStatus() {
  if (!listStatusElement) return; // Not initialized yet
  let statusChar = '';
  if (isSaving) statusChar = ' S';
  else if (isModified) statusChar = ' *';
  listStatusElement.textContent = statusChar;
  // Update tab title
  if (currentList) {
    const displayTitle = currentList.title || currentList.name;
    document.title = displayTitle + statusChar;
  }
}

function setBanner(message, type = 'error') {
  if (!errorBannerElement) return; // Not initialized yet
  if (!message) return clearBanner();
  errorBannerElement.textContent = message;
  errorBannerElement.classList.add('show');
  errorBannerElement.classList.toggle('info', type === 'info');
}

function clearBanner() {
  if (!errorBannerElement) return; // Not initialized yet
  errorBannerElement.textContent = '';
  errorBannerElement.classList.remove('show', 'info');
}

// ================= Public API =================
window.State = {
  // Getters
  getAllLists: () => allLists,
  getCurrentList: () => currentList,
  getCurrentListLastModified: () => currentListLastModified,
  getSaveTimeout: () => saveTimeout,
  getFocusItem: () => focusItem,
  isSaving: () => isSaving,
  isModified: () => isModified,
  
  // Setters
  setAllLists: (lists) => { allLists = lists; },
  setCurrentList: (list) => { currentList = list; },
  setCurrentListLastModified: (lm) => { currentListLastModified = lm; },
  setSaveTimeout: (timeout) => { saveTimeout = timeout; },
  setFocusItem: (item) => { focusItem = item; },
  setIsSaving: (val) => { isSaving = val; updateStatus(); },
  setIsModified: (val) => { isModified = val; updateStatus(); },
  
  // DOM element initialization (called by shopping.js after DOM creation)
  initDOMElements: (statusEl, bannerEl) => {
    listStatusElement = statusEl;
    errorBannerElement = bannerEl;
  },
  
  // Status/Banner functions
  updateStatus,
  setBanner,
  clearBanner
};
