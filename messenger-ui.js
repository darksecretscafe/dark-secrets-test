// Test-only Messenger side tab. No order, checkout, or routing changes.
(function () {
  const tip = document.getElementById('messengerTip');
  const link = document.querySelector('.messenger-widget .floating-messenger');
  if (!tip || !link) return;
  let hideTimer;
  const hide = () => { clearTimeout(hideTimer); tip.classList.remove('visible'); };
  const show = (autoHide = true) => {
    clearTimeout(hideTimer);
    tip.classList.add('visible');
    if (autoHide) hideTimer = setTimeout(hide, 5000);
  };
  setTimeout(() => show(true), 3000);
  link.addEventListener('mouseenter', () => show(false));
  link.addEventListener('mouseleave', hide);
  link.addEventListener('focus', () => show(false));
  link.addEventListener('blur', hide);
})();
