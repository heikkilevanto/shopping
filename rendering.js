// rendering.js
// DOM creation and rendering logic
// Extracted from shopping.js Phase 5

"use strict";

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
listName.onfocus = () => {
  // Cancel any active drag when starting to edit
  if (drag.isDragActive && drag.isDragActive()) {
    drag.forceCancelIfActive();
  }
};
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

// ================= Render Functions =================

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
    drag.registerDragHandle(cb, { type: 'item', itemOrSection: item, parentArray: parentItems, domNode: line });
  } else if (item.type === 'photo') {
    // Render photo items with camera icon as drag handle
    const bullet = document.createElement('span');
    bullet.textContent = '📷';
    bullet.classList.add('drag-handle');
    line.appendChild(bullet);

    // Register the bullet as the drag handle for photos
    drag.registerDragHandle(bullet, { type: 'item', itemOrSection: item, parentArray: parentItems, domNode: line });

    renderPhotoItem(line, item);
    // Register per-line hover and pointer handlers for showing inline drop line and accepting drops
    drag.registerLine(line);
    container.appendChild(line);
    return;
  } else {
    // For text items, add a bullet point as drag handle
    const bullet = document.createElement('span');
    bullet.textContent = '•';
    bullet.classList.add('drag-handle');
    line.appendChild(bullet);

    // Register the bullet as the drag handle for text items
    drag.registerDragHandle(bullet, { type: 'item', itemOrSection: item, parentArray: parentItems, domNode: line });
  }
  
  const span=document.createElement('span');
  span.className='line-text';
  span.textContent=item.text;
  span.contentEditable=true;
  span._item=item;

  // Cancel any active drag when starting to edit text
  span.onfocus = () => {
    if (drag.isDragActive && drag.isDragActive()) {
      drag.forceCancelIfActive();
    }
  };

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
        photoInsertContext = { parentItems: parentItems, index: idx, emptyLineItem: item };
        capturePhoto();
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
  drag.registerLine(line);

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
          Menu.showSectionMenu(section, toggleBtn);
        }
      };

    header.appendChild(toggleBtn);
  }

  const title=document.createElement('span');
  title.className='title';
  title.textContent=section.title;
  title.contentEditable=true;
  title._section=section;
  title.onfocus = () => {
    // Cancel any active drag when starting to edit section title
    if (drag.isDragActive && drag.isDragActive()) {
      drag.forceCancelIfActive();
    }
  };
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

  // Add section footer drop zone after the section
  const footerDropZone = document.createElement('div');
  footerDropZone.className = 'section-footer-drop-zone';
  container.appendChild(footerDropZone);
  drag.registerSectionFooter(footerDropZone, section, parentSections);

  // Register section header for drop behavior and mark header with references for drag module
  // attach references for drag computations
  header._section = section;
  header._parentSections = parentSections;
  drag.registerSectionHeader(header);

  // Register toggle button as the section drag handle
  drag.registerDragHandle(toggleBtn, { type: 'section', itemOrSection: section, parentArray: parentSections, domNode: sec });

  if(section.title.trim()==='' && State.getFocusItem()===null) State.setFocusItem(section);
}

