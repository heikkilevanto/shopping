'use strict';

// add-item.js — Add item form UI module
// Provides a popup form for adding new items/sections to lists

const AddItemForm = (function() {
  // Module state
  let addItemForm = null;
  let addItemContext = null; // { targetArray, parentSection }
  let suppressNextAddItemDocClose = false;

  function defaultItemTypeForCurrentList() {
    const currentList = window.ShoppingApp ? ShoppingApp.getCurrentList() : null;
    return (currentList?.type === 'journal') ? 'text' : 'checkbox';
  }

  function hide() {
    if (!addItemForm) return;
    addItemForm.classList.add('hidden');
    addItemContext = null;
  }

  function ensureForm() {
    if (addItemForm) return addItemForm;
    
    addItemForm = document.createElement('div');
    addItemForm.className = 'add-item-form';
    addItemForm.onclick = e => e.stopPropagation();

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '6px';

    const label = document.createElement('label');
    label.textContent = 'Type:';
    row.appendChild(label);

    const select = document.createElement('select');
    // Options populated dynamically in show() based on current list type
    row.appendChild(select);
    addItemForm._typeSelect = select;

    // Date input row (shown only for Journal Entry)
    const dateRow = document.createElement('div');
    dateRow.className = 'add-item-date-row';
    const dateLabel = document.createElement('label');
    dateLabel.textContent = 'Date:';
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateLabel.appendChild(dateInput);
    dateRow.appendChild(dateLabel);
    addItemForm._dateRow = dateRow;
    addItemForm._dateInput = dateInput;

    const buttons = document.createElement('div');
    buttons.className = 'add-item-buttons';

    const topBtn = document.createElement('button');
    topBtn.type = 'button';
    topBtn.textContent = 'Add to top';
    buttons.appendChild(topBtn);

    const bottomBtn = document.createElement('button');
    bottomBtn.type = 'button';
    bottomBtn.textContent = 'Add to bottom';
    buttons.appendChild(bottomBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    buttons.appendChild(cancelBtn);

    // Single Add button (used for Journal Entry mode)
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.textContent = 'Add';
    addBtn.className = 'add-item-add-btn';
    addItemForm._addBtn = addBtn;
    buttons.appendChild(addBtn);

    addItemForm.appendChild(row);
    addItemForm.appendChild(dateRow);
    addItemForm.appendChild(buttons);
    document.body.appendChild(addItemForm);

    function todayStr() {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth()+1).padStart(2,'0');
      const da = String(d.getDate()).padStart(2,'0');
      return `${y}-${m}-${da}`;
    }

    function handleAdd(where) {
      if (!addItemContext || !Array.isArray(addItemContext.targetArray)) return;
      const t = addItemForm._typeSelect.value;
      const newItem = createItemByType(t);
      if (where === 'top') addItemContext.targetArray.unshift(newItem);
      else addItemContext.targetArray.push(newItem);

      const focusItem = (t === 'section') ? newItem.items[0] : newItem;
      if (window.ShoppingApp && ShoppingApp.setFocusItem) ShoppingApp.setFocusItem(focusItem);
      hide();
      if (window.ShoppingApp && ShoppingApp.render) ShoppingApp.render();
      if (window.ShoppingApp && ShoppingApp.scheduleSave) ShoppingApp.scheduleSave();
      if (window.ShoppingApp && ShoppingApp.hideAppMenus) ShoppingApp.hideAppMenus();
    }

    topBtn.onclick = () => handleAdd('top');
    bottomBtn.onclick = () => handleAdd('bottom');
    cancelBtn.onclick = hide;

    // Add handler for Journal Entry mode
    addBtn.onclick = () => {
      const val = addItemForm._typeSelect.value;
      if (val === 'journal-entry') {
        const dateStr = addItemForm._dateInput.value.trim();
        if (window.ShoppingApp && ShoppingApp.createJournalEntryForDate) {
          ShoppingApp.createJournalEntryForDate(dateStr);
        }
        hide();
        if (window.ShoppingApp && ShoppingApp.hideAppMenus) ShoppingApp.hideAppMenus();
      }
    };

    // Toggle button visibility based on selected type
    function updateButtonsMode() {
      const val = addItemForm._typeSelect.value;
      const isJournal = (val === 'journal-entry');
      addItemForm._dateRow.classList.toggle('show', isJournal);
      topBtn.style.display = isJournal ? 'none' : '';
      bottomBtn.style.display = isJournal ? 'none' : '';
      addBtn.classList.toggle('show', isJournal);
      if (isJournal && !addItemForm._dateInput.value) {
        addItemForm._dateInput.value = todayStr();
      }
    }
    select.onchange = updateButtonsMode;

    document.addEventListener('click', (e) => {
      if (suppressNextAddItemDocClose) { suppressNextAddItemDocClose = false; return; }
      if (addItemForm && !addItemForm.classList.contains('hidden') && !addItemForm.contains(e.target)) hide();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && addItemForm && !addItemForm.classList.contains('hidden')) hide();
    });

    return addItemForm;
  }

  function show(targetArray, { parentSection = null, anchor = null, defaultType = null } = {}) {
    const currentList = ShoppingApp.getCurrentList ? ShoppingApp.getCurrentList() : null;
    if (!currentList || !Array.isArray(targetArray)) return;
    
    const form = ensureForm();
    addItemContext = { targetArray, parentSection };
    suppressNextAddItemDocClose = true; // ignore the originating click (menu item)
    
    const bg = ShoppingApp.getEffectiveBgColor ? ShoppingApp.getEffectiveBgColor(parentSection) : '#ffffff';
    form.style.backgroundColor = bg;
    form.style.color = getContrastColor(bg);
    
    // Populate type options depending on current list
    const isJournal = (currentList?.type === 'journal');
    const sel = form._typeSelect;
    sel.innerHTML = '';
    const opts = [
      { v: 'checkbox', t: 'Checkbox' },
      { v: 'text', t: 'Text line' },
      { v: 'section', t: 'Section' }
    ];
    if (isJournal) opts.push({ v: 'journal-entry', t: 'Journal Entry' });
    for (const o of opts) {
      const opt = document.createElement('option');
      opt.value = o.v; opt.textContent = o.t;
      sel.appendChild(opt);
    }
    sel.value = defaultType || defaultItemTypeForCurrentList();
    
    // Reset date input if switching contexts
    form._dateInput.value = '';
    
    // Apply button visibility mode
    const updateEvt = new Event('change'); 
    sel.dispatchEvent(updateEvt);
    form.classList.remove('hidden');

    const anchorRect = anchor ? anchor.getBoundingClientRect() : null;
    const x = anchorRect ? anchorRect.left : 20;
    const y = anchorRect ? anchorRect.bottom + window.scrollY + 6 : (window.scrollY + 20);
    form.style.left = `${x}px`;
    form.style.top = `${y}px`;
    form._typeSelect.focus();
  }

  // Public API
  return {
    init: function() {
      // No initialization needed - uses global ShoppingApp
    },
    show: show,
    hide: hide
  };
})();

// Attach to global window
if (typeof window !== 'undefined') {
  window.AddItemForm = AddItemForm;
}
