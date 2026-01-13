// Shopping.js - the shopping list web app
// Handles the logic and display, uses a simpel REST-like
// back end for storage

"use strict";  // Croak on undefined vars etc

// Note: State management moved to state.js
// Access state via State.getCurrentList(), State.setFocusItem(), etc.

// ================= Build page =================
const body = document.body;

// App container
const appContainer = document.createElement('div');
body.appendChild(appContainer);

// Top line: title + menu button
const titleContainer = document.createElement('div');
titleContainer.id = 'title-container';
// Background and text color are applied dynamically in render()
appContainer.appendChild(titleContainer);

const menuButton = document.createElement('button');
menuButton.id = 'menu-button';
menuButton.textContent = '☰';
menuButton.type = 'button';
titleContainer.appendChild(menuButton);

const listName = document.createElement('span');
listName.id = 'list-name';
listName.contentEditable = true;
listName.onkeydown = e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    listName.blur();
  }
};
listName.oninput = () => {
  const currentList = State.getCurrentList();
  if (!currentList) return;
  const newTitle = listName.textContent.trim();
  if (newTitle && currentList.title !== newTitle) {
    currentList.title = newTitle;
    document.title = newTitle + (listStatus.textContent || '');
    scheduleSave();
  }
};
titleContainer.appendChild(listName);

const listStatus = document.createElement('span');
listStatus.id = 'list-status';
titleContainer.appendChild(listStatus);

// Top-line error/status banner
const errorBanner = document.createElement('div');
errorBanner.id = 'error-banner';
titleContainer.appendChild(errorBanner);


// Container for list items
const container = document.createElement('div');
container.id = 'list-container';
container.style.marginTop = '0.5em';
appContainer.appendChild(container);

// Initialize State module with DOM elements
State.initDOMElements(listStatus, errorBanner);

// ================= Utility =================
function sanitizeListName(rawName) {
  const fallback = 'NewList';
  const trimmed = (rawName ?? '').trim();
  let candidate = trimmed || fallback;
  candidate = candidate.replace(/[^\w-]/g, '_');
  candidate = candidate.replace(/_+/g, '_');
  candidate = candidate.replace(/^_+/, '').replace(/_+$/, '');
  if (!candidate) candidate = fallback;
  const adjusted = trimmed.length > 0 && candidate !== trimmed;
  return { name: candidate, adjusted };
}

function saveCurrentList() {
  const currentList = State.getCurrentList();
  State.setIsSaving(true);
  clearTimeout(State.getSaveTimeout());

  return fetch(`/shopping/api.cgi/${currentList.name}`, {
    method: 'POST',
    body: JSON.stringify(currentList, null, 2) + '\n',
    headers: { 'Content-Type': 'application/json' }
  }).then(async r => {
    if (!r.ok) {
      const bodyText = await r.text().catch(() => '');
      throw new Error(bodyText.trim() || `Save failed (${r.status} ${r.statusText})`);
    }
    State.clearBanner();
    State.setCurrentListLastModified(r.headers.get('Last-Modified'));
    State.setIsSaving(false);
    State.setIsModified(false);
  }).catch(err => {
    console.error('Save failed', err);
    State.setIsSaving(false);
    State.setBanner(err.message || 'Save failed');
    throw err;
  });
}

function scheduleSave() {
  clearTimeout(State.getSaveTimeout());
  const currentList = State.getCurrentList();
  if (!currentList) return;
  State.setIsModified(true);

  const timeout = setTimeout(() => {
    saveCurrentList().catch(console.error);
  }, 2000);  // in ms
  State.setSaveTimeout(timeout);
}


// Helper: Get the effective background color for a section (walks up parent chain)
function getEffectiveBgColor(section){
  const currentList = State.getCurrentList();
  if (!currentList) return '#ffffff';
  if (!section) return currentList.bgColor || '#ffffff';
  if (section.bgColor) return section.bgColor;
  
  // Walk up to find a parent with a color
  let parent = Util.findParentSection(currentList.items, section);
  while (parent) {
    if (parent.bgColor) return parent.bgColor;
    parent = Util.findParentSection(currentList.items, parent);
  }
  
  // Fall back to list color
  return currentList.bgColor || '#ffffff';
}

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
    if (allLists && Menu.setAllLists) Menu.setAllLists(getRecentListsForMenu());
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
function getRecentListsForMenu() {
  const allLists = State.getAllLists();
  return allLists.slice(0, 5);
}

