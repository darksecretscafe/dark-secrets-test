const cart = new Map();
const MAX_QTY = 15;
const BOTTLE_FEE = 15;
const OAT_FEE = 30;
const OAT_ELIGIBLE = new Set(['Cafe Latte','Spanish Latte','White Chocolate Mocha','Caramel Macchiato','Matcha Latte','Hot Chocolate']);
const peso = n => `₱${n}`;
const items = [...document.querySelectorAll('.menu-item')];
const ctaCount = document.getElementById('ctaCount');
const ctaSummary = document.getElementById('ctaSummary');
const modal = document.getElementById('orderModal');
const lines = document.getElementById('orderLines');
const modalTotal = document.getElementById('modalTotal');
const deliveryFields = document.getElementById('deliveryFields');
let pinLocation = null;

// Each cart entry is one exact drink configuration. Quantities never share packaging state.
const cartKey = (name, packaging, oatMilk) => JSON.stringify([name, packaging, !!oatMilk]);
const unitPrice = i => i.price + (i.packaging === 'Take Away Bottle' ? BOTTLE_FEE : 0) + (i.oatMilk ? OAT_FEE : 0);
const itemTotal = i => unitPrice(i) * i.qty;
const totals = () => { let count=0,total=0;cart.forEach(i=>{count+=i.qty;total+=itemTotal(i)});return {count,total}; };
const escapeHtml = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const customizer=document.getElementById('customizeModal');
const customName=document.getElementById('customName');
const customPack=document.getElementById('customPack');
const customOat=document.getElementById('customOat');
const customQty=document.getElementById('customQty');
const customPrice=document.getElementById('customPrice');
let selectedDrink=null, selectedQty=1;
function refreshCustomizer(){
  customQty.textContent=selectedQty;
  document.getElementById('customMinus').disabled=selectedQty<=1;
  document.getElementById('customPlus').disabled=selectedQty>=MAX_QTY;
  const bottle=customPack.value==='Take Away Bottle';
  customPrice.textContent=peso((selectedDrink.price+(bottle?BOTTLE_FEE:0)+(customOat.checked?OAT_FEE:0))*selectedQty);
}
function openCustomizer(el){
  selectedDrink={name:el.dataset.name,price:Number(el.dataset.price)};
  selectedQty=1;customName.textContent=selectedDrink.name;
  customPack.value='Regular Cup';customOat.checked=false;
  document.getElementById('customOatRow').hidden=!OAT_ELIGIBLE.has(selectedDrink.name);
  refreshCustomizer();customizer.classList.add('open');customizer.setAttribute('aria-hidden','false');
  document.body.style.overflow='hidden';
}
function closeCustomizer(){customizer.classList.remove('open');customizer.setAttribute('aria-hidden','true');document.body.style.overflow=modal.classList.contains('open')?'hidden':'';}
items.forEach(el=>el.querySelector('.add-btn').addEventListener('click',()=>openCustomizer(el)));
document.querySelectorAll('[data-custom-close]').forEach(el=>el.addEventListener('click',closeCustomizer));
customPack.addEventListener('change',refreshCustomizer);
customOat.addEventListener('change',refreshCustomizer);
document.getElementById('customMinus').onclick=()=>{selectedQty=Math.max(1,selectedQty-1);refreshCustomizer()};
document.getElementById('customPlus').onclick=()=>{selectedQty=Math.min(MAX_QTY,selectedQty+1);refreshCustomizer()};
document.getElementById('customAdd').onclick=()=>{
  if(!selectedDrink)return;
  const packaging=customPack.value,oatMilk=OAT_ELIGIBLE.has(selectedDrink.name)&&customOat.checked;
  const key=cartKey(selectedDrink.name,packaging,oatMilk);
  const current=cart.get(key);
  const existing=Array.from(cart.values()).filter(i=>i.name===selectedDrink.name).reduce((n,i)=>n+i.qty,0);
  if(existing+selectedQty>MAX_QTY){document.getElementById('customError').textContent=`Maximum ${MAX_QTY} per drink. You already have ${existing}.`;return;}
  cart.set(key,{name:selectedDrink.name,price:selectedDrink.price,packaging,oatMilk,qty:(current?.qty||0)+selectedQty});
  document.getElementById('customError').textContent='';closeCustomizer();updateUI();
};
function updateUI(){
  const {count,total}=totals();ctaCount.textContent=count;
  ctaSummary.textContent=count?`${count} item${count===1?'':'s'} • ${peso(total)}`:'Select drinks above, then complete the checkout details.';
  items.forEach(el=>{
    const n=Array.from(cart.values()).filter(i=>i.name===el.dataset.name).reduce((sum,i)=>sum+i.qty,0);
    el.querySelector('.add-btn').textContent=n?`+ ADD MORE (${n})`:'+ ADD';
  });
  if(modal.classList.contains('open'))renderOrder();
}
function changeQty(key,delta){
  const i=cart.get(key);if(!i)return;
  if(delta>0){const existing=Array.from(cart.values()).filter(x=>x.name===i.name).reduce((n,x)=>n+x.qty,0);if(existing>=MAX_QTY)return;}
  i.qty+=delta;if(i.qty<=0)cart.delete(key);else cart.set(key,i);
  updateUI();
}
function renderOrder(){
  lines.innerHTML='';
  cart.forEach((i,key)=>{
    const row=document.createElement('div');row.className='order-line';
    const name=escapeHtml(i.name),pack=escapeHtml(i.packaging);
    const existing=Array.from(cart.values()).filter(x=>x.name===i.name).reduce((n,x)=>n+x.qty,0);
    row.innerHTML=`<div><div class="order-line-name">${name}</div><div class="order-line-price">${pack}${i.oatMilk?' · Sub Oat Milk (+₱30)':''}</div><div class="order-line-price">${peso(unitPrice(i))} each · ${peso(itemTotal(i))}</div></div><div class="qty"><button type="button" data-act="minus" aria-label="Remove one">−</button><b>${i.qty}</b><button type="button" data-act="plus" aria-label="Add one" ${existing>=MAX_QTY?'disabled':''}>+</button></div>`;
    row.querySelector('[data-act="minus"]').onclick=()=>changeQty(key,-1);
    row.querySelector('[data-act="plus"]').onclick=()=>changeQty(key,1);
    lines.appendChild(row);
  });
  const {total,count}=totals();modalTotal.textContent=total;
  document.getElementById('messengerOrder').disabled=count===0;
  document.getElementById('placeOrder').disabled=!(window.DS_CHECKOUT?.enabled&&count>0);
  if(!count)lines.innerHTML='<p style="text-align:center;color:#776a60;padding:18px 0">Your order is empty.</p>';
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
 const d=checkoutData(),{total}=totals();
 const out=['Hi Dark Secrets! I’d like to order:',''];
 cart.forEach(i=>out.push(`• ${i.qty}× ${i.name} (${i.packaging}${i.oatMilk?' · Sub Oat Milk':''}) — ${peso(itemTotal(i))}`));
 out.push('',`Total: ${peso(total)}`,`Name: ${d.name||'-'}`,`Mobile: ${d.phone||'-'}`,`Order Method: ${d.method}`,`Payment: ${d.payment||'-'}`);
 out.push(`Address: ${d.address||'-'}`);if(d.landmark)out.push(`Landmark: ${d.landmark}`);
 if(d.pin)out.push(`Pin: https://www.google.com/maps?q=${d.pin.lat},${d.pin.lng}`);
 if(d.notes)out.push(`Notes: ${d.notes}`);
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

let submitBusy = false;
let pendingOrder = null;

function getOrderAttempt(payload) {
  const fingerprint = JSON.stringify(payload);

  if (!pendingOrder || pendingOrder.fingerprint !== fingerprint) {
    pendingOrder = {
      fingerprint,
      idempotencyKey: crypto.randomUUID()
    };
  }

  return pendingOrder.idempotencyKey;
}
function orderItemsForBackend(){
 return Array.from(cart.values()).map(i=>({name:i.name,packaging:i.packaging,quantity:i.qty,oatMilk:i.oatMilk}));
}
let turnstileWidgetId=null;
function getTurnstileToken(){
 if(!window.turnstile || turnstileWidgetId===null)return '';
 return window.turnstile.getResponse(turnstileWidgetId)||'';
}
function initTurnstile(){
 if(!window.DS_CHECKOUT?.enabled)return;
 if(!window.DS_CHECKOUT.siteKey || window.DS_CHECKOUT.siteKey.includes('REPLACE'))return;
 if(!window.turnstile){setTimeout(initTurnstile,200);return;}
 turnstileWidgetId=window.turnstile.render('#turnstileMount',{
  sitekey:window.DS_CHECKOUT.siteKey,action:'order_submit',theme:'auto'
 });
}
initTurnstile();
document.getElementById('placeOrder').onclick=async()=>{
 const cfg=window.DS_CHECKOUT;
 if(!cfg?.enabled || submitBusy || !totals().count || !validateCheckout())return;
 const status=document.getElementById('submitStatus');
 const token=getTurnstileToken();
 if(!token){status.textContent='Please complete the verification before placing your order.';return;}
 const d=checkoutData(), btn=document.getElementById('placeOrder');
  const orderPayload = {
  name: d.name,
  phone: d.phone,
  address: d.address,
  landmark: d.landmark,
  notes: d.notes,
  payment: d.payment,
  pin: {
    lat: Number(d.pin.lat),
    lng: Number(d.pin.lng)
  },
  items: orderItemsForBackend()
};

const idempotencyKey = getOrderAttempt(orderPayload);
 submitBusy=true;btn.disabled=true;status.textContent='Submitting your order…';
 try{
  const response=await fetch(`${window.DS_SUPABASE_URL}/functions/v1/submit-order`,{
   method:'POST',headers:{'Content-Type':'application/json'},
   body: JSON.stringify({
  ...orderPayload,
  idempotencyKey,
  turnstileToken: token
})
  });
  const result=await response.json();
  if(!response.ok || !result.order_number)throw new Error(result.error||'Could not save order.');
  status.textContent='';
pendingOrder = null;
showSavedConfirmation(result.order_number);
 }catch(error){
  status.textContent='Order was not confirmed. '+(error?.message||'Please try again.');
 }finally{
  submitBusy=false;btn.disabled=!(cfg?.enabled && totals().count);
  if(window.turnstile && turnstileWidgetId!==null)window.turnstile.reset(turnstileWidgetId);
 }
};
async function showSavedConfirmation(orderNumber){
  if(!totals().count || !validateCheckout()) return;
  const d=checkoutData(), {total}=totals();
  const card=document.getElementById('confirmationCard');
  const esc=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let itemHtml='';cart.forEach(i=>{
    itemHtml+=`<div class="summary-item"><span>${i.qty}× ${esc(i.name)}<small class="summary-addon"><br>↳ ${esc(i.packaging)}${i.oatMilk?' · Sub Oat Milk':''}</small></span><strong>${peso(itemTotal(i))}</strong></div>`;
  });
  const deliveryHtml=`<div class="summary-section summary-address"><strong>Delivery Address</strong><span>${esc(d.address)}</span></div>${d.landmark?`<div><span>Landmark</span><strong>${esc(d.landmark)}</strong></div>`:''}${d.pin?`<div><span>GPS Pin</span><strong>${esc(d.pin.lat)}, ${esc(d.pin.lng)}</strong></div>`:''}`;
  card.innerHTML=`<div><span>Order Number</span><strong>${esc(orderNumber)}</strong></div><div><span>Customer</span><strong>${esc(d.name)}</strong></div><div><span>Mobile</span><strong>${esc(d.phone)}</strong></div><div class="summary-section"><strong>Items</strong>${itemHtml}</div><div><span>Total</span><strong>${peso(total)}</strong></div><div><span>Order Method</span><strong>${d.method}</strong></div><div><span>Payment</span><strong>${d.payment}</strong></div>${deliveryHtml}${d.notes?`<div class="summary-section summary-address"><strong>Notes</strong><span>${esc(d.notes)}</span></div>`:''}`;
  document.querySelector('#orderConfirmation .phase-badge').textContent='ORDER SAVED';
  document.querySelector('#orderConfirmation h3').textContent='Your order has been received.';
  document.querySelector('#orderConfirmation > p').textContent='Your order was saved successfully. Please keep your order number for reference. Payment is not yet verified.';
  document.getElementById('newTestOrder').textContent='CREATE ANOTHER TEST ORDER';
  document.getElementById('checkoutForm').style.display='none';
  document.getElementById('orderConfirmation').classList.add('show');
  document.querySelector('.order-sheet').scrollTo({top:0,behavior:'smooth'});
};

document.getElementById('newTestOrder').onclick=()=>{
  pendingOrder = null;
  cart.clear(); updateUI();
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

// Checkout label follows TEST-only configuration.
if (window.DS_CHECKOUT?.enabled) {
  document.querySelector('.checkout-heading span').textContent = 'TEST CHECKOUT';
  document.querySelector('.checkout-note').textContent = 'TEST ENVIRONMENT: orders are saved to the development database. Do not submit real customer orders.';
  document.getElementById('placeOrder').textContent = 'PLACE TEST ORDER';
}
