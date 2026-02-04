// list-operations.js
// List-level operations: CRUD, sorting, filtering, navigation
// Extracted from shopping.js Phase 4

"use strict";

// ============== Helper functions =================

function getRecentListsForMenu() {
  const allLists = State.getAllLists();
  return allLists.slice(0, 10);
}

function hideAppMenus() {
  Menu.hideMenus();
}

// ============== List actions =================

function uncheckAll() {
  const currentList = State.getCurrentList();
  Util.traverseSections(currentList.items, null, it => {
    if (it.type === 'item') {
      it.checked = false;
    }
  });
  hideAppMenus();
}

// Go back to the index page
function indexLink() {
  window.location.href = window.location.pathname;
}

function createNewList(name=null, type='checklist') {
  // TODO - Save the current list if modified
  if (! name)
    name = prompt('Enter new list name:');

  // The user-provided name is the display title; normalize it for the filename
  const displayTitle = name || 'NewList';
  const { name: safeName, adjusted } = Storage.sanitizeListName(displayTitle);
  if (adjusted) State.setBanner(`File name adjusted to ${safeName} for saving.`, 'info');
  else State.clearBanner();

  let newListObj;
  if (type === 'journal') {
    // For journal lists, start with empty items and let JournalHelper populate the year/month/day path.
    newListObj = {
      name: safeName,
      title: displayTitle,
      type: 'journal',
      sortOrder: 'newest-first',
      items: []
    };
  } else {
    newListObj = {
      name: safeName,
      title: displayTitle,
      type: type || 'checklist',
      items:[{
        type:"section",
        title:displayTitle,
        collapsed:false,
        items:[{type:"item", text:"", checked:false}]
      }]
    };
  }

  const allLists = State.getAllLists();
  if (!allLists.find(l => l.name === safeName)) allLists.push({name: safeName, title: displayTitle});
  selectList(safeName,newListObj);
  Storage.scheduleSave();
}

function deleteCurrentList() {
  const currentList = State.getCurrentList();
  const typeWord = (currentList?.type === 'journal') ? 'journal' : 'list';
  const displayTitle = currentList?.title || currentList?.name;
  if(!confirm(`Delete ${typeWord} "${displayTitle}"?`)) return;
  fetch(`/shopping/api.cgi/${currentList.name}`,{method:'DELETE'})
  .then ( data => {
    const allLists = State.getAllLists();
    State.setAllLists(allLists.filter(l=>l.name!==currentList.name));
    indexLink();
  })
  .catch(console.error);
}

// Toggle list type between 'journal' and 'checklist'
function toggleListType() {
  const currentList = State.getCurrentList();
  if (!currentList) return;
  const was = currentList.type || 'checklist';
  const now = was === 'journal' ? 'checklist' : 'journal';
  currentList.type = now;

  // If switching to journal, ensure today's journal path exists
  if (now === 'journal') {
    const res = JournalHelper.ensureJournalPathForDate(currentList, new Date());
    if (res && res.createdItem) State.setFocusItem(res.createdItem);
  }

  // Note: render() and scheduleSave() are called by the caller (shopping.js)
}

// Create a journal entry for a specific date (dateStr in YYYY-MM-DD or empty for today)
function createJournalEntryForDate(dateStr) {
  const currentList = State.getCurrentList();
  if (!currentList) return;
  if ((currentList.type || 'checklist') !== 'journal') {
    // Offer to convert
    if (!confirm('Current list is not a journal. Convert it to a journal?')) return;
    currentList.type = 'journal';
  }
  let date;
  if (!dateStr || dateStr.trim() === '') date = new Date();
  else {
    // Parse a simple YYYY-MM-DD string
    const m = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) {
      alert('Please enter date in YYYY-MM-DD format.');
      return;
    }
    date = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
    if (isNaN(date.getTime())) { alert('Invalid date'); return; }
  }

  const res = JournalHelper.ensureJournalPathForDate(currentList, date);
  if (res && res.createdItem) {
    State.setFocusItem(res.createdItem);
  }
  // Note: render(), scheduleSave() and Menu.setCurrentList() are called by the caller
  return true; // signal success
}

