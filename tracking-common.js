// TEST only: private bearer tracking tokens are stored on this device.
(function(){
  const KEY='dsc-test-orders-v1';
  function list(){try{const a=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(a)?a.filter(x=>/^[a-f0-9]{64}$/.test(x.token)).slice(0,30):[]}catch{return []}}
  function makeUrl(token){return new URL('track.html#token='+encodeURIComponent(token),location.href).href}
  function saveOrder(o){if(!/^[a-f0-9]{64}$/.test(o.token))return;try{const a=[o,...list().filter(x=>x.token!==o.token)].slice(0,30);localStorage.setItem(KEY,JSON.stringify(a));}catch{} render()}
  function render(){const el=document.getElementById('myOrdersList');if(!el)return;const a=list();const count=document.getElementById('savedOrdersCount');if(count)count.textContent=a.length?'('+a.length+')':'';el.replaceChildren();if(!a.length){const p=document.createElement('p');p.textContent='No saved orders on this device yet.';el.append(p);return}for(const o of a){const d=document.createElement('div');d.className='saved-order';const b=document.createElement('strong');b.textContent=o.order_number||'Order';const link=document.createElement('a');link.href=makeUrl(o.token);link.textContent='TRACK ORDER ↗';d.append(b,link);el.append(d)}}
  window.DS_TRACKING={list,makeUrl,saveOrder};
  document.addEventListener('DOMContentLoaded',()=>{render();const modal=document.getElementById('myOrdersModal');document.getElementById('myOrdersBtn')?.addEventListener('click',()=>{render();modal.classList.add('open');modal.setAttribute('aria-hidden','false')});document.querySelectorAll('[data-my-orders-close]').forEach(e=>e.addEventListener('click',()=>{modal.classList.remove('open');modal.setAttribute('aria-hidden','true')}));});
})();
