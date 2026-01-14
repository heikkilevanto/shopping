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
// Initialize Menu - assume it's loaded.

function initMenuIntegration(){
  Menu.init();
  const allLists = State.getAllLists();
  if (allLists) Menu.setAllLists(ListOps.getRecentListsForMenu());
  const currentList = State.getCurrentList();
  if (currentList) Menu.setCurrentList(currentList);
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
    Menu.hideMenus();
  },
  
  addItemToList: (anchor) => {
    const currentList = State.getCurrentList();
    if (!currentList) return;
    const defaultType = (currentList?.type === 'journal') ? 'journal-entry' : 'checkbox';
    AddItemForm.show(currentList.items, { parentSection: null, anchor: anchor || Rendering.menuButton, defaultType });
  },
  
  addItemToSection: (section, anchor) => {
    if (!section || !Array.isArray(section.items)) return;
    const currentList = State.getCurrentList();
    const defaultType = (currentList?.type === 'journal') ? 'journal-entry' : 'checkbox';
    AddItemForm.show(section.items, { parentSection: section, anchor, defaultType });
  },
  
  capturePhoto: () => {
    capturePhoto();
  }
};

// Initialize Menu after ShoppingApp is available
initMenuIntegration();

// ================= Init =================
// Check that all required modules are loaded
function checkModules() {
  const requiredModules = [
    { name: 'State', obj: window.State },
    { name: 'Rendering', obj: window.Rendering },
    { name: 'Storage', obj: window.Storage },
    { name: 'Util', obj: window.Util },
    { name: 'ListOps', obj: window.ListOps },
    { name: 'Menu', obj: window.Menu },
    { name: 'AddItemForm', obj: window.AddItemForm },
    { name: 'drag', obj: window.drag },
    { name: 'JournalHelper', obj: window.JournalHelper },
  ];
  const requiredFunctions = [
    { name: 'capturePhoto', func: typeof capturePhoto !== 'undefined' },
    { name: 'initPhotoModule', func: typeof initPhotoModule !== 'undefined' },
    { name: 'renderPhotoItem', func: typeof renderPhotoItem !== 'undefined' },
  ];

  const missing = [];
  requiredModules.forEach(mod => {
    if (!mod.obj) missing.push(mod.name);
  });
  requiredFunctions.forEach(func => {
    if (!func.func) missing.push(func.name);
  });

  if (missing.length > 0) {
    const msg = `Missing required modules/functions: ${missing.join(', ')}. Please ensure all JS files are included.`;
    console.error(msg);
    if (window.State && State.setBanner) {
      State.setBanner(msg);
    } else {
      alert(msg);
    }
    throw new Error(msg);
  }
}

checkModules();

// Initialize add-item form module
AddItemForm.init();

// Initialize drag module.
drag.init();

initPhotoModule();

// Setup focus-check reload logic (moved to storage.js)
Storage.setupFocusReloadCheck();

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
      Menu.setAllLists(ListOps.getRecentListsForMenu());
      return;
    }

    let idx = allLists.findIndex(l => l.name === want);
    if (idx < 0) idx = 0;

    ListOps.selectList(allLists[idx].name);
    Menu.setAllLists(ListOps.getRecentListsForMenu());
  })
  .catch(err=>{
    console.log('Using default list:',err);
    State.setBanner(err.message || 'Failed to load list index');
  });