// Helper to call Menu.hideMenus() if available
function hideAppMenus(){ if (window.Menu && Menu.hideMenus) Menu.hideMenus(); }

// ============== Section menu actions that used to rely on hideMenus ================
function uncheckAll() {
  const currentList = State.getCurrentList();
  traverseSections(currentList.items, null, it => {
    if (it.type === 'item') {
      it.checked = false;
    }
  });
  hideAppMenus();
};

// ============== Menu actions (unchanged, small tweak for list type) =================

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
  const { name: safeName, adjusted } = sanitizeListName(displayTitle);
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
  if (window.Menu && Menu.setAllLists) Menu.setAllLists(getRecentListsForMenu());
  selectList(safeName,newListObj);
  scheduleSave();
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
    if (window.Menu && Menu.setAllLists) Menu.setAllLists(getRecentListsForMenu());
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
  if (now === 'journal' && window.JournalHelper) {
    try {
      const res = JournalHelper.ensureJournalPathForDate(currentList, new Date());
      if (res && res.createdItem) State.setFocusItem(res.createdItem);
    } catch (e) {
      console.error('JournalHelper ensure failed', e);
    }
  }

  if (window.Menu && Menu.setCurrentList) Menu.setCurrentList(currentList);
  render();
  scheduleSave();
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

  if (window.JournalHelper) {
    try {
      const res = JournalHelper.ensureJournalPathForDate(currentList, date);
      if (res && res.createdItem) {
        State.setFocusItem(res.createdItem);
      }
      render();
      scheduleSave();
      if (window.Menu && Menu.setCurrentList) Menu.setCurrentList(currentList);
    } catch (e) {
      console.error('JournalHelper ensure failed', e);
    }
  }
}

// ============== Sorting helpers and functions for journal lists ==============
// Refactored to use JournalHelper from journal.js

// Sort entire journal: years, months and days (sections only)
function sortJournal() {
  const currentList = State.getCurrentList();
  if (!currentList || !Array.isArray(currentList.items)) return;
  JournalHelper.sortJournal(currentList);
  render();
  scheduleSave();
}

// Sort only the immediate subsections of the provided section
function sortSection(section) {
  if (!section || !Array.isArray(section.items)) return;
  const currentList = State.getCurrentList();
  const success = JournalHelper.sortSection(section, currentList);
  if (!success) {
    alert('No sortable subsections found in this section.');
    return;
  }
  render();
  scheduleSave();
}

// Toggle journal sort order between newest-first and oldest-first
function toggleSortOrder() {
  const currentList = State.getCurrentList();
  if (!currentList) return;
  const current = currentList.sortOrder || 'newest-first';
  currentList.sortOrder = current === 'newest-first' ? 'oldest-first' : 'newest-first';
  
  // Auto-sort after toggling
  sortJournal();
  
  if (window.Menu && Menu.setCurrentList) Menu.setCurrentList(currentList);
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
    return;
  }

  const nonEmptyCount = Util.countNonEmptyItems(section);
  if (nonEmptyCount > 0) {
    if (!confirm(`This section contains ${nonEmptyCount} non-empty item(s). Delete the section and all its content?`)) return;
  }

  // perform deletion
  found.parentArray.splice(found.index, 1);

  // update UI and save
  if (window.Menu && Menu.setCurrentList) Menu.setCurrentList(currentList);
  render();
  scheduleSave();
}

// Helper to recurse through a section, and do something for each
// section we meet and/or each item we meet.
// Finally render and schedule a save, if requested
function traverseSections(items, secFn = null, itFn = null, doRender=true) {
  items.forEach(item => {
    if (item.type === 'section') {
      if (secFn) secFn(item);
      traverseSections(item.items, secFn, itFn, false); // recurse into subsections
        // without rendering on every level
    } else if ( item.type  === 'item' ) {
      if (itFn) itFn(item);
    }
  });
  if (doRender) {
    render();
    scheduleSave();
  }
}

function expandAll() {
  const currentList = State.getCurrentList();
  traverseSections(currentList.items, sec => sec.collapsed = false);
}

function collapseAll() {
  const currentList = State.getCurrentList();
  traverseSections(currentList.items, sec => sec.collapsed = true);
}

