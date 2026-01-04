'use strict';

// journal.js — helpers for journal-style lists (flat module)
// Exposes global JournalHelper with functions to format prefixes and
// ensure year/month/day sections exist (using ISO-like prefixes in titles).
//
// Matching uses title.startsWith(prefix) so the user may append arbitrary
// human text after the numeric prefix, e.g. "2025-12-24 Xmas Eve".
// No hidden metadata is used.

const JournalHelper = (function() {
  // Local helpers (function scope inside this module object)
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
      if (typeof s.title === 'string' && s.title.indexOf(prefix) === 0) return s;
    }
    return null;
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

  // Ensure year/month/day sections exist for a date inside list (list.items).
  // Inserts at top (index 0) so newest-first order is preserved.
  // Returns an object describing what was found/created and references to created structures.
  //
  // Usage:
  //   const res = JournalHelper.ensureJournalPathForDate(currentList, new Date());
  //   if (res.createdDay && res.createdItem) { focusItem = res.createdItem; scheduleSave(); render(); }
  function ensureJournalPathForDate(list, date, opts) {
    opts = opts || {};
    if (!list || !Array.isArray(list.items)) {
      return { created: false };
    }
    const p = formatPrefixes(date, opts);
    let createdYear = false, createdMonth = false, createdDay = false, createdItem = null;

    // Find or create year in list.items
    let yearSection = findSectionStartingWith(list.items, p.yearPrefix);
    if (!yearSection) {
      yearSection = createSection(p.yearPrefix, []);
      list.items.unshift(yearSection);
      createdYear = true;
    }

    // Find or create month in yearSection.items
    let monthSection = findSectionStartingWith(yearSection.items, p.monthPrefix);
    if (!monthSection) {
      monthSection = createSection(p.monthTitle, []);
      yearSection.items.unshift(monthSection);
      createdMonth = true;
    }

    // Find or create day in monthSection.items
    let daySection = findSectionStartingWith(monthSection.items, p.dayPrefix);
    if (!daySection) {
      // day items should be text entries initially; create one empty text item at top
      const emptyDayItem = { type: 'text', text: '' };
      daySection = createSection(p.dayTitle, [ emptyDayItem ]);
      monthSection.items.unshift(daySection);
      createdDay = true;
      createdItem = emptyDayItem;
    } else {
      // Make sure the day section has at least one item; if none, add a blank text item at top
      if (!Array.isArray(daySection.items) || daySection.items.length === 0) {
        const emptyDayItem = { type: 'text', text: '' };
        daySection.items = [ emptyDayItem ];
        createdItem = emptyDayItem;
      }
    }

    return {
      created: createdYear || createdMonth || createdDay,
      createdYear, createdMonth, createdDay,
      yearSection, monthSection, daySection,
      createdItem
    };
  }

  // Public API
  return {
    formatPrefixes,
    findSectionStartingWith,
    ensureJournalPathForDate
  };
})();

// Attach to global window for pages that include this script
if (typeof window !== 'undefined') {
  window.JournalHelper = JournalHelper;
}
