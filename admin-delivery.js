'use strict';
// TEST admin delivery-fee extension. Existing admin.js remains unchanged.
(() => {
  const url = window.DS_SUPABASE_URL;
  const key = window.DS_SUPABASE_KEY;
  if (!window.supabase || !url || !key) return;
  const db = window.supabase.createClient(url, key);
  const root = document.getElementById('orders');
  const dashboard = document.getElementById('dashboard');
  if (!root || !dashboard) return;
  const money = n => '₱' + Number(n).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  const node = (tag, label, className) => {
    const el = document.createElement(tag);
    if (label !== undefined) el.textContent = String(label);
    if (className) el.className = className;
    return el;
  };
  let fetching = false;
  let queued = false;
  let saving = false;
  const notify = (message, error = false) => {
    const target = document.getElementById('message');
    if (target) { target.textContent = message; target.className = error ? 'error' : ''; }
  };
  function appendFeePanel(card, order) {
    if (card.querySelector('.ds-delivery-panel')) return;
    const panel = node('section', undefined, 'ds-delivery-panel');
    panel.append(node('h4', 'Delivery & payment'));
    panel.append(node('div', 'Payment status: ' + (order.payment_status || 'Not set'), 'ds-delivery-note'));
    const summary = node('div', undefined, 'ds-delivery-summary');
    summary.append(node('span', 'Drinks subtotal'), node('strong', money(order.total_amount)));
    panel.append(summary);
    if (order.delivery_fee !== null) {
      const courierLine = node('div', undefined, 'ds-delivery-summary');
      courierLine.append(node('span', (order.courier || 'Courier') + ' fee'), node('strong', money(order.delivery_fee)));
      panel.append(courierLine);
      const total = node('div', undefined, 'ds-delivery-summary ds-delivery-final');
      total.append(node('span', 'Final total'), node('strong', money(order.final_total ?? Number(order.total_amount) + Number(order.delivery_fee))));
      panel.append(total);
    } else {
      panel.append(node('div', 'Delivery fee awaiting confirmation', 'ds-delivery-note'));
    }
    if (!['Paid', 'Cancelled'].includes(order.payment_status) && !['Completed', 'Cancelled', 'Declined'].includes(order.status)) {
      const form = node('form', undefined, 'ds-delivery-form');
      const courierLabel = node('label', 'Courier');
      const courier = node('select');
      for (const name of ['Lalamove', 'GrabExpress']) courier.add(new Option(name, name));
      courier.value = order.courier || 'Lalamove';
      courierLabel.append(courier);
      const feeLabel = node('label', 'Delivery fee (₱)');
      const fee = node('input');
      fee.type = 'number'; fee.min = '0'; fee.max = '10000'; fee.step = '0.01'; fee.required = true;
      fee.placeholder = 'Courier quotation';
      fee.value = order.delivery_fee === null ? '' : String(order.delivery_fee);
      feeLabel.append(fee);
      const preview = node('div', 'Final total preview: —', 'ds-delivery-note');
      const updatePreview = () => {
        const amount = Number(fee.value);
        preview.textContent = fee.value.trim() !== '' && Number.isFinite(amount) && amount >= 0
          ? 'Final total preview: ' + money(Number(order.total_amount) + amount)
          : 'Final total preview: —';
      };
      fee.addEventListener('input', updatePreview);
      updatePreview();
      const save = node('button', order.delivery_fee === null ? 'Confirm delivery fee' : 'Update delivery fee');
      save.type = 'submit';
      form.append(courierLabel, feeLabel, preview, save);
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const amount = Number(fee.value);
        if (saving || fee.value.trim() === '' || !Number.isFinite(amount) || amount < 0 || amount > 10000) {
          notify('Enter a valid delivery fee between ₱0 and ₱10,000.', true); return;
        }
        if (!confirm(`Set ${order.order_number} delivery fee to ${money(amount)} via ${courier.value}?`)) return;
        saving = true; save.disabled = true;
        notify('Saving delivery fee…');
        try {
          const {error} = await db.rpc('admin_set_delivery_fee', {
            p_order_id: order.id, p_courier: courier.value, p_delivery_fee: amount
          });
          if (error) throw error;
          // Update the visible panel immediately after the server confirms saving.
          // Also refresh the original order list so its payment status stays in sync.
          const {data: updated, error: readError} = await db.from('orders')
            .select('id,order_number,total_amount,delivery_fee,final_total,payment_status,courier,status')
            .eq('id', order.id).single();
          if (readError) throw readError;
          if (card.isConnected) {
            panel.remove();
            appendFeePanel(card, updated);
          }
          notify(`Delivery fee saved for ${order.order_number}.`);
          document.activeElement?.blur?.();
          document.getElementById('refresh')?.click();
        } catch (err) {
          notify('Could not save delivery fee: ' + (err.message || 'Unknown error'), true);
        } finally { saving = false; save.disabled = false; }
      });
      panel.append(form);
    } else {
      panel.append(node('div', 'Delivery fee locked for this order.', 'ds-delivery-note'));
    }
    const actions = card.querySelector('.actions');
    if (actions) card.insertBefore(panel, actions);
    else card.append(panel);
  }
  async function refreshPanels() {
    if (fetching || saving || dashboard.hidden) return;
    const cards = [...root.querySelectorAll('.ordercard')];
    const missing = cards.filter(c => !c.querySelector('.ds-delivery-panel'));
    if (!missing.length) return;
    fetching = true;
    try {
      const {data: {user}, error: authError} = await db.auth.getUser();
      if (authError || !user) return;
      const {data: admin, error: adminError} = await db.rpc('is_admin');
      if (adminError || admin !== true) return;
      const numbers = [...new Set(missing.map(c => c.querySelector('h3')?.textContent?.trim()).filter(Boolean))];
      if (!numbers.length) return;
      const {data, error} = await db.from('orders')
        .select('id,order_number,total_amount,delivery_fee,final_total,payment_status,courier,status')
        .in('order_number', numbers);
      if (error) throw error;
      const byNumber = new Map((data || []).map(o => [o.order_number, o]));
      for (const card of missing) {
        if (!card.isConnected) continue;
        const order = byNumber.get(card.querySelector('h3')?.textContent?.trim());
        if (order) appendFeePanel(card, order);
      }
    } catch (err) {
      console.error('Delivery panel unavailable:', err);
      notify('Delivery controls could not load. ' + (err.message || ''), true);
    } finally { fetching = false; }
  }
  const observer = new MutationObserver(mutations => {
    if (mutations.some(m => [...m.addedNodes].some(n => n.nodeType === 1 && (n.matches?.('.ordercard') || n.querySelector?.('.ordercard'))))) {
      if (!queued) {
        queued = true;
        setTimeout(() => { queued = false; refreshPanels(); }, 100);
      }
    }
  });
  observer.observe(root, {childList: true});
  document.getElementById('refresh')?.addEventListener('click', () => setTimeout(refreshPanels, 1000));
  setInterval(refreshPanels, 15000);
  setTimeout(refreshPanels, 1000);
})();
