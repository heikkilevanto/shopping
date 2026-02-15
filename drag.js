/* Drag-drop handling */

'use strict';

// Module-level state
let state = {
  dragActive: false,
  pointerId: null,
  startPos: null,
  draggedMeta: null,
  ghostEl: null,
  dropMarker: null,
  targetParentArray: null,
  targetIndex: null,
  autoScrollTimer: null,
  safetyTimer: null,  // timeout to force-cancel stuck drags
  // click suppression state
  suppressClickTarget: null,
  clickSuppressor: null,
  justDropped: false
};

function createDropMarker() {
    const el = document.createElement('div');
    el.className = 'drop-marker';
    document.body.appendChild(el);
    return el;
  }

  // Disable drag debug output. Re-enable in the console with window.DRAG_DEBUG = true
  // and refresh.
  if (!window.__DRAG_DEBUG__) {
    // Silences all console.debug calls from this point on.
    console.debug = () => {};
  }

  // lightweight describers for debug
  function describeNode(obj) {
    if (!obj) return '<null>';
    if (obj.type === 'section') return `section(${String(obj.title || '')})`;
    if (obj.type === 'item') return `item(${String(obj.text || '')})`;
    return String(obj);
  }
  function describeArray(arr) {
    if (!arr) return '<null-array>';
    try {
      return `Array(len=${arr.length})[${arr.slice(0,6).map(it => (it && it.type) ? (it.type === 'section' ? (it.title||'sec') : (it.text||'item')) : '?').join(',')}${arr.length>6? ',...':''}]`;
    } catch (e) { return `Array(len=${arr.length})`; }
  }

  const dragApi = {
    init() {
      state.dropMarker = createDropMarker();
      console.debug('drag.init', { container: ShoppingApp.container });
      
      // Global safety: cancel drag if pointer leaves window or visibility changes
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && state.dragActive) {
          console.debug('Page hidden during drag, canceling');
          this.cancelDrag();
        }
      });
      
      window.addEventListener('blur', () => {
        if (state.dragActive) {
          console.debug('Window lost focus during drag, canceling');
          this.cancelDrag();
        }
      });
    },

    registerLine(lineEl) {
      let inlineLine = null;
      lineEl.addEventListener('mouseenter', () => {
        if (!state.dragActive) return;
        if (!inlineLine) {
          inlineLine = document.createElement('div');
          inlineLine.className = 'inline-drop-line';
          lineEl.appendChild(inlineLine);
        }
      });
      lineEl.addEventListener('mouseleave', () => {
        if (inlineLine && inlineLine.parentNode === lineEl) lineEl.removeChild(inlineLine);
        inlineLine = null;
      });

      lineEl.addEventListener('pointerup', (ev) => {
        if (!state.dragActive) return;
        ev.preventDefault();
        const parentArray = lineEl._parentItems;
        const idx = parentArray ? parentArray.indexOf(lineEl._item) : -1;
        const insertIndex = (idx >= 0) ? idx + 1 : null;
        console.debug('pointerup on .line while dragging', { lineItem: describeNode(lineEl._item), parentArray: describeArray(parentArray), idx, insertIndex });
        if (insertIndex !== null) {
          dragApi.dropHere(state.draggedMeta, parentArray, insertIndex);
        } else {
          dragApi.cancelDrag();
        }
      });
    },

    registerSectionHeader(headerEl) {
      let inlineLine = null;
      headerEl.addEventListener('mouseenter', () => {
        if (!state.dragActive) return;
        if (!inlineLine) {
          inlineLine = document.createElement('div');
          inlineLine.className = 'inline-drop-line';
          headerEl.appendChild(inlineLine);
        }
      });
      headerEl.addEventListener('mouseleave', () => {
        if (inlineLine && inlineLine.parentNode === headerEl) headerEl.removeChild(inlineLine);
        inlineLine = null;
      });

      headerEl.addEventListener('pointerup', (ev) => {
        if (!state.dragActive) return;
        ev.preventDefault();
        const section = headerEl._section;
        console.debug('pointerup on section header while dragging', { headerSection: describeNode(section), headerParentSections: describeArray(headerEl._parentSections) });
        if (section && Array.isArray(section.items)) {
          dragApi.dropHere(state.draggedMeta, section.items, 0);
        } else {
          dragApi.cancelDrag();
        }
      });
    },

    registerTopDropZone(zoneEl, mainItemsArray) {
      zoneEl._mainItemsArray = mainItemsArray;
      let inlineLine = null;
      zoneEl.addEventListener('mouseenter', () => {
        if (!state.dragActive) return;
        if (!inlineLine) {
          inlineLine = document.createElement('div');
          inlineLine.className = 'inline-drop-line';
          zoneEl.appendChild(inlineLine);
        }
      });
      zoneEl.addEventListener('mouseleave', () => {
        if (inlineLine && inlineLine.parentNode === zoneEl) zoneEl.removeChild(inlineLine);
        inlineLine = null;
      });

      zoneEl.addEventListener('pointerup', (ev) => {
        if (!state.dragActive) return;
        ev.preventDefault();
        console.debug('pointerup on top drop zone while dragging', { mainItemsArray: describeArray(zoneEl._mainItemsArray) });
        dragApi.dropHere(state.draggedMeta, zoneEl._mainItemsArray, 0);
      });
    },

    registerSectionFooter(zoneEl, section, parentSections) {
      zoneEl._section = section;
      zoneEl._parentSections = parentSections;
      let inlineLine = null;
      zoneEl.addEventListener('mouseenter', () => {
        if (!state.dragActive) return;
        if (!inlineLine) {
          inlineLine = document.createElement('div');
          inlineLine.className = 'inline-drop-line';
          zoneEl.appendChild(inlineLine);
        }
      });
      zoneEl.addEventListener('mouseleave', () => {
        if (inlineLine && inlineLine.parentNode === zoneEl) zoneEl.removeChild(inlineLine);
        inlineLine = null;
      });

      zoneEl.addEventListener('pointerup', (ev) => {
        if (!state.dragActive) return;
        ev.preventDefault();
        const insertIndex = zoneEl._parentSections.indexOf(zoneEl._section) + 1;
        console.debug('pointerup on section footer while dragging', { section: describeNode(zoneEl._section), parentSections: describeArray(zoneEl._parentSections), insertIndex });
        if (insertIndex > 0) {
          dragApi.dropHere(state.draggedMeta, zoneEl._parentSections, insertIndex);
        } else {
          dragApi.cancelDrag();
        }
      });
    },

    /**
     * registerDragHandle(handleEl, meta)
     * handleEl: DOM element to start drag from (checkbox for items, toggleBtn for sections)
     * meta: { type:'item'|'section', itemOrSection, parentArray, domNode }
     */
    registerDragHandle(handleEl, meta) {
      if (!handleEl) return;
      handleEl._dragMeta = meta;

      const onPointerDown = (ev) => {
        // For sections: only allow starting a drag when the section is collapsed.
        if (meta && meta.type === 'section' && meta.itemOrSection && !meta.itemOrSection.collapsed) {
          return;
        }

        if (state.dragActive) return;

        state.pointerId = ev.pointerId;
        state.startPos = { x: ev.clientX, y: ev.clientY };
        state.draggedMeta = {
          type: meta.type,
          itemOrSection: meta.itemOrSection,
          parentArray: meta.parentArray,
          sourceIndex: meta.parentArray ? meta.parentArray.indexOf(meta.itemOrSection) : -1,
          domNode: meta.domNode || handleEl.closest('.line') || handleEl.closest('.section') || null,
          handleEl: handleEl
        };

        console.debug('pointerdown on drag handle', {
          pointerType: ev.pointerType,
          metaType: meta.type,
          dragged: describeNode(meta.itemOrSection),
          parentArray: describeArray(meta.parentArray),
          sourceIndex: state.draggedMeta.sourceIndex
        });

        try { handleEl.setPointerCapture(ev.pointerId); } catch (e) {}

        // Use a larger threshold for touch to avoid accidental drags, smaller for mouse/pen.
        const moveThreshold = ev.pointerType === 'touch' ? 10 : 6;
        const onMove = (moveEv) => {
          // Prevent default on move to block scrolling/refresh once we're tracking a potential drag
          moveEv.preventDefault();
          const dx = moveEv.clientX - state.startPos.x;
          const dy = moveEv.clientY - state.startPos.y;
          if (Math.hypot(dx, dy) > moveThreshold) {
            window.removeEventListener('pointermove', onMove, { capture: true });
            if (!state.dragActive) startDrag(moveEv);
          }
        };
        window.addEventListener('pointermove', onMove, { capture: true, passive: false });

        // If pointerup happens before threshold, cleanup the listener and release pointer capture.
        const onPointerUpBeforeStart = () => {
          window.removeEventListener('pointermove', onMove, { capture: true });
          try { handleEl.releasePointerCapture(ev.pointerId); } catch (e) {}
        };
        handleEl.addEventListener('pointerup', onPointerUpBeforeStart, { once: true });

        function startDrag(startEvent) {
          if (state.dragActive) return;
          state.dragActive = true;

          // Haptic feedback on mobile devices (try both methods)
          if ('vibrate' in navigator) {
            try {
              navigator.vibrate(50);
            } catch (e) {
              console.debug('vibrate failed', e);
            }
          }

          // Prevent scrolling and pull-to-refresh during drag
          document.body.classList.add('drag-in-progress');

          // Setup click suppression so the handle's click doesn't fire after drag
          state.suppressClickTarget = handleEl;
          installClickSuppressor();

          console.debug('startDrag', {
            draggedMeta: {
              desc: describeNode(state.draggedMeta.itemOrSection),
              sourceArray: describeArray(state.draggedMeta.parentArray),
              sourceIndex: state.draggedMeta.sourceIndex,
              domNode: !!state.draggedMeta.domNode
            }
          });

          createGhost(state.draggedMeta.domNode || handleEl, startEvent);
          if (state.dropMarker) {
            state.dropMarker.classList.remove('hidden');
            // Force initial visibility with a default safe position
            state.dropMarker.style.display = 'block';
            console.debug('drop marker unhidden and shown');
          }
          if (state.draggedMeta.domNode) {
            state.draggedMeta.domNode.classList.add('dragging');
          }
          // Compute initial drop target position
          computeAndShowTarget(startEvent.clientX, startEvent.clientY);
          window.addEventListener('pointermove', onPointerMove, { capture: true, passive: false });
          window.addEventListener('pointerup', onPointerUp, { capture: true, passive: false });
          
          // Safety timeout: auto-cancel drag after 30 seconds to prevent stuck state
          state.safetyTimer = setTimeout(() => {
            if (state.dragActive) {
              console.warn('Drag safety timeout: force canceling stuck drag');
              dragApi.cancelDrag();
            }
          }, 30000);
        }

        function onPointerMove(ev) {
          if (!state.dragActive) return;
          // Prevent default to block scrolling/refresh during drag
          ev.preventDefault();
          moveGhost(ev.clientX, ev.clientY);
          computeAndShowTarget(ev.clientX, ev.clientY);
          handleAutoScroll(ev.clientY);
        }

        function onPointerUp(ev) {
          if (!state.dragActive) {
            // pointerup before actual drag started: cleanup
            window.removeEventListener('pointermove', onPointerMove, { capture: true });
            window.removeEventListener('pointerup', onPointerUp, { capture: true });
            removeClickSuppressor();
            try { handleEl.releasePointerCapture(ev.pointerId); } catch (e) {}
            return;
          }
          ev.preventDefault();
          
          // Recompute target at the final drop position to ensure accuracy on mobile
          computeAndShowTarget(ev.clientX, ev.clientY);
          
          if (state.targetParentArray && typeof state.targetIndex === 'number') {
            console.debug('pointerup: dropping at valid target', { 
              targetArray: describeArray(state.targetParentArray), 
              targetIndex: state.targetIndex 
            });
            dragApi.dropHere(state.draggedMeta, state.targetParentArray, state.targetIndex);
          } else {
            console.debug('pointerup: no valid target, canceling drag', {
              hadTargetArray: !!state.targetParentArray,
              hadTargetIndex: typeof state.targetIndex === 'number'
            });
            dragApi.cancelDrag();
          }
          try { handleEl.releasePointerCapture(ev.pointerId); } catch (e) {}
          window.removeEventListener('pointermove', onPointerMove, { capture: true });
          window.removeEventListener('pointerup', onPointerUp, { capture: true });
        }
      };

      // Passive listener for pointerdown is fine - we prevent default on move events instead
      handleEl.addEventListener('pointerdown', onPointerDown, { passive: true });
    },

    dropHere(draggedMeta, targetParentArray, targetIndex) {
      console.debug('dropHere called', {
        dragged: describeNode(draggedMeta && draggedMeta.itemOrSection),
        sourceArray: describeArray(draggedMeta && draggedMeta.parentArray),
        sourceIndex: draggedMeta && draggedMeta.sourceIndex,
        targetArray: describeArray(targetParentArray),
        targetIndex
      });

      if (!draggedMeta || !targetParentArray || typeof targetIndex !== 'number') {
        console.warn('dropHere: invalid args', { draggedMeta, targetParentArray, targetIndex });
        this.cancelDrag();
        return;
      }

      // For sections: prevent dropping INTO the section itself (i.e., into its own items array).
      if (draggedMeta.type === 'section') {
        const draggedObj = draggedMeta.itemOrSection;
        if (targetParentArray === draggedObj.items) {
          console.debug('dropHere prevented: target is the dragged section itself (insert into its own items array)', {
            dragged: describeNode(draggedObj),
            targetArray: describeArray(targetParentArray)
          });
          // cleanup visuals but keep click suppressor for a short window to avoid menu opening
          this._cleanupVisuals();
          state.justDropped = true;
          setTimeout(() => {
            state.justDropped = false;
            removeClickSuppressor();
          }, 300);
          return;
        }
      }

      const sourceArray = draggedMeta.parentArray;
      let srcIndex = draggedMeta.sourceIndex;
      if (!Array.isArray(sourceArray) || srcIndex < 0) {
        console.warn('dropHere: invalid source array/index', { sourceArray: describeArray(sourceArray), srcIndex });
        this.cancelDrag();
        return;
      }

      // Detect no-op (dropping so the ordering doesn't change). Ignore such drops.
      if (sourceArray === targetParentArray) {
        if (targetIndex === srcIndex || targetIndex === srcIndex + 1) {
          console.debug('dropHere ignored: no-op same-array drop', { sourceIndex: srcIndex, targetIndex });
          this._cleanupVisuals();
          state.justDropped = true;
          setTimeout(() => {
            state.justDropped = false;
            removeClickSuppressor();
          }, 300);
          return;
        }
      }

      console.debug('before splice', { sourceArrayLen: sourceArray.length, targetArrayLen: targetParentArray.length });
      const movingItem = sourceArray.splice(srcIndex, 1)[0];
      console.debug('after removal', { removed: describeNode(movingItem), sourceArrayLen: sourceArray.length });

      if (sourceArray === targetParentArray && srcIndex < targetIndex) {
        targetIndex -= 1;
        console.debug('adjusted targetIndex due to same-array move', { newTargetIndex: targetIndex });
      }

      targetParentArray.splice(targetIndex, 0, movingItem);
      console.debug('after insert', { targetArrayLen: targetParentArray.length, insertedAt: targetIndex, inserted: describeNode(movingItem) });

      // cleanup visuals (but keep click suppressor installed for a short window)
      this._cleanupVisuals();

      // set justDropped to suppress click events for a short while,
      // and remove the click suppressor after the short window.
      state.justDropped = true;
      setTimeout(() => {
        state.justDropped = false;
        removeClickSuppressor();
      }, 300);

      console.debug('calling render() and scheduleSave() after successful drop');
      ShoppingApp.render();
      ShoppingApp.scheduleSave();
    },

    cancelDrag() {
      console.debug('cancelDrag invoked');
      this._cleanupVisuals();
      removeClickSuppressor();
      state.justDropped = false;
    },

    // Force cancel any active drag (can be called externally)
    forceCancelIfActive() {
      if (state.dragActive) {
        console.debug('forceCancelIfActive: canceling stuck drag');
        this.cancelDrag();
      }
    },

    // Check if drag is currently active
    isDragActive() {
      return state.dragActive;
    },

    // visual cleanup only
    _cleanupVisuals() {
      // Re-enable scrolling and pull-to-refresh
      document.body.classList.remove('drag-in-progress');
      
      if (state.ghostEl && state.ghostEl.parentNode) state.ghostEl.parentNode.removeChild(state.ghostEl);
      if (state.dropMarker) {
        state.dropMarker.classList.add('hidden');
        state.dropMarker.style.display = 'none';
      }
      if (state.draggedMeta && state.draggedMeta.domNode) state.draggedMeta.domNode.classList.remove('dragging');
      if (state.autoScrollTimer) { clearInterval(state.autoScrollTimer); state.autoScrollTimer = null; }
      if (state.safetyTimer) { clearTimeout(state.safetyTimer); state.safetyTimer = null; }

      state.dragActive = false;
      state.pointerId = null;
      state.startPos = null;
      state.draggedMeta = null;
      state.targetParentArray = null;
      state.targetIndex = null;
    }
  }; // end api

  // Helpers outside api
  function createGhost(sourceDom, ev) {
    const ghost = (sourceDom && sourceDom.cloneNode(true)) || document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.style.left = (ev.clientX + 8) + 'px';
    ghost.style.top = (ev.clientY + 8) + 'px';
    document.body.appendChild(ghost);
    state.ghostEl = ghost;
    console.debug('ghost created', { hasDom: !!sourceDom });
  }

  function moveGhost(x, y) {
    if (!state.ghostEl) return;
    state.ghostEl.style.left = (x + 8) + 'px';
    state.ghostEl.style.top = (y + 8) + 'px';
  }

  function computeAndShowTarget(clientX, clientY) {
    if (!state.dropMarker) return;
    
    // Temporarily hide ghost to ensure elementFromPoint works on touch devices
    const ghostWasVisible = state.ghostEl && state.ghostEl.style.display !== 'none';
    if (ghostWasVisible) {
      state.ghostEl.style.display = 'none';
    }
    
    const el = document.elementFromPoint(clientX, clientY);
    
    // Restore ghost visibility
    if (ghostWasVisible) {
      state.ghostEl.style.display = 'block';
    }
    
    if (!el) {
      console.debug('computeAndShowTarget: no element found at point');
      // Clear target when nothing is found
      state.dropMarker.style.display = 'none';
      state.targetParentArray = null;
      state.targetIndex = null;
      return;
    }
    const lineEl = el.closest ? el.closest('.line, .section, .top-drop-zone, .section-footer-drop-zone') : null;
    if (!lineEl) {
      // Only default to container end if we're actually over the container
      const container = window.ShoppingApp.container;
      if (!container) {
        state.dropMarker.style.display = 'none';
        state.targetParentArray = null;
        state.targetIndex = null;
        return;
      }
      const rect = container.getBoundingClientRect();
      // Check if pointer is actually within container bounds
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
        console.debug('computeAndShowTarget: pointer outside container, clearing target');
        state.dropMarker.style.display = 'none';
        state.targetParentArray = null;
        state.targetIndex = null;
        return;
      }
      // Pointer is over container - show drop at end
      state.dropMarker.style.left = rect.left + 'px';
      state.dropMarker.style.width = rect.width + 'px';
      state.dropMarker.style.top = (rect.bottom - 2 + window.scrollY) + 'px';
      state.dropMarker.style.display = 'block';
      state.dropMarker.classList.remove('hidden');
      state.targetParentArray = ShoppingApp.getCurrentList().items;
      state.targetIndex = state.targetParentArray.length;
      console.debug('computeAndShowTarget: over container (end)', { targetParentArray: describeArray(state.targetParentArray), targetIndex: state.targetIndex, markerTop: state.dropMarker.style.top });
      return;
    }

    if (lineEl.classList.contains('line')) {
      const rect = lineEl.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      const parentArray = lineEl._parentItems;
      const idx = parentArray ? parentArray.indexOf(lineEl._item) : -1;
      const insertIndex = (idx >= 0) ? ((clientY > mid) ? idx + 1 : idx) : null;
      if (insertIndex !== null && parentArray) {
        state.targetParentArray = parentArray;
        state.targetIndex = insertIndex;
        const topPos = (clientY > mid) ? rect.bottom + window.scrollY : rect.top + window.scrollY;
        state.dropMarker.style.left = rect.left + 'px';
        state.dropMarker.style.width = rect.width + 'px';
        state.dropMarker.style.top = topPos + 'px';
        state.dropMarker.style.display = 'block';
        state.dropMarker.classList.remove('hidden');
        console.debug('computeAndShowTarget: on .line', { lineItem: describeNode(lineEl._item), parentArray: describeArray(parentArray), targetIndex: insertIndex });
        return;
      }
    }

    if (lineEl.classList.contains('section')) {
      const header = lineEl.querySelector('.section-header') || lineEl;
      const section = header && header._section;
      if (section) {
        const rect = lineEl.getBoundingClientRect();
        const isNearTop = clientY < rect.top + rect.height / 2;
        state.targetParentArray = section.items;
        state.targetIndex = isNearTop ? 0 : section.items.length;
        const markerTop = isNearTop ? rect.top + window.scrollY : rect.bottom + window.scrollY;
        state.dropMarker.style.left = rect.left + 'px';
        state.dropMarker.style.width = rect.width + 'px';
        state.dropMarker.style.top = markerTop + 'px';
        state.dropMarker.style.display = 'block';
        state.dropMarker.classList.remove('hidden');
        console.debug('computeAndShowTarget: on .section', { section: describeNode(section), isNearTop, targetParentArray: describeArray(state.targetParentArray), targetIndex: state.targetIndex });
        return;
      }
    }

    if (lineEl.classList.contains('top-drop-zone')) {
      const rect = lineEl.getBoundingClientRect();
      state.targetParentArray = lineEl._mainItemsArray;
      state.targetIndex = 0;
      state.dropMarker.style.left = rect.left + 'px';
      state.dropMarker.style.width = rect.width + 'px';
      state.dropMarker.style.top = (rect.top + window.scrollY) + 'px';
      state.dropMarker.style.display = 'block';
      state.dropMarker.classList.remove('hidden');
      console.debug('computeAndShowTarget: on .top-drop-zone', { targetParentArray: describeArray(state.targetParentArray), targetIndex: state.targetIndex });
      return;
    }

    if (lineEl.classList.contains('section-footer-drop-zone')) {
      const rect = lineEl.getBoundingClientRect();
      const insertIndex = lineEl._parentSections.indexOf(lineEl._section) + 1;
      state.targetParentArray = lineEl._parentSections;
      state.targetIndex = insertIndex;
      state.dropMarker.style.left = rect.left + 'px';
      state.dropMarker.style.width = rect.width + 'px';
      state.dropMarker.style.top = (rect.bottom + window.scrollY) + 'px';
      state.dropMarker.style.display = 'block';
      state.dropMarker.classList.remove('hidden');
      console.debug('computeAndShowTarget: on .section-footer-drop-zone', { section: describeNode(lineEl._section), targetParentArray: describeArray(state.targetParentArray), targetIndex: state.targetIndex });
      return;
    }

    state.dropMarker.style.display = 'none';
    state.targetParentArray = null;
    state.targetIndex = null;
  }

  function handleAutoScroll(clientY) {
    const container = ShoppingApp.container;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const margin = 40; // autoScroll margin
    const speed = 8;   // autoScroll speed
    if (clientY < rect.top + margin) {
      if (!state.autoScrollTimer) state.autoScrollTimer = setInterval(() => container.scrollBy(0, -speed), 40);
    } else if (clientY > rect.bottom - margin) {
      if (!state.autoScrollTimer) state.autoScrollTimer = setInterval(() => container.scrollBy(0, speed), 40);
    } else {
      if (state.autoScrollTimer) { clearInterval(state.autoScrollTimer); state.autoScrollTimer = null; }
    }
  }

  function installClickSuppressor() {
    if (state.clickSuppressor) return;
    state.clickSuppressor = function (ev) {
      const target = ev.target;
      const shouldSuppress = state.suppressClickTarget && (state.suppressClickTarget === target || state.suppressClickTarget.contains(target));
      if (shouldSuppress || state.justDropped) { ev.preventDefault(); ev.stopPropagation(); }
    };
    document.addEventListener('click', state.clickSuppressor, true);
  }
  function removeClickSuppressor() {
    if (state.clickSuppressor) { document.removeEventListener('click', state.clickSuppressor, true); state.clickSuppressor = null; }
    state.suppressClickTarget = null;
  }

  window.drag = dragApi;
