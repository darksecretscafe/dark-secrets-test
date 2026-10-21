(() => {
  'use strict';
  const token = new URLSearchParams(location.hash.slice(1)).get('token');
  const msg = document.getElementById('trackingMessage');
  const stages = document.getElementById('trackingStages');
  const payment = document.getElementById('trackingPayment');
  const cancellation = document.getElementById('trackingCancellation');
  const refundPanel = document.getElementById('trackingRefund');
  let cancellationSubmitted = false;
  let cancellationPending = false;
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
    if (!['Pending', 'Accepted'].includes(data.status)) {
      cancellation.replaceChildren();
      delete cancellation.dataset.orderNumber;
      return;
    }
    // Do not destroy a form while the customer is typing during 20-second polling.
    const formKey = data.order_number + ':' + (data.payment_status === 'Paid' ? 'paid' : 'unpaid');
    if (cancellation.dataset.formKey === formKey && cancellation.childElementCount) return;
    cancellation.dataset.formKey = formKey;
    cancellation.replaceChildren();
    cancellation.append(el('h2', 'Need to cancel your order?'));
    cancellation.append(el('p', 'You can request cancellation before preparation starts. Your order is not cancelled until our team approves it.'));
    if (cancellationSubmitted) {
      cancellation.append(el('p', 'Cancellation request sent. Waiting for admin review.'));
      return;
    }
    const isPaid = data.payment_status === 'Paid';
    const button = el('button', 'REQUEST CANCELLATION');
    button.type = 'button';
    const form = el('form');
    form.hidden = true;
    const reasonLabel = el('label', 'Reason for cancellation (10–500 characters)');
    const reason = el('textarea');
    reason.required = true;
    reason.minLength = 10;
    reason.maxLength = 500;
    reason.rows = 3;
    reason.placeholder = 'Tell us why you need to cancel';
    reasonLabel.append(reason);
    form.append(reasonLabel);

    let destination, method, accountName, mobile;
    if (isPaid) {
      form.append(el('h3', 'Refund account details'));
      form.append(el('p', 'Enter the GCash or Maya account where you want to receive the refund. Our team will verify the details before transferring any money.'));
      const makeSelect = (title, options) => {
        const label = el('label', title);
        const select = el('select');
        select.required = true;
        for (const [value, name] of options) {
          const option = el('option', name);
          option.value = value;
          select.append(option);
        }
        label.append(select);
        form.append(label);
        return select;
      };
      destination = makeSelect('Refund destination', [['Original', 'Original payment account'], ['Different', 'Different account']]);
      const originalMethod = ['GCash', 'Maya'].includes(data.payment_method) ? data.payment_method : '';
      method = makeSelect('Refund method', [['', 'Select GCash or Maya'], ['GCash', 'GCash'], ['Maya', 'Maya']]);
      method.value = originalMethod;
      destination.addEventListener('change', () => {
        if (destination.value === 'Original' && originalMethod) method.value = originalMethod;
        updateWarning();
      });
      method.addEventListener('change', updateWarning);
      const nameLabel = el('label', 'Refund account holder full name');
      accountName = el('input');
      accountName.type = 'text';
      accountName.required = true;
      accountName.minLength = 2;
      accountName.maxLength = 120;
      accountName.autocomplete = 'name';
      accountName.placeholder = 'Name registered to the wallet';
      nameLabel.append(accountName);
      form.append(nameLabel);
      const mobileLabel = el('label', 'Refund GCash/Maya mobile number');
      mobile = el('input');
      mobile.type = 'tel';
      mobile.required = true;
      mobile.inputMode = 'numeric';
      mobile.autocomplete = 'off';
      mobile.maxLength = 11;
      mobile.pattern = '09[0-9]{9}';
      mobile.placeholder = '09XXXXXXXXX';
      mobileLabel.append(mobile);
      form.append(mobileLabel);
      const warning = el('p', '', 'ds-refund-warning');
      function updateWarning() {
        warning.textContent = destination.value === 'Different'
          ? 'A different refund account needs additional verification and approval from the original payer.'
          : 'The owner will verify that this is the original payment account. Your order contact number may be different.';
      }
      updateWarning();
      form.append(warning);
      form.append(el('p', 'Never provide your GCash/Maya PIN, OTP or password. Refunds are processed manually after approval.'));
    }

    const feedback = el('p');
    feedback.setAttribute('role', 'status');
    const submit = el('button', 'SUBMIT REQUEST');
    submit.type = 'submit';
    const close = el('button', 'BACK');
    close.type = 'button';
    close.addEventListener('click', () => { form.hidden = true; button.hidden = false; });
    button.addEventListener('click', () => { button.hidden = true; form.hidden = false; reason.focus(); });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (cancellationPending) return;
      const value = reason.value.trim();
      if (value.length < 10 || value.length > 500) {
        feedback.textContent = 'Please enter a reason between 10 and 500 characters.';
        return;
      }
      const body = { token, reason: value };
      if (isPaid) {
        const name = accountName.value.trim();
        const phone = mobile.value.trim();
        if (!['GCash', 'Maya'].includes(method.value) || name.length < 2 || name.length > 120 || !/^09[0-9]{9}$/.test(phone)) {
          feedback.textContent = 'Please enter valid refund account details and an 11-digit mobile number starting with 09.';
          return;
        }
        if (destination.value === 'Original' && ['GCash', 'Maya'].includes(data.payment_method) && method.value !== data.payment_method) {
          feedback.textContent = 'For the original payment account, use the original payment method.';
          return;
        }
        Object.assign(body, {
          refund_method: method.value,
          refund_account_name: name,
          refund_mobile: phone,
          refund_destination_type: destination.value,
        });
      }
      if (!confirm('Send your cancellation request for ' + data.order_number + '? The team must approve it.')) return;
      cancellationPending = true;
      submit.disabled = true;
      close.disabled = true;
      feedback.textContent = 'Sending cancellation request…';
      try {
        const response = await fetch(window.DS_SUPABASE_URL + '/functions/v1/request-cancellation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          cache: 'no-store'
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.ok !== true) throw new Error(result.error || 'Could not submit request (' + response.status + ')');
        cancellationSubmitted = true;
        cancellation.replaceChildren();
        cancellation.append(el('h2', 'Cancellation request sent'), el('p', 'Waiting for admin review. If approved, our team will contact you to verify refund details before sending any refund.'));
      } catch (error) {
        feedback.textContent = 'Request failed: ' + error.message;
        submit.disabled = false;
        close.disabled = false;
      } finally {
        cancellationPending = false;
      }
    });
    form.append(submit, close, feedback);
    cancellation.append(button, form);
  }
  function showRefund(data) {
    if (!refundPanel) return;
    refundPanel.replaceChildren();
    const refund = data.refund;
    if (!refund || !['Refund Required','Processing','Refunded'].includes(refund.status)) return;
    refundPanel.append(el('h2', 'Refund status'));
    const stages = ['Refund Required','Processing','Refunded'];
    const names = ['Approved · Awaiting processing','Processing · Manual transfer in progress','Refunded · Transfer confirmed'];
    const current = stages.indexOf(refund.status);
    const steps = el('ol', undefined, 'ds-refund-progress');
    stages.forEach((status, i) => {
      const li = el('li', names[i]);
      if (i <= current) li.className = 'done';
      if (i === current) li.setAttribute('aria-current','step');
      steps.append(li);
    });
    refundPanel.append(steps);
    if (typeof refund.amount === 'number' && Number.isFinite(refund.amount)) refundPanel.append(el('p', 'Refund amount: ' + money(refund.amount), 'ds-refund-total'));
    if (refund.status === 'Refunded' && refund.refunded_at) {
      const date = new Date(refund.refunded_at);
      if (!Number.isNaN(date.getTime())) refundPanel.append(el('p', 'Transfer confirmed: ' + date.toLocaleString('en-PH')));
    } else refundPanel.append(el('p', 'Please check this page for updates. Contact support if you have questions.'));
  }
  // All timeline timestamps are displayed in Philippine Time.
  function pht(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true
    }).format(date) + ' PHT';
  }
  function statusTime(data, status) {
    if (status === 'Pending') return pht(data.created_at);
    const history = Array.isArray(data.status_history) ? data.status_history : [];
    const entry = history.find(item => item && item.status === status && item.changed_at);
    return entry ? pht(entry.changed_at) : '';
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
      const time = statusTime(data, statuses[i]);
      if (time) li.append(el('small', ' · ' + time, 'ds-tracking-time'));
      stages.append(li);
    }
    if (declined) {
      const time = statusTime(data, data.status);
      const li = el('li', data.status + (time ? ' · ' + time : ''));
      li.className = 'done';
      stages.append(li);
    }
    msg.textContent = declined ? 'This order was cancelled or declined. Contact support for assistance.' : idx === -1 ? 'Order status is being updated.' : 'Latest status shown below.';
    const verified = data.payment_status === 'Paid' ? pht(data.payment_verified_at) : '';
    document.getElementById('trackingUpdated').textContent =
      verified ? 'Payment verified: ' + verified : '';
    payment.replaceChildren();
    if (typeof data.total_amount === 'number' && Number.isFinite(data.total_amount)) {
      payment.append(el('h2', 'Delivery & payment'));
      payment.append(line('Drinks subtotal', money(data.total_amount)));
      const ready = data.delivery_fee !== null && typeof data.delivery_fee === 'number' && Number.isFinite(data.delivery_fee) && typeof data.final_total === 'number' && Number.isFinite(data.final_total);
      if (ready) {
        payment.append(line((data.courier || 'Courier') + ' fee', money(data.delivery_fee)));
        payment.append(line('Final amount to pay', money(data.final_total), true));
      } else if (!declined) {
        payment.append(el('p', 'Delivery fee is being calculated. Please wait for the final payment amount.'));
      }
      if (declined && data.payment_status !== 'Paid') {
        payment.append(el('p', 'Order cancelled or declined. No payment required.', 'tracking-payment-status'));
      } else {
        const paymentStatus = el('p', 'Payment status: ' + (data.payment_status || 'Awaiting Delivery Fee'), 'tracking-payment-status');
        paymentStatus.style.fontSize = '16px';
        paymentStatus.style.fontWeight = '700';
        paymentStatus.style.lineHeight = '1.5';
        payment.append(paymentStatus);
      }
      if (declined) {
        if (data.payment_status === 'Paid' && !data.refund) payment.append(el('p', 'Payment was confirmed. Contact support regarding any refund.'));
      } else if (ready && data.payment_status === 'Awaiting Payment' && data.status !== 'Completed') {
        addPaymentOptions(data);
      } else if (data.payment_status === 'Paid') {
        const paymentConfirmed = el('p', 'Payment confirmed. Thank you!');
        paymentConfirmed.style.fontSize = '15px';
        paymentConfirmed.style.lineHeight = '1.5';
        payment.append(paymentConfirmed);
      } else if (data.payment_status === 'Payment Submitted') {
        payment.append(el('p', 'Payment proof is awaiting verification.'));
      } else if (!ready) {
        payment.append(el('p', 'Please wait for final payment instructions.'));
      }
      payment.hidden = false;
    } else payment.hidden = true;
    showCancellation(data);
    showRefund(data);
    finished = data.status === 'Completed' || (declined && (!data.refund || data.refund.status === 'Refunded')); 
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
  setInterval(() => { if (!document.hidden && !finished) refresh(); }, 10000);
})();
