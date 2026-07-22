// menu.js — extracted menu handling for shopping app
// Exposes a global Menu object with init(), setAllLists(), setCurrentList(), hideMenus(), showSectionMenu()

'use strict';

// Module state
let menu, secMenu, subMenu, subSubMenu;
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

    // Third-level submenu (for nested items like Sort within Settings)
    subSubMenu = createStyledMenu();
    applyMenuColors(subSubMenu, bg);
    document.body.appendChild(subSubMenu);
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

    // Sort Section submenu
    secMenu.appendChild(createSeparator());
    addTrigger(secMenu, 'Sort Section', (subMenu) => {
      const currentList = State.getCurrentList();
      if (currentList && currentList.type === 'journal') {
        addMenuItem(subMenu, 'Date', () => {
          ShoppingApp.sortSection(section);
        });
      }
      addMenuItem(subMenu, 'Alphabetic', () => {
        ShoppingApp.sortSectionItems(section, 'alphabetic');
      });
      addMenuItem(subMenu, 'Checked First', () => {
        ShoppingApp.sortSectionItems(section, 'checked-first');
      });
      addMenuItem(subMenu, 'Unchecked First', () => {
        ShoppingApp.sortSectionItems(section, 'unchecked-first');
      });
      addMenuItem(subMenu, 'Subsections First', () => {
        ShoppingApp.sortSectionItems(section, 'subsections-first');
      });
      addMenuItem(subMenu, 'Items First', () => {
        ShoppingApp.sortSectionItems(section, 'items-first');
      });
      subMenu.appendChild(createSeparator());
      addMenuItem(subMenu, 'Reverse Order', () => {
        ShoppingApp.reverseOrder(section);
      });
    });

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

  // OLD buildMenuInternal removed - see the newer version below

  function hideMenus(){
    if (menu) menu.style.display = 'none';
    if (window.ShoppingApp && ShoppingApp.menuButton) ShoppingApp.menuButton.setAttribute('aria-expanded','false');
    if (secMenu) secMenu.style.display = 'none';
    if (subMenu) subMenu.style.display = 'none';
    if (subSubMenu) subSubMenu.style.display = 'none';
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
    if (subSubMenu && subSubMenu.style.display === 'block') {
      subSubMenu.style.display = 'none';
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
    const clickedOutsideSubSub = subSubMenu && !subSubMenu.contains(e.target);
    if (clickedOutsideMain && clickedOutsideSec && clickedOutsideSub && clickedOutsideSubSub) hideMenus();
  }
  function onDocumentKey(e){ if (e.key === 'Escape') hideMenus(); }

  // Helper: add a trigger item that opens a submenu anchored to this item
  function addTrigger(menuEl, text, buildFn){
    console.log('[addTrigger] Creating trigger for:', text);
    const div = document.createElement('div');
    div.textContent = text;
    div.style.padding = '4px 12px';
    div.style.cursor = 'pointer';
    div.onmouseover = () => div.style.background = '#eee';
    div.onmouseout = () => div.style.background = '';
    div.onclick = () => {
      console.log('[addTrigger] Clicked:', text);
      showSubmenuAt(div, buildFn);
    };
    menuEl.appendChild(div);
    return div;
  }

  // Helper: add a nested trigger (for third-level menus) that uses subSubMenu
  function addNestedTrigger(menuEl, text, buildFn){
    console.log('[addNestedTrigger] Creating nested trigger for:', text);
    const div = document.createElement('div');
    div.textContent = text;
    div.style.padding = '4px 12px';
    div.style.cursor = 'pointer';
    div.onmouseover = () => div.style.background = '#eee';
    div.onmouseout = () => div.style.background = '';
    div.onclick = () => {
      console.log('[addNestedTrigger] Clicked:', text);
      showNestedSubmenuAt(div, buildFn);
    };
    menuEl.appendChild(div);
    return div;
  }

  // Show generic submenu at anchor element and build its content via buildFn(subMenu)
  function showSubmenuAt(anchor, buildFn){
    console.log('[showSubmenuAt] Called');
    if (!subMenu) {
      console.error('[showSubmenuAt] subMenu is null!');
      return;
    }
    subMenu.innerHTML = '';
    const bg = State.getCurrentList()?.bgColor || '#ffffff';
    applyMenuColors(subMenu, bg);
    console.log('[showSubmenuAt] Calling buildFn');
    buildFn(subMenu);
    console.log('[showSubmenuAt] buildFn complete, positioning submenu');
    const rect = anchor.getBoundingClientRect();
    subMenu.style.left = rect.left + 'px';
    subMenu.style.top = (rect.bottom + window.scrollY + 4) + 'px';
    subMenu.style.zIndex = '1001';
    subMenu.style.display = 'block';
    // Adjust position if off-screen
    const subMenuRect = subMenu.getBoundingClientRect();
    if (subMenuRect.bottom > window.innerHeight) {
      subMenu.style.top = (rect.top + window.scrollY - subMenuRect.height - 4) + 'px';
    }
    if (subMenuRect.right > window.innerWidth) {
      subMenu.style.left = (window.innerWidth - subMenuRect.width - 4) + 'px';
    }
  }

  // Show nested submenu (third level) at anchor element
  function showNestedSubmenuAt(anchor, buildFn){
    console.log('[showNestedSubmenuAt] Called');
    if (!subSubMenu) {
      console.error('[showNestedSubmenuAt] subSubMenu is null!');
      return;
    }
    subSubMenu.innerHTML = '';
    const bg = State.getCurrentList()?.bgColor || '#ffffff';
    applyMenuColors(subSubMenu, bg);
    console.log('[showNestedSubmenuAt] Calling buildFn');
    buildFn(subSubMenu);
    console.log('[showNestedSubmenuAt] buildFn complete, positioning submenu');
    const rect = anchor.getBoundingClientRect();
    subSubMenu.style.left = (rect.right + 4) + 'px';
    subSubMenu.style.top = rect.top + window.scrollY + 'px';
    subSubMenu.style.zIndex = '1002';
    subSubMenu.style.display = 'block';
    // Adjust position if off-screen
    const subSubMenuRect = subSubMenu.getBoundingClientRect();
    if (subSubMenuRect.bottom > window.innerHeight) {
      subSubMenu.style.top = (window.innerHeight - subSubMenuRect.height - 4 + window.scrollY) + 'px';
    }
    if (subSubMenuRect.right > window.innerWidth) {
      subSubMenu.style.left = (rect.left - subSubMenuRect.width - 4) + 'px';
    }
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
      // Bubbling toggle
      const isBubbling = State.getCurrentList()?.bubbling;
      addMenuItem(sm, 'Bubbling: ' + (isBubbling ? 'On' : 'Off'), () => {
        if (ShoppingApp.toggleBubbling) ShoppingApp.toggleBubbling();
      });
      // Toggle journal mode
      addMenuItem(sm, 'Toggle Journal Mode', () => {
        if (window.ShoppingApp && typeof ShoppingApp.toggleListType === 'function') {
          ShoppingApp.toggleListType();
        }
      });
      // Sort submenu
      if (State.getCurrentList()) {
        sm.appendChild(createSeparator());
        addNestedTrigger(sm, 'Sort', (sortSubMenu) => {
          const currentList = State.getCurrentList();
          
          // Journal-specific resort option
          if (currentList.type === 'journal') {
            addMenuItem(sortSubMenu, 'Resort Journal', () => {
              ShoppingApp.resortJournal();
            });
            sortSubMenu.appendChild(createSeparator());
          }
          
          addMenuItem(sortSubMenu, 'Alphabetic', () => {
            ShoppingApp.sortAllSections(currentList, 'alphabetic');
          });
          addMenuItem(sortSubMenu, 'Checked First', () => {
            ShoppingApp.sortAllSections(currentList, 'checked-first');
          });
          addMenuItem(sortSubMenu, 'Unchecked First', () => {
            ShoppingApp.sortAllSections(currentList, 'unchecked-first');
          });
          addMenuItem(sortSubMenu, 'Subsections First', () => {
            ShoppingApp.sortAllSections(currentList, 'subsections-first');
          });
          addMenuItem(sortSubMenu, 'Items First', () => {
            ShoppingApp.sortAllSections(currentList, 'items-first');
          });
          sortSubMenu.appendChild(createSeparator());
          addMenuItem(sortSubMenu, 'Reverse Order', () => {
            ShoppingApp.reverseAllSections(currentList);
          });
        });
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