function clearAllFilters() {
  const currentList = State.getCurrentList();
  currentList.filter = "",
  traverseSections(currentList.items, sec => sec.filter = '');
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
          render();
          scheduleSave();
        } else {
          render();
        }
      } catch (e) {
        console.error('JournalHelper ensure failed', e);
        render();
      }
    } else {
      render();
    }

    if (window.Menu && Menu.setCurrentList) Menu.setCurrentList(currentList);
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
      if (window.JournalHelper && currentList?.type === 'journal') {
        try {
          const res = JournalHelper.ensureJournalPathForDate(currentList, new Date());
          if (res && res.createdItem) {
            State.setFocusItem(res.createdItem);
            render();
            scheduleSave();
          } else {
            render();
          }
        } catch (e) {
          console.error('JournalHelper ensure failed', e);
          render();
        }
      } else {
        render();
      }

      Util.setListFavicon(name,currentList?.bgColor || '#fff');
      if (window.Menu && Menu.setCurrentList) Menu.setCurrentList(currentList);
      State.clearBanner();
    })
    .catch(err => {
      console.error('Failed to load list', err);
      State.setBanner(err.message || 'Failed to load list');
    });
}

// ================= Render =================
function resolveFilter(section, parentSections) {
  const currentList = State.getCurrentList();
  let sec = section;
  let filter = sec?.filter || '';
  let parents = parentSections || [];
  let idx = parents.indexOf(sec);
  while (filter === '' && idx > -1) {
    // move up to parent section if exists
    sec = parents[idx]._parentSection;
    if (!sec) break;
    filter = sec.filter || '';
    parents = sec._parentSections || [];
    idx = parents.indexOf(sec);
  }
  return filter || currentList?.filter || 'all';

}



function focusEditable(el){
  el.focus();
  const sel=window.getSelection();
  sel.removeAllRanges();
  const range=document.createRange();
  range.selectNodeContents(el);
  sel.addRange(range);
}