// ============== Sorting helpers and functions for journal lists ==============

// Sort entire journal: years, months and days (sections only)
function sortJournal() {
  const currentList = State.getCurrentList();
  if (!currentList || !Array.isArray(currentList.items)) return;
  JournalHelper.sortJournal(currentList);
  // Note: render() and scheduleSave() are called by the caller
}

// Reorganize journal: move day sections into proper month sections
function resortJournal() {
  const currentList = State.getCurrentList();
  if (!currentList || !Array.isArray(currentList.items) || currentList.type !== 'journal') return;
  
  const sortOrder = currentList.sortOrder || 'newest-first';
  
  // Collect all day sections that are at the root level or misplaced
  const daySections = [];
  const monthSections = new Map(); // key: monthPrefix (e.g., "2026-02"), value: section object
  
  // First pass: identify all month sections and collect misplaced day sections
  for (let i = currentList.items.length - 1; i >= 0; i--) {
    const item = currentList.items[i];
    if (item && item.type === 'section') {
      const dayPrefix = JournalHelper.getTitlePrefix(item.title, 10);
      const monthPrefix = JournalHelper.getTitlePrefix(item.title, 7);
      
      if (dayPrefix) {
        // This is a day section - remove it from root and save it
        daySections.push(currentList.items.splice(i, 1)[0]);
      } else if (monthPrefix && !dayPrefix) {
        // This is a month section - remember it
        monthSections.set(monthPrefix, item);
      }
    }
  }
  
  // Second pass: also collect day sections from within other day sections (misplaced)
  currentList.items.forEach(item => {
    if (item && item.type === 'section' && Array.isArray(item.items)) {
      const monthPrefix = JournalHelper.getTitlePrefix(item.title, 7);
      if (monthPrefix && !JournalHelper.getTitlePrefix(item.title, 10)) {
        // This is a month section - check for misplaced day sections inside
        for (let i = item.items.length - 1; i >= 0; i--) {
          const child = item.items[i];
          if (child && child.type === 'section') {
            const childDayPrefix = JournalHelper.getTitlePrefix(child.title, 10);
            if (childDayPrefix) {
              // Check if this day belongs to a different month
              const childMonthPrefix = childDayPrefix.substring(0, 7);
              if (childMonthPrefix !== monthPrefix) {
                // Misplaced - move it
                daySections.push(item.items.splice(i, 1)[0]);
              }
            }
          }
        }
      }
    }
  });
  
  // Process each day section and place it in the correct month
  daySections.forEach(daySection => {
    const dayPrefix = JournalHelper.getTitlePrefix(daySection.title, 10);
    if (!dayPrefix) return;
    
    const monthPrefix = dayPrefix.substring(0, 7); // e.g., "2026-02"
    
    // Find or create the month section
    let monthSection = monthSections.get(monthPrefix);
    if (!monthSection) {
      // Create new month section
      const year = parseInt(monthPrefix.substring(0, 4));
      const month = parseInt(monthPrefix.substring(5, 7));
      const date = new Date(year, month - 1, 1);
      const prefixes = JournalHelper.formatPrefixes(date);
      monthSection = { type: 'section', title: prefixes.monthTitle, items: [] };
      monthSections.set(monthPrefix, monthSection);
      
      // Insert the month section in the correct position
      JournalHelper.reorderSectionsInPlace([...currentList.items, monthSection], 7, sortOrder);
      // Find where it ended up and insert it there
      let inserted = false;
      for (let i = 0; i < currentList.items.length; i++) {
        const item = currentList.items[i];
        if (item && item.type === 'section') {
          const itemMonthPrefix = JournalHelper.getTitlePrefix(item.title, 7);
          if (itemMonthPrefix) {
            if ((sortOrder === 'newest-first' && itemMonthPrefix < monthPrefix) ||
                (sortOrder === 'oldest-first' && itemMonthPrefix > monthPrefix)) {
              currentList.items.splice(i, 0, monthSection);
              inserted = true;
              break;
            }
          }
        }
      }
      if (!inserted) {
        currentList.items.push(monthSection);
      }
    }
    
    // Add the day section to the month section
    if (!Array.isArray(monthSection.items)) {
      monthSection.items = [];
    }
    monthSection.items.push(daySection);
  });
  
  // Finally, sort everything
  JournalHelper.sortJournal(currentList);
  
  // Note: render() and scheduleSave() are called by the caller
}

