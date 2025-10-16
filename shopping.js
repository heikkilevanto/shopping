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
listStatus.style.color = '#c00';  // red for modified
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

function scheduleSave() {
  if(!currentList) return;
  clearTimeout(saveTimeout);
  isModified = true;
  updateStatus();
  saveTimeout = setTimeout(() => {
    isSaving = true;
    updateStatus();
    fetch(`/shopping/api.cgi/${currentList.name}`, {
      method: 'POST',
      body: JSON.stringify(currentList,null,2)+'\n',
      headers: {'Content-Type':'application/json'}
    })
    .then(() => {
      isSaving = false;
      isModified = false;
      updateStatus();
    })
    .catch(console.error);
  },2000);
}

function hideMenu() {
  menu.style.display = 'none';
  menuButton.setAttribute('aria-expanded','false');
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

// ================= Menu actions =================
function createNewList() {
  const name = prompt('Enter new list name:');
  if(!name) return;
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
  if(!currentList) return;
  if(!confirm(`Delete list "${currentList.name}"?`)) return;
  fetch(`/shopping/api.cgi/${currentList.name}`,{method:'DELETE'}).catch(console.error);
  allLists = allLists.filter(l=>l.name!==currentList.name);
  currentList = null;
  render();
}

// Build menu items dynamically
function buildMenu() {
  menu.innerHTML='';
  const bg = currentList?.bgColor || '#ffffff';
  menu.style.background = bg;
  menu.style.color = getContrastColor(bg);

  // New
  const newItem=document.createElement('div');
  newItem.textContent='New List';
  newItem.style.padding='4px 12px';
  newItem.style.cursor='pointer';
  newItem.onclick=()=>{ hideMenu(); createNewList(); };
  menu.appendChild(newItem);

  // Delete
  const delItem=document.createElement('div');
  delItem.textContent='Delete List';
  delItem.style.padding='4px 12px';
  delItem.style.cursor='pointer';
  delItem.onclick=()=>{ hideMenu(); deleteCurrentList(); };
  menu.appendChild(delItem);

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
    if (!currentList) return;
    currentList.bgColor = colorInput.value;
    document.body.style.backgroundColor = currentList.bgColor || '#ffffff' ;
    document.body.style.color = getContrastColor(currentList.bgColor || '#ffffff');
    scheduleSave();
    hideMenu();
  };
  colorLabel.appendChild(colorInput);
  colorItem.appendChild(colorLabel);
  menu.appendChild(colorItem);

  // separator
  const sep=document.createElement('div');
  sep.style.borderTop='1px solid #ccc';
  sep.style.margin='4px 0';
  menu.appendChild(sep);

  // list entries
  allLists.forEach(lst=>{
    const li=document.createElement('div');
    li.textContent=lst.name;
    li.style.padding='4px 12px';
    li.style.cursor='pointer';
    li.onclick=()=>{ hideMenu(); selectList(lst.name); };
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
  } else hideMenu();
};
document.addEventListener('click',e=>{ if(!menu.contains(e.target)&&e.target!==menuButton) hideMenu(); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape') hideMenu(); });

// ================= List selection =================
function selectList(name,data){
  document.title=name;
  listName.textContent=name;
  if(data){ currentList=data; render(); }
  else fetch(`/shopping/api.cgi/${name}`).then(r=>r.json()).then(d=>{ currentList=d; render(); });
}

// ================= Render =================
function focusEditable(el){
  el.focus();
  const sel=window.getSelection();
  sel.removeAllRanges();
  const range=document.createRange();
  range.selectNodeContents(el);
  sel.addRange(range);
}

// Render item
function renderItem(container,item,parentItems){
  const line=document.createElement('div');
  line.className='line';
  if(item.type==='item'){
    const cb=document.createElement('input');
    cb.type='checkbox';
    cb.checked=item.checked;
    cb.onchange=()=>{ item.checked=cb.checked; scheduleSave(); };
    line.appendChild(cb);
  }
  const span=document.createElement('span');
  span.className='line-text';
  span.textContent=item.text;
  span.contentEditable=true;
  span._item=item;

  span.onkeydown=e=>{
    if(e.key==='Enter'){
      e.preventDefault();
      let text=span.textContent.trim();
      if(text===''){ span.blur(); return; }
      if(text.startsWith('o ')){ item.type='item'; item.checked=false; text=text.slice(2).trim(); }
      else if(text.startsWith('x ')){ item.type='item'; item.checked=true; text=text.slice(2).trim(); }
      else if(text.startsWith('.')) item.type='text';
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
  container.appendChild(line);
}

// Render section
function renderSection(container,section,parentSections){
  const sec=document.createElement('div');
  sec.className='section';
  const header=document.createElement('div');
  header.className='section-header';
  const toggle=document.createElement('span');
  toggle.textContent=section.collapsed?'[+]':'[-]';
  toggle.onclick=()=>{ section.collapsed=!section.collapsed; render(); scheduleSave(); };
  header.appendChild(toggle);
  const title=document.createElement('span');
  title.className='title';
  title.textContent=section.title;
  title.contentEditable=true;
  title._section=section;
  title.onkeydown=e=>{
    if(e.key!=='Enter') return;
    e.preventDefault();
    const t=title.textContent.trim();
    section.title=t;
    scheduleSave();
    const idx=parentSections.indexOf(section);
    if(idx===parentSections.length-1 && t!==''){
      parentSections.push({type:'section',title:'',collapsed:false,items:[{type:'item',text:'',checked:false}]});
    }
    if(section.items.length) focusItem=section.items[0];
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
  renderItems(body,section.items,section.items);
  if(section.title.trim()==='' && focusItem===null) focusItem=section;
}

// Render items recursively
function renderItems(container,items,parentItems){
  container.innerHTML='';
  items.forEach(item=>{
    if(item.type==='section') renderSection(container,item,parentItems);
    else renderItem(container,item,parentItems);
  });
}

// Main render
function render(){
  document.body.style.backgroundColor = currentList.bgColor || '#ffffff';
  document.body.style.color = getContrastColor(currentList.bgColor || '#ffffff');
  if(!currentList){
    listName.textContent='No List Selected';
    container.innerHTML='';
    return;
  }
  renderItems(container,currentList.items,currentList.items);

  if(focusItem){
    const lines=container.querySelectorAll('.line-text');
    const titles=container.querySelectorAll('.section-header .title');
    let focused=false;
    for(const l of lines){ if(l._item===focusItem){ focusEditable(l); focused=true; break; } }
    if(!focused) for(const t of titles){ if(t._section===focusItem){ focusEditable(t); break; } }
    focusItem=null;
  }
}

// ================= Init =================
fetch('/shopping/api.cgi/')
  .then(r=>r.json())
  .then(data=>{
    allLists = data.map(name=>({name}));
    if(allLists.length) selectList(allLists[0].name);
  })
  .catch(err=>console.log('Using default list:',err));
