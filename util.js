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
