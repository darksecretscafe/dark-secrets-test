'use strict';
// TEST admin only: keep delivery summary before payment verification.
(() => {
  const root = document.getElementById('orders');
  if (!root) return;
  let scheduled = false;
  function arrange() {
    scheduled = false;
    for (const card of root.querySelectorAll('.ordercard')) {
      const delivery = card.querySelector('.ds-delivery-panel');
      const verification = card.querySelector('.ds-verify-panel');
      const actions = card.querySelector('.actions');
      if (!delivery || !verification) continue;
      // Move only if necessary, preserving existing form values and event handlers.
      if (delivery.compareDocumentPosition(verification) & Node.DOCUMENT_POSITION_PRECEDING) {
        delivery.after(verification);
      }
      // Keep the order-action buttons after both panels.
      if (actions && (actions.compareDocumentPosition(verification) & Node.DOCUMENT_POSITION_FOLLOWING)) {
        verification.after(actions);
      }
    }
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(arrange);
  }
  const observer = new MutationObserver(schedule);
  observer.observe(root, { childList: true, subtree: true });
  schedule();
})();
