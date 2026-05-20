/**
 * Linked Product Card
 * Handles variant selection and add-to-cart for standalone linked product card blocks.
 */

(function () {
  'use strict';

  function init() {
    document.querySelectorAll('.skre-lpc').forEach(initCard);
  }

  function initCard(card) {
    const variantBtns = card.querySelectorAll('[data-lpc-variant-btn]');
    const addBtn = /** @type {HTMLButtonElement|null} */ (card.querySelector('[data-lpc-add-btn]'));
    const priceEl = card.querySelector('[data-lpc-price]');
    const selectedLabelSpan = card.querySelector('[data-lpc-selected-label] span');

    variantBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        variantBtns.forEach((b) => {
          b.classList.remove('skre-lpc__variant-btn--selected');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('skre-lpc__variant-btn--selected');
        btn.setAttribute('aria-pressed', 'true');

        if (priceEl) priceEl.textContent = btn.dataset.variantPrice || '';
        if (selectedLabelSpan) selectedLabelSpan.textContent = btn.dataset.variantTitle || '';
        if (addBtn) addBtn.dataset.selectedVariant = btn.dataset.variantId || '';
      });
    });

    if (addBtn) addBtn.addEventListener('click', () => addToCart(addBtn));
  }

  /** @param {HTMLButtonElement} btn */
  function addToCart(btn) {
    const variantId = btn.dataset.selectedVariant;
    if (!variantId) return;

    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = '...';

    fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ id: Number(variantId), quantity: 1 }),
    })
      .then((r) => {
        if (!r.ok) throw new Error('cart-add-failed');
        return r.json();
      })
      .then((item) => {
        btn.textContent = '✓';
        // Notify the theme's cart icon / drawer via the standard cart:update event
        return fetch('/cart.js')
          .then((r) => r.json())
          .then((cart) => {
            document.dispatchEvent(
              Object.assign(new Event('cart:update', { bubbles: true }), {
                detail: {
                  resource: cart,
                  sourceId: btn.closest('[data-block-id]')?.dataset.blockId || '',
                  data: {
                    itemCount: cart.item_count,
                    variantId: String(variantId),
                  },
                },
              })
            );
          });
      })
      .then(() => {
        setTimeout(() => {
          btn.textContent = originalLabel;
          btn.disabled = false;
        }, 1400);
      })
      .catch(() => {
        btn.textContent = originalLabel;
        btn.disabled = false;
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