// Sort only the immediate subsections of the provided section
function sortSection(section) {
  if (!section || !Array.isArray(section.items)) return;
  const currentList = State.getCurrentList();
  const success = JournalHelper.sortSection(section, currentList);
  if (!success) {
    alert('No sortable subsections found in this section.');
    return false;
  }
  // Note: render() and scheduleSave() are called by the caller
  return true;
}

// Sort section items by the given sort type
function sortSectionItems(section, sortType) {
  if (!section || !Array.isArray(section.items)) return;
  
  section.items.sort((a, b) => {
    switch (sortType) {
      case 'alphabetic':
        const aText = a.title || a.text || '';
        const bText = b.title || b.text || '';
        return aText.localeCompare(bText);
      case 'reverse-alpha':
        const aTextRev = a.title || a.text || '';
        const bTextRev = b.title || b.text || '';
        return bTextRev.localeCompare(aTextRev);
      case 'checked-first':
        if (a.checked === b.checked) return 0;
        return a.checked ? -1 : 1;
      case 'unchecked-first':
        if (a.checked === b.checked) return 0;
        return a.checked ? 1 : -1;
      case 'subsections-first':
        if (a.type === b.type) return 0;
        return a.type === 'section' ? -1 : 1;
      case 'items-first':
        if (a.type === b.type) return 0;
        return a.type === 'item' ? -1 : 1;
      default:
        return 0;
    }
  });
  
  // Note: render() and scheduleSave() are called by the caller
}

// Recursively sort all sections and subsections
function sortAllSections(section, sortType) {
  if (!section || !Array.isArray(section.items)) return;
  
  // Sort this level
  sortSectionItems(section, sortType);
  
  // Recursively sort all child sections
  section.items.forEach(item => {
    if (item.type === 'section' && item.items) {
      sortAllSections(item, sortType);
    }
  });
  
  // Note: render() and scheduleSave() are called by the caller
}

// Reverse the order of items in a section (non-recursive)
function reverseOrder(section) {
  if (!section || !Array.isArray(section.items)) return;
  section.items.reverse();
  // Note: render() and scheduleSave() are called by the caller
}

// Recursively reverse order of all sections and subsections
function reverseAllSections(section) {
  if (!section || !Array.isArray(section.items)) return;
  
  // Reverse this level
  section.items.reverse();
  
  // Recursively reverse all child sections
  section.items.forEach(item => {
    if (item.type === 'section' && item.items) {
      reverseAllSections(item);
    }
  });
  
  // Note: render() and scheduleSave() are called by the caller
}

// Toggle journal sort order between newest-first and oldest-first
function toggleSortOrder() {
  const currentList = State.getCurrentList();
  if (!currentList) return;
  const current = currentList.sortOrder || 'newest-first';
  currentList.sortOrder = current === 'newest-first' ? 'oldest-first' : 'newest-first';
  
  // Auto-sort after toggling
  sortJournal(currentList);
  
  // Note: render() and scheduleSave() are called by sortJournal() -> caller
}

// ============== Section deletion helpers ==============

