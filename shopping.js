// Shopping.js - the shopping list web app
// Handles the logic and display, uses a simpel REST-like
// back end for storage

"use strict";  // Croak on undefined vars etc

// ================= Data =================
let allLists = [];   // {name}
let currentList = null;
let saveTimeout;
let focusItem = null;
let isSaving = false;
let isModified = false;


// ================= Build page =================
const body = document.body;

// App container
const appContainer = document.createElement('div');
body.appendChild(appContainer);

// Top line: title + menu button
const titleContainer = document.createElement('div');
titleContainer.style.display = 'flex';
titleContainer.style.alignItems = 'center';
titleContainer.style.gap = '0.5em';
appContainer.appendChild(titleContainer);

const menuButton = document.createElement('button');
menuButton.textContent = '☰';
menuButton.type = 'button';
menuButton.style.padding = '0.15em 0.5em';
titleContainer.appendChild(menuButton);

const listName = document.createElement('span');
listName.id = 'list-name';
listName.style.fontSize = '1.5em';
listName.style.fontWeight = 'bold';
titleContainer.appendChild(listName);

const listStatus = document.createElement('span');
listStatus.style.marginLeft = '0.5em';
listStatus.style.fontWeight = 'normal';
//listStatus.style.color = '#c00';  // red for modified
titleContainer.appendChild(listStatus);


// Container for list items
const container = document.createElement('div');
container.id = 'list-container';
container.style.marginTop = '0.5em';
appContainer.appendChild(container);

// ================= Utility =================

function updateStatus() {
  let statusChar = '';
  if (isSaving) statusChar = ' S';
  else if (isModified) statusChar = ' *';
  listStatus.textContent = statusChar;
  // Update tab title
  if (currentList) {
    document.title = currentList.name + statusChar;
  }
}

function saveCurrentList() {
  isSaving = true;
  updateStatus();
  clearTimeout(saveTimeout);

  return fetch(`/shopping/api.cgi/${currentList.name}`, {
    method: 'POST',
    body: JSON.stringify(currentList, null, 2) + '\n',
    headers: { 'Content-Type': 'application/json' }
  }).then(() => {
    isSaving = false;
    isModified = false;
    updateStatus();
  });
}

function scheduleSave() {
  clearTimeout(saveTimeout);
  if (!currentList) return;
  isModified = true;
  updateStatus();

  saveTimeout = setTimeout(() => {
    saveCurrentList().catch(console.error);
  }, 2000);  // in ms
}


function getContrastColor(hex) {
  // remove leading #
  if (hex.startsWith('#')) hex = hex.slice(1);
  const r = parseInt(hex.substr(0,2),16);
  const g = parseInt(hex.substr(2,2),16);
  const b = parseInt(hex.substr(4,2),16);
  // relative luminance formula
  const lum = 0.299*r + 0.587*g + 0.114*b;
  return lum > 186 ? '#000000' : '#ffffff'; // light bg → black, dark bg → white
}

// ================= Menu integration =================
// menu.js is included by the server-side page; we do not inject it here.
// Initialize Menu if available; otherwise wait for window 'load' as a fallback.

