const cart = new Map();
const MAX_QTY = 15;
const BOTTLE_FEE = 15;
const peso = n => `₱${n}`;
const items = [...document.querySelectorAll('.menu-item')];
const ctaCount = document.getElementById('ctaCount');
const ctaSummary = document.getElementById('ctaSummary');
const modal = document.getElementById('orderModal');
const lines = document.getElementById('orderLines');
const modalTotal = document.getElementById('modalTotal');
const deliveryFields = document.getElementById('deliveryFields');
let pinLocation = null;

items.forEach(el => {
  const addBtn = el.querySelector('.add-btn');
  const controls = document.createElement('div');
  controls.className = 'menu-qty';
  controls.hidden = true;
  controls.innerHTML = '<button type="button" class="menu-minus" aria-label="Remove one">−</button><b class="menu-count">0</b><button type="button" class="menu-plus" aria-label="Add one">+</button>';
  addBtn.insertAdjacentElement('afterend', controls);

  const addOne = () => {
    const name = el.dataset.name, price = Number(el.dataset.price);
    const current = cart.get(name) || {name, price, qty:0, isDrink:el.dataset.drink==='true', regularQty:0, bottleQty:0};
    if(current.qty >= MAX_QTY) return;
    current.qty++;
    if(current.isDrink) current.regularQty++;
    cart.set(name,current);
    updateUI();
  };
  addBtn.addEventListener('click', addOne);
  controls.querySelector('.menu-plus').addEventListener('click', addOne);
  controls.querySelector('.menu-minus').addEventListener('click', () => changeQty(el.dataset.name,-1));
});

