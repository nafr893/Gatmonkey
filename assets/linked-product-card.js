/**
 * Linked Product Card
 * Handles variant selection, add-to-cart, and inline quantity controls.
 */

(function () {
  'use strict';

  function init() {
    document.querySelectorAll('.skre-lpc').forEach(initBlock);
  }

  /** @param {HTMLElement} block */
  function initBlock(block) {
    initCarousel(block);
    block.querySelectorAll('.skre-lpc__card').forEach(initCard);
  }

  /**
   * Hybrid carousel:
   * - Mobile (<750px): native overflow-x scroll + snap (no layout risk in single-column)
   * - Desktop (≥750px): transform-based, overflow:hidden clips cards — no scroll container,
   *   no column blowout risk
   * @param {HTMLElement} block
   */
  function initCarousel(block) {
    const track   = /** @type {HTMLElement|null} */ (block.querySelector('[data-lpc-track]'));
    const cards   = /** @type {NodeListOf<HTMLElement>} */ (block.querySelectorAll('.skre-lpc__card'));
    const prevBtn = /** @type {HTMLButtonElement|null} */ (block.querySelector('[data-lpc-prev]'));
    const nextBtn = /** @type {HTMLButtonElement|null} */ (block.querySelector('[data-lpc-next]'));
    if (!track || !cards.length) return;

    let currentIndex = 0;
    let cardPx = 0;
    let gapPx  = 0;

    function goTo(index) {
      currentIndex = Math.max(0, Math.min(index, cards.length - 1));
      track.style.transform = `translateX(-${currentIndex * (cardPx + gapPx)}px)`;
      if (prevBtn) prevBtn.disabled = currentIndex === 0;
      if (nextBtn) nextBtn.disabled = currentIndex === cards.length - 1;
    }

    function applyDesktop() {
      // CSS sets the card width via flex-basis (38rem / max-width: 100%).
      // Read the rendered pixel value from the first card after CSS applies so the
      // transform step stays in sync without overriding the CSS-driven width.
      gapPx  = parseFloat(getComputedStyle(track).columnGap) || 12;
      cardPx = cards[0].getBoundingClientRect().width;
      goTo(currentIndex);
    }

    function applyMobile() {
      track.style.transform = '';
    }

    function update() {
      if (window.innerWidth >= 750) {
        applyDesktop();
      } else {
        applyMobile();
      }
    }

    // Desktop arrow navigation
    prevBtn?.addEventListener('click', () => goTo(currentIndex - 1));
    nextBtn?.addEventListener('click', () => goTo(currentIndex + 1));

    // Mobile: sync arrow state with native scroll (arrows are hidden on mobile but keep state clean)
    track.addEventListener('scroll', () => {
      if (window.innerWidth >= 750) return;
      const atStart = track.scrollLeft <= 4;
      const atEnd   = track.scrollLeft >= track.scrollWidth - track.clientWidth - 4;
      if (prevBtn) prevBtn.disabled = atStart;
      if (nextBtn) nextBtn.disabled = atEnd;
    }, { passive: true });

    update();
    new ResizeObserver(update).observe(block);
  }

  /** @param {HTMLElement} card */
  function initCard(card) {
    const variantBtns = card.querySelectorAll('[data-lpc-variant-btn]');
    const addBtn      = /** @type {HTMLButtonElement} */ (card.querySelector('[data-lpc-add-btn]'));
    const qtyRow      = card.querySelector('[data-lpc-qty-row]');
    const qtyValue    = card.querySelector('[data-lpc-qty-value]');
    const addedPrice  = card.querySelector('[data-lpc-added-price]');
    const priceEl     = card.querySelector('[data-lpc-price]');
    const labelSpan   = card.querySelector('[data-lpc-selected-label] span');
    const minusBtn    = card.querySelector('[data-lpc-qty-minus]');
    const plusBtn     = card.querySelector('[data-lpc-qty-plus]');
    const removeBtn   = card.querySelector('[data-lpc-remove]');
    const moreInfoLink = card.querySelector('.skre-lpc__more-info');
    const infoPanel   = card.querySelector('[data-lpc-info-panel]');
    const infoClose   = card.querySelector('[data-lpc-info-close]');

    // ── More info panel ────────────────────────────────────────────
    if (moreInfoLink && infoPanel) {
      moreInfoLink.addEventListener('click', (e) => {
        e.preventDefault();
        infoPanel.classList.add('skre-lpc__info-panel--open');
        infoPanel.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
      });
    }
    if (infoClose && infoPanel) {
      infoClose.addEventListener('click', () => {
        infoPanel.classList.remove('skre-lpc__info-panel--open');
        infoPanel.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
      });
    }

    // ── Variant selection ──────────────────────────────────────────
    variantBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        variantBtns.forEach((b) => {
          b.classList.remove('skre-lpc__variant-btn--selected');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('skre-lpc__variant-btn--selected');
        btn.setAttribute('aria-pressed', 'true');

        if (priceEl)    priceEl.firstChild.textContent = btn.dataset.variantPrice || '';
        if (labelSpan)  labelSpan.textContent = btn.dataset.variantTitle || '';
        if (addBtn)     addBtn.dataset.selectedVariant = btn.dataset.variantId || '';

        // If item is already in cart (qty row visible), update added price too
        if (addedPrice) addedPrice.textContent = btn.dataset.variantPrice || '';
      });
    });

    // ── ADD + ──────────────────────────────────────────────────────
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const variantId = addBtn.dataset.selectedVariant;
        if (!variantId) return;

        addBtn.disabled = true;

        cartAdd(variantId)
          .then((cart) => {
            // Store the server-assigned line key so remove/change works immediately
            const item = cart.items?.find((i) => String(i.variant_id) === String(variantId));
            if (item) addBtn.dataset.lineKey = item.key;
            if (qtyValue)   qtyValue.textContent = '1';
            if (addedPrice) addedPrice.textContent = getPriceLabel(card, variantId);
            showQtyRow(qtyRow, addBtn);
            notifyCart(cart);
          })
          .catch(() => {
            addBtn.disabled = false;
          });
      });
    }

    // ── Quantity − ─────────────────────────────────────────────────
    if (minusBtn) {
      minusBtn.addEventListener('click', () => {
        const current = parseInt(qtyValue?.textContent || '1', 10);
        const next = current - 1;
        if (next <= 0) {
          triggerRemove(card, addBtn, qtyRow, qtyValue);
        } else {
          updateQty(card, addBtn, qtyValue, next);
        }
      });
    }

    // ── Quantity + ─────────────────────────────────────────────────
    if (plusBtn) {
      plusBtn.addEventListener('click', () => {
        const current = parseInt(qtyValue?.textContent || '1', 10);
        updateQty(card, addBtn, qtyValue, current + 1);
      });
    }

    // ── Remove ─────────────────────────────────────────────────────
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        triggerRemove(card, addBtn, qtyRow, qtyValue);
      });
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────

  function showQtyRow(qtyRow, addBtn) {
    if (qtyRow) {
      qtyRow.classList.add('skre-lpc__qty-row--visible');
      qtyRow.setAttribute('aria-hidden', 'false');
    }
    if (addBtn) addBtn.style.display = 'none';
  }

  function hideQtyRow(qtyRow, addBtn) {
    if (qtyRow) {
      qtyRow.classList.remove('skre-lpc__qty-row--visible');
      qtyRow.setAttribute('aria-hidden', 'true');
    }
    if (addBtn) {
      addBtn.style.display = '';
      addBtn.disabled = false;
    }
  }

  /** @param {HTMLElement} card @param {HTMLButtonElement} addBtn @param {Element|null} qtyRow @param {Element|null} qtyValue */
  function triggerRemove(card, addBtn, qtyRow, qtyValue) {
    if (!addBtn) return;
    cartChange(addBtn, 0).then((cart) => {
      delete addBtn.dataset.lineKey;
      if (qtyValue) qtyValue.textContent = '1';
      hideQtyRow(qtyRow, addBtn);
      notifyCart(cart);
    });
  }

  /** @param {HTMLElement} card @param {HTMLButtonElement} addBtn @param {Element|null} qtyValue @param {number} qty */
  function updateQty(card, addBtn, qtyValue, qty) {
    if (!addBtn) return;
    cartChange(addBtn, qty).then((cart) => {
      if (qtyValue) qtyValue.textContent = String(qty);
      notifyCart(cart);
    });
  }

  /** @param {HTMLElement} card @param {string} variantId */
  function getPriceLabel(card, variantId) {
    const btn = card.querySelector(`[data-lpc-variant-btn][data-variant-id="${variantId}"]`);
    if (btn) return btn.dataset.variantPrice || '';
    const priceEl = card.querySelector('[data-lpc-price]');
    return priceEl?.firstChild?.textContent?.trim() || '';
  }

  /** @param {HTMLElement|null} ctx */
  // ── Cart API ─────────────────────────────────────────────────────

  function cartAdd(variantId) {
    return fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ id: Number(variantId), quantity: 1 }),
    })
      .then((r) => { if (!r.ok) throw new Error('add-failed'); return r.json(); })
      .then(() => fetch('/cart.js').then((r) => r.json()));
  }

  /** @param {HTMLButtonElement} addBtn @param {number} quantity */
  function cartChange(addBtn, quantity) {
    // Use the real line key captured when the item was added; fall back to colon-key format
    const key = addBtn.dataset.lineKey || (addBtn.dataset.selectedVariant + ':');
    return fetch('/cart/change.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ id: key, quantity }),
    }).then((r) => r.json());
  }

  function notifyCart(cart) {
    // Suppress cart drawer auto-open — dispatch the event without triggering it to slide open
    const drawer = document.querySelector('cart-drawer-component');
    const hadAutoOpen = drawer?.hasAttribute('auto-open');
    if (hadAutoOpen) drawer.removeAttribute('auto-open');

    document.dispatchEvent(
      Object.assign(new Event('cart:update', { bubbles: true }), {
        detail: {
          resource: cart,
          sourceId: 'linked-product-card',
          data: { itemCount: cart.item_count },
        },
      })
    );

    // Restore immediately — dispatchEvent is synchronous so handlers have already run
    if (hadAutoOpen) drawer.setAttribute('auto-open', '');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
