'use strict';
// TEST ONLY. Owner verification UI; Supabase RPC enforces authorization server-side.
(() => {
  const url = window.DS_SUPABASE_URL, key = window.DS_SUPABASE_KEY;
  const root = document.getElementById('orders');
  const dashboard = document.getElementById('dashboard');
  if (!window.supabase || !url || !key || !root || !dashboard) return;
  const db = window.supabase.createClient(url, key);
  const money = n => '₱' + Number(n).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  const el = (tag, value, cls) => {
    const e = document.createElement(tag);
    if (value !== undefined) e.textContent = String(value);
    if (cls) e.className = cls;
    return e;
  };
  const notify = (value, error = false) => {
    const target = document.getElementById('message');
    if (target) { target.textContent = value; target.className = error ? 'error' : ''; }
  };
  let loading = false, saving = false, queued = false;
  function panelFor(card, order) {
    if (card.querySelector('.ds-verify-panel')) return;
    const panel = el('section', undefined, 'ds-verify-panel');
    panel.append(el('h4', 'Payment verification'));
    if (order.payment_status === 'Paid') {
      panel.append(el('p', '✓ Payment verified', 'ds-verify-success'));
      if (order.payment_method) panel.append(el('p', 'Method: ' + order.payment_method));
      if (order.payment_reference) panel.append(el('p', 'Transaction reference: ' + order.payment_reference));
      if (order.payment_verified_at) panel.append(el('p', 'Verified: ' + new Date(order.payment_verified_at).toLocaleString('en-PH')));
    } else if (order.payment_status === 'Awaiting Payment' && order.final_total !== null && Number(order.final_total) > 0 && !['Completed', 'Cancelled', 'Declined'].includes(order.status)) {
      panel.append(el('p', 'Only confirm after checking the actual received transaction in your GCash or Maya account.', 'ds-verify-note'));
      panel.append(el('p', 'Expected payment: ' + money(order.final_total), 'ds-verify-amount'));
      const form = el('form', undefined, 'ds-verify-form');
      const methodLabel = el('label', 'Verified payment method');
      const method = el('select'); method.required = true;
      for (const name of ['GCash', 'Maya']) method.add(new Option(name, name));
      methodLabel.append(method);
      const referenceLabel = el('label', 'Transaction reference number');
      const reference = el('input'); reference.type = 'text'; reference.required = true;
      reference.minLength = 4; reference.maxLength = 100; reference.autocomplete = 'off';
      reference.placeholder = 'From actual payment transaction';
      referenceLabel.append(reference);
      const confirmLabel = el('label', undefined, 'ds-verify-check');
      const verified = el('input'); verified.type = 'checkbox'; verified.required = true;
      confirmLabel.append(verified, el('span', 'I checked the actual received payment and confirmed the amount and transaction reference.'));
      const save = el('button', 'Mark as Paid'); save.type = 'submit';
      form.append(methodLabel, referenceLabel, confirmLabel, save);
      form.addEventListener('submit', async event => {
        event.preventDefault();
        if (saving) return;
        const ref = reference.value.trim();
        if (!verified.checked || !/^[A-Za-z0-9][A-Za-z0-9 _./-]{3,99}$/.test(ref)) {
          notify('Enter a valid transaction reference (4–100 characters) and confirm verification.', true); return;
        }
        const confirmation = `VERIFY PAYMENT — TEST ONLY\n\nOrder: ${order.order_number}\nAmount: ${money(order.final_total)}\nMethod: ${method.value}\nReference: ${ref}\n\nHave you verified the payment in the actual ${method.value} account?\n\nMark as Paid cannot be undone using this form.`;
        if (!window.confirm(confirmation)) return;
        saving = true; save.disabled = true; notify('Verifying payment…');
        try {
          const { error } = await db.rpc('admin_verify_payment', {
            p_order_id: order.id,
            p_payment_method: method.value,
            p_payment_reference: ref
          });
          if (error) throw error;
          const { data: updated, error: readError } = await db.from('orders')
            .select('id,order_number,payment_status,payment_method,payment_reference,payment_verified_at,final_total,status')
            .eq('id', order.id).single();
          if (readError) throw readError;
          if (card.isConnected) { panel.remove(); panelFor(card, updated); }
          notify(`Payment verified for ${order.order_number}.`);
          document.activeElement?.blur?.();
          document.getElementById('refresh')?.click();
        } catch (error) {
          notify('Payment verification failed: ' + (error.message || 'Unknown error'), true);
        } finally { saving = false; save.disabled = false; }
      });
      panel.append(form);
    } else {
      panel.append(el('p', 'Verification available after the delivery fee is confirmed and the order is awaiting payment.', 'ds-verify-note'));
    }
    const actions = card.querySelector('.actions');
    if (actions) card.insertBefore(panel, actions); else card.append(panel);
  }
  async function loadMissing() {
    if (loading || saving || dashboard.hidden) return;
    const missing = [...root.querySelectorAll('.ordercard')].filter(c => !c.querySelector('.ds-verify-panel'));
    if (!missing.length) return;
    loading = true;
    try {
      const { data: { user }, error: authError } = await db.auth.getUser();
      if (authError || !user) return;
      const { data: admin, error: adminError } = await db.rpc('is_admin');
      if (adminError || admin !== true) return;
      const numbers = [...new Set(missing.map(c => c.querySelector('h3')?.textContent?.trim()).filter(Boolean))];
      if (!numbers.length) return;
      const { data, error } = await db.from('orders')
        .select('id,order_number,payment_status,payment_method,payment_reference,payment_verified_at,final_total,status')
        .in('order_number', numbers);
      if (error) throw error;
      const byNumber = new Map((data || []).map(o => [o.order_number, o]));
      for (const card of missing) {
        if (!card.isConnected) continue;
        const order = byNumber.get(card.querySelector('h3')?.textContent?.trim());
        if (order) panelFor(card, order);
      }
    } catch (error) {
      console.error('Payment verification panel unavailable:', error);
      notify('Payment verification controls could not load: ' + (error.message || ''), true);
    } finally { loading = false; }
  }
  const observer = new MutationObserver(mutations => {
    if (!mutations.some(m => [...m.addedNodes].some(n => n.nodeType === 1 && (n.matches?.('.ordercard') || n.querySelector?.('.ordercard'))))) return;
    if (!queued) { queued = true; setTimeout(() => { queued = false; loadMissing(); }, 120); }
  });
  observer.observe(root, { childList: true });
  document.getElementById('refresh')?.addEventListener('click', () => setTimeout(loadMissing, 900));
  setInterval(loadMissing, 15000);
  setTimeout(loadMissing, 1000);
})();
