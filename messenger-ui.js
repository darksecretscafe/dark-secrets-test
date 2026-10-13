// Test-only presentation behavior. Does not alter orders, checkout, or Messenger routing.
(function(){
  const tip=document.getElementById('messengerTip');
  if(!tip)return;
  let hideTimer;
  function show(){tip.classList.add('visible');clearTimeout(hideTimer);hideTimer=setTimeout(()=>tip.classList.remove('visible'),5000)}
  setTimeout(show,3000);
  const link=document.querySelector('.messenger-widget .floating-messenger');
  link?.addEventListener('mouseenter',()=>{clearTimeout(hideTimer);tip.classList.add('visible')});
  link?.addEventListener('mouseleave',()=>{tip.classList.remove('visible')});
  link?.addEventListener('focus',()=>{clearTimeout(hideTimer);tip.classList.add('visible')});
  link?.addEventListener('blur',()=>tip.classList.remove('visible'));
})();
