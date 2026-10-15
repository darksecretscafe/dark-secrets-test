// Messenger side tab v3 — small edge handle, aligned reveal, mobile tap support.
(function () {
  const widget = document.querySelector('.messenger-widget');
  const link = widget && widget.querySelector('.floating-messenger');
  if (!widget || !link) return;
  let timer;
  let expanded = false;
  const close = () => {
    clearTimeout(timer);
    expanded = false;
    widget.classList.remove('is-expanded');
  };
  const open = (autoClose) => {
    clearTimeout(timer);
    expanded = true;
    widget.classList.add('is-expanded');
    if (autoClose) timer = setTimeout(close, 5000);
  };
  // Show the aligned help prompt briefly after load.
  setTimeout(() => open(true), 3000);
  // On touch devices, first tap opens the handle; second tap opens Messenger.
  link.addEventListener('click', (event) => {
    if (!expanded) {
      event.preventDefault();
      open(true);
    }
  });
  widget.addEventListener('mouseenter', () => open(false));
  widget.addEventListener('mouseleave', close);
  link.addEventListener('focus', () => open(false));
  link.addEventListener('blur', () => { if (!widget.matches(':hover')) close(); });
})();
