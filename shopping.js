// Shopping.js - the shopping list web app
// Handles the logic and display, uses a simpel REST-like
// back end for storage

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


// Menu dropdown
const menu = document.createElement('div');
menu.style.display = 'none';
menu.style.position = 'absolute';
menu.style.background = '#fff';
menu.style.border = '1px solid #ccc';
menu.style.padding = '4px 0';
menu.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
menu.style.zIndex = '1000';
body.appendChild(menu);

// Section menu (shared)
const secMenu = document.createElement('div');
secMenu.style.display = 'none';
secMenu.style.position = 'absolute';
secMenu.style.background = currentList?.bgColor || '#fff';
secMenu.style.color = getContrastColor(currentList?.bgColor || '#fff');
secMenu.style.border = '1px solid #ccc';
secMenu.style.padding = '4px 0';
secMenu.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
secMenu.style.zIndex = '1000';
document.body.appendChild(secMenu);

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


function hideMenus() {  // Hide both section and global menus
  menu.style.display = 'none';
  menuButton.setAttribute('aria-expanded','false');
  secMenu.style.display = 'none';
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

function addMenuItem(menu, text, onClick) {
  const div = document.createElement('div');
  div.textContent = text;
  div.style.padding = '4px 12px';
  div.style.cursor = 'pointer';
  div.onmouseover = () => div.style.background = '#eee';
  div.onmouseout = () => div.style.background = '';
  div.onclick = () => { onClick(); hideMenus(); };
  menu.appendChild(div);
}

// ============== Section menu ==================



function buildSectionMenu(section, menu) {
  menu.innerHTML = '';

  if ( section.collapsed ) {
    addMenuItem(menu,"Expand", () => {
      section.collapsed = false;
      focusItem = section;
      render();
      scheduleSave();
    });
  } else {
    addMenuItem(menu,"Collapse", () => {
      section.collapsed = false;
      focusItem = section;
      render();
      scheduleSave();
    });
  }

  addMenuItem(menu,"Uncheck All", () => {
    traverseSections(section.items, null, it => {it.checked = false;} );
  });

  const filterDiv = document.createElement('div');
  filterDiv.style.padding = '4px 12px';
  filterDiv.textContent = 'Show: ';
  ['all','checked','unchecked','none'].forEach(f => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = f[0].toUpperCase() + f.slice(1);
    btn.style.marginRight = '4px';
    if (section.filter === f || (!section.filter && f === 'all')) {
      btn.style.fontWeight = 'bold';
      btn.style.textDecoration = 'underline';
    }
    btn.onclick = () => {
      section.filter = section.filter = f === 'none' ? '' : f; // none = ''
      focusItem = section;
      render();
      scheduleSave();
      hideMenus();
    };
    filterDiv.appendChild(btn);
  });
  menu.appendChild(filterDiv);

  // Color picker
  const colorDiv = document.createElement('div');
  colorDiv.style.padding = '4px 12px';
  const colorLabel = document.createElement('label');
  colorLabel.textContent = 'Color: ';
  const colorInput = document.createElement('input');
  const bg = section.bgColor ||currentList?.bgColor ||  '#ffffff';
  colorInput.type = 'color';
  colorInput.value = bg;
  colorInput.oninput = () => { section.bgColor = colorInput.value; render(); scheduleSave(); };
  colorLabel.appendChild(colorInput);
  colorDiv.appendChild(colorLabel);
  menu.appendChild(colorDiv);

  menu.style.background = bg;
  menu.style.color = getContrastColor(bg);
}


// ================= Menu actions =================

function createNewList(name=null) {
  // TODO - Save the current list if modified
  if (! name)
    name = prompt('Enter new list name:');
  if(!name)
    name = "NewList";
  const newListObj = {
    name,
    items:[{
      type:"section",
      title:name,
      collapsed:false,
      items:[{type:"item", text:"", checked:false}]
    }]
  };
  allLists.push({name});
  selectList(name,newListObj);
  scheduleSave();
}

