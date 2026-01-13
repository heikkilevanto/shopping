// storage.js - Data persistence and server communication for shopping app
// Handles saving, loading, and managing list data on the server

"use strict";

// ================= Sanitization =================

function sanitizeListName(rawName) {
  const fallback = 'NewList';
  const trimmed = (rawName ?? '').trim();
  let candidate = trimmed || fallback;
  candidate = candidate.replace(/[^\w-]/g, '_');
  candidate = candidate.replace(/_+/g, '_');
  candidate = candidate.replace(/^_+/, '').replace(/_+$/, '');
  if (!candidate) candidate = fallback;
  const adjusted = trimmed.length > 0 && candidate !== trimmed;
  return { name: candidate, adjusted };
}

// ================= Save Operations =================

function saveCurrentList() {
  const currentList = State.getCurrentList();
  State.setIsSaving(true);
  clearTimeout(State.getSaveTimeout());

  return fetch(`/shopping/api.cgi/${currentList.name}`, {
    method: 'POST',
    body: JSON.stringify(currentList, null, 2) + '\n',
    headers: { 'Content-Type': 'application/json' }
  }).then(async r => {
    if (!r.ok) {
      const bodyText = await r.text().catch(() => '');
      throw new Error(bodyText.trim() || `Save failed (${r.status} ${r.statusText})`);
    }
    State.clearBanner();
    State.setCurrentListLastModified(r.headers.get('Last-Modified'));
    State.setIsSaving(false);
    State.setIsModified(false);
  }).catch(err => {
    console.error('Save failed', err);
    State.setIsSaving(false);
    State.setBanner(err.message || 'Save failed');
    throw err;
  });
}

function scheduleSave() {
  clearTimeout(State.getSaveTimeout());
  const currentList = State.getCurrentList();
  if (!currentList) return;
  State.setIsModified(true);

  const timeout = setTimeout(() => {
    saveCurrentList().catch(console.error);
  }, 2000);  // in ms
  State.setSaveTimeout(timeout);
}

// ================= Load Operations =================

function loadList(name, callback) {
  fetch(`/shopping/api.cgi/${name}`)
    .then(async r => {
      if (!r.ok) {
        const bodyText = await r.text().catch(() => '');
        throw new Error(bodyText.trim() || `Failed to load list (${r.status} ${r.statusText})`);
      }
      State.setCurrentListLastModified(r.headers.get('Last-Modified'));
      return r.json();
    })
    .then(data => {
      callback(null, data);
    })
    .catch(err => {
      console.error('Failed to load list', err);
      callback(err);
    });
}

function loadAllLists(callback) {
  fetch('/shopping/api.cgi/')
    .then(async r => {
      if (!r.ok) {
        const bodyText = await r.text().catch(() => '');
        throw new Error(bodyText.trim() || `Failed to fetch lists (${r.status} ${r.statusText})`);
      }
      return r.json();
    })
    .then(data => {
      callback(null, data);
    })
    .catch(err => {
      callback(err);
    });
}

// ================= Delete Operations =================

function deleteList(name, callback) {
  fetch(`/shopping/api.cgi/${name}`, {method: 'DELETE'})
    .then(data => {
      callback(null, data);
    })
    .catch(err => {
      console.error('Delete failed', err);
      callback(err);
    });
}

// ================= Focus-check reload logic =================

function setupFocusReloadCheck() {
  window.addEventListener('focus', () => {
    const currentList = State.getCurrentList();
    const currentListLastModified = State.getCurrentListLastModified();
    if (!currentList || !currentList.name || !currentListLastModified) return;
    
    // Check if list has been modified on server
    fetch(`/shopping/api.cgi/${currentList.name}`, {
      headers: { 'If-Modified-Since': currentListLastModified }
    })
    .then(r => {
      if (r.status === 304) {
        // Not modified, nothing to do
        return null;
      }
      if (r.ok) {
        // File was modified, reload it
        State.setCurrentListLastModified(r.headers.get('Last-Modified'));
        console.log('List has changed on server! Reloading...');
        return r.json();
      }
      return null;
    })
    .then(d => {
      if (d) {
        State.setCurrentList(d);
        State.setIsModified(false);
        State.setIsSaving(false);
        clearTimeout(State.getSaveTimeout());
        // Trigger render through ShoppingApp
        if (window.ShoppingApp && ShoppingApp.render) {
          ShoppingApp.render();
        }
        // Brief status update
        State.updateStatus();
        // Show reload indicator briefly
        const tempStatus = document.getElementById('list-status');
        if (tempStatus) {
          const oldText = tempStatus.textContent;
          tempStatus.textContent = ' ↻';
          setTimeout(() => {
            tempStatus.textContent = oldText;
            State.updateStatus();
          }, 1500);
        }
      }
    })
    .catch(err => console.error('Focus check failed:', err));
  });
}

// ================= Public API =================
window.Storage = {
  sanitizeListName,
  saveCurrentList,
  scheduleSave,
  loadList,
  loadAllLists,
  deleteList,
  setupFocusReloadCheck
};
