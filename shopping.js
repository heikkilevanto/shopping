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
    Storage.scheduleSave();
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

// ================= Render =================
// Note: resolveFilter and focusEditable moved to util.js

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
      Storage.scheduleSave();
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
        Storage.scheduleSave();
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
        Storage.scheduleSave();
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
        Storage.scheduleSave();
        return;  // stop further processing
      }
      item.text=text;
      const newItem={type:item.type,text:"",checked:false};
      const idx=parentItems.indexOf(item);
      parentItems.splice(idx+1,0,newItem);
      State.setFocusItem(newItem);
      render();
      Storage.scheduleSave();
    }
  };
  span.oninput=()=>{
    const currentText=span.textContent.replace(/\r?\n/g, ' ').trim();
    item.text=currentText;
    Storage.scheduleSave();
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
          Storage.scheduleSave();
          ListOps.hideAppMenus();
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
    Storage.scheduleSave();

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
      Storage.scheduleSave();
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
          Util.focusEditable(l);
          l.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
        focused = true; 
        break; 
      }
    }
    if (!focused) {
      for (const t of titles) {
        if (t._section === focusItem) { 
          Util.focusEditable(t);
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
  scheduleSave: Storage.scheduleSave,
  
  // List operations - delegate to ListOps (with render/save wrappers where needed)
  selectList: ListOps.selectList,
  indexLink: ListOps.indexLink,
  createNewList: ListOps.createNewList,
  deleteCurrentList: ListOps.deleteCurrentList,
  uncheckAll: () => { ListOps.uncheckAll(); render(); Storage.scheduleSave(); },
  expandAll: () => { ListOps.expandAll(); render(); Storage.scheduleSave(); },
  collapseAll: () => { ListOps.collapseAll(); render(); Storage.scheduleSave(); },
  clearAllFilters: () => { ListOps.clearAllFilters(); render(); Storage.scheduleSave(); },
  hideAppMenus: ListOps.hideAppMenus,
  
  // Journal operations - delegate to ListOps (with render/save wrappers where needed)
  toggleListType: () => { ListOps.toggleListType(); render(); Storage.scheduleSave(); },
  createJournalEntryForDate: (dateStr) => { 
    const result = ListOps.createJournalEntryForDate(dateStr); 
    if (result) { render(); Storage.scheduleSave(); }
  },
  sortJournal: () => { ListOps.sortJournal(); render(); Storage.scheduleSave(); },
  sortSection: (section) => { 
    const result = ListOps.sortSection(section); 
    if (result) { render(); Storage.scheduleSave(); }
  },
  toggleSortOrder: () => { ListOps.toggleSortOrder(); render(); Storage.scheduleSave(); },
  deleteSection: (section) => { 
    const result = ListOps.deleteSection(section); 
    if (result) { render(); Storage.scheduleSave(); }
  },
  
  // Helper functions used by Menu - delegate to ListOps
  getRecentListsForMenu: ListOps.getRecentListsForMenu,
  getEffectiveBgColor: Util.getEffectiveBgColor,
  
  // Menu helper callbacks
  changeCurrentBg: (bg) => {
    const currentList = State.getCurrentList();
    if (!currentList) return;
    currentList.bgColor = bg;
    render();
    Storage.scheduleSave();
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
      renderIndex();
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