// Delete a section: prompt only if it contains non-empty items
function deleteSection(section) {
  const currentList = State.getCurrentList();
  if (!currentList || !section) return;

  // find parent array and index
  const found = Util.findParentArrayAndIndex(currentList.items, section);
  if (!found) {
    console.warn('deleteSection: parent not found');
    return false;
  }

  const nonEmptyCount = Util.countNonEmptyItems(section);
  if (nonEmptyCount > 0) {
    if (!confirm(`This section contains ${nonEmptyCount} non-empty item(s). Delete the section and all its content?`)) return false;
  }

  // perform deletion
  found.parentArray.splice(found.index, 1);

  // Note: render() and scheduleSave() are called by the caller
  return true;
}

// ============== Expand/Collapse/Filter helpers ==============

function expandAll() {
  const currentList = State.getCurrentList();
  Util.traverseSections(currentList.items, sec => sec.collapsed = false);
}

function collapseAll() {
  const currentList = State.getCurrentList();
  Util.traverseSections(currentList.items, sec => sec.collapsed = true);
}

function clearAllFilters() {
  const currentList = State.getCurrentList();
  currentList.filter = "";
  Util.traverseSections(currentList.items, sec => sec.filter = '');
}

// ================= List selection =================
function selectList(name,data){
  // Update the URL in the address bar so selection is reflected (without reloading)
  try {
    const newUrl = `${window.location.pathname}?l=${encodeURIComponent(name)}`;
    history.replaceState(null, '', newUrl);
  } catch (e) { /* ignore if history not available */ }

  // Use title for display, name for file operations; fallback to name if title not present
  if(data){
    State.setCurrentList(data);
    const currentList = State.getCurrentList();
    const displayTitle = currentList.title || currentList.name;
    document.title = displayTitle;
    listName.textContent = displayTitle;

    // If this is a journal list and the JournalHelper is present,
    // ensure today's year/month/day section exists before rendering.
    if (window.JournalHelper && currentList?.type === 'journal') {
      try {
        const res = JournalHelper.ensureJournalPathForDate(currentList, new Date());
        if (res && res.createdItem) {
          State.setFocusItem(res.createdItem);
        }
      } catch (e) {
        console.error('JournalHelper ensure failed', e);
      }
    }
    
    // Call render here in the synchronous path
    ShoppingApp.render();
    
    // Also call scheduleSave if journal entry was created
    if (currentList?.type === 'journal') {
      Storage.scheduleSave();
    }
  }
  else
    fetch(`/shopping/api.cgi/${name}`)
    .then(async r=>{
      if (!r.ok) {
        const bodyText = await r.text().catch(() => '');
        throw new Error(bodyText.trim() || `Failed to load list (${r.status} ${r.statusText})`);
      }
      State.setCurrentListLastModified(r.headers.get('Last-Modified'));
      return r.json();
    })
    .then(d=>{
      State.setCurrentList(d);
      const currentList = State.getCurrentList();
      const displayTitle = currentList.title || currentList.name;
      document.title = displayTitle;
      listName.textContent = displayTitle;

      // ensure journal top path if needed
      if (currentList?.type === 'journal') {
        const res = JournalHelper.ensureJournalPathForDate(currentList, new Date());
        if (res && res.createdItem) {
          State.setFocusItem(res.createdItem);
          // Note: render() and scheduleSave() are called by selectList internally
        }
      }
      // Note: render() is called by selectList internally
      
      Util.setListFavicon(name,currentList?.bgColor || '#fff');
      State.clearBanner();
      
      // Call render here since we're async
      ShoppingApp.render();
    })
    .catch(err => {
      console.error('Failed to load list', err);
      State.setBanner(err.message || 'Failed to load list');
    });
}

// ================= Public API =================
window.ListOps = {
  getRecentListsForMenu,
  hideAppMenus,
  uncheckAll,
  indexLink,
  createNewList,
  deleteCurrentList,
  toggleListType,
  createJournalEntryForDate,
  sortJournal,
  resortJournal,
  sortSection,
  sortSectionItems,
  sortAllSections,
  reverseOrder,
  reverseAllSections,
  toggleSortOrder,
  deleteSection,
  expandAll,
  collapseAll,
  clearAllFilters,
  selectList
};
