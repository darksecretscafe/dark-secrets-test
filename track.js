(() => {
  'use strict';
  const token = new URLSearchParams(location.hash.slice(1)).get('token');
  const msg = document.getElementById('trackingMessage');
  const stages = document.getElementById('trackingStages');
  const payment = document.getElementById('trackingPayment');
  const cancellation = document.getElementById('trackingCancellation');
  let cancellationSubmitted = false;
  const statuses = ['Pending', 'Accepted', 'Preparing', 'Ready', 'Out for Delivery', 'Completed'];
  const money = value => '₱' + Number(value).toLocaleString('en-PH', {minimumFractionDigits:2,maximumFractionDigits:2});
  let busy = false, finished = false, selectedMethod = null;
  function el(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function line(label, value, strong = false) {
    const row = el('div', undefined, 'tracking-payment-row');
    row.append(el('span', label), el(strong ? 'strong' : 'span', value));
    return row;
  }
  function addPaymentOptions(data) {
    const box = el('section', undefined, 'ds-pay-options');
    box.append(el('h3', 'Choose payment method'));
    const buttons = el('div', undefined, 'ds-pay-methods');
    const detail = el('div', undefined, 'ds-pay-detail');
    for (const method of ['GCash', 'Maya']) {
      const button = el('button', method, 'ds-pay-method');
      button.type = 'button';
      button.setAttribute('aria-pressed', String(selectedMethod === method));
      button.addEventListener('click', () => { selectedMethod = method; showMethod(); });
      buttons.append(button);
    }
    function showMethod() {
      [...buttons.children].forEach(b => b.setAttribute('aria-pressed', String(b.textContent === selectedMethod)));
      detail.replaceChildren();
      if (!selectedMethod) { detail.append(el('p', 'Select GCash or Maya to view the payment QR.')); return; }
      detail.append(el('p', 'Pay exactly ' + money(data.final_total) + ' using ' + selectedMethod + '. Check the recipient in your payment app before sending.'));
      const img = el('img');
      img.src = selectedMethod === 'GCash' ? 'GCASH.jpg' : 'MAYA.jpg';
      img.alt = selectedMethod + ' payment QR code';
      img.loading = 'lazy';
      img.className = 'ds-pay-qr';
      detail.append(img);
      const controls = el('div', undefined, 'ds-pay-actions');
      const copy = el('button', 'Copy amount'); copy.type = 'button';
      copy.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(Number(data.final_total).toFixed(2)); copy.textContent = 'Amount copied!'; }
        catch { copy.textContent = 'Copy manually: ' + Number(data.final_total).toFixed(2); }
      });
      const download = el('a', 'Save QR image');
      download.href = img.src; download.download = selectedMethod + '-QR.jpg';
      controls.append(copy, download);
      detail.append(controls);
      detail.append(el('p', 'After payment, send your payment receipt or screenshot to our Messenger. Include order ' + data.order_number + '. Payment will remain unverified until our team confirms it.'));
      const messenger = el('a', 'Send payment proof via Messenger ↗', 'ds-pay-messenger');
      messenger.href = 'https://m.me/DarkSecretsCoffee';
      messenger.target = '_blank'; messenger.rel = 'noopener noreferrer';
      detail.append(messenger);
    }
    box.append(buttons, detail);
    showMethod();
    payment.append(box);
  }
  function showCancellation(data) {
    cancellation.replaceChildren();
    if (!['Pending', 'Accepted'].includes(data.status)) return;
    const title = el('h2', 'Need to cancel your order?');
    const info = el('p', 'You can request cancellation before preparation starts. Your order is not cancelled until the team approves your request.');
    cancellation.append(title, info);
    if (cancellationSubmitted) {
      cancellation.append(el('p', 'Cancellation request sent. Waiting for admin review. Refresh later for order updates.'));
      return;
    }
    const button = el('button', 'REQUEST CANCELLATION');
    button.type = 'button';
    const form = el('form');
    form.hidden = true;
    const label = el('label', 'Reason for cancellation (10–500 characters)');
    const reason = el('textarea');
    reason.required = true; reason.minLength = 10; reason.maxLength = 500;
    reason.rows = 3; reason.placeholder = 'Tell us why you need to cancel';
    label.append(reason);
    const feedback = el('p');
    feedback.setAttribute('role', 'status');
    const submit = el('button', 'SUBMIT REQUEST'); submit.type = 'submit';
    const close = el('button', 'BACK'); close.type = 'button';
    close.addEventListener('click', () => { form.hidden = true; button.hidden = false; });
    button.addEventListener('click', () => { button.hidden = true; form.hidden = false; reason.focus(); });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const value = reason.value.trim();
      if (value.length < 10 || value.length > 500) {
        feedback.textContent = 'Please enter a reason between 10 and 500 characters.';
        return;
      }
      if (!confirm('Send your cancellation request for ' + data.order_number + '? The team must approve it.')) return;
      submit.disabled = true; close.disabled = true;
      feedback.textContent = 'Sending cancellation request…';
      try {
        const response = await fetch(window.DS_SUPABASE_URL + '/functions/v1/request-cancellation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, reason: value }),
          cache: 'no-store'
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.success === false) throw new Error(result.error || 'Could not submit request (' + response.status + ')');
        cancellationSubmitted = true;
        showCancellation(data);
      } catch (error) {
        feedback.textContent = 'Request failed: ' + error.message;
        submit.disabled = false; close.disabled = false;
      }
    });
    form.append(label, submit, close, feedback);
    cancellation.append(button, form);
  }
  function show(data) {
    document.getElementById('trackingNumber').textContent = data.order_number;
    document.getElementById('trackingStatus').textContent = 'Status: ' + data.status;
    const declined = ['Declined', 'Cancelled'].includes(data.status);
    const idx = statuses.indexOf(data.status);
    stages.replaceChildren();
    for (let i = 0; i < statuses.length; i++) {
      const li = el('li', statuses[i]);
      if (!declined && i <= idx) li.className = 'done';
      stages.append(li);
    }
    msg.textContent = declined ? 'This order was cancelled or declined. Contact support for assistance.' : idx === -1 ? 'Order status is being updated.' : 'Latest status shown below.';
    document.getElementById('trackingUpdated').textContent = data.updated_at ? 'Last updated: ' + new Date(data.updated_at).toLocaleString() : '';
    payment.replaceChildren();
    if (typeof data.total_amount === 'number' && Number.isFinite(data.total_amount)) {
      payment.append(el('h2', 'Delivery & payment'));
      payment.append(line('Drinks subtotal', money(data.total_amount)));
      const ready = data.delivery_fee !== null && typeof data.delivery_fee === 'number' && Number.isFinite(data.delivery_fee) && typeof data.final_total === 'number' && Number.isFinite(data.final_total);
      if (ready) {
        payment.append(line((data.courier || 'Courier') + ' fee', money(data.delivery_fee)));
        payment.append(line('Final amount to pay', money(data.final_total), true));
      } else {
        payment.append(el('p', 'Delivery fee is being calculated. Please wait for the final payment amount.'));
      }
      payment.append(el('p', 'Payment status: ' + (data.payment_status || 'Awaiting Delivery Fee'), 'tracking-payment-status'));
      if (ready && data.payment_status === 'Awaiting Payment' && !declined && data.status !== 'Completed') {
        addPaymentOptions(data);
      } else if (data.payment_status === 'Paid') {
        payment.append(el('p', 'Payment confirmed. Thank you!'));
      } else if (data.payment_status === 'Payment Submitted') {
        payment.append(el('p', 'Payment proof is awaiting verification.'));
      } else if (!ready) {
        payment.append(el('p', 'Please wait for final payment instructions.'));
      }
      payment.hidden = false;
    } else payment.hidden = true;
    showCancellation(data);
    finished = declined || data.status === 'Completed';
  }
  async function refresh() {
    if (busy || !/^[a-f0-9]{64}$/.test(token || '')) {
      if (!/^[a-f0-9]{64}$/.test(token || '')) msg.textContent = 'Invalid or missing private tracking link.';
      return;
    }
    busy = true;
    try {
      const r = await fetch(window.DS_SUPABASE_URL + '/functions/v1/track-order', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({token}), cache:'no-store'
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
