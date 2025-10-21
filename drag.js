/* drag.js
   Drag-reorder module (desktop-only / touch removed)

   Changes in this version:
   - Removed all touch-specific handling (long-press, touchmove preventers, overscroll/scroll nudges).
   - Pointer events still used, but pointerdown with pointerType === 'touch' is ignored (no touch drag).
   - Simplified drag lifecycle: mouse/pen start drag after move threshold; no long-press timers.
   - Removed all scroll-trickery and related helpers.
   - Kept ghost element, single drop marker, auto-scroll near container edges (for mouse), click suppression to avoid clicks firing after a drag.
   - Preserved safeguards: don't start dragging expanded sections, don't insert a section into its own items array, ignore no-op same-array drops.
   - Retained debug logging to help future troubleshooting; you can remove console.debug calls if you want quieter output.
*/

(function () {
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
    options: null,
    // click suppression state
    suppressClickTarget: null,
    clickSuppressor: null,
    justDropped: false
  };

  function createDropMarker() {
    const el = document.createElement('div');
    el.style.position = 'absolute';
    el.style.height = '2px';
    el.style.background = '#06f';
    el.style.boxShadow = '0 1px 0 rgba(0,0,0,0.1)';
    el.style.zIndex = '9999';
    el.style.pointerEvents = 'none';
    el.style.display = 'none';
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

  const api = {
    init(options = {}) {
      if (!options.container || !options.render || !options.scheduleSave) {
        console.warn('drag.init: missing required options (container, render, scheduleSave)');
      }
      state.options = Object.assign({
        autoScroll: { margin: 40, speed: 8 }
      }, options);
      state.dropMarker = createDropMarker();
      console.debug('drag.init', { container: state.options.container, autoScroll: state.options.autoScroll });
    },

    registerLine(lineEl) {
      let inlineLine = null;
      lineEl.addEventListener('mouseenter', () => {
        if (!inlineLine) {
          inlineLine = document.createElement('div');
          inlineLine.style.height = '1px';
          inlineLine.style.background = '#aaa';
          inlineLine.style.marginTop = '0.1em';
          inlineLine.style.opacity = '0.6';
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
          api.dropHere(state.draggedMeta, parentArray, insertIndex);
        } else {
          api.cancelDrag();
        }
      });
    },

    registerSectionHeader(headerEl) {
      let inlineLine = null;
      headerEl.addEventListener('mouseenter', () => {
        if (!inlineLine) {
          inlineLine = document.createElement('div');
          inlineLine.style.height = '1px';
          inlineLine.style.background = '#aaa';
          inlineLine.style.opacity = '0.6';
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
          api.dropHere(state.draggedMeta, section.items, 0);
        } else {
          api.cancelDrag();
        }
      });
    },

    /**
     * registerDragHandle(handleEl, meta)
     * handleEl: DOM element to start drag from (checkbox for items, toggleBtn for sections)
     * meta: { type:'item'|'section', itemOrSection, parentArray, domNode }
     *
     * NOTE: Touch dragging has been removed. If pointerType === 'touch' we ignore pointerdown.
     */
    registerDragHandle(handleEl, meta) {
      if (!handleEl) return;
      handleEl._dragMeta = meta;

      const onPointerDown = (ev) => {
        // Do not initiate touch-based drags here: skip pointerdown if pointer is touch.
        if (ev.pointerType === 'touch') return;

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

        // For mouse/pen: start drag after a small move threshold to avoid interfering with clicks.
        const moveThreshold = 6;
        const onMove = (moveEv) => {
          const dx = moveEv.clientX - state.startPos.x;
          const dy = moveEv.clientY - state.startPos.y;
          if (Math.hypot(dx, dy) > moveThreshold) {
            window.removeEventListener('pointermove', onMove, true);
            if (!state.dragActive) startDrag(moveEv);
          }
        };
        window.addEventListener('pointermove', onMove, true);

        // If pointerup happens before threshold, cleanup the listener and release pointer capture.
        const onPointerUpBeforeStart = () => {
          window.removeEventListener('pointermove', onMove, true);
          try { handleEl.releasePointerCapture(ev.pointerId); } catch (e) {}
        };
        handleEl.addEventListener('pointerup', onPointerUpBeforeStart, { once: true });

        function startDrag(startEvent) {
          if (state.dragActive) return;
          state.dragActive = true;

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
          if (state.dropMarker) state.dropMarker.style.display = 'block';
          if (state.draggedMeta.domNode) {
            state.draggedMeta.domNode.style.opacity = '0.4';
          }
          window.addEventListener('pointermove', onPointerMove, true);
          window.addEventListener('pointerup', onPointerUp, true);
        }

        function onPointerMove(ev) {
          if (!state.dragActive) return;
          moveGhost(ev.clientX, ev.clientY);
          computeAndShowTarget(ev.clientX, ev.clientY);
          handleAutoScroll(ev.clientY);
        }

        function onPointerUp(ev) {
          if (!state.dragActive) {
            // pointerup before actual drag started: cleanup
            window.removeEventListener('pointermove', onPointerMove, true);
            window.removeEventListener('pointerup', onPointerUp, true);
            removeClickSuppressor();
            try { handleEl.releasePointerCapture(ev.pointerId); } catch (e) {}
            return;
          }
          if (state.targetParentArray && typeof state.targetIndex === 'number') {
            api.dropHere(state.draggedMeta, state.targetParentArray, state.targetIndex);
          } else {
            api.cancelDrag();
          }
          try { handleEl.releasePointerCapture(ev.pointerId); } catch (e) {}
          window.removeEventListener('pointermove', onPointerMove, true);
          window.removeEventListener('pointerup', onPointerUp, true);
        }
      };

      // pointerdown for mouse/pen - passive:true is fine since we won't call preventDefault.
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

      try {
        console.debug('calling render() and scheduleSave() after successful drop');
        state.options.render();
        state.options.scheduleSave();
      } catch (e) {
        console.error('drag.dropHere: error calling render/scheduleSave', e);
      }
    },

    cancelDrag() {
      console.debug('cancelDrag invoked');
      this._cleanupVisuals();
      removeClickSuppressor();
      state.justDropped = false;
    },

    // visual cleanup only
    _cleanupVisuals() {
      if (state.ghostEl && state.ghostEl.parentNode) state.ghostEl.parentNode.removeChild(state.ghostEl);
      if (state.dropMarker) state.dropMarker.style.display = 'none';
      if (state.draggedMeta && state.draggedMeta.domNode) state.draggedMeta.domNode.style.opacity = '';
      if (state.autoScrollTimer) { clearInterval(state.autoScrollTimer); state.autoScrollTimer = null; }

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
    ghost.style.position = 'fixed';
    ghost.style.pointerEvents = 'none';
    ghost.style.opacity = '0.7';
    ghost.style.zIndex = '9998';
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
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return;
    const lineEl = el.closest ? el.closest('.line, .section') : null;
    if (!lineEl) {
      const container = state.options.container;
      const rect = container.getBoundingClientRect();
      state.dropMarker.style.left = rect.left + 'px';
      state.dropMarker.style.width = rect.width + 'px';
      state.dropMarker.style.top = (rect.bottom - 2 + window.scrollY) + 'px';
      state.dropMarker.style.display = 'block';
      state.targetParentArray = typeof state.options.getRootItems === 'function' ? state.options.getRootItems() : null;
      state.targetIndex = state.targetParentArray ? state.targetParentArray.length : null;
      console.debug('computeAndShowTarget: over container (end)', { targetParentArray: describeArray(state.targetParentArray), targetIndex: state.targetIndex });
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
        console.debug('computeAndShowTarget: on .line', { lineItem: describeNode(lineEl._item), parentArray: describeArray(parentArray), targetIndex: insertIndex });
        return;
      }
    }

    if (lineEl.classList.contains('section')) {
      const header = lineEl.querySelector('.section-header') || lineEl;
      const section = header && header._section;
      if (section) {
        state.targetParentArray = section.items;
        state.targetIndex = 0;
        const headerRect = header.getBoundingClientRect();
        state.dropMarker.style.left = headerRect.left + 'px';
        state.dropMarker.style.width = headerRect.width + 'px';
        state.dropMarker.style.top = (headerRect.bottom + window.scrollY) + 'px';
        state.dropMarker.style.display = 'block';
        console.debug('computeAndShowTarget: on .section', { section: describeNode(section), targetParentArray: describeArray(state.targetParentArray), targetIndex: state.targetIndex });
        return;
      }
    }

    state.dropMarker.style.display = 'none';
    state.targetParentArray = null;
    state.targetIndex = null;
  }

  function handleAutoScroll(clientY) {
    const container = state.options.container;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const margin = state.options.autoScroll.margin;
    const speed = state.options.autoScroll.speed;
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

  window.drag = api;
})();
