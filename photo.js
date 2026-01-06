// photo.js - photo capture, upload, and rendering for shopping list

// Globals set by shopping.js
// currentList, scheduleSave, render, focusItem

// Hidden file input for fallback capture/select
let photoFileInput = null;

// Store where to insert the photo (set when 'p' is typed)
let photoInsertContext = null;  // { parentItems, index }

function initPhotoModule() {
  // Create hidden file input for camera access
  photoFileInput = document.createElement('input');
  photoFileInput.type = 'file';
  photoFileInput.name = 'photo'; 
  photoFileInput.accept = 'image/*';
  photoFileInput.capture = 'environment';
  photoFileInput.style.display = 'none';
  photoFileInput.value = '';
  document.body.appendChild(photoFileInput);

  photoFileInput.onchange = function() {
    if (photoFileInput.files && photoFileInput.files[0]) {
      uploadPhoto(photoFileInput.files[0]);
      // Reset so same file can be selected again
      photoFileInput.value = '';
    }
  };
}

function capturePhoto() {
  if (photoFileInput) {
    photoFileInput.click();
  } else {
    console.error('photoFileInput not initialized; call initPhotoModule() first');
  }
}

function uploadPhoto(file) {
  const formData = new FormData();
  formData.append('photo', file, file.name);
  
  fetch('/shopping/photo.cgi/upload', {
    method: 'POST',
    body: formData
  })
  .then(resp => {
    if (!resp.ok) {
      throw new Error('Upload failed: ' + resp.status + ' ' + resp.statusText);
    }
    return resp.json();
  })
  .then(data => {
    if (data.ok && data.filename) {
      insertPhotoItem(data.filename);
    } else {
      console.error('uploadPhoto: server error: ' + JSON.stringify(data));
    }
  })
  .catch(err => {
    console.error('uploadPhoto: error ' + err.message);
    alert('Upload failed: ' + err.message);
  });
}

function insertPhotoItem(filename) {
  if (!currentList) {
    console.error('insertPhotoItem: no currentList');
    return;
  }

  // Build the photo item
  const photoItem = {
    type: 'photo',
    filename: filename,
    created: new Date().toISOString()
  };

  // Use stored insertion context if available
  let parentItems = null;
  let insertIdx = null;
  let emptyLineItem = null;  // Save this before clearing photoInsertContext

  if (photoInsertContext && photoInsertContext.parentItems) {
    parentItems = photoInsertContext.parentItems;
    insertIdx = photoInsertContext.index;
    emptyLineItem = photoInsertContext.emptyLineItem;  // Save before clearing
    photoInsertContext = null;  // Clear after use
  } else if (focusItem && (focusItem.type === 'text' || focusItem.type === 'item' || focusItem.type === 'photo')) {
    // focusItem is a regular item; find its parent array and insert after it
    parentItems = findParentArray(currentList, focusItem);
    if (parentItems) {
      insertIdx = parentItems.indexOf(focusItem);
      if (insertIdx >= 0) {
        insertIdx += 1;
      } else {
        insertIdx = parentItems.length;
      }
    }
  } else if (focusItem && focusItem.type === 'section') {
    // focusItem is a section; insert into its items
    parentItems = focusItem.items;
    insertIdx = parentItems.length;
  }

  if (!parentItems) {
    // Fallback: insert into top-level items
    parentItems = currentList.items || [];
    insertIdx = parentItems.length;
  }

  console.log('insertPhotoItem: inserting at index ' + insertIdx);
  parentItems.splice(insertIdx, 0, photoItem);
  
  // Focus the item after the photo - use the stored reference if available
  if (emptyLineItem) {
    focusItem = emptyLineItem;
  } else if (parentItems[insertIdx + 1]) {
    focusItem = parentItems[insertIdx + 1];
  } else {
    focusItem = photoItem;
  }
  
  render();
  scheduleSave();
}

function findParentArray(container, targetItem) {
  // Helper: recursively find which array contains targetItem
  if (container.items) {
    if (container.items.indexOf(targetItem) >= 0) {
      return container.items;
    }
    for (let item of container.items) {
      if (item.type === 'section') {
        let result = findParentArray(item, targetItem);
        if (result) return result;
      }
    }
  }
  return null;
}

function renderPhotoItem(line, item) {
  console.log('renderPhotoItem: filename=' + item.filename);
  
  // Create container div for the image
  const photoDiv = document.createElement('div');
  photoDiv.className = 'photo-item';
  
  const img = document.createElement('img');
  img.src = '/shopping/photo.cgi/' + 'heikki' + '/' + item.filename;  // TODO: use actual username
  img.alt = 'Photo: ' + item.filename;
  img.style.maxWidth = '100%';  // Fit within container/section box
  img.style.maxHeight = '90vh';  // Limit to 90% of viewport height
  img.style.height = 'auto';
  img.style.width = 'auto';
  img.style.display = 'block';
  img.style.cursor = 'pointer';
  img.style.marginTop = '0.25em';
  img.style.marginBottom = '0.25em';
  
  img.onclick = function(e) {
    e.stopPropagation();
    window.open(img.src, '_blank');
  };
  
  photoDiv.appendChild(img);
  line.appendChild(photoDiv);
}