// Render item
function renderItem(container,item,parentItems,parentSection){
  const line=document.createElement('div');
  line.className='line';
  line._item = item;
  line._parentItems = parentItems;
  if(item.type==='item'){
    const cb=document.createElement('input');
    cb.type='checkbox';
    cb.checked=item.checked;
    cb.onchange=()=>{
      item.checked=cb.checked;
      State.setFocusItem(parentSection);
      render(); // so the filters take effect
      scheduleSave();
    };
    line.appendChild(cb);

    // Register the checkbox as the drag handle for items (drag.js should start only when dragging from this checkbox)
    if (typeof drag !== 'undefined' && drag.registerDragHandle) {
      drag.registerDragHandle(cb, { type: 'item', itemOrSection: item, parentArray: parentItems, domNode: line });
    }
  } else if (item.type === 'photo') {
    // Render photo items with camera icon as drag handle
    const bullet = document.createElement('span');
    bullet.textContent = '📷';
    bullet.classList.add('drag-handle');
    line.appendChild(bullet);

    // Register the bullet as the drag handle for photos
    if (typeof drag !== 'undefined' && drag.registerDragHandle) {
      drag.registerDragHandle(bullet, { type: 'item', itemOrSection: item, parentArray: parentItems, domNode: line });
    }

    if (typeof renderPhotoItem !== 'undefined') {
      renderPhotoItem(line, item);
    }
    // Register per-line hover and pointer handlers for showing inline drop line and accepting drops
    if (typeof drag !== 'undefined' && drag.registerLine) {
      drag.registerLine(line);
    }
    container.appendChild(line);
    return;
  } else {
    // For text items, add a bullet point as drag handle
    const bullet = document.createElement('span');
    bullet.textContent = '•';
    bullet.classList.add('drag-handle');
    line.appendChild(bullet);

    // Register the bullet as the drag handle for text items
    if (typeof drag !== 'undefined' && drag.registerDragHandle) {
      drag.registerDragHandle(bullet, { type: 'item', itemOrSection: item, parentArray: parentItems, domNode: line });
    }
  }
  
  const span=document.createElement('span');
  span.className='line-text';
  span.textContent=item.text;
  span.contentEditable=true;
  span._item=item;

  span.onkeydown=e=>{
    if(e.key==='Enter'){
      e.preventDefault();
      let text = span.textContent.replace(/\r?\n/g, ' ').trim();
      // Delete the line if it has no text (except whitespace) and it's not the only item
      if(text==='' && parentItems.length>1){
        const idx=parentItems.indexOf(item);
        if(idx>=0) parentItems.splice(idx,1);
        State.setFocusItem(parentItems[Math.min(idx,parentItems.length-1)]||null);
        render();
        scheduleSave();
        return;
      }
      if(text===''){ span.blur(); return; }
      if(text.startsWith('o ') ||text.startsWith('☐') ){
        item.type='item';
        item.checked=false;
        text=text.slice(2).trim();
      } else if(text.startsWith('x ')||text.startsWith('☑ ') ){
        item.type='item';
        item.checked=true;
        text=text.slice(2).trim();
      } else if(text.startsWith('.')) {
        item.type='text';
        text=text.slice(2).trim();
      } else if(text === 'p' || text === 'P'){
        // Photo capture: clear this line, store insertion context, trigger capture
        const idx = parentItems.indexOf(item);
        item.text = '';  // Clear the 'P' text but keep the line
        item.type = 'text';  // Ensure it's a text line
        // Store insertion context for photo.js - insert at current position (above this line)
        if (typeof photoInsertContext !== 'undefined') {
          photoInsertContext = { parentItems: parentItems, index: idx, emptyLineItem: item };
        }
        if (typeof capturePhoto !== 'undefined') {
          capturePhoto();
        }
        State.setFocusItem(item);  // Focus stays on the cleared line
        render();
        scheduleSave();
        return;  // IMPORTANT: return early, do NOT create a new line
      } else if(text.startsWith('s ')){
        const idx = parentItems.indexOf(item);
        const newSection = {
          type: 'section',
          title: text.slice(2).trim(),
          collapsed: false,
          items: [{ type: 'item', text: '', checked: false }],
          filter: ''
        };
        parentItems.splice(idx, 1, newSection);
        State.setFocusItem(newSection.items[0]);
        render();
        scheduleSave();
        return;  // stop further processing
      }
      item.text=text;
      const newItem={type:item.type,text:"",checked:false};
      const idx=parentItems.indexOf(item);
      parentItems.splice(idx+1,0,newItem);
      State.setFocusItem(newItem);
      render();
      scheduleSave();
    }
  };
  span.oninput=()=>{
    const currentText=span.textContent.replace(/\r?\n/g, ' ').trim();
    item.text=currentText;
    scheduleSave();
  };
  // Handle paste: replace newlines with spaces to prevent words from merging
  span.onpaste = e => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    const processedText = text.replace(/\r?\n/g, ' ');
    document.execCommand('insertText', false, processedText);
  };
  // Prevent native drag-drop into contentEditable text (use custom drag system only)
  span.ondragover = e => e.preventDefault();
  span.ondrop = e => e.preventDefault();
  
  line.appendChild(span);

  // Register per-line hover and pointer handlers for showing inline drop line and accepting drops
  if (typeof drag !== 'undefined' && drag.registerLine) {
    drag.registerLine(line);
  }

  container.appendChild(line);
}