function initMenuIntegration(){
  if (window.Menu && Menu.init) {
    Menu.init({
      menuButton,
      getContrastColor,
      callbacks: {
        indexLink,
        createNewList,
        deleteCurrentList,
        uncheckAll,
        expandAll,
        collapseAll,
        clearAllFilters,
        selectList: (name) => selectList(name),
        scheduleSave,
        changeCurrentBg: (bg) => {
          if (!currentList) return;
          currentList.bgColor = bg;
          document.body.style.backgroundColor = bg || '#ffffff';
          document.body.style.color = getContrastColor(bg || '#ffffff');
          scheduleSave();
          Menu.hideMenus();
        },
        // New callbacks for sorting and deletion
        sortJournal: () => sortJournal(),
        sortSection: (section) => sortSection(section),
        deleteSection: (section) => deleteSection(section),
        // other callbacks
        toggleListType: () => toggleListType(),
        createJournalEntryForDate: (dateStr) => createJournalEntryForDate(dateStr),
        capturePhoto: () => {
          if (typeof capturePhoto !== 'undefined') {
            capturePhoto();
          } else {
            console.error('capturePhoto function not available');
          }
        }
      },
      document,
      body: document.body
    });

    if (allLists && Menu.setAllLists) Menu.setAllLists(allLists);
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

initMenuIntegration();

// Helper to call Menu.hideMenus() if available
function hideAppMenus(){ if (window.Menu && Menu.hideMenus) Menu.hideMenus(); }

// ============== Section menu actions that used to rely on hideMenus ================
function uncheckAll() {
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
  if(!name)
    name = "NewList";

  let newListObj;
  if (type === 'journal') {
    // For journal lists, start with empty items and let JournalHelper populate the year/month/day path.
    newListObj = {
      name,
      type: 'journal',
      items: []
    };
  } else {
    newListObj = {
      name,
      type: type || 'checklist',
      items:[{
        type:"section",
        title:name,
        collapsed:false,
        items:[{type:"item", text:"", checked:false}]
      }]
    };
  }

  allLists.push({name});
  if (window.Menu && Menu.setAllLists) Menu.setAllLists(allLists);
  selectList(name,newListObj);
  scheduleSave();
}

function deleteCurrentList() {
  if(!confirm(`Delete list "${currentList.name}"?`)) return;
  fetch(`/shopping/api.cgi/${currentList.name}`,{method:'DELETE'})
  .then ( data => {
    allLists = allLists.filter(l=>l.name!==currentList.name);
    if (window.Menu && Menu.setAllLists) Menu.setAllLists(allLists);
    indexLink();
  })
  .catch(console.error);
}

// Toggle list type between 'journal' and 'checklist'
function toggleListType() {
  if (!currentList) return;
  const was = currentList.type || 'checklist';
  const now = was === 'journal' ? 'checklist' : 'journal';
  currentList.type = now;

  // If switching to journal, ensure today's journal path exists
  if (now === 'journal' && window.JournalHelper) {
    try {
      const res = JournalHelper.ensureJournalPathForDate(currentList, new Date());
      if (res && res.createdItem) focusItem = res.createdItem;
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
        focusItem = res.createdItem;
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

// Extract a prefix of required length (4/7/10) from a title if it matches the corresponding pattern
function getTitlePrefix(title, prefixLen) {
  if (typeof title !== 'string') return null;
  if (prefixLen === 4) {
    const m = title.match(/^(\d{4})/);
    return m ? m[1] : null;
  } else if (prefixLen === 7) {
    const m = title.match(/^(\d{4}-\d{2})/);
    return m ? m[1] : null;
  } else if (prefixLen === 10) {
    const m = title.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
  }
  return null;
}

// Reorder only the section elements in parentArray among the original section-slots,
// leaving non-section elements in their original positions.
function reorderSectionsInPlace(parentArray, prefixLen) {
  if (!Array.isArray(parentArray)) return;
  // Collect indices of section slots and their section objects
  const sectionSlots = [];
  for (let i = 0; i < parentArray.length; i++) {
    if (parentArray[i] && parentArray[i].type === 'section') {
      sectionSlots.push({ index: i, section: parentArray[i] });
    }
  }
  if (sectionSlots.length <= 1) return;

  // Sort sections by prefix descending (newest-first); if prefix missing, treat as smallest
  sectionSlots.sort((a, b) => {
    const pa = getTitlePrefix(a.section.title, prefixLen);
    const pb = getTitlePrefix(b.section.title, prefixLen);
    if (pa && pb) return pb.localeCompare(pa);
    if (pa && !pb) return -1; // keep prefixed before non-prefixed
    if (!pa && pb) return 1;
    return 0;
  });

  // Place sorted sections back into the parentArray at their original section slot indices
  let si = 0;
  for (let i = 0; i < parentArray.length; i++) {
    if (parentArray[i] && parentArray[i].type === 'section') {
      parentArray[i] = sectionSlots[si++].section;
    }
  }
}

// Sort entire journal: years, months and days (sections only), newest-first
function sortJournal() {
  if (!currentList || !Array.isArray(currentList.items)) return;
  // Sort year-level sections (prefixLen = 4)
  reorderSectionsInPlace(currentList.items, 4);
  // For each year, sort its months (prefixLen = 7)
  currentList.items.forEach(yearSec => {
    if (yearSec && yearSec.type === 'section' && Array.isArray(yearSec.items)) {
      reorderSectionsInPlace(yearSec.items, 7);
      // For each month, sort its days (prefixLen = 10)
      yearSec.items.forEach(monthSec => {
        if (monthSec && monthSec.type === 'section' && Array.isArray(monthSec.items)) {
          reorderSectionsInPlace(monthSec.items, 10);
        }
      });
    }
  });
  render();
  scheduleSave();
}

// Sort only the immediate subsections of the provided section (determine prefix len from children)
function sortSection(section) {
  if (!section || !Array.isArray(section.items)) return;
  // Decide which prefix length to use by inspecting children titles
  let prefixLen = null;
  for (const child of section.items) {
    if (child && child.type === 'section') {
      if (getTitlePrefix(child.title, 10)) { prefixLen = 10; break; }
      if (getTitlePrefix(child.title, 7)) { prefixLen = 7; /* but keep scanning for 10 just in case */ }
      if (!prefixLen && getTitlePrefix(child.title, 4)) prefixLen = 4;
    }
  }
  if (!prefixLen) {
    alert('No sortable subsections found in this section.');
    return;
  }
  reorderSectionsInPlace(section.items, prefixLen);
  render();
  scheduleSave();
}

// ============== Section deletion helpers ==============

// Find the parent array and index of a target section by walking tree rooted at items.
// Returns { parentArray, index } or null if not found.
function findParentArrayAndIndex(items, target) {
  if (!Array.isArray(items)) return null;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it === target) return { parentArray: items, index: i };
    if (it && it.type === 'section') {
      const found = findParentArrayAndIndex(it.items, target);
      if (found) return found;
    }
  }
  return null;
}
// Recursively count non-empty item/text lines inside a section
function countNonEmptyItems(section) {
  if (!section || !Array.isArray(section.items)) return 0;
  let count = 0;
  for (const it of section.items) {
    if (!it) continue;
    if (it.type === 'item' || it.type === 'text') {
      if (typeof it.text === 'string' && it.text.trim() !== '') count++;
    } else if (it.type === 'section') {
      count += countNonEmptyItems(it);
    }
  }
  return count;
}

// Find the parent array and index of a target section by walking tree rooted at items.
// Returns { parentArray, index } or null if not found.
function findParentArrayAndIndex(items, target) {
  if (!Array.isArray(items)) return null;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it === target) return { parentArray: items, index: i };
    if (it && it.type === 'section') {
      const found = findParentArrayAndIndex(it.items, target);
      if (found) return found;
    }
  }
  return null;
}

// Delete a section: prompt only if it contains non-empty items
function deleteSection(section) {
  if (!currentList || !section) return;

  // find parent array and index
  const found = findParentArrayAndIndex(currentList.items, section);
  if (!found) {
    console.warn('deleteSection: parent not found');
    return;
  }

  const nonEmptyCount = countNonEmptyItems(section);
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
  traverseSections(currentList.items, sec => sec.collapsed = false);
}

function collapseAll() {
  traverseSections(currentList.items, sec => sec.collapsed = true);
}

function clearAllFilters() {
  currentList.filter = "",
  traverseSections(currentList.items, sec => sec.filter = '');
}


// ================= FavIcon =================
function setListFavicon(name, bgColor) {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  // background
  const r = 16; // corner radius
  ctx.fillStyle = bgColor || '#ffffff';
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fill();

  // letter
 // extract up to 3 letters
  const letters = name
    .replace(/[^A-Z]/g, '')
    .slice(0, 3) || '?';

  // text
  ctx.fillStyle = getContrastColor(bgColor || '#ffffff');
  ctx.font = `bold ${letters.length === 1 ? 40 : 28}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letters, size / 2, size / 2 + 2);

  // set favicon
  let link = document.querySelector("link[rel='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = canvas.toDataURL('image/png');
}

// ================= List selection =================
function selectList(name,data){
  // Update the URL in the address bar so selection is reflected (without reloading)
  try {
    const newUrl = `${window.location.pathname}?l=${encodeURIComponent(name)}`;
    history.replaceState(null, '', newUrl);
  } catch (e) { /* ignore if history not available */ }

  document.title=name;
  listName.textContent=name;
  if(data){
    currentList=data;

    // If this is a journal list and the JournalHelper is present,
    // ensure today's year/month/day section exists before rendering.
    if (window.JournalHelper && currentList?.type === 'journal') {
      try {
        const res = JournalHelper.ensureJournalPathForDate(currentList, new Date());
        if (res && res.createdItem) {
          focusItem = res.createdItem;
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
    .then(r=>r.json())
    .then(d=>{
      currentList=d;

      // ensure journal top path if needed
      if (window.JournalHelper && currentList?.type === 'journal') {
        try {
          const res = JournalHelper.ensureJournalPathForDate(currentList, new Date());
          if (res && res.createdItem) {
            focusItem = res.createdItem;
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

      setListFavicon(name,currentList?.bgColor || '#fff');
      if (window.Menu && Menu.setCurrentList) Menu.setCurrentList(currentList);
    });
}

// ================= Render =================
function resolveFilter(section, parentSections) {
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
      focusItem = parentSection;
      render(); // so the filters take effect
      scheduleSave();
    };
    line.appendChild(cb);

    // Register the checkbox as the drag handle for items (drag.js should start only when dragging from this checkbox)
    if (typeof drag !== 'undefined' && drag.registerDragHandle) {
      drag.registerDragHandle(cb, { type: 'item', itemOrSection: item, parentArray: parentItems, domNode: line });
    }
  }
  
  // Render photo items differently - no text span, just the photo
  if (item.type === 'photo') {
    if (typeof renderPhotoItem !== 'undefined') {
      renderPhotoItem(line, item);
    }
    // Register per-line hover and pointer handlers for showing inline drop line and accepting drops
    if (typeof drag !== 'undefined' && drag.registerLine) {
      drag.registerLine(line);
    }
    container.appendChild(line);
    return;
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
        // Photo capture: remove this item, store insertion context, trigger capture
        // insertPhotoItem will use the stored context to insert at the right place
        const idx = parentItems.indexOf(item);
        if (idx >= 0) {
          parentItems.splice(idx, 1);
        }
        // Store insertion context for photo.js
        if (typeof photoInsertContext !== 'undefined') {
          photoInsertContext = { parentItems: parentItems, index: Math.max(0, idx) };
        }
        focusItem = parentItems[Math.max(0, idx - 1)] || null;
        if (typeof capturePhoto !== 'undefined') {
          capturePhoto();
        }
        render();
        span.blur();
        return;  // stop further processing
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
        focusItem = newSection.items[0];
        render();
        scheduleSave();
        return;  // stop further processing
      }
      item.text=text;
      const newItem={type:item.type,text:"",checked:false};
      const idx=parentItems.indexOf(item);
      parentItems.splice(idx+1,0,newItem);
      focusItem=newItem;
      render();
      scheduleSave();
    }
  };
  span.oninput=()=>{
    const currentText=span.textContent.trim();
    if(currentText==='' && parentItems.length>1){
      const idx=parentItems.indexOf(item);
      if(idx>=0) parentItems.splice(idx,1);
      focusItem=parentItems[Math.min(idx,parentItems.length-1)]||null;
      render();
      scheduleSave();
      return;
    }
    item.text=currentText;
    scheduleSave();
  };
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
  if ( currentList ) {
      toggleBtn.textContent = section.collapsed ? '[+]' : '[-]';
      toggleBtn.style.marginRight = '0.5em';
      toggleBtn.type = 'button';

      toggleBtn.onclick = e => {
        e.stopPropagation();
        if (e.detail === 2) {
          section.collapsed = !section.collapsed;
          focusItem = section;
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
      focusItem = newItem;
    } else {
      focusItem = section.items[0];
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
  body.style.display=section.collapsed?'none':'block';
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
  if (typeof drag !== 'undefined' && drag.registerDragHandle && currentList) {
    drag.registerDragHandle(toggleBtn, { type: 'section', itemOrSection: section, parentArray: parentSections, domNode: sec });
  }

  if(section.title.trim()==='' && focusItem===null) focusItem=section;
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
  if (!target) {
    document.body.style.backgroundColor = currentList.bgColor || '#ffffff';
    document.body.style.color = getContrastColor(currentList.bgColor || '#ffffff');
    target = container;
  } else {
    target.style.backgroundColor = currentList.bgColor || '#ffffff';
    target.style.color = getContrastColor(currentList.bgColor || '#ffffff');
  }
  renderItems(target,currentList.items,currentList.items, currentList.filter || 'all');
  if (focusItem) {
    const lines = target.querySelectorAll('.line-text');
    const titles = target.querySelectorAll('.section-header .title');
    let focused = false;
    for (const l of lines) {
      if (l._item === focusItem) { focusEditable(l); focused = true; break; }
    }
    if (!focused) for (const t of titles) {
      if (t._section === focusItem) { focusEditable(t); break; }
    }
    focusItem = null;
  }

}

// ==================== Index page =========================
function renderIndex() {
  appContainer.innerHTML = '<h1>' + currentUser + "'s lists</h1>";
  document.body.style.backgroundColor = "#444";
  document.body.style.color = "#ccc";
  currentList = null;  // indicator for not menyu buttons

  setListFavicon(currentUser, document.body.style.color);

  const index = document.createElement('div');
  index.id = 'list-index';

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
        box.style.color = getContrastColor(list.bgColor || '#ffffff');
        box.innerHTML = `<strong>&nbsp;${list.name}</strong>`;  // list title

        // render items below the title
        const itemsDiv = document.createElement('div');
        box.appendChild(itemsDiv);
        renderItems(itemsDiv, list.items, list.items, 'unchecked');
      });
  }
  appContainer.appendChild(index);
}



// ================= Init =================
// Initialize drag module (if available).
if (typeof drag !== 'undefined' && drag.init) {
  drag.init({
    container,
    render,
    scheduleSave,
    getRootItems: () => currentList ? currentList.items : []
  });
}

if (typeof initPhotoModule !== 'undefined') {
  initPhotoModule();
}

fetch('/shopping/api.cgi/')
  .then(r=>r.json())
  .then(data=>{
    allLists = data.map(name=>({name}));
    if (!allLists.length) { // Make sure we have at least some list
      console.log("No lists found. Creating NewList");
      createNewList("NewList");
    }
    //let want = window.preferredList || "";
    const params = new URLSearchParams(window.location.search);
    const want = params.get('l');   // null if not present

    if ( !want ) {
      renderIndex();
      if (window.Menu && Menu.setAllLists) Menu.setAllLists(allLists);
      return;
    }

    let idx = allLists.findIndex(l => l.name === want);
    if (idx < 0) idx = 0;

    selectList(allLists[idx].name);
    if (window.Menu && Menu.setAllLists) Menu.setAllLists(allLists);
  })
  .catch(err=>console.log('Using default list:',err));