function itemTotal(i){return i.isDrink ? i.price*i.regularQty+(i.price+BOTTLE_FEE)*i.bottleQty : i.price*i.qty;}
function totals(){
  let count=0,total=0;
  cart.forEach(i=>{count+=i.qty;total+=itemTotal(i)});
  return {count,total};
}
function updateUI(){
  const {count,total}=totals();
  ctaCount.textContent=count;
  ctaSummary.textContent=count ? `${count} item${count===1?'':'s'} • ${peso(total)}` : 'Select drinks above, then complete the checkout details.';
  items.forEach(el=>{
    const q=cart.get(el.dataset.name)?.qty||0;
    const btn=el.querySelector('.add-btn');
    const controls=el.querySelector('.menu-qty');
    const plus=controls.querySelector('.menu-plus');
    btn.hidden=q>0;
    btn.textContent='+ ADD';
    controls.hidden=q===0;
    controls.querySelector('.menu-count').textContent=q;
    plus.disabled=q>=MAX_QTY;
    plus.setAttribute('aria-disabled', q>=MAX_QTY ? 'true' : 'false');
    plus.title=q>=MAX_QTY ? `Maximum ${MAX_QTY} per item` : '';
  });
  if(modal.classList.contains('open')) renderOrder();
}
function renderOrder(){
  lines.innerHTML='';
  cart.forEach(i=>{
    if(!i.qty)return;
    const row=document.createElement('div'); row.className='order-line';
    if(i.isDrink){
      row.innerHTML=`<div class="split-packaging"><div class="order-line-name">${i.name}</div><div class="order-line-price">${i.qty} item${i.qty===1?'':'s'} • ${peso(itemTotal(i))}</div><div class="packaging-rows"><div class="packaging-row"><div><strong>Regular Cup</strong><small>${peso(i.price)} each</small></div><div class="qty"><button type="button" data-pack="regular" data-act="minus" aria-label="Remove regular cup" ${i.regularQty===0?'disabled':''}>−</button><b>${i.regularQty}</b><button type="button" data-pack="regular" data-act="plus" aria-label="Add regular cup" ${i.qty>=MAX_QTY?'disabled':''}>+</button></div></div><div class="packaging-row"><div><strong>Take Away Bottle</strong><small>${peso(i.price+BOTTLE_FEE)} each (+₱${BOTTLE_FEE})</small></div><div class="qty"><button type="button" data-pack="bottle" data-act="minus" aria-label="Remove bottle" ${i.bottleQty===0?'disabled':''}>−</button><b>${i.bottleQty}</b><button type="button" data-pack="bottle" data-act="plus" aria-label="Add bottle" ${i.qty>=MAX_QTY && !(i.regularQty===1 && i.bottleQty===0)?'disabled':''}>+</button></div></div></div></div>`;
      row.querySelectorAll('[data-act]').forEach(btn=>btn.onclick=()=>changePackagingQty(i.name,btn.dataset.pack,btn.dataset.act==='plus'?1:-1));
    }else{
      row.innerHTML=`<div><div class="order-line-name">${i.name}</div><div class="order-line-price">${peso(i.price)} each • ${peso(itemTotal(i))}</div></div><div class="qty"><button type="button" data-act="minus" aria-label="Remove one">−</button><b>${i.qty}</b><button type="button" data-act="plus" aria-label="Add one" ${i.qty>=MAX_QTY?'disabled':''}>+</button></div>`;
      row.querySelector('[data-act="minus"]').onclick=()=>changeQty(i.name,-1);
      row.querySelector('[data-act="plus"]').onclick=()=>changeQty(i.name,1);
    }
    lines.appendChild(row);
  });
  const {total,count}=totals(); modalTotal.textContent=total;
  document.getElementById('messengerOrder').disabled=count===0;
  document.getElementById('placeOrder').disabled=true;
  if(!count) lines.innerHTML='<p style="text-align:center;color:#776a60;padding:18px 0">Your order is empty.</p>';
}
function changePackagingQty(name,pack,delta){
  const i=cart.get(name); if(!i||!i.isDrink)return;
  const key=pack==='bottle'?'bottleQty':'regularQty';
  // First bottle selection converts the sole default regular cup instead of adding a drink.
  if(pack==='bottle' && delta>0 && i.regularQty===1 && i.bottleQty===0){
    i.regularQty=0; i.bottleQty=1;
  }else{
    if((delta>0 && i.qty>=MAX_QTY) || (delta<0 && i[key]===0))return;
    i[key]+=delta;
  }
  i.qty=i.regularQty+i.bottleQty;
  if(!i.qty)cart.delete(name); else cart.set(name,i);
  updateUI();
}
function changeQty(name,delta){
  const i=cart.get(name); if(!i)return;
  if(i.isDrink){changePackagingQty(name,'regular',delta);return;}
  if(delta>0 && i.qty>=MAX_QTY)return;
  i.qty+=delta;
  if(i.qty<=0)cart.delete(name); else cart.set(name,i);
  updateUI();
}
function openModal(){
  document.getElementById('checkoutForm').style.display='block';
  document.getElementById('orderConfirmation').classList.remove('show');
  renderOrder();modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
}
function closeModal(){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');document.body.style.overflow=''}
document.getElementById('openOrder').onclick=openModal;
document.querySelectorAll('[data-close]').forEach(x=>x.onclick=closeModal);

document.querySelectorAll('input[name="paymentMethod"]').forEach(r=>r.addEventListener('change',()=>document.getElementById('paymentField').classList.remove('has-error')));
['customerName','customerPhone','deliveryAddress'].forEach(id=>document.getElementById(id).addEventListener('input',e=>e.target.closest('label')?.classList.remove('has-error')));
const phoneInput=document.getElementById('customerPhone');
phoneInput.addEventListener('input',()=>{phoneInput.value=phoneInput.value.replace(/\D/g,'').slice(0,11);});
const notes=document.getElementById('orderNotes'), notesCount=document.getElementById('notesCount');
notes.addEventListener('input',()=>notesCount.textContent=`${notes.value.length} / 150`);

function checkoutData(){
  return {
    name:document.getElementById('customerName').value.trim(),
    phone:phoneInput.value.trim(),
    method:'Delivery',
    address:document.getElementById('deliveryAddress').value.trim(),
    landmark:document.getElementById('deliveryLandmark').value.trim(),
    payment:document.querySelector('input[name="paymentMethod"]:checked')?.value || '',
    notes:notes.value.trim(),
    pin:pinLocation
  };
}
function validateCheckout(){
  const d=checkoutData(); let ok=true;
  const checks=[['nameField',!!d.name],['phoneField',/^\d{11}$/.test(d.phone)],['paymentField',!!d.payment]];
  checks.push(['addressField',!!d.address]);
  const pinValid=!!(d.pin && Number.isFinite(Number(d.pin.lat)) && Number.isFinite(Number(d.pin.lng)));
  document.getElementById('pinError').hidden=pinValid;
  if(!pinValid) ok=false;
  checks.forEach(([id,valid])=>{document.getElementById(id).classList.toggle('has-error',!valid);if(!valid)ok=false});
  document.querySelector('#phoneField .field-error').textContent = d.phone && !/^\d{11}$/.test(d.phone) ? 'Please enter exactly 11 digits.' : 'Please enter your mobile number.';
  if(!ok) (document.querySelector('.has-error') || (!pinValid && document.getElementById('useLocation')))?.scrollIntoView({behavior:'smooth',block:'center'});
  return ok;
}
function orderText(){
  const d=checkoutData(); const {total}=totals();
  const out=['Hi Dark Secrets! I’d like to order:',''];
  cart.forEach(i=>{if(i.isDrink){if(i.regularQty)out.push(`• ${i.regularQty}× ${i.name} (Regular Cup) — ${peso(i.regularQty*i.price)}`);if(i.bottleQty)out.push(`• ${i.bottleQty}× ${i.name} (Take Away Bottle +₱${BOTTLE_FEE}) — ${peso(i.bottleQty*(i.price+BOTTLE_FEE))}`);}else out.push(`• ${i.qty}× ${i.name} — ${peso(itemTotal(i))}`);});
  out.push('',`Total: ${peso(total)}`,`Name: ${d.name || '-'}`,`Mobile: ${d.phone || '-'}`,`Order Method: ${d.method || '-'}`,`Payment: ${d.payment || '-'}`);
  if(d.method==='Delivery') {out.push(`Address: ${d.address || '-'}`); if(d.landmark) out.push(`Landmark: ${d.landmark}`); if(d.pin) out.push(`Pin: https://www.google.com/maps?q=${d.pin.lat},${d.pin.lng}`);}
  if(d.notes) out.push(`Notes: ${d.notes}`);
  return out.join('\n');
}
async function copyText(text){
  try{await navigator.clipboard.writeText(text);return true}catch(e){
    const t=document.createElement('textarea');t.value=text;t.style.position='fixed';t.style.opacity='0';document.body.appendChild(t);t.select();
    const ok=document.execCommand('copy');t.remove();return ok;
  }
}

const useLocationBtn=document.getElementById('useLocation');
useLocationBtn.onclick=()=>{
  const status=document.getElementById('locationStatus'), link=document.getElementById('viewPin');
  link.hidden=true; link.removeAttribute('href'); pinLocation=null;
  document.getElementById('pinError').hidden=true;
  if(!navigator.geolocation){status.textContent='Location is not supported on this browser.';return;}
  const proceed=window.confirm('For an accurate delivery pin, please turn ON your phone Location/GPS first. Then tap OK and allow location access when your browser asks.');
  if(!proceed){status.textContent='Turn on Location/GPS, then tap USE MY LOCATION again.';return;}
  useLocationBtn.disabled=true; useLocationBtn.textContent='GETTING LOCATION…'; status.textContent='Waiting for your exact location… Please allow location access.';
  navigator.geolocation.getCurrentPosition(pos=>{
    pinLocation={lat:pos.coords.latitude.toFixed(6),lng:pos.coords.longitude.toFixed(6),accuracy:Math.round(pos.coords.accuracy)};
    status.textContent=`Pin captured ✓ Approx. accuracy: ${pinLocation.accuracy} m`;
    link.href=`https://www.google.com/maps?q=${pinLocation.lat},${pinLocation.lng}`; link.hidden=false;
    document.getElementById('pinError').hidden=true;
    useLocationBtn.textContent='📍 UPDATE MY LOCATION'; useLocationBtn.disabled=false;
  },err=>{
    link.hidden=true; link.removeAttribute('href'); pinLocation=null;
    if(err.code===1){status.textContent='Location permission was denied. Allow Location for this site, then try again.';}
    else if(err.code===2){status.textContent='Your location could not be detected. Make sure Location/GPS is ON, then try again.';window.alert('Location/GPS may be turned off or unavailable. Please turn on Location/GPS, then tap USE MY LOCATION again.');}
    else{status.textContent='Location request timed out. Make sure Location/GPS is ON and try again.';}
    useLocationBtn.textContent='📍 USE MY LOCATION'; useLocationBtn.disabled=false;
  },{enableHighAccuracy:true,timeout:12000,maximumAge:0});
};

document.getElementById('placeOrder').onclick=()=>{
  if(!totals().count || !validateCheckout()) return;
  const d=checkoutData(), {total}=totals();
  const card=document.getElementById('confirmationCard');
  const esc=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let itemHtml=''; cart.forEach(i=>{if(i.isDrink){if(i.regularQty)itemHtml+=`<div class="summary-item"><span>${i.regularQty}× ${esc(i.name)}<small class="summary-addon"><br>↳ Regular Cup</small></span><strong>${peso(i.regularQty*i.price)}</strong></div>`;if(i.bottleQty)itemHtml+=`<div class="summary-item"><span>${i.bottleQty}× ${esc(i.name)}<small class="summary-addon"><br>↳ Take Away Bottle +₱${BOTTLE_FEE} each</small></span><strong>${peso(i.bottleQty*(i.price+BOTTLE_FEE))}</strong></div>`;}else itemHtml+=`<div class="summary-item"><span>${i.qty}× ${esc(i.name)}</span><strong>${peso(itemTotal(i))}</strong></div>`;});
  let deliveryHtml='';
  if(d.method==='Delivery') deliveryHtml=`<div class="summary-section summary-address"><strong>Delivery Details</strong><span>${esc(d.address)}</span>${d.landmark?`<span><br>Landmark: ${esc(d.landmark)}</span>`:''}${d.pin?`<br><a href="https://www.google.com/maps?q=${d.pin.lat},${d.pin.lng}" target="_blank" rel="noopener">📍 View exact pin location ↗</a>`:'<br><span>No pin location added</span>'}</div>`;
  card.innerHTML=`<div><span>Customer</span><strong>${esc(d.name)}</strong></div><div><span>Mobile</span><strong>${esc(d.phone)}</strong></div><div class="summary-section"><strong>Items</strong>${itemHtml}</div><div><span>Total</span><strong>${peso(total)}</strong></div><div><span>Order Method</span><strong>${d.method}</strong></div><div><span>Payment</span><strong>${d.payment}</strong></div>${deliveryHtml}${d.notes?`<div class="summary-section summary-address"><strong>Notes</strong><span>${esc(d.notes)}</span></div>`:''}`;
  document.getElementById('checkoutForm').style.display='none';
  document.getElementById('orderConfirmation').classList.add('show');
  document.querySelector('.order-sheet').scrollTo({top:0,behavior:'smooth'});
};

document.getElementById('newTestOrder').onclick=()=>{
  document.getElementById('checkoutForm').style.display='block';
  document.getElementById('orderConfirmation').classList.remove('show');
  document.querySelector('.order-sheet').scrollTo({top:0,behavior:'smooth'});
};

document.getElementById('messengerOrder').onclick=async()=>{
  if(!totals().count || !validateCheckout())return;
  const btn=document.getElementById('messengerOrder');
  const text=orderText(); const original=btn.textContent;
  btn.textContent='COPYING ORDER…';
  const copied=await copyText(text);
  btn.textContent=copied?'COPIED! OPENING MESSENGER…':'OPENING MESSENGER…';
  setTimeout(()=>btn.textContent=original,1800);
  window.location.assign('https://m.me/DarkSecretsCoffee');
};
updateUI();