function deleteCurrentList() {
  if(!confirm(`Delete list "${currentList.name}"?`)) return;
  fetch(`/shopping/api.cgi/${currentList.name}`,{method:'DELETE'})
  .then ( data => {
    allLists = allLists.filter(l=>l.name!==currentList.name);
    if(!allLists.length) {
      createNewList("NewList"); // Make sure we have something
    }
    else
      selectList(allLists[0].name);
    render();
  })
  .catch(console.error);
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
    } else if ( item.type  = 'item' ) {
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

function uncheckAll() {
  traverseSections(currentList.items, null, it => {
    if (it.type === 'item') {
      it.checked = false;
    }
  });
  hideMenus();
};

function clearAllFilters() {
  currentList.filter = "",
  traverseSections(currentList.items, sec => sec.filter = '');
}


// Build menu items dynamically
function buildMenu() {
  menu.innerHTML='';
  const bg = currentList?.bgColor || '#ffffff';
  menu.style.background = bg;
  menu.style.color = getContrastColor(bg);

  addMenuItem(menu, 'New List', createNewList);
  addMenuItem(menu, 'Delete List', deleteCurrentList);
  // separator
  const sep=document.createElement('div');
  sep.style.borderTop='1px solid #ccc';
  sep.style.margin='4px 0';
  menu.appendChild(sep);

  addMenuItem(menu, 'Uncheck All', uncheckAll);

  addMenuItem(menu, 'Expand All', expandAll);
  addMenuItem(menu, 'Collapse All', collapseAll);
  addMenuItem(menu, 'Clear All Filters', clearAllFilters);

  // Global filter
  const gfDiv = document.createElement('div');
  gfDiv.style.padding = '4px 12px';
  gfDiv.textContent = 'Show: ';
  ['checked','unchecked','none'].forEach(f=>{
    const btn=document.createElement('button');
    btn.type='button';
    btn.textContent=f[0].toUpperCase()+f.slice(1);
    btn.style.marginRight='4px';
    if((currentList.filter||'all')===f){
      btn.style.fontWeight='bold';
      btn.style.textDecoration='underline';
    }
    btn.onclick=()=>{
      currentList.filter = f==='none' ? '' : f;
      render();
      scheduleSave();
      hideMenus();
    };
    gfDiv.appendChild(btn);
  });
  menu.appendChild(gfDiv);

  // Color picker
  const colorItem = document.createElement('div');
  colorItem.style.padding = '4px 12px';
  colorItem.style.cursor = 'default';
  const colorLabel = document.createElement('label');
  colorLabel.textContent = 'Background: ';
  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.value = currentList?.bgColor || '#ffffff'; // default white
  colorInput.oninput = () => {
    currentList.bgColor = colorInput.value;
    document.body.style.backgroundColor = currentList.bgColor || '#ffffff' ;
    document.body.style.color = getContrastColor(currentList.bgColor || '#ffffff');
    scheduleSave();
    hideMenus();
  };
  colorLabel.appendChild(colorInput);
  colorItem.appendChild(colorLabel);
  menu.appendChild(colorItem);

  // separator
  const sep2=document.createElement('div');
  sep2.style.borderTop='1px solid #ccc';
  sep2.style.margin='4px 0';
  menu.appendChild(sep2);

  // list entries
  allLists.forEach(lst=>{
    const li=document.createElement('div');
    li.textContent=lst.name;
    li.style.padding='4px 12px';
    li.style.cursor='pointer';
    li.onclick=()=>{ hideMenus(); selectList(lst.name); };
    menu.appendChild(li);
  });
}

// Show/hide menu
menuButton.onclick=e=>{
  e.stopPropagation();
  if(menu.style.display==='none'){
    buildMenu();
    const rect=menuButton.getBoundingClientRect();
    menu.style.left=rect.left+'px';
    menu.style.top=(rect.bottom+6+window.scrollY)+'px';
    menu.style.display='block';
    menuButton.setAttribute('aria-expanded','true');
  } else hideMenus();
};
document.addEventListener('click',e=>{
  if(!menu.contains(e.target) && e.target !== menuButton) hideMenus();
  if (!secMenu.contains(e.target)) hideMenus();
});
document.addEventListener('keydown',e=>{ if(e.key==='Escape') hideMenus(); });

// ================= List selection =================
function selectList(name,data){
  // TODO Save the current list if modified
  // Can happen while waiting for the savetimeout
  document.title=name;
  listName.textContent=name;
  if(data){
    currentList=data;
    render();
  }
  else
    fetch(`/shopping/api.cgi/${name}`)
    .then(r=>r.json())
    .then(d=>{ currentList=d; render(); });
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
  span.onblur=()=>{
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
  toggleBtn.textContent = section.collapsed ? '[+]' : '[-]';
  toggleBtn.style.marginRight = '0.5em';
  toggleBtn.type = 'button';

  toggleBtn.onclick = e => {
    e.stopPropagation();
    if (secMenu.style.display === 'block' || e.detail === 2) {
      section.collapsed = !section.collapsed;

      // set focusItem to the section title before render
      focusItem = section;

      render();
      scheduleSave();
      hideMenus();
    } else {
      buildSectionMenu(section, secMenu);
      const rect = toggleBtn.getBoundingClientRect();
      secMenu.style.left = rect.left + 'px';
      secMenu.style.top = rect.bottom + window.scrollY + 4 + 'px';
      secMenu.style.display = 'block';
    }
  };

  document.addEventListener('click', e => {  // hide menu
    if (!secMenu.contains(e.target) && e.target !== toggleBtn) secMenu.style.display = 'none';
  });

  header.appendChild(toggleBtn);

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

  title.onblur = () => {
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
  if (typeof drag !== 'undefined' && drag.registerDragHandle) {
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
function render(into = document.body){
  document.body.style.backgroundColor = currentList.bgColor || '#ffffff';
  document.body.style.color = getContrastColor(currentList.bgColor || '#ffffff');
  renderItems(container,currentList.items,currentList.items, currentList.filter || 'all');
  if (focusItem) {
    const lines = container.querySelectorAll('.line-text');
    const titles = container.querySelectorAll('.section-header .title');
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

fetch('/shopping/api.cgi/')
  .then(r=>r.json())
  .then(data=>{
    allLists = data.map(name=>({name}));
    if (!allLists.length) { // Make sure we have at least some list
      console.log("No lists found. Creating NewList");
      createNewList("NewList");
    }
    let want = window.preferredList || "";
    let idx = allLists.findIndex(l => l.name === want);
    if (idx < 0) idx = 0;

    selectList(allLists[idx].name);
  })
  .catch(err=>console.log('Using default list:',err));


