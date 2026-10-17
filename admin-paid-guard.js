'use strict';
// TEST-only UI safeguard. Database trigger remains the authority.
(() => {
  const root = document.getElementById('orders');
  if (!root) return;
  let queued = false;
  function update() {
    queued = false;
    for (const card of root.querySelectorAll('.ordercard')) {
      const paid = [...card.querySelectorAll('.meta')].some(n => n.textContent.trim() === 'Payment status: Paid');
      if (!paid) continue;
      for (const button of card.querySelectorAll('.actions button')) {
        if (button.textContent.trim() === 'Decline') button.remove();
      }
    }
  }
  function schedule() {
    if (queued) return;
    queued = true;
    queueMicrotask(update);
  }
  new MutationObserver(schedule).observe(root, {childList:true, subtree:true});
  schedule();
})();
