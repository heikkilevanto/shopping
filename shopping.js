// Shopping.js - the shopping list web app
// Handles the logic and display, uses a simpel REST-like
// back end for storage

"use strict";  // Croak on undefined vars etc

// Note: State management moved to state.js
// Access state via State.getCurrentList(), State.setFocusItem(), etc.
// Note: DOM creation and rendering moved to rendering.js
// Access via Rendering.render(), Rendering.renderIndex(), etc.

// ================= Get references from Rendering module =================
// These are created by rendering.js and exposed via window.Rendering
// No need to redeclare - just use Rendering.appContainer, Rendering.menuButton, etc. directly

// ================= Utility =================
// Note: sanitizeListName, saveCurrentList, scheduleSave moved to storage.js
// Note: getEffectiveBgColor, traverseSections, resolveFilter, focusEditable moved to util.js

// ============== Add-item helper UI ==============
// Handled by add-item.js module

// ================= Menu integration =================
// menu.js is included by the server-side page; we do not inject it here.
// Initialize Menu if available; otherwise wait for window 'load' as a fallback.

function initMenuIntegration(){
  const allLists = State.getAllLists();
  const currentList = State.getCurrentList();
  if (window.Menu && Menu.init) {
    Menu.init();
    if (allLists && Menu.setAllLists) Menu.setAllLists(ListOps.getRecentListsForMenu());
    if (currentList && Menu.setCurrentList) Menu.setCurrentList(currentList);
  } else {
    // Wait for the page resources to be loaded — server should have included menu.js
    window.addEventListener('load', () => {
      if (window.Menu && Menu.init) {
        initMenuIntegration(); // try again
      } else {
        console.warn('Menu module not available. Ensure menu.js is included by the page.');
      }
    }, { once: true });
  }
}

// Helper to get recent lists for menu (limit to 5 for mobile)

// ============== Section menu actions ================

// ============== Menu actions (unchanged, small tweak for list type) =================

// Delegates to ListOps module for list-level operations
// Functions moved: uncheckAll, indexLink, createNewList, deleteCurrentList, toggleListType,
// createJournalEntryForDate, sortJournal, sortSection, toggleSortOrder, deleteSection,
// expandAll, collapseAll, clearAllFilters, selectList

// ================= Rendering =================
// Note: All rendering functions moved to rendering.js
// Access via Rendering.render(), Rendering.renderIndex(), Rendering.renderItem(), etc.

