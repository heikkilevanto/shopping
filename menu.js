// menu.js — extracted menu handling for shopping app
// Exposes a global Menu object with init(), setAllLists(), setCurrentList(), hideMenus(), showSectionMenu()

(function(window, document){
  const doc = document;
  let menu, secMenu;
  let allLists = [];
  let currentList = null;
  let options = null;
  let lastSectionAnchor = null;

  // Helper: Create a styled menu element
  function createStyledMenu(){
    const menuEl = document.createElement('div');
    menuEl.className = 'menu';
    menuEl.style.display = 'none';
    menuEl.style.position = 'absolute';
    menuEl.style.background = '#fff';
    menuEl.style.border = '1px solid #ccc';
    menuEl.style.padding = '4px 0';
    menuEl.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
    menuEl.style.zIndex = '1000';
    return menuEl;
  }

  // Helper: Create a separator
  function createSeparator(){
    const sep = document.createElement('div');
    sep.style.borderTop = '1px solid #ccc';
    sep.style.margin = '4px 0';
    return sep;
  }

  // Helper: Create filter buttons
  function createFilterButtons(containerEl, filterOptions, currentFilter, onFilterChange){
    const filterDiv = document.createElement('div');
    filterDiv.style.padding = '4px 12px';
    filterDiv.textContent = 'Show: ';
    filterOptions.forEach(f => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = f[0].toUpperCase() + f.slice(1);
      btn.style.marginRight = '4px';
      if (currentFilter === f || (!currentFilter && f === 'all')) {
        btn.style.fontWeight = 'bold';
        btn.style.textDecoration = 'underline';
      }
      btn.onclick = () => onFilterChange(f);
      filterDiv.appendChild(btn);
    });
    containerEl.appendChild(filterDiv);
  }

  // Helper: Create color picker
  function createColorPicker(containerEl, label, initialColor, onChange){
    const colorDiv = document.createElement('div');
    colorDiv.style.padding = '4px 12px';
    colorDiv.style.cursor = label === 'Background: ' ? 'default' : 'pointer';
    const colorLabel = document.createElement('label');
    colorLabel.textContent = label;
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = initialColor;
    colorInput.oninput = () => onChange(colorInput.value);
    colorLabel.appendChild(colorInput);
    colorDiv.appendChild(colorLabel);
    containerEl.appendChild(colorDiv);
  }

  // Helper: Apply background color and contrasting text color to element
  function applyMenuColors(element, bgColor){
    element.style.background = bgColor;
    element.style.color = options.getContrastColor ? options.getContrastColor(bgColor) : '#000';
  }

  // Helper: Find parent section of a target section by walking the tree
  function findParentSection(items, target, parent = null){
    if (!Array.isArray(items)) return null;
    for (const item of items) {
      if (item === target) return parent;
      if (item && item.type === 'section') {
        const found = findParentSection(item.items, target, item);
        if (found !== null) return found;
      }
    }
    return null;
  }

  // Helper: Get the effective background color for a section (walks up parent chain)
  function getEffectiveBgColor(section){
    if (!currentList) return '#ffffff';
    if (section.bgColor) return section.bgColor;
    
    // Walk up to find a parent with a color
    let parent = findParentSection(currentList.items, section);
    while (parent) {
      if (parent.bgColor) return parent.bgColor;
      parent = findParentSection(currentList.items, parent);
    }
    
    // Fall back to list color
    return currentList.bgColor || '#ffffff';
  }

  function createMenuElements(){
    // Main Menu dropdown
    menu = createStyledMenu();
    document.body.appendChild(menu);

    // Section menu
    secMenu = createStyledMenu();
    const bg = currentList?.bgColor || '#fff';
    applyMenuColors(secMenu, bg);
    document.body.appendChild(secMenu);
  }

  function addMenuItem(menuEl, text, onClick){
    const div = document.createElement('div');
    div.textContent = text;
    div.style.padding = '4px 12px';
    div.style.cursor = 'pointer';
    div.onmouseover = () => div.style.background = '#eee';
    div.onmouseout = () => div.style.background = '';
    div.onclick = () => { onClick(); hideMenus(); };
    menuEl.appendChild(div);
  }

  function buildSectionMenuInternal(section){
    secMenu.innerHTML = '';

    if ( section.collapsed ) {
      addMenuItem(secMenu,"Expand", () => {
        section.collapsed = false;
        options.callbacks.scheduleSave && options.callbacks.scheduleSave();
        options.callbacks.rerender && options.callbacks.rerender();
      });
    } else {
      addMenuItem(secMenu,"Collapse", () => {
        section.collapsed = true;
        options.callbacks.scheduleSave && options.callbacks.scheduleSave();
        options.callbacks.rerender && options.callbacks.rerender();
      });
    }

    addMenuItem(secMenu,"Uncheck All", () => {
      // delegate to app
      options.callbacks.uncheckAllSection && options.callbacks.uncheckAllSection(section);
      // fallback to global uncheckAll if provided
      if (!options.callbacks.uncheckAllSection && options.callbacks.uncheckAll) options.callbacks.uncheckAll();
    });

    createFilterButtons(secMenu, ['all','checked','unchecked','none'], section.filter, (f) => {
      section.filter = f === 'none' ? '' : f;
      options.callbacks.scheduleSave && options.callbacks.scheduleSave();
      options.callbacks.rerender && options.callbacks.rerender();
    });

    const effectiveBg = getEffectiveBgColor(section);
    createColorPicker(secMenu, 'Color: ', effectiveBg, (value) => {
      section.bgColor = value;
      applyMenuColors(secMenu, value);
      options.callbacks.scheduleSave && options.callbacks.scheduleSave();
      options.callbacks.rerender && options.callbacks.rerender();
    });

    // If the current list is a journal, expose "Sort Section" here
    if (currentList && currentList.type === 'journal' && options && options.callbacks && typeof options.callbacks.sortSection === 'function') {
      secMenu.appendChild(createSeparator());
      addMenuItem(secMenu, 'Sort Section', () => {
        options.callbacks.sortSection(section);
      });
    }

    // Add Item...
    if (options.callbacks && typeof options.callbacks.addItemToSection === 'function') {
      addMenuItem(secMenu, 'Add Item...', () => {
        options.callbacks.addItemToSection(section, lastSectionAnchor || secMenu);
      });
    }

    // Delete Section (available for all lists)
    secMenu.appendChild(createSeparator());
    addMenuItem(secMenu, 'Delete Section', () => {
      if (options.callbacks && typeof options.callbacks.deleteSection === 'function') {
        options.callbacks.deleteSection(section);
      }
    });

    applyMenuColors(secMenu, effectiveBg);
  }

  function buildMenuInternal(){
    menu.innerHTML='';
    const bg = currentList?.bgColor || '#ffffff';
    applyMenuColors(menu, bg);

    // New Journal (create a new list of type 'journal')
    addMenuItem(menu, 'New Journal', () => {
      const name = window.prompt ? window.prompt('Enter new journal name:') : null;
      if (name !== null) {
        if (options.callbacks && typeof options.callbacks.createNewList === 'function') {
          options.callbacks.createNewList(name, 'journal');
        } else if (options.callbacks && typeof options.callbacks.createNew === 'function') {
          options.callbacks.createNew(name, 'journal');
        }
      }
    });

    // New List
    addMenuItem(menu, 'New List', options.callbacks.createNewList || (()=>{}));

    // Add Item to current list
    if (currentList && options.callbacks && typeof options.callbacks.addItemToList === 'function') {
      addMenuItem(menu, 'Add Item...', () => {
        options.callbacks.addItemToList(options.menuButton || menu);
      });
    }

    // Toggle Journal on current list (only visible/enabled if a list is selected)
    addMenuItem(menu, 'Toggle Journal', () => {
      if (options.callbacks && typeof options.callbacks.toggleListType === 'function') {
        options.callbacks.toggleListType();
      }
    });

    // New entry for date...
    addMenuItem(menu, 'New entry for date...', () => {
      const dateStr = window.prompt ? window.prompt('Enter date (YYYY-MM-DD), empty = today:') : '';
      if (dateStr !== null) {
        if (options.callbacks && typeof options.callbacks.createJournalEntryForDate === 'function') {
          options.callbacks.createJournalEntryForDate(dateStr);
        }
      }
    });

    // If current list is a journal, show Sort Journal
    if (currentList && currentList.type === 'journal' && options && options.callbacks && typeof options.callbacks.sortJournal === 'function') {
      addMenuItem(menu, 'Sort Journal', () => {
        options.callbacks.sortJournal();
      });
    }

    addMenuItem(menu, 'Delete List', options.callbacks.deleteCurrentList || (()=>{}));
    menu.appendChild(createSeparator());

    addMenuItem(menu, 'Uncheck All', options.callbacks.uncheckAll || (()=>{}));
    addMenuItem(menu, 'Expand All', options.callbacks.expandAll || (()=>{}));
    addMenuItem(menu, 'Collapse All', options.callbacks.collapseAll || (()=>{}));
    addMenuItem(menu, 'Clear All Filters', options.callbacks.clearAllFilters || (()=>{}));

    // Global filter
    createFilterButtons(menu, ['checked','unchecked','none'], currentList?.filter || 'all', (f) => {
      if (!currentList) return;
      currentList.filter = f === 'none' ? '' : f;
      options.callbacks.scheduleSave && options.callbacks.scheduleSave();
      options.callbacks.selectList && options.callbacks.selectList(currentList.name);
      hideMenus();
    });

    // Color picker
    createColorPicker(menu, 'Background: ', currentList?.bgColor || '#ffffff', (val) => {
      if (options.callbacks.changeCurrentBg) options.callbacks.changeCurrentBg(val);
    });

    menu.appendChild(createSeparator());

    // list entries
    allLists.forEach(lst=>{
      const a = document.createElement('a');
      a.textContent = lst.name;
      a.href = `?l=${encodeURIComponent(lst.name)}`;
      a.style.display = 'block';
      a.style.padding = '4px 12px';
      a.style.cursor = 'pointer';
      a.onclick = (e) => { e.preventDefault(); hideMenus(); options.callbacks.selectList && options.callbacks.selectList(lst.name); };
      menu.appendChild(a);
    });
  }

  function hideMenus(){
    if (menu) menu.style.display = 'none';
    if (options && options.menuButton) options.menuButton.setAttribute('aria-expanded','false');
    if (secMenu) secMenu.style.display = 'none';
  }

  function rebuildOpenMenus(){
    if (menu && menu.style.display === 'block') buildMenuInternal();
    if (secMenu && secMenu.style.display === 'block') {
      // if we had a section open, rebuild it (we don't track which one here; the app will re-show)
      secMenu.style.display='none';
    }
  }

  function showMainMenu(){
    if (!menu) return;
    buildMenuInternal();
    const rect = options.menuButton.getBoundingClientRect();
    menu.style.left = rect.left + 'px';
    menu.style.top = (rect.bottom + 6 + window.scrollY) + 'px';
    menu.style.display='block';
    options.menuButton.setAttribute('aria-expanded','true');
  }

  function showSectionMenu(section, anchor){
    if(!secMenu) return;
    lastSectionAnchor = anchor || null;
    buildSectionMenuInternal(section);
    const rect = anchor.getBoundingClientRect();
    secMenu.style.left = rect.left + 'px';
    secMenu.style.top = (rect.bottom + window.scrollY + 4) + 'px';
    secMenu.style.display = 'block';
  }

  // global click/key handlers
  function onDocumentClick(e){
    if (!options) return;
    if (menu && !menu.contains(e.target) && e.target !== options.menuButton) hideMenus();
    if (secMenu && !secMenu.contains(e.target)) hideMenus();
  }
  function onDocumentKey(e){ if (e.key === 'Escape') hideMenus(); }

  const Menu = {
    init(opts){
      options = opts || {};
      if (!options.getContrastColor) options.getContrastColor = (hex) => '#000';
      if (!options.menuButton) console.warn('Menu.init: menuButton not provided');
      if (!menu || !secMenu) createMenuElements();

      // attach the menu button handler
      options.menuButton.onclick = (e) => {
        e.stopPropagation();
        if (menu.style.display === 'none') showMainMenu(); else hideMenus();
      };

      document.addEventListener('click', onDocumentClick);
      document.addEventListener('keydown', onDocumentKey);
    },
    setAllLists(lists){ allLists = lists || []; rebuildOpenMenus(); },
    setCurrentList(list){ currentList = list || null; rebuildOpenMenus(); },
    hideMenus,
    showSectionMenu,
    // convenience for other modules
    _internal: { buildMenuInternal, buildSectionMenuInternal }
  };

  window.Menu = Menu;

})(window, document);