// Render section
function renderSection(container,section,parentSections,parentEffectiveFilter){
  const sec=document.createElement('div');
  sec.className='section';
  sec.style.backgroundColor = section.bgColor || '';
  sec.style.padding = '0.3em';   // optional padding
  sec.style.borderRadius = '4px'; // optional rounding for nicer look

  const header=document.createElement('div');
  header.className='section-header';
  const toggleBtn = document.createElement('button');
  if ( State.getCurrentList() ) {
      toggleBtn.textContent = section.collapsed ? '[+]' : '[-]';
      toggleBtn.className = 'section-toggle';
      toggleBtn.type = 'button';

      toggleBtn.onclick = e => {
        e.stopPropagation();
        if (e.detail === 2) {
          section.collapsed = !section.collapsed;
          State.setFocusItem(section);
          render();
          scheduleSave();
          hideAppMenus();
        } else {
          if (window.Menu && Menu.showSectionMenu) Menu.showSectionMenu(section, toggleBtn);
        }
      };

    header.appendChild(toggleBtn);
  }

  const title=document.createElement('span');
  title.className='title';
  title.textContent=section.title;
  title.contentEditable=true;
  title._section=section;
  title.onkeydown = e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const t = title.textContent.trim();
    section.title = t;
    scheduleSave();

    // ensure at least one item exists and first is not a section
    if (section.items.length === 0 || section.items[0].type === 'section') {
      const newItem = { type: 'item', text: '', checked: false };
      section.items.unshift(newItem);
      State.setFocusItem(newItem);
    } else {
      State.setFocusItem(section.items[0]);
    }

    // add new section below if this is last
    const idx = parentSections.indexOf(section);
    if (idx === parentSections.length - 1 && t !== '') {
      parentSections.push({
        type: 'section',
        title: '',
        collapsed: false,
        items: [{ type: 'item', text: '', checked: false }]
      });
    }

    render();
  };

  title.oninput = () => {
    const t = title.textContent.trim();
    if (section.title !== t) {
      section.title = t;
      scheduleSave();
    }
  };
  header.appendChild(title);
  sec.appendChild(header);
  const body=document.createElement('div');
  if (section.collapsed) body.classList.add('collapsed');
  sec.appendChild(body);
  container.appendChild(sec);
  const childFilter = section.filter && section.filter !== '' ? section.filter : parentEffectiveFilter;
  renderItems(body, section.items, section.items, childFilter, section);

  // Register section header for drop behavior and mark header with references for drag module
  // attach references for drag computations
  header._section = section;
  header._parentSections = parentSections;
  if (typeof drag !== 'undefined' && drag.registerSectionHeader) {
    drag.registerSectionHeader(header);
  }

  // Register toggle button as the section drag handle
  if (typeof drag !== 'undefined' && drag.registerDragHandle && State.getCurrentList()) {
    drag.registerDragHandle(toggleBtn, { type: 'section', itemOrSection: section, parentArray: parentSections, domNode: sec });
  }

  if(section.title.trim()==='' && State.getFocusItem()===null) State.setFocusItem(section);
}

// Render items recursively
function renderItems(container, items, parentItems, effectiveFilter = 'all', parentSection) {
  container.innerHTML = '';
  items.forEach(item => {
    if (item.type === 'section') {
      // compute section’s filter: use own filter if set, otherwise inherit
      const secFilter = item.filter && item.filter !== '' ? item.filter : effectiveFilter;
      renderSection(container, item, parentItems, secFilter);
    } else {
      if (effectiveFilter === 'checked' && !item.checked) return;
      if (effectiveFilter === 'unchecked' && item.checked) return;
      renderItem(container, item, parentItems);
    }
  });
}

