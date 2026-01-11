// menu.js — extracted menu handling for shopping app
// Exposes a global Menu object with init(), setAllLists(), setCurrentList(), hideMenus(), showSectionMenu()

(function(window, document){
  const doc = document;
  let menu, secMenu, subMenu;
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

    // Generic submenu (used for New, View, Filters, Settings)
    subMenu = createStyledMenu();
    applyMenuColors(subMenu, bg);
    document.body.appendChild(subMenu);
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

  function addMenuHeader(menuEl, text){
    const header = document.createElement('div');
    header.textContent = text;
    header.style.padding = '6px 12px 2px 12px';
    header.style.fontWeight = 'bold';
    header.style.fontSize = '0.85em';
    header.style.color = '#666';
    header.style.textTransform = 'uppercase';
    header.style.letterSpacing = '0.5px';
    menuEl.appendChild(header);
  }

  function buildMenuInternal(){
    menu.innerHTML='';
    const bg = currentList?.bgColor || '#ffffff';
    applyMenuColors(menu, bg);

    // ===== CREATE SECTION =====
    addMenuHeader(menu, 'Create');
    
    addMenuItem(menu, '+ New List', options.callbacks.createNewList || (()=>{}));
    
    addMenuItem(menu, '+ New Journal', () => {
      const name = window.prompt ? window.prompt('Enter new journal name:') : null;
      if (name !== null) {
        if (options.callbacks && typeof options.callbacks.createNewList === 'function') {
          options.callbacks.createNewList(name, 'journal');
        } else if (options.callbacks && typeof options.callbacks.createNew === 'function') {
          options.callbacks.createNew(name, 'journal');
        }
      }
    });

    // Only show current list actions if there's a current list
    if (currentList) {
      menu.appendChild(createSeparator());
      
      // ===== CURRENT LIST SECTION =====
      addMenuHeader(menu, currentList.name);
      
      // Add Item to current list
      if (options.callbacks && typeof options.callbacks.addItemToList === 'function') {
        addMenuItem(menu, '+ Add Item...', () => {
          options.callbacks.addItemToList(options.menuButton || menu);
        });
      }

      // Journal-specific actions
      if (currentList.type === 'journal') {
        addMenuItem(menu, '+ New Entry for Date...', () => {
          const dateStr = window.prompt ? window.prompt('Enter date (YYYY-MM-DD), empty = today:') : '';
          if (dateStr !== null) {
            if (options.callbacks && typeof options.callbacks.createJournalEntryForDate === 'function') {
              options.callbacks.createJournalEntryForDate(dateStr);
            }
          }
        });
        
        if (options && options.callbacks && typeof options.callbacks.sortJournal === 'function') {
          addMenuItem(menu, '↕ Sort Journal', () => {
            options.callbacks.sortJournal();
          });
        }
        
        // Toggle sort order for journals
        if (options && options.callbacks && typeof options.callbacks.toggleSortOrder === 'function') {
          const sortOrder = currentList.sortOrder || 'newest-first';
          const label = sortOrder === 'newest-first' ? '⬇ Sort: Newest First' : '⬆ Sort: Oldest First';
          addMenuItem(menu, label, () => {
            options.callbacks.toggleSortOrder();
          });
        }
      }

      addMenuItem(menu, '↔ Toggle Journal Mode', () => {
        if (options.callbacks && typeof options.callbacks.toggleListType === 'function') {
          options.callbacks.toggleListType();
        }
      });

      // Color picker
      createColorPicker(menu, 'Background: ', currentList.bgColor || '#ffffff', (val) => {
        if (options.callbacks.changeCurrentBg) options.callbacks.changeCurrentBg(val);
      });

      // Global filter
      createFilterButtons(menu, ['checked','unchecked','none'], currentList.filter || 'all', (f) => {
        currentList.filter = f === 'none' ? '' : f;
        options.callbacks.scheduleSave && options.callbacks.scheduleSave();
        options.callbacks.selectList && options.callbacks.selectList(currentList.name);
        hideMenus();
      });

      menu.appendChild(createSeparator());

      // ===== BULK ACTIONS SECTION =====
      addMenuHeader(menu, 'Bulk Actions');
      
      addMenuItem(menu, '☐ Uncheck All', options.callbacks.uncheckAll || (()=>{}));
      addMenuItem(menu, '▼ Expand All', options.callbacks.expandAll || (()=>{}));
      addMenuItem(menu, '▶ Collapse All', options.callbacks.collapseAll || (()=>{}));
      addMenuItem(menu, '⊗ Clear All Filters', options.callbacks.clearAllFilters || (()=>{}));

      menu.appendChild(createSeparator());

      // ===== DANGER ZONE =====
      addMenuItem(menu, '🗑 Delete This List', options.callbacks.deleteCurrentList || (()=>{}));
    }

    menu.appendChild(createSeparator());

    // ===== SWITCH TO SECTION =====
    addMenuHeader(menu, 'Switch to List');
    const switchLists = (allLists || []).filter(lst => !currentList || lst.name !== currentList.name);
    
    // list entries (exclude current list)
    switchLists.forEach(lst=>{
      const a = document.createElement('a');
      a.textContent = lst.name;
      a.href = `?l=${encodeURIComponent(lst.name)}`;
      a.style.display = 'block';
      a.style.padding = '4px 12px';
      a.style.cursor = 'pointer';
      if (lst.name === currentList?.name) {
        a.style.fontWeight = 'bold';
      }
      // Allow natural navigation so the list reloads fully
      a.onclick = () => hideMenus();
      menu.appendChild(a);
    });
  }

  function hideMenus(){
    if (menu) menu.style.display = 'none';
    if (options && options.menuButton) options.menuButton.setAttribute('aria-expanded','false');
    if (secMenu) secMenu.style.display = 'none';
    if (subMenu) subMenu.style.display = 'none';
  }

  function rebuildOpenMenus(){
    if (menu && menu.style.display === 'block') buildMenuInternal();
    if (secMenu && secMenu.style.display === 'block') {
      // if we had a section open, rebuild it (we don't track which one here; the app will re-show)
      secMenu.style.display='none';
    }
    if (subMenu && subMenu.style.display === 'block') {
      subMenu.style.display = 'none';
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
    const clickedOutsideMain = menu && !menu.contains(e.target) && e.target !== options.menuButton;
    const clickedOutsideSec = secMenu && !secMenu.contains(e.target);
    const clickedOutsideSub = subMenu && !subMenu.contains(e.target);
    if (clickedOutsideMain && clickedOutsideSec && clickedOutsideSub) hideMenus();
  }
  function onDocumentKey(e){ if (e.key === 'Escape') hideMenus(); }

  // Helper: add a trigger item that opens a submenu anchored to this item
  function addTrigger(menuEl, text, buildFn){
    const div = document.createElement('div');
    div.textContent = text;
    div.style.padding = '4px 12px';
    div.style.cursor = 'pointer';
    div.onmouseover = () => div.style.background = '#eee';
    div.onmouseout = () => div.style.background = '';
    div.onclick = () => {
      showSubmenuAt(div, buildFn);
    };
    menuEl.appendChild(div);
    return div;
  }

  // Show generic submenu at anchor element and build its content via buildFn(subMenu)
  function showSubmenuAt(anchor, buildFn){
    if (!subMenu) return;
    subMenu.innerHTML = '';
    const bg = currentList?.bgColor || '#ffffff';
    applyMenuColors(subMenu, bg);
    buildFn(subMenu);
    const rect = anchor.getBoundingClientRect();
    subMenu.style.left = rect.left + 'px';
    subMenu.style.top = (rect.bottom + window.scrollY + 4) + 'px';
    subMenu.style.display = 'block';
  }

  function buildMenuInternal(){
    menu.innerHTML='';
    const bg = currentList?.bgColor || '#ffffff';
    applyMenuColors(menu, bg);

    // New… submenu
    addTrigger(menu, 'New…', (sm) => {
      addMenuItem(sm, 'List', options.callbacks.createNewList || (()=>{}));
      addMenuItem(sm, 'Journal', () => {
        const name = window.prompt ? window.prompt('Enter new journal name:') : null;
        if (name !== null) {
          if (options.callbacks && typeof options.callbacks.createNewList === 'function') {
            options.callbacks.createNewList(name, 'journal');
          } else if (options.callbacks && typeof options.callbacks.createNew === 'function') {
            options.callbacks.createNew(name, 'journal');
          }
        }
      });
    });

    // Add to … opens add-item dialog directly
    if (currentList && options.callbacks && typeof options.callbacks.addItemToList === 'function') {
      addMenuItem(menu, `Add to ${currentList.name}…`, () => {
        options.callbacks.addItemToList(options.menuButton || menu);
      });
    }

    // View… submenu
    addTrigger(menu, 'View…', (sm) => {
      addMenuItem(sm, 'Expand All', options.callbacks.expandAll || (()=>{}));
      addMenuItem(sm, 'Collapse All', options.callbacks.collapseAll || (()=>{}));
      
      // Filters section
      sm.appendChild(createSeparator());
      const setFilter = (val) => {
        if (!currentList) return;
        currentList.filter = val;
        options.callbacks.scheduleSave && options.callbacks.scheduleSave();
        options.callbacks.selectList && options.callbacks.selectList(currentList.name);
        hideMenus();
      };
      addMenuItem(sm, 'Show All', () => setFilter('all'));
      addMenuItem(sm, 'Checked', () => setFilter('checked'));
      addMenuItem(sm, 'Unchecked', () => setFilter('unchecked'));
      addMenuItem(sm, 'Inherit (None)', () => setFilter(''));
      sm.appendChild(createSeparator());
      addMenuItem(sm, 'Clear All Filters', options.callbacks.clearAllFilters || (()=>{}));
    });

    // Settings… submenu
    addTrigger(menu, 'Settings…', (sm) => {
      // Background color picker
      createColorPicker(sm, 'Background: ', currentList?.bgColor || '#ffffff', (val) => {
        if (options.callbacks.changeCurrentBg) options.callbacks.changeCurrentBg(val);
      });
      // Toggle journal mode
      addMenuItem(sm, 'Toggle Journal Mode', () => {
        if (options.callbacks && typeof options.callbacks.toggleListType === 'function') {
          options.callbacks.toggleListType();
        }
      });
      // Sort Journal (only for journal type lists)
      if (currentList && currentList.type === 'journal' && options && options.callbacks && typeof options.callbacks.sortJournal === 'function') {
        addMenuItem(sm, 'Sort Journal', () => {
          options.callbacks.sortJournal();
        });
        
        // Toggle sort order
        if (typeof options.callbacks.toggleSortOrder === 'function') {
          const sortOrder = currentList.sortOrder || 'newest-first';
          const label = sortOrder === 'newest-first' ? 'Sort: Newest First ⬇' : 'Sort: Oldest First ⬆';
          addMenuItem(sm, label, () => {
            options.callbacks.toggleSortOrder();
          });
        }
      }
      // Uncheck all moved to Settings
      addMenuItem(sm, 'Uncheck All', options.callbacks.uncheckAll || (()=>{}));
      // Delete action with type + name
      if (currentList) {
        const typeWord = (currentList.type === 'journal') ? 'Journal' : 'List';
        addMenuItem(sm, `Delete ${typeWord} "${currentList.name}"`, options.callbacks.deleteCurrentList || (()=>{}));
      }
    });

    menu.appendChild(createSeparator());

    // Recent lists (API decides count) and All Lists… (exclude current list)
    const recent = (allLists || []).filter(lst => !currentList || lst.name !== currentList.name);
    recent.forEach(lst=>{
      const a = document.createElement('a');
      const prefix = lst.name === currentList?.name ? '• ' : '';
      a.textContent = prefix + lst.name;
      a.href = `?l=${encodeURIComponent(lst.name)}`;
      a.style.display = 'block';
      a.style.padding = '4px 12px';
      a.style.cursor = 'pointer';
      if (lst.name === currentList?.name) {
        a.style.fontWeight = 'bold';
      }
      // Let anchors navigate normally so the new list loads fresh
      a.onclick = () => hideMenus();
      menu.appendChild(a);
    });

    // Link to index page
    const allLink = document.createElement('a');
    allLink.textContent = 'All Lists…';
    allLink.href = window.location.pathname;
    allLink.style.display = 'block';
    allLink.style.padding = '4px 12px';
    allLink.style.cursor = 'pointer';
    allLink.onmouseover = () => allLink.style.background = '#eee';
    allLink.onmouseout = () => allLink.style.background = '';
    allLink.onclick = () => hideMenus();
    menu.appendChild(allLink);
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

  const Menu = {
    init(opts){
      options = opts || {};
      if (!options.getContrastColor) options.getContrastColor = (hex) => '#000';
      if (!options.menuButton) console.warn('Menu.init: menuButton not provided');
      if (!menu || !secMenu || !subMenu) createMenuElements();

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
