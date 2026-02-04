// menu.js — extracted menu handling for shopping app
// Exposes a global Menu object with init(), setAllLists(), setCurrentList(), hideMenus(), showSectionMenu()

'use strict';

// Module state
let menu, secMenu, subMenu;
let lastSectionAnchor = null;

// ================= Helper Functions =================

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
    element.style.color = Util.getContrastColor(bgColor);
  }

  // Helper: Get the effective background color for a section (walks up parent chain)
  function getEffectiveBgColor(section){
    const currentList = State.getCurrentList();
    if (!currentList) return '#ffffff';
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

  function createMenuElements(){
    // Main Menu dropdown
    menu = createStyledMenu();
    document.body.appendChild(menu);

    // Section menu
    secMenu = createStyledMenu();
    const bg = State.getCurrentList()?.bgColor || '#fff';
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
        ShoppingApp.scheduleSave();
        ShoppingApp.render();
      });
    } else {
      addMenuItem(secMenu,"Collapse", () => {
        section.collapsed = true;
        ShoppingApp.scheduleSave();
        ShoppingApp.render();
      });
    }

    addMenuItem(secMenu,"Uncheck All", () => {
      // delegate to app
      ShoppingApp.uncheckAllSection(section);
    });

    createFilterButtons(secMenu, ['all','checked','unchecked','none'], section.filter, (f) => {
      section.filter = f === 'none' ? '' : f;
      ShoppingApp.scheduleSave();
      ShoppingApp.render();
      hideMenus();
    });

    const effectiveBg = getEffectiveBgColor(section);
    createColorPicker(secMenu, 'Color: ', effectiveBg, (value) => {
      section.bgColor = value;
      applyMenuColors(secMenu, value);
      ShoppingApp.scheduleSave();
      ShoppingApp.render();
      hideMenus();
    });

    // If the current list is a journal, expose "Sort Section" here
    if (State.getCurrentList() && State.getCurrentList().type === 'journal') {
      secMenu.appendChild(createSeparator());
      addMenuItem(secMenu, 'Sort Section', () => {
        ShoppingApp.sortSection(section);
      });
    }

    // Add Item...
    addMenuItem(secMenu, 'Add Item...', () => {
      ShoppingApp.addItemToSection(section, lastSectionAnchor || secMenu);
    });

    // Delete Section (available for all lists)
    secMenu.appendChild(createSeparator());
    addMenuItem(secMenu, 'Delete Section', () => {
      ShoppingApp.deleteSection(section);
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
    
    addMenuItem(menu, '+ New List', ShoppingApp.createNewList || (()=>{}));
    
    addMenuItem(menu, '+ New Journal', () => {
      const name = window.prompt ? window.prompt('Enter new journal name:') : null;
      if (name !== null) {
        if (window.ShoppingApp && typeof ShoppingApp.createNewList === 'function') {
          ShoppingApp.createNewList(name, 'journal');
        } else if (window.ShoppingApp && typeof ShoppingApp.createNew === 'function') {
          ShoppingApp.createNew(name, 'journal');
        }
      }
    });

    // Only show current list actions if there's a current list
    if (State.getCurrentList()) {
      menu.appendChild(createSeparator());
      
      // ===== CURRENT LIST SECTION =====
      addMenuHeader(menu, State.getCurrentList().title || State.getCurrentList().name);
      
      // Add Item to current list
      if (window.ShoppingApp && typeof ShoppingApp.addItemToList === 'function') {
        addMenuItem(menu, '+ Add Item...', () => {
          ShoppingApp.addItemToList(ShoppingApp.menuButton || menu);
        });
      }

      // Journal-specific actions
      if (currentList.type === 'journal') {
        addMenuItem(menu, '+ New Entry for Date...', () => {
          const dateStr = window.prompt ? window.prompt('Enter date (YYYY-MM-DD), empty = today:') : '';
          if (dateStr !== null) {
            if (window.ShoppingApp && typeof ShoppingApp.createJournalEntryForDate === 'function') {
              ShoppingApp.createJournalEntryForDate(dateStr);
            }
          }
        });
        
        if (window.ShoppingApp && typeof ShoppingApp.sortJournal === 'function') {
          addMenuItem(menu, '↕ Sort Journal', () => {
            ShoppingApp.sortJournal();
          });
        }
        
        // Toggle sort order for journals
        if (window.ShoppingApp && typeof ShoppingApp.toggleSortOrder === 'function') {
          const sortOrder = currentList.sortOrder || 'newest-first';
          const label = sortOrder === 'newest-first' ? '⬇ Sort: Newest First' : '⬆ Sort: Oldest First';
          addMenuItem(menu, label, () => {
            ShoppingApp.toggleSortOrder();
          });
        }
      }

      addMenuItem(menu, '↔ Toggle Journal Mode', () => {
        if (window.ShoppingApp && typeof ShoppingApp.toggleListType === 'function') {
          ShoppingApp.toggleListType();
        }
      });

      // Color picker
      createColorPicker(menu, 'Background: ', currentList.bgColor || '#ffffff', (val) => {
        if (ShoppingApp.changeCurrentBg) ShoppingApp.changeCurrentBg(val);
      });

      // Global filter
      createFilterButtons(menu, ['checked','unchecked','none'], currentList.filter || 'all', (f) => {
        console.log('[Menu] Filter button clicked:', f);
        currentList.filter = f === 'none' ? '' : f;
        console.log('[Menu] currentList.filter set to:', currentList.filter);
        if (window.ShoppingApp) {
          console.log('[Menu] Calling scheduleSave and render');
          ShoppingApp.scheduleSave();
          ShoppingApp.render();
        } else {
          console.error('[Menu] ShoppingApp not available!');
        }
        hideMenus();
      });

      menu.appendChild(createSeparator());

      // ===== BULK ACTIONS SECTION =====
      addMenuHeader(menu, 'Bulk Actions');
      
      addMenuItem(menu, '☐ Uncheck All', ShoppingApp.uncheckAll || (()=>{}));
      addMenuItem(menu, '▼ Expand All', ShoppingApp.expandAll || (()=>{}));
      addMenuItem(menu, '▶ Collapse All', ShoppingApp.collapseAll || (()=>{}));
      addMenuItem(menu, '⊗ Clear All Filters', ShoppingApp.clearAllFilters || (()=>{}));

      menu.appendChild(createSeparator());

      // ===== DANGER ZONE =====
      addMenuItem(menu, '🗑 Delete This List', ShoppingApp.deleteCurrentList || (()=>{}));
    }

    menu.appendChild(createSeparator());

    // ===== SWITCH TO SECTION =====
    addMenuHeader(menu, 'Switch to List');
    const switchLists = (State.getAllLists() || []).filter(lst => !State.getCurrentList() || lst.name !== State.getCurrentList().name);
    
    // list entries (exclude current list)
    switchLists.forEach(lst=>{
      const a = document.createElement('a');
      a.textContent = lst.title || lst.name;
      a.href = `?l=${encodeURIComponent(lst.name)}`;
      a.style.display = 'block';
      a.style.padding = '4px 12px';
      a.style.cursor = 'pointer';
      if (lst.name === menuCurrentList?.name) {
        a.style.fontWeight = 'bold';
      }
      // Allow natural navigation so the list reloads fully
      a.onclick = () => hideMenus();
      menu.appendChild(a);
    });
  }

  function hideMenus(){
    if (menu) menu.style.display = 'none';
    if (window.ShoppingApp && ShoppingApp.menuButton) ShoppingApp.menuButton.setAttribute('aria-expanded','false');
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
    const rect = window.ShoppingApp.menuButton.getBoundingClientRect();
    menu.style.left = rect.left + 'px';
    menu.style.top = (rect.bottom + 6 + window.scrollY) + 'px';
    menu.style.display='block';
    window.ShoppingApp.menuButton.setAttribute('aria-expanded','true');
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
    if (!window.ShoppingApp) return;
    const clickedOutsideMain = menu && !menu.contains(e.target) && e.target !== window.ShoppingApp.menuButton;
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
    const bg = State.getCurrentList()?.bgColor || '#ffffff';
    applyMenuColors(subMenu, bg);
    buildFn(subMenu);
    const rect = anchor.getBoundingClientRect();
    subMenu.style.left = rect.left + 'px';
    subMenu.style.top = (rect.bottom + window.scrollY + 4) + 'px';
    subMenu.style.display = 'block';
  }

  function buildMenuInternal(){
    menu.innerHTML='';
    const bg = State.getCurrentList()?.bgColor || '#ffffff';
    applyMenuColors(menu, bg);

    // New… submenu
    addTrigger(menu, 'New…', (sm) => {
      addMenuItem(sm, 'List', ShoppingApp.createNewList || (()=>{}));
      addMenuItem(sm, 'Journal', () => {
        const name = window.prompt ? window.prompt('Enter new journal name:') : null;
        if (name !== null) {
          ShoppingApp.createNewList(name, 'journal');
        }
      });
    });

    // Add to … opens add-item dialog directly
    if (State.getCurrentList()) {
      const displayTitle = State.getCurrentList().title || State.getCurrentList().name;
      addMenuItem(menu, `Add to ${displayTitle}…`, () => {
        ShoppingApp.addItemToList(ShoppingApp.menuButton || menu);
      });
    }

    // View… submenu
    addTrigger(menu, 'View…', (sm) => {
      addMenuItem(sm, 'Expand All', ShoppingApp.expandAll || (()=>{}));
      addMenuItem(sm, 'Collapse All', ShoppingApp.collapseAll || (()=>{}));
      
      // Filters section with button style (matching section menu)
      sm.appendChild(createSeparator());
      createFilterButtons(sm, ['all','checked','unchecked','none'], State.getCurrentList()?.filter || 'all', (f) => {
        if (!State.getCurrentList()) return;
        // Clear section filters first (before setting list filter)
        if (State.getCurrentList().items) {
          const clearSectionFilters = (items) => {
            items.forEach(item => {
              if (item.type === 'section') {
                item.filter = '';
                if (item.items) clearSectionFilters(item.items);
              }
            });
          };
          clearSectionFilters(State.getCurrentList().items);
        }
        // Now set the list-level filter
        State.getCurrentList().filter = f === 'none' ? '' : f;
        if (window.ShoppingApp) {
          ShoppingApp.scheduleSave();
          ShoppingApp.render();
        }
        hideMenus();
      });
      sm.appendChild(createSeparator());
      addMenuItem(sm, 'Clear All Filters', ShoppingApp.clearAllFilters || (()=>{}));
    });

    // Settings… submenu
    addTrigger(menu, 'Settings…', (sm) => {
      // Background color picker
      createColorPicker(sm, 'Background: ', State.getCurrentList()?.bgColor || '#ffffff', (val) => {
        if (ShoppingApp.changeCurrentBg) ShoppingApp.changeCurrentBg(val);
      });
      // Toggle journal mode
      addMenuItem(sm, 'Toggle Journal Mode', () => {
        if (window.ShoppingApp && typeof ShoppingApp.toggleListType === 'function') {
          ShoppingApp.toggleListType();
        }
      });
      // Sort Journal (only for journal type lists)
      if (State.getCurrentList() && State.getCurrentList().type === 'journal' && window.ShoppingApp && typeof ShoppingApp.sortJournal === 'function') {
        addMenuItem(sm, 'Sort Journal', () => {
          ShoppingApp.sortJournal();
        });
        
        // Toggle sort order
        if (typeof ShoppingApp.toggleSortOrder === 'function') {
          const sortOrder = State.getCurrentList().sortOrder || 'newest-first';
          const label = sortOrder === 'newest-first' ? 'Sort: Newest First ⬇' : 'Sort: Oldest First ⬆';
          addMenuItem(sm, label, () => {
            ShoppingApp.toggleSortOrder();
          });
        }
      }
      // Uncheck all moved to Settings
      addMenuItem(sm, 'Uncheck All', ShoppingApp.uncheckAll || (()=>{}));
      // Delete action with type + name
      if (State.getCurrentList()) {
        const typeWord = (State.getCurrentList().type === 'journal') ? 'Journal' : 'List';
        const displayTitle = State.getCurrentList().title || State.getCurrentList().name;
        addMenuItem(sm, `Delete ${typeWord} "${displayTitle}"`, ShoppingApp.deleteCurrentList || (()=>{}));
      }
    });

    menu.appendChild(createSeparator());

    // Recent lists (API decides count) and All Lists… (exclude current list)
    const recent = (State.getAllLists() || []).filter(lst => !State.getCurrentList() || lst.name !== State.getCurrentList().name).slice(0, 10);
    recent.forEach(lst=>{
      const a = document.createElement('a');
      const prefix = lst.name === State.getCurrentList()?.name ? '• ' : '';
      a.textContent = prefix + lst.name;
      a.href = `?l=${encodeURIComponent(lst.name)}`;
      a.style.display = 'block';
      a.style.padding = '4px 12px';
      a.style.cursor = 'pointer';
      if (lst.name === State.getCurrentList()?.name) {
        a.style.fontWeight = 'bold';
      }
      // Let anchors navigate normally so the new list loads fresh
      a.onclick = () => hideMenus();
      menu.appendChild(a);
    });

    menu.appendChild(createSeparator());

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

  const Menu = {
    init(){
      if (!menu || !secMenu || !subMenu) createMenuElements();

      // attach the menu button handler
      ShoppingApp.menuButton.onclick = (e) => {
        e.stopPropagation();
        if (menu.style.display === 'none') showMainMenu(); else hideMenus();
      };

      document.addEventListener('click', onDocumentClick);
      document.addEventListener('keydown', onDocumentKey);
    },

    hideMenus,
    showSectionMenu,
    // convenience for other modules
    _internal: { buildMenuInternal, buildSectionMenuInternal }
  };

  window.Menu = Menu;
