// menu.js — extracted menu handling for shopping app
// Exposes a global Menu object with init(), setAllLists(), setCurrentList(), hideMenus(), showSectionMenu()

(function(window, document){
  const doc = document;
  let menu, secMenu;
  let allLists = [];
  let currentList = null;
  let options = null;

  function createMenuElements(){
    // Main Menu dropdown
    menu = document.createElement('div');
    menu.className = 'menu';
    menu.style.display = 'none';
    menu.style.position = 'absolute';
    menu.style.background = '#fff';
    menu.style.border = '1px solid #ccc';
    menu.style.padding = '4px 0';
    menu.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
    menu.style.zIndex = '1000';
    document.body.appendChild(menu);

    // Section menu
    secMenu = document.createElement('div');
    secMenu.className = 'menu';
    secMenu.style.display = 'none';
    secMenu.style.position = 'absolute';
    secMenu.style.background = currentList?.bgColor || '#fff';
    secMenu.style.color = (options && options.getContrastColor) ? options.getContrastColor(currentList?.bgColor || '#fff') : '#000';
    secMenu.style.border = '1px solid #ccc';
    secMenu.style.padding = '4px 0';
    secMenu.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
    secMenu.style.zIndex = '1000';
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
        options.callbacks.selectSection && options.callbacks.selectSection(section);
      });
    } else {
      addMenuItem(secMenu,"Collapse", () => {
        section.collapsed = true;
        options.callbacks.scheduleSave && options.callbacks.scheduleSave();
        options.callbacks.selectSection && options.callbacks.selectSection(section);
      });
    }

    addMenuItem(secMenu,"Uncheck All", () => {
      // delegate to app
      options.callbacks.uncheckAllSection && options.callbacks.uncheckAllSection(section);
      // fallback to global uncheckAll if provided
      if (!options.callbacks.uncheckAllSection && options.callbacks.uncheckAll) options.callbacks.uncheckAll();
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
        section.filter = f === 'none' ? '' : f; // none = ''
        options.callbacks.scheduleSave && options.callbacks.scheduleSave();
        options.callbacks.selectSection && options.callbacks.selectSection(section);
      };
      filterDiv.appendChild(btn);
    });
    secMenu.appendChild(filterDiv);

    // Color picker
    const colorDiv = document.createElement('div');
    colorDiv.style.padding = '4px 12px';
    const colorLabel = document.createElement('label');
    colorLabel.textContent = 'Color: ';
    const colorInput = document.createElement('input');
    const bg = section.bgColor || currentList?.bgColor || '#ffffff';
    colorInput.type = 'color';
    colorInput.value = bg;
    colorInput.oninput = () => {
      section.bgColor = colorInput.value;
      rebuildOpenMenus();
      options.callbacks.scheduleSave && options.callbacks.scheduleSave();
      options.callbacks.selectSection && options.callbacks.selectSection(section);
    };
    colorLabel.appendChild(colorInput);
    colorDiv.appendChild(colorLabel);
    secMenu.appendChild(colorDiv);

    secMenu.style.background = bg;
    secMenu.style.color = options.getContrastColor ? options.getContrastColor(bg) : '#000';
  }

  function buildMenuInternal(){
    menu.innerHTML='';
    const bg = currentList?.bgColor || '#ffffff';
    menu.style.background = bg;
    menu.style.color = options.getContrastColor ? options.getContrastColor(bg) : '#000';

    addMenuItem(menu, 'Index of Lists', options.callbacks.indexLink || (()=>{}));
    addMenuItem(menu, 'New List', options.callbacks.createNewList || (()=>{}));
    addMenuItem(menu, 'Delete List', options.callbacks.deleteCurrentList || (()=>{}));
    // separator
    const sep=document.createElement('div');
    sep.style.borderTop='1px solid #ccc';
    sep.style.margin='4px 0';
    menu.appendChild(sep);

    addMenuItem(menu, 'Uncheck All', options.callbacks.uncheckAll || (()=>{}));

    addMenuItem(menu, 'Expand All', options.callbacks.expandAll || (()=>{}));
    addMenuItem(menu, 'Collapse All', options.callbacks.collapseAll || (()=>{}));
    addMenuItem(menu, 'Clear All Filters', options.callbacks.clearAllFilters || (()=>{}));

    // Global filter
    const gfDiv = document.createElement('div');
    gfDiv.style.padding = '4px 12px';
    gfDiv.textContent = 'Show: ';
    ['checked','unchecked','none'].forEach(f=>{
      const btn=document.createElement('button');
      btn.type='button';
      btn.textContent=f[0].toUpperCase()+f.slice(1);
      btn.style.marginRight='4px';
      if((currentList && (currentList.filter||'all'))===f){
        btn.style.fontWeight='bold';
        btn.style.textDecoration='underline';
      }
      btn.onclick=()=>{
        if (!currentList) return;
        currentList.filter = f==='none' ? '' : f;
        options.callbacks.scheduleSave && options.callbacks.scheduleSave();
        options.callbacks.selectList && options.callbacks.selectList(currentList.name);
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
    colorInput.value = currentList?.bgColor || '#ffffff';
    colorInput.oninput = () => {
      const val = colorInput.value;
      if (options.callbacks.changeCurrentBg) options.callbacks.changeCurrentBg(val);
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