// Render items recursively
function renderItems(container, items, parentItems, effectiveFilter = 'all', parentSection) {
  container.innerHTML = '';
  items.forEach(item => {
    if (item.type === 'section') {
      // compute section's filter: use own filter if set, otherwise inherit
      const secFilter = item.filter && item.filter !== '' ? item.filter : effectiveFilter;
      renderSection(container, item, parentItems, secFilter);
    } else {
      if (effectiveFilter === 'checked' && !item.checked) return;
      if (effectiveFilter === 'unchecked' && item.checked) return;
      renderItem(container, item, parentItems, parentSection);
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
    // Remove existing content div if any
    const existingContent = target.querySelector('#list-content');
    if (existingContent) target.removeChild(existingContent);
    const contentDiv = document.createElement('div');
    contentDiv.id = 'list-content';
    target.appendChild(contentDiv);
    renderItems(contentDiv, currentList.items, currentList.items, currentList.filter || 'all');

    // Add top drop zone at the top
    const topDropZone = document.createElement('div');
    topDropZone.className = 'top-drop-zone';
    contentDiv.insertBefore(topDropZone, contentDiv.firstChild);
    drag.registerTopDropZone(topDropZone, currentList.items);
  } else {
    target.style.backgroundColor = currentList.bgColor || '#ffffff';
    target.style.color = Util.getContrastColor(currentList.bgColor || '#ffffff');
    renderItems(target, currentList.items, currentList.items, currentList.filter || 'all');
  }
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
  document.title = currentUser + "'s lists";
  // Add the + New button
  const newBtn = document.createElement('button');
  newBtn.textContent = '+ New';
  newBtn.onclick = () => showCreateDialog();
  appContainer.appendChild(newBtn);

  // Define showCreateDialog
  function showCreateDialog() {
    let dialog = document.getElementById('create-dialog');
    if (!dialog) {
      dialog = document.createElement('div');
      dialog.id = 'create-dialog';
      dialog.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;';
      
      const content = document.createElement('div');
      content.style.cssText = 'background: white; padding: 20px; border-radius: 5px; color: black;';
      
      const typeSelect = document.createElement('select');
      typeSelect.innerHTML = '<option>List</option><option>Journal</option>';
      
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.placeholder = 'Enter name';
      nameInput.onkeydown = (e) => { if (e.key === 'Enter') createBtn.click(); };
      
      const createBtn = document.createElement('button');
      createBtn.textContent = 'Create';
      createBtn.onclick = () => {
        const name = nameInput.value.trim();
        if (!name) return;
        const type = typeSelect.value;
        const { name: safeName } = Storage.sanitizeListName(name);
        const allLists = State.getAllLists();
        if (allLists.find(l => l.name === safeName)) {
          alert('A list with that name already exists. Selecting it instead.');
          window.location.href = `${window.location.pathname}?l=${encodeURIComponent(safeName)}`;
        } else {
          const displayTitle = name;
          let newListObj;
          if (type === 'Journal') {
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
              type: 'checklist',
              items:[{
                type:"section",
                title:displayTitle,
                collapsed:false,
                items:[{type:"item", text:"", checked:false}]
              }]
            };
          }
          fetch(`/shopping/api.cgi/${safeName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newListObj)
          }).then(r => {
            if (r.ok) {
              window.location.href = `${window.location.pathname}?l=${encodeURIComponent(safeName)}`;
            } else {
              alert('Failed to create list');
            }
          }).catch(err => {
            alert('Error creating list: ' + err);
          });
        }
        dialog.style.display = 'none';
        nameInput.value = '';
      };
      
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Cancel';
      cancelBtn.onclick = () => dialog.style.display = 'none';
      
      content.appendChild(document.createTextNode('Type: '));
      content.appendChild(typeSelect);
      content.appendChild(document.createElement('br'));
      content.appendChild(document.createTextNode('Name: '));
      content.appendChild(nameInput);
      content.appendChild(document.createElement('br'));
      content.appendChild(createBtn);
      content.appendChild(cancelBtn);
      dialog.appendChild(content);
      document.body.appendChild(dialog);
    }
    dialog.style.display = 'flex';
  }

  document.body.style.backgroundColor = "#444";
  document.body.style.color = "#ccc";
  State.setCurrentList(null);  // indicator for not showing menu buttons

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
  if (allLists.length === 0) {
    const noListsMsg = document.createElement('p');
    noListsMsg.textContent = 'No lists found.';
    index.appendChild(noListsMsg);
  }
  appContainer.appendChild(index);
}

// ================= Public API =================
window.Rendering = {
  // DOM elements (exposed for other modules)
  appContainer,
  titleContainer,
  menuButton,
  listName,
  listStatus,
  errorBanner,
  container,
  
  // Main render functions
  render,
  renderIndex,
  
  // Internal (but exposed for special cases)
  renderItem,
  renderSection,
  renderItems
};
