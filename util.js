// util.js - Utility functions for the shopping app
// Provides window.Util namespace with helper functions

"use strict";

window.Util = {
  getContrastColor(hex) {
    // remove leading #
    if (hex.startsWith('#')) hex = hex.slice(1);
    const r = parseInt(hex.substr(0,2),16);
    const g = parseInt(hex.substr(2,2),16);
    const b = parseInt(hex.substr(4,2),16);
    // relative luminance formula
    const lum = 0.299*r + 0.587*g + 0.114*b;
    return lum > 186 ? '#000000' : '#ffffff'; // light bg → black, dark bg → white
  },

  createItemByType(t) {
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
  },

  // Helper: Find parent section of a target section by walking the tree
  findParentSection(items, target, parent = null) {
    if (!Array.isArray(items)) return null;
    for (const item of items) {
      if (item === target) return parent;
      if (item && item.type === 'section') {
        const found = this.findParentSection(item.items, target, item);
        if (found !== null) return found;
      }
    }
    return null;
  },

  // Recursively count non-empty item/text lines inside a section
  countNonEmptyItems(section) {
    if (!section || !Array.isArray(section.items)) return 0;
    let count = 0;
    for (const it of section.items) {
      if (!it) continue;
      if (it.type === 'item' || it.type === 'text') {
        if (typeof it.text === 'string' && it.text.trim() !== '') count++;
      } else if (it.type === 'section') {
        count += this.countNonEmptyItems(it);
      }
    }
    return count;
  },

  // Find the parent array and index of a target section by walking tree rooted at items.
  // Returns { parentArray, index } or null if not found.
  findParentArrayAndIndex(items, target) {
    if (!Array.isArray(items)) return null;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it === target) return { parentArray: items, index: i };
      if (it && it.type === 'section') {
        const found = this.findParentArrayAndIndex(it.items, target);
        if (found) return found;
      }
    }
    return null;
  },

  // Generate and set a favicon from list name and background color
  setListFavicon(name, bgColor) {
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
    ctx.fillStyle = this.getContrastColor(bgColor || '#ffffff');
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
  },

  // Get the effective background color for a section (walks up parent chain)
  getEffectiveBgColor(section) {
    const currentList = State.getCurrentList();
    if (!currentList) return '#ffffff';
    if (!section) return currentList.bgColor || '#ffffff';
    if (section.bgColor) return section.bgColor;
    
    // Walk up to find a parent with a color
    let parent = Util.findParentSection(currentList.items, section);
    while (parent) {
      if (parent.bgColor) return parent.bgColor;
      parent = Util.findParentSection(currentList.items, parent);
    }
    
    // Fall back to list color
    return currentList.bgColor || '#ffffff';
  },

  // Helper to recurse through sections and do something for each section and/or item
  // Finally render and schedule a save, if requested
  traverseSections(items, secFn = null, itFn = null, doRender = true) {
    items.forEach(item => {
      if (item.type === 'section') {
        if (secFn) secFn(item);
        this.traverseSections(item.items, secFn, itFn, false); // recurse without rendering
      } else if (item.type === 'item') {
        if (itFn) itFn(item);
      }
    });
    if (doRender) {
      // Delegate to ShoppingApp for render and scheduleSave
      ShoppingApp.render();
      ShoppingApp.scheduleSave();
    }
  },

  // Resolve the effective filter for a section by walking up the parent chain
  resolveFilter(section, parentSections) {
    const currentList = State.getCurrentList();
    let sec = section;
    let filter = sec?.filter || '';
    let parents = parentSections || [];
    let idx = parents.indexOf(sec);
    while (filter === '' && idx > -1) {
      // move up to parent section if exists
      sec = parents[idx]._parentSection;
      if (!sec) break;
      filter = sec.filter || '';
      parents = sec._parentSections || [];
      idx = parents.indexOf(sec);
    }
    return filter || currentList?.filter || 'all';
  },

  // Focus an editable element and select all its contents
  focusEditable(el) {
    el.focus();
    const sel = window.getSelection();
    sel.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.addRange(range);
  }
};
