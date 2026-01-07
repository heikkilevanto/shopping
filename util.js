// util.js - Utility functions for the shopping app
// Simple module that adds functions to global namespace

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

function createItemByType(t){
  if (t === 'section') {
    return {
      type: 'section',
      title: '',
      collapsed: false,
      items: [{ type: 'item', text: '', checked: false }],
      filter: ''
    };
  }
  if (t === 'text') return { type: 'text', text: '' };
  return { type: 'item', text: '', checked: false };
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

// Recursively count non-empty item/text lines inside a section
function countNonEmptyItems(section) {
  if (!section || !Array.isArray(section.items)) return 0;
  let count = 0;
  for (const it of section.items) {
    if (!it) continue;
    if (it.type === 'item' || it.type === 'text') {
      if (typeof it.text === 'string' && it.text.trim() !== '') count++;
    } else if (it.type === 'section') {
      count += countNonEmptyItems(it);
    }
  }
  return count;
}

// Find the parent array and index of a target section by walking tree rooted at items.
// Returns { parentArray, index } or null if not found.
function findParentArrayAndIndex(items, target) {
  if (!Array.isArray(items)) return null;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it === target) return { parentArray: items, index: i };
    if (it && it.type === 'section') {
      const found = findParentArrayAndIndex(it.items, target);
      if (found) return found;
    }
  }
  return null;
}

// Generate and set a favicon from list name and background color
function setListFavicon(name, bgColor) {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  // background
  const r = 16; // corner radius
  ctx.fillStyle = bgColor || '#ffffff';
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fill();

  // letter
 // extract up to 3 letters
  const letters = name
    .replace(/[^A-Z]/g, '')
    .slice(0, 3) || '?';

  // text
  ctx.fillStyle = getContrastColor(bgColor || '#ffffff');
  ctx.font = `bold ${letters.length === 1 ? 40 : 28}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letters, size / 2, size / 2 + 2);

  // set favicon
  let link = document.querySelector("link[rel='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = canvas.toDataURL('image/png');
}
