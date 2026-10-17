(() => {
  'use strict';
  const token = new URLSearchParams(location.hash.slice(1)).get('token');
  const msg = document.getElementById('trackingMessage');
  const stages = document.getElementById('trackingStages');
  const statuses = ['Pending', 'Accepted', 'Preparing', 'Ready', 'Out for Delivery', 'Completed'];
  const payment = document.getElementById('trackingPayment');
  const money = value => '₱' + Number(value).toLocaleString('en-PH', {minimumFractionDigits:2,maximumFractionDigits:2});
  let busy = false, finished = false;
  function line(label, value, strong = false) {
    const row = document.createElement('div'); row.className = 'tracking-payment-row';
    const left = document.createElement('span'); left.textContent = label;
    const right = document.createElement(strong ? 'strong' : 'span'); right.textContent = value;
    row.append(left, right); return row;
  }
  function show(data) {
    document.getElementById('trackingNumber').textContent = data.order_number;
    document.getElementById('trackingStatus').textContent = 'Status: ' + data.status;
    const declined = data.status === 'Declined';
    const idx = statuses.indexOf(data.status);
    stages.replaceChildren();
    for (let i = 0; i < statuses.length; i++) {
      const li = document.createElement('li'); li.textContent = statuses[i];
      if (!declined && i <= idx) li.className = 'done';
      stages.append(li);
    }
    msg.textContent = declined ? 'This order was declined. Contact support for assistance.' : idx === -1 ? 'Order status is being updated.' : 'Latest status shown below.';
    document.getElementById('trackingUpdated').textContent = data.updated_at ? 'Last updated: ' + new Date(data.updated_at).toLocaleString() : '';
    payment.replaceChildren();
    if (typeof data.total_amount === 'number' && Number.isFinite(data.total_amount)) {
      const title = document.createElement('h2'); title.textContent = 'Delivery & payment'; payment.append(title);
      payment.append(line('Drinks subtotal', money(data.total_amount)));
      if (data.delivery_fee !== null && typeof data.delivery_fee === 'number' && Number.isFinite(data.delivery_fee) && typeof data.final_total === 'number' && Number.isFinite(data.final_total)) {
        payment.append(line((data.courier || 'Courier') + ' fee', money(data.delivery_fee)));
        payment.append(line('Final amount to pay', money(data.final_total), true));
      } else {
        const note = document.createElement('p'); note.textContent = 'Delivery fee is being calculated. Please wait for the final payment amount.'; payment.append(note);
      }
      const status = document.createElement('p'); status.className = 'tracking-payment-status';
      status.textContent = 'Payment status: ' + (data.payment_status || 'Awaiting Delivery Fee'); payment.append(status);
      if (data.payment_status === 'Awaiting Payment') {
        const note = document.createElement('p'); note.textContent = 'Please wait for payment instructions. Do not send payment until the payment details are provided.'; payment.append(note);
      }
      payment.hidden = false;
    } else { payment.hidden = true; }
    finished = declined || data.status === 'Completed' || data.status === 'Cancelled';
  }
  async function refresh() {
    if (busy || !/^[a-f0-9]{64}$/.test(token || '')) {
      if (!token || !/^[a-f0-9]{64}$/.test(token)) msg.textContent = 'Invalid or missing private tracking link.';
      return;
    }
    busy = true;
    try {
      const r = await fetch(window.DS_SUPABASE_URL + '/functions/v1/track-order', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({token}), cache:'no-store'
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Tracking temporarily unavailable');
      show(data);
    } catch (e) {
      msg.textContent = e.message === 'Order not found' ? 'Order not found. Check your private tracking link.' : 'Could not refresh: ' + e.message;
    } finally { busy = false; }
  }
  document.getElementById('refreshTracking').addEventListener('click', refresh);
  refresh();
  setInterval(() => { if (!document.hidden && !finished) refresh(); }, 20000);
})();
