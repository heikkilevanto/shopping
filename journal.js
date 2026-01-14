'use strict';

// journal.js — helpers for journal-style lists (flat module)
// Exposes global JournalHelper with functions to format prefixes and
// ensure month/day sections exist (using ISO-like prefixes in titles).
// A legacy helper can flatten old year → month → day hierarchies into the
// new month → day layout.
//
// Matching uses title.startsWith(prefix) so the user may append arbitrary
// human text after the numeric prefix, e.g. "2025-12-24 Xmas Eve".
// No hidden metadata is used.

// ================= Helper Functions =================

function pad(n) { return n < 10 ? '0' + n : String(n); }

function monthName(date, locale) {
  // If locale is undefined, browser default locale is used
  return date.toLocaleString(locale, { month: 'long' });
}
function weekdayShort(date, locale) {
  return date.toLocaleString(locale, { weekday: 'short' });
}

// Given a Date, return canonical prefixes and suggested titles
function formatPrefixes(date, opts) {
    opts = opts || {};
    const locale = opts.locale || undefined; // undefined lets browser use default
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const yearPrefix = `${y}`;                 // "2026"
    const monthPrefix = `${y}-${m}`;           // "2026-01"
    const dayPrefix = `${y}-${m}-${d}`;        // "2026-01-03"

    const monthDisplay = monthName(date, locale); // "January"
    const weekday = weekdayShort(date, locale);   // "Sat"

    const monthTitle = `${monthPrefix} ${monthDisplay}`; // "2026-01 January"
    const dayTitle   = `${dayPrefix} ${weekday}`;        // "2026-01-03 Sat"

    return {
      yearPrefix, monthPrefix, dayPrefix,
      monthTitle, dayTitle,
      monthDisplay, weekday
    };
  }

  // Find first section in parentItems whose title startsWith(prefix)
  function findSectionStartingWith(parentItems, prefix) {
    if (!Array.isArray(parentItems)) return null;
    for (const s of parentItems) {
      if (s && s.type === 'section' && typeof s.title === 'string' && s.title.indexOf(prefix) === 0) return s;
    }
    return null;
  }

  // Extract prefix from a title using prefixLen (4,7,10). Returns the matched prefix or null.
  function extractPrefix(title, prefixLen) {
    if (typeof title !== 'string') return null;
    if (prefixLen === 4) {
      const m = title.match(/^(\d{4})/); return m ? m[1] : null;
    } else if (prefixLen === 7) {
      const m = title.match(/^(\d{4}-\d{2})/); return m ? m[1] : null;
    } else if (prefixLen === 10) {
      const m = title.match(/^(\d{4}-\d{2}-\d{2})/); return m ? m[1] : null;
    }
    return null;
  }

  // Insert newSection into parentItems among the section entries so that sections are
  // ordered by their numeric prefix (prefixLen) according to sortOrder. Non-section items are left in place.
  // Return inserted index.
  function insertSectionByPrefix(parentItems, newSection, prefixLen, newPrefix, sortOrder) {
    sortOrder = sortOrder || 'newest-first';
    if (!Array.isArray(parentItems)) {
      parentItems.push(newSection);
      return parentItems.length - 1;
    }
    for (let i = 0; i < parentItems.length; i++) {
      const it = parentItems[i];
      if (it && it.type === 'section') {
        const itPrefix = extractPrefix(it.title, prefixLen);
        if (itPrefix) {
          // For newest-first: insert before older sections (itPrefix < newPrefix)
          // For oldest-first: insert before newer sections (itPrefix > newPrefix)
          if ((sortOrder === 'newest-first' && itPrefix < newPrefix) ||
              (sortOrder === 'oldest-first' && itPrefix > newPrefix)) {
            parentItems.splice(i, 0, newSection);
            return i;
          }
        }
      }
    }
    // No insertion point found — would append at end
    // Scan backwards to find the last journal section and insert after it
    for (let i = parentItems.length - 1; i >= 0; i--) {
      const it = parentItems[i];
      if (it && it.type === 'section') {
        const itPrefix = extractPrefix(it.title, prefixLen);
        if (itPrefix) {
          // Found a journal section - insert after it
          parentItems.splice(i + 1, 0, newSection);
          return i + 1;
        }
      }
    }
    // No journal sections found at all - append at end
    parentItems.push(newSection);
    return parentItems.length - 1;
  }

  // Create a new section object with given title and optional children (items)
  function createSection(title, children) {
    return {
      type: 'section',
      title: title || '',
      collapsed: false,
      items: children || []
    };
  }

  // Ensure month/day sections exist for a date inside list (list.items).
  // Inserts sections in chronological positions according to sortOrder among sibling sections.
  // Ensures day section has at least one item; created day item is appended to the day.
  // Returns an object describing what was found/created and references to created structures.
  //
  // Usage:
  //   const sortOrder = list.sortOrder || 'newest-first';
  //   const res = JournalHelper.ensureJournalPathForDate(list, new Date(), { sortOrder });
  //   if (res.createdDay && res.createdItem) { focusItem = res.createdItem; scheduleSave(); render(); }
  function ensureJournalPathForDate(list, date, opts) {
    opts = opts || {};
    if (!list || !Array.isArray(list.items)) {
      return { created: false };
    }

    const sortOrder = opts.sortOrder || list.sortOrder || 'newest-first';
    const p = formatPrefixes(date, opts);
    let createdMonth = false, createdDay = false, createdItem = null;

    // Find or create month directly under the list (prefixLen = 7)
    let monthSection = findSectionStartingWith(list.items, p.monthPrefix);
    if (!monthSection) {
      monthSection = createSection(p.monthTitle, []);
      insertSectionByPrefix(list.items, monthSection, 7, p.monthPrefix, sortOrder);
      createdMonth = true;
    }

    // Find or create day in monthSection.items (prefixLen = 10)
    let daySection = findSectionStartingWith(monthSection.items, p.dayPrefix);
    if (!daySection) {
      // day items should be text entries initially; create one empty text item appended to the day
      const emptyDayItem = { type: 'text', text: '' };
      daySection = createSection(p.dayTitle, [ emptyDayItem ]);
      insertSectionByPrefix(monthSection.items, daySection, 10, p.dayPrefix, sortOrder);
      createdDay = true;
      createdItem = emptyDayItem;
    } else {
      // Make sure the day section has at least one item; if none, add a blank text item at the end (append)
      if (!Array.isArray(daySection.items) || daySection.items.length === 0) {
        const emptyDayItem = { type: 'text', text: '' };
        daySection.items.push(emptyDayItem);
        createdItem = emptyDayItem;
      }
    }

    return {
      created: createdMonth || createdDay,
      createdYear: false,
      createdMonth, createdDay,
      yearSection: null,
      monthSection, daySection,
      createdItem
    };
  }

  // Extract a prefix of required length (4/7/10) from a title if it matches the corresponding pattern
  function getTitlePrefix(title, prefixLen) {
    if (typeof title !== 'string') return null;
    if (prefixLen === 4) {
      const m = title.match(/^(\d{4})/);
      return m ? m[1] : null;
    } else if (prefixLen === 7) {
      const m = title.match(/^(\d{4}-\d{2})/);
      return m ? m[1] : null;
    } else if (prefixLen === 10) {
      const m = title.match(/^(\d{4}-\d{2}-\d{2})/);
      return m ? m[1] : null;
    }
    return null;
  }

  // Reorder only the section elements with matching date prefixes in parentArray,
  // leaving non-matching sections and other elements in their original positions.
  function reorderSectionsInPlace(parentArray, prefixLen, sortOrder) {
    if (!Array.isArray(parentArray)) return;
    sortOrder = sortOrder || 'newest-first';
    
    // Collect only sections that have the matching prefix pattern
    const matchingSections = [];
    const matchingIndices = [];
    for (let i = 0; i < parentArray.length; i++) {
      if (parentArray[i] && parentArray[i].type === 'section') {
        const prefix = getTitlePrefix(parentArray[i].title, prefixLen);
        if (prefix) {
          matchingSections.push({ section: parentArray[i], prefix });
          matchingIndices.push(i);
        }
      }
    }
    
    if (matchingSections.length <= 1) return;

    // Sort matching sections by prefix (newest-first = descending, oldest-first = ascending)
    if (sortOrder === 'oldest-first') {
      matchingSections.sort((a, b) => a.prefix.localeCompare(b.prefix));
    } else {
      matchingSections.sort((a, b) => b.prefix.localeCompare(a.prefix));
    }

    // Place sorted sections back at the positions where matching sections were
    for (let i = 0; i < matchingSections.length; i++) {
      parentArray[matchingIndices[i]] = matchingSections[i].section;
    }
  }

  // Sort entire journal: years, months and days (sections only)
  function sortJournal(list) {
    if (!list || !Array.isArray(list.items)) return;
    const sortOrder = list.sortOrder || 'newest-first';
    
    // Sort month-level sections (prefixLen = 7) at root
    reorderSectionsInPlace(list.items, 7, sortOrder);
    
    // Then sort day sections (prefixLen = 10) inside each month section
    list.items.forEach(item => {
      if (item && item.type === 'section' && Array.isArray(item.items)) {
        // Only process if this looks like a month section (has 7-char date prefix)
        if (getTitlePrefix(item.title, 7)) {
          reorderSectionsInPlace(item.items, 10, sortOrder);
        }
      }
    });
  }

  // Sort only the immediate subsections of the provided section (determine prefix len from children)
  function sortSection(section, list) {
    if (!section || !Array.isArray(section.items)) return;
    const sortOrder = (list && list.sortOrder) || 'newest-first';
    // Decide which prefix length to use by inspecting children titles
    let prefixLen = null;
    for (const child of section.items) {
      if (child && child.type === 'section') {
        if (getTitlePrefix(child.title, 10)) { prefixLen = 10; break; }
        if (getTitlePrefix(child.title, 7)) { prefixLen = 7; /* but keep scanning for 10 just in case */ }
        if (!prefixLen && getTitlePrefix(child.title, 4)) prefixLen = 4;
      }
    }
    if (!prefixLen) {
      return false; // No sortable subsections found
    }
    reorderSectionsInPlace(section.items, prefixLen, sortOrder);
    return true;
  }

  // Public API
  window.JournalHelper = {
    formatPrefixes,
    findSectionStartingWith,
    ensureJournalPathForDate,
    getTitlePrefix,
    reorderSectionsInPlace,
    sortJournal,
    sortSection
  };