// ================= Public API =================
// Expose functions for other modules to use instead of callbacks
window.ShoppingApp = {
  // Data accessors - delegate to State
  getCurrentList: State.getCurrentList,
  getAllLists: State.getAllLists,
  setFocusItem: State.setFocusItem,
  
  // DOM elements
  container: Rendering.container,
  menuButton: Rendering.menuButton,
  
  // Core functions
  render: Rendering.render,
  scheduleSave: Storage.scheduleSave,
  
  // List operations - delegate to ListOps (with render/save wrappers where needed)
  selectList: ListOps.selectList,
  indexLink: ListOps.indexLink,
  createNewList: ListOps.createNewList,
  deleteCurrentList: ListOps.deleteCurrentList,
  uncheckAll: () => { ListOps.uncheckAll(); Rendering.render(); Storage.scheduleSave(); },
  expandAll: () => { ListOps.expandAll(); Rendering.render(); Storage.scheduleSave(); },
  collapseAll: () => { ListOps.collapseAll(); Rendering.render(); Storage.scheduleSave(); },
  clearAllFilters: () => { ListOps.clearAllFilters(); Rendering.render(); Storage.scheduleSave(); },
  hideAppMenus: ListOps.hideAppMenus,
  
  // Journal operations - delegate to ListOps (with render/save wrappers where needed)
  toggleListType: () => { ListOps.toggleListType(); Rendering.render(); Storage.scheduleSave(); },
  createJournalEntryForDate: (dateStr) => { 
    const result = ListOps.createJournalEntryForDate(dateStr); 
    if (result) { Rendering.render(); Storage.scheduleSave(); }
  },
  sortJournal: () => { ListOps.sortJournal(); Rendering.render(); Storage.scheduleSave(); },
  sortSection: (section) => { 
    const result = ListOps.sortSection(section); 
    if (result) { Rendering.render(); Storage.scheduleSave(); }
  },
  toggleSortOrder: () => { ListOps.toggleSortOrder(); Rendering.render(); Storage.scheduleSave(); },
  deleteSection: (section) => { 
    const result = ListOps.deleteSection(section); 
    if (result) { Rendering.render(); Storage.scheduleSave(); }
  },
  
  // Helper functions used by Menu - delegate to ListOps
  getRecentListsForMenu: ListOps.getRecentListsForMenu,
  getEffectiveBgColor: Util.getEffectiveBgColor,
  
  // Menu helper callbacks
  changeCurrentBg: (bg) => {
    const currentList = State.getCurrentList();
    if (!currentList) return;
    currentList.bgColor = bg;
    Rendering.render();
    Storage.scheduleSave();
    if (window.Menu && Menu.hideMenus) Menu.hideMenus();
  },
  
  addItemToList: (anchor) => {
    const currentList = State.getCurrentList();
    if (!currentList) return;
    const defaultType = (currentList?.type === 'journal') ? 'journal-entry' : 'checkbox';
    if (typeof AddItemForm !== 'undefined' && AddItemForm.show) {
      AddItemForm.show(currentList.items, { parentSection: null, anchor: anchor || Rendering.menuButton, defaultType });
    }
  },
  
  addItemToSection: (section, anchor) => {
    if (!section || !Array.isArray(section.items)) return;
    const currentList = State.getCurrentList();
    const defaultType = (currentList?.type === 'journal') ? 'journal-entry' : 'checkbox';
    if (typeof AddItemForm !== 'undefined' && AddItemForm.show) {
      AddItemForm.show(section.items, { parentSection: section, anchor, defaultType });
    }
  },
  
  capturePhoto: () => {
    if (typeof capturePhoto !== 'undefined') {
      capturePhoto();
    } else {
      console.error('capturePhoto function not available');
    }
  }
};

// Initialize Menu after ShoppingApp is available
initMenuIntegration();

// ================= Init =================
// Initialize add-item form module
if (typeof AddItemForm !== 'undefined' && AddItemForm.init) {
  AddItemForm.init();
}

// Initialize drag module (if available).
if (typeof drag !== 'undefined' && drag.init) {
  drag.init();
}

if (typeof initPhotoModule !== 'undefined') {
  initPhotoModule();
}

// Setup focus-check reload logic (moved to storage.js)
if (window.Storage && Storage.setupFocusReloadCheck) {
  Storage.setupFocusReloadCheck();
}

// Ask API for all available lists
fetch('/shopping/api.cgi/')
  .then(async r=>{
    if (!r.ok) {
      const bodyText = await r.text().catch(() => '');
      throw new Error(bodyText.trim() || `Failed to fetch lists (${r.status} ${r.statusText})`);
    }
    return r.json();
  })
  .then(data=>{
    State.setAllLists(data.map(name=>({name})));
    const allLists = State.getAllLists();
    if (!allLists.length) { // Make sure we have at least some list
      console.log("No lists found. Creating NewList");
      ListOps.createNewList("NewList");
    }
    //let want = window.preferredList || "";
    const params = new URLSearchParams(window.location.search);
    const want = params.get('l');   // null if not present

    if ( !want ) {
      Rendering.renderIndex();
      if (window.Menu && Menu.setAllLists) Menu.setAllLists(ListOps.getRecentListsForMenu());
      return;
    }

    let idx = allLists.findIndex(l => l.name === want);
    if (idx < 0) idx = 0;

    ListOps.selectList(allLists[idx].name);
    if (window.Menu && Menu.setAllLists) Menu.setAllLists(ListOps.getRecentListsForMenu());
  })
  .catch(err=>{
    console.log('Using default list:',err);
    State.setBanner(err.message || 'Failed to load list index');
  });
