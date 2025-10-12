let allLists = [];  // list of {name, items}
let currentList = null;
let saveTimeout;

const listSelect = document.getElementById('list-select');
const container = document.getElementById('list-container');
const listName = document.getElementById('list-name');
let focusItem = null;  // global variable to track the item to focus

// ------------------ Utility -------------------
function scheduleSave() {
  if(!currentList) return;
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    fetch(`/shopping/api.cgi/${currentList.name}`, {
      method: 'POST',
      body: JSON.stringify(currentList,null,2) + "\n",
      headers: {'Content-Type': 'application/json'}
    }).catch(console.error);
  }, 2000);
}


function renderItems(container, items, parentItems) {
  container.innerHTML = '';
  items.forEach(item => {
    if (item.type === 'section') {
      renderSection(container, item, parentItems);
    } else {
      renderItem(container, item, parentItems);
    }
  });
}

function renderSection(container, section, parentSections) {
  const sec = document.createElement('div');
  sec.className = 'section';

  const header = document.createElement('div');
  header.className = 'section-header';

  const toggle = document.createElement('span');
  toggle.textContent = section.collapsed ? '[+]' : '[-]';
  toggle.onclick = () => {
    section.collapsed = !section.collapsed;
    render();
    scheduleSave();
  };
  header.appendChild(toggle);

  const title = document.createElement('span');
  title.className = 'title';
  title.textContent = section.title;
  title.contentEditable = true;
  title._section = section;

 title.onkeydown = e => {
  if (e.key !== 'Enter') return;

  e.preventDefault();
  const t = title.textContent.trim();
  section.title = t;
  scheduleSave();

  const idx = parentSections.indexOf(section);

  // append new extra section if last and now has text
  if (idx === parentSections.length - 1 && t !== '') {
    parentSections.push({
      type: 'section',
      title: '',
      collapsed: false,
      items: [{ type: 'item', text: '', checked: false }]
    });
  }

  // focus first item in this section
  if (section.items.length) focusItem = section.items[0];

  render();
};

  header.appendChild(title);
  sec.appendChild(header);

  const body = document.createElement('div');
  body.style.display = section.collapsed ? 'none' : 'block';
  sec.appendChild(body);

  container.appendChild(sec);
  renderItems(body, section.items, section.items);

  // Focus empty extra section's title if no other focus target
  if (section.title.trim() === '' && focusItem === null) {
    focusItem = section;
  }
}

function renderItem(container, item, parentItems) {
  const line = document.createElement('div');
  line.className = 'line';

  if (item.type === 'item') {
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = item.checked;
    cb.onchange = () => { item.checked = cb.checked; scheduleSave(); };
    line.appendChild(cb);
  }

  const span = document.createElement('span');
  span.className = 'line-text';
  span.textContent = item.text;
  span.contentEditable = true;
  span._item = item;

  span.onkeydown = e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      let text = span.textContent.trim();

      if (text === '') {
        span.blur();
        return;
      }
      // convert type based on prefix
      if (text.startsWith('o ')) {
        item.type = 'item';
        item.checked = false;
        text = text.slice(2).trim();
      } else if (text.startsWith('x ')) {
        item.type = 'item';
        item.checked = true;
        text = text.slice(2).trim();
      } else if (text.startsWith('.')) {
        item.type = 'text';
      }
      item.text = text;
      const newItem = { type: item.type, text: "", checked: false };
      const idx = parentItems.indexOf(item);
      parentItems.splice(idx + 1, 0, newItem);

      focusItem = newItem;
      render();
      scheduleSave();
    }
  };

  span.onblur = () => {
    const currentText = span.textContent.trim();
    if (currentText === '' && parentItems.length > 1) {
      const idx = parentItems.indexOf(item);
      if (idx >= 0) parentItems.splice(idx, 1);
      focusItem = parentItems[Math.min(idx, parentItems.length - 1)] || null;
      render();
      scheduleSave();
      return;
    }
    item.text = currentText;
    scheduleSave();
  };

  line.appendChild(span);
  container.appendChild(line);
}

function render() {
  if (!currentList) {
    listName.textContent = 'No List Selected';
    container.innerHTML = '';
    return;
  }

  listName.textContent = currentList.name;
  renderItems(container, currentList.items, currentList.items);

  // Focus tracking
  if (focusItem) {
    const lines = container.querySelectorAll('.line-text');
    const titles = container.querySelectorAll('.section-header .title');
    let focused = false;

    for (const l of lines) {
      if (l._item === focusItem) {
        focusEditable(l);
        focused = true;
        break;
      }
    }

    if (!focused) {
      for (const t of titles) {
        if (t._section === focusItem) {
          focusEditable(t);
          break;
        }
      }
    }

    focusItem = null;
  }
}

function focusEditable(el) {
  el.focus();
  const sel = window.getSelection();
  sel.removeAllRanges();
  const range = document.createRange();
  range.selectNodeContents(el);
  sel.addRange(range);
}



// ------------------ Top Menu -------------------
function loadLists() {
  fetch('/shopping/api.cgi/')
    .then(r => r.json())
    .then(data => {
      allLists = data.map(name => ({ name }));
      listSelect.innerHTML = '';
      data.forEach(fname => {
        const name = fname.replace(/\.json$/, '');    // strip .json
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        listSelect.appendChild(option);
      });
      if(allLists.length) selectList(allLists[0].name);
    })
    .catch( err => {
      console.log('Using default list: ', err);
    });
}

function updateListSelect() {
  listSelect.innerHTML = '';
  allLists.forEach(lst => {
    const opt = document.createElement('option');
    opt.value = lst.name;
    opt.textContent = lst.name;
    listSelect.appendChild(opt);
  });
}


function selectList(name, data) {
  if (data) {
    currentList = data;
    render();
  } else {
    fetch(`/shopping/api.cgi/${name}`)
      .then(r => r.json())
      .then(d => { currentList = d; render(); });
  }
}

// ------------------ Event Handlers -------------------
listSelect.onchange = () => selectList(listSelect.value);

document.getElementById('new-list').onclick = () => {
  const name = prompt('Enter new list name:');
  if(!name) return;
  const newList = {
    name: name,
    items: [
      {
        type: "section",
        title: name,
        collapsed: false,
        items: [
          { type: "item", text: "", checked: false }
        ]
      }
    ]};
  allLists.push(name);
  updateListSelect();
  selectList(name, newList);
  scheduleSave();
};

document.getElementById('delete-list').onclick = () => {
  if(!currentList) return;
  if(!confirm(`Delete list "${currentList.name}"?`)) return;
  fetch(`/shopping/api.cgi/${currentList.name}`, {method:'DELETE'}).catch(console.error);
  allLists = allLists.filter(l => l !== currentList);
  currentList = null;
  updateListSelect();
  render();
};

// ------------------ Init -------------------
loadLists();