// Main render
function render(target){
  const currentList = State.getCurrentList();
  if (!target) {
    document.body.style.backgroundColor = currentList.bgColor || '#ffffff';
    document.body.style.color = Util.getContrastColor(currentList.bgColor || '#ffffff');
    // Keep the top line matching the list background and contrast
    if (titleContainer) {
      titleContainer.style.backgroundColor = currentList.bgColor || '#ffffff';
      titleContainer.style.color = Util.getContrastColor(currentList.bgColor || '#ffffff');
    }
    target = container;
  } else {
    target.style.backgroundColor = currentList.bgColor || '#ffffff';
    target.style.color = Util.getContrastColor(currentList.bgColor || '#ffffff');
  }
  renderItems(target,currentList.items,currentList.items, currentList.filter || 'all');
  const focusItem = State.getFocusItem();
  if (focusItem) {
    const lines = target.querySelectorAll('.line-text');
    const titles = target.querySelectorAll('.section-header .title');
    let focused = false;
    for (const l of lines) {
      if (l._item === focusItem) { 
        // Defer focus to next frame to let layout settle before focusing
        requestAnimationFrame(() => {
          focusEditable(l);
          l.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
        focused = true; 
        break; 
      }
    }
    if (!focused) {
      for (const t of titles) {
        if (t._section === focusItem) { 
          focusEditable(t);
          t.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          break;
        }
      }
    }
    State.setFocusItem(null);
  }

}

// ==================== Index page =========================
function renderIndex() {
  appContainer.innerHTML = '<h1>' + currentUser + "'s lists</h1>";
  document.body.style.backgroundColor = "#444";
  document.body.style.color = "#ccc";
  State.setCurrentList(null);  // indicator for not menyu buttons

  Util.setListFavicon(currentUser, document.body.style.color);

  const index = document.createElement('div');
  index.id = 'list-index';

  const allLists = State.getAllLists();
  for (const l of allLists) {
    const link = document.createElement('a');
    link.href = `?l=${encodeURIComponent(l.name)}`;
    link.style.display = 'block';
    link.style.textDecoration = 'none';
    link.className = 'list-link';

    const box = document.createElement('div');
    box.className = 'list-preview';
    box.style.pointerEvents = 'none'; // disables clicks inside preview

    link.appendChild(box);
    index.appendChild(link);

    fetch(`/shopping/api.cgi/${l.name}`)
      .then(r => r.json())
      .then(list => {
        box.style.backgroundColor = list.bgColor || '#ffffff';
        box.style.color = Util.getContrastColor(list.bgColor || '#ffffff');
        const displayTitle = list.title || list.name;
        box.innerHTML = `<strong>&nbsp;${displayTitle}</strong>`;  // list title

        // render items below the title
        const itemsDiv = document.createElement('div');
        box.appendChild(itemsDiv);
        renderItems(itemsDiv, list.items, list.items, 'unchecked');
      });
  }
  appContainer.appendChild(index);
}

// ================= Public API =================
// Expose functions for other modules to use instead of callbacks
window.ShoppingApp = {
  // Data accessors - delegate to State
  getCurrentList: State.getCurrentList,
  getAllLists: State.getAllLists,
  setFocusItem: State.setFocusItem,
  
  // DOM elements
  container,
  menuButton,
  
  // Core functions
  render,
  scheduleSave,
  selectList,
  getEffectiveBgColor,
  hideAppMenus,
  
  // List operations
  indexLink,
  createNewList,
  deleteCurrentList,
  uncheckAll,
  expandAll,
  collapseAll,
  clearAllFilters,
  
  // Journal operations
  toggleListType,
  createJournalEntryForDate,
  sortJournal,
  sortSection,
  toggleSortOrder,
  deleteSection,
  
  // Helper functions used by Menu
  getRecentListsForMenu,
  
  // Menu helper callbacks
  changeCurrentBg: (bg) => {
    const currentList = State.getCurrentList();
    if (!currentList) return;
    currentList.bgColor = bg;
    render();
    scheduleSave();
    if (window.Menu && Menu.hideMenus) Menu.hideMenus();
  },
  
  addItemToList: (anchor) => {
    const currentList = State.getCurrentList();
    if (!currentList) return;
    const defaultType = (currentList?.type === 'journal') ? 'journal-entry' : 'checkbox';
    if (typeof AddItemForm !== 'undefined' && AddItemForm.show) {
      AddItemForm.show(currentList.items, { parentSection: null, anchor: anchor || menuButton, defaultType });
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

// Add focus listener to check for updates when window regains focus
window.addEventListener('focus', () => {
  const currentList = State.getCurrentList();
  const currentListLastModified = State.getCurrentListLastModified();
  if (!currentList || !currentList.name || !currentListLastModified) return;
  
  // Check if list has been modified on server
  fetch(`/shopping/api.cgi/${currentList.name}`, {
    headers: { 'If-Modified-Since': currentListLastModified }
  })
  .then(r => {
    if (r.status === 304) {
      // Not modified, nothing to do
      return null;
    }
    if (r.ok) {
      // File was modified, reload it
      State.setCurrentListLastModified(r.headers.get('Last-Modified'));
      console.log('List has changed on server! Reloading...');
      return r.json();
    }
    return null;
  })
  .then(d => {
    if (d) {
      State.setCurrentList(d);
      State.setIsModified(false);
      State.setIsSaving(false);
      clearTimeout(State.getSaveTimeout());
      render();
      // Brief status update
      listStatus.textContent = ' ↻';
      setTimeout(() => State.updateStatus(), 1500);
    }
  })
  .catch(err => console.error('Focus check failed:', err));
});

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
      createNewList("NewList");
    }
    //let want = window.preferredList || "";
    const params = new URLSearchParams(window.location.search);
    const want = params.get('l');   // null if not present

    if ( !want ) {
      renderIndex();
      if (window.Menu && Menu.setAllLists) Menu.setAllLists(getRecentListsForMenu());
      return;
    }

    let idx = allLists.findIndex(l => l.name === want);
    if (idx < 0) idx = 0;

    selectList(allLists[idx].name);
    if (window.Menu && Menu.setAllLists) Menu.setAllLists(getRecentListsForMenu());
  })
  .catch(err=>{
    console.log('Using default list:',err);
    State.setBanner(err.message || 'Failed to load list index');
  });
