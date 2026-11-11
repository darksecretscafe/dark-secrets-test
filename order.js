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
const customOat=document.getElementById('customOat');
const customPrice=document.getElementById('customPrice');
const customError=document.getElementById('customError');
const cupQty=document.getElementById('customCupQty');
const bottleQty=document.getElementById('customBottleQty');
let selectedDrink=null, editingQty={cup:0,bottle:0};
const editableKey = (packaging) => cartKey(selectedDrink.name,packaging,OAT_ELIGIBLE.has(selectedDrink.name)&&customOat.checked);
function loadCustomizerQuantities(){
  editingQty={cup:cart.get(editableKey('Regular Cup'))?.qty||0,bottle:cart.get(editableKey('Take Away Bottle'))?.qty||0};
  refreshCustomizer();
}
function refreshCustomizer(){
  const sum=editingQty.cup+editingQty.bottle;
  cupQty.textContent=editingQty.cup;
  bottleQty.textContent=editingQty.bottle;
  document.getElementById('customCupMinus').disabled=editingQty.cup===0;
  document.getElementById('customBottleMinus').disabled=editingQty.bottle===0;
  document.getElementById('customCupPlus').disabled=sum>=MAX_QTY;
  document.getElementById('customBottlePlus').disabled=sum>=MAX_QTY;
  const oat=OAT_ELIGIBLE.has(selectedDrink.name)&&customOat.checked?OAT_FEE:0;
  customPrice.textContent=peso(editingQty.cup*(selectedDrink.price+oat)+editingQty.bottle*(selectedDrink.price+BOTTLE_FEE+oat));
  document.getElementById('customAdd').textContent=Array.from(cart.values()).some(i=>i.name===selectedDrink.name)?'UPDATE CART':'ADD TO CART';
}
function openCustomizer(el){
  selectedDrink={name:el.dataset.name,price:Number(el.dataset.price)};
  document.getElementById('customName').textContent=selectedDrink.name;
  customOat.checked=false;
  document.getElementById('customOatRow').hidden=!OAT_ELIGIBLE.has(selectedDrink.name);
  customError.textContent='';
  loadCustomizerQuantities();
  customizer.classList.add('open');customizer.setAttribute('aria-hidden','false');
  document.body.style.overflow='hidden';
}
function closeCustomizer(){customizer.classList.remove('open');customizer.setAttribute('aria-hidden','true');document.body.style.overflow=modal.classList.contains('open')?'hidden':'';}
items.forEach(el=>el.querySelector('.add-btn').addEventListener('click',()=>openCustomizer(el)));
document.querySelectorAll('[data-custom-close]').forEach(el=>el.addEventListener('click',closeCustomizer));
// Switching oat-milk selection displays the existing quantities for that exact variant.
customOat.addEventListener('change',()=>{customError.textContent='';loadCustomizerQuantities()});
for(const [id,kind,delta] of [['customCupMinus','cup',-1],['customCupPlus','cup',1],['customBottleMinus','bottle',-1],['customBottlePlus','bottle',1]]){
  document.getElementById(id).onclick=()=>{
    const next=editingQty[kind]+delta;
    if(next<0||next>MAX_QTY||editingQty.cup+editingQty.bottle+delta>MAX_QTY)return;
    editingQty[kind]=next;refreshCustomizer();
  };
}
document.getElementById('customAdd').onclick=()=>{
  if(!selectedDrink)return;
  const oatMilk=OAT_ELIGIBLE.has(selectedDrink.name)&&customOat.checked;
  const otherQty=Array.from(cart.values()).filter(i=>i.name===selectedDrink.name&&i.oatMilk!==oatMilk).reduce((n,i)=>n+i.qty,0);
  if(otherQty+editingQty.cup+editingQty.bottle>MAX_QTY){
    customError.textContent=`Maximum ${MAX_QTY} per drink, including other milk options. You already have ${otherQty} in another option.`;return;
  }
  for(const [kind,packaging] of [['cup','Regular Cup'],['bottle','Take Away Bottle']]){
    const key=cartKey(selectedDrink.name,packaging,oatMilk), qty=editingQty[kind];
    if(qty===0)cart.delete(key);
    else cart.set(key,{name:selectedDrink.name,price:selectedDrink.price,packaging,oatMilk,qty});
  }
  customError.textContent='';closeCustomizer();updateUI();
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
  modal.classList.remove('confirmation-active');
  renderOrder();modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
}
function closeModal(){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');document.body.style.overflow=''}
document.getElementById('openOrder').onclick=openModal;
document.querySelectorAll('[data-close]').forEach(x=>x.onclick=closeModal);


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
    payment:'Pending', // Compatibility placeholder: backend must support deferred payment.
    notes:notes.value.trim(),
    pin:pinLocation
  };
}
function validateCheckout(){
  const d=checkoutData(); let ok=true;
  const checks=[['nameField',!!d.name],['phoneField',/^\d{11}$/.test(d.phone)]];
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
 out.push('',`Drinks subtotal: ${peso(total)}`,`Name: ${d.name||'-'}`,`Mobile: ${d.phone||'-'}`,`Order Method: ${d.method}`,'Payment: Awaiting delivery fee confirmation');
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
const CHECKOUT_ATTEMPT_KEY = 'dsc-production-checkout-attempt-v1';

function randomCheckoutCredential() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
async function getOrderAttempt(payload) {
  // Only a fingerprint and private retry credentials are stored, never customer details.
  const fingerprint = await sha256Hex(JSON.stringify(payload));
  if (!pendingOrder) {
    try { pendingOrder = JSON.parse(localStorage.getItem(CHECKOUT_ATTEMPT_KEY) || 'null'); }
    catch { pendingOrder = null; }
  }
  if (!pendingOrder || pendingOrder.fingerprint !== fingerprint ||
      !/^[a-f0-9]{64}$/.test(pendingOrder.credential || '') ||
      !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/.test(pendingOrder.idempotencyKey || '')) {
    pendingOrder = {
      fingerprint,
      idempotencyKey: crypto.randomUUID(),
      credential: randomCheckoutCredential()
    };
  }
  // Storage may be unavailable; in-memory retry still works in the current tab.
  try { localStorage.setItem(CHECKOUT_ATTEMPT_KEY, JSON.stringify(pendingOrder)); } catch {}
  return {
    idempotencyKey: pendingOrder.idempotencyKey,
    checkoutCredentialHash: await sha256Hex(pendingOrder.credential)
  };
}
function clearOrderAttempt() {
  pendingOrder = null;
  try { localStorage.removeItem(CHECKOUT_ATTEMPT_KEY); } catch {}
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

submitBusy=true;btn.disabled=true;status.textContent='Submitting your order…';
 try{
  const { idempotencyKey, checkoutCredentialHash } = await getOrderAttempt(orderPayload);
  const response=await fetch(`${window.DS_SUPABASE_URL}/functions/v1/submit-order`,{
   method:'POST',headers:{'Content-Type':'application/json'},
   body: JSON.stringify({
  ...orderPayload,
  idempotencyKey,
  checkoutCredentialHash,
  turnstileToken: token
})
  });
  const result=await response.json();
  if(!response.ok || !result.order_number || !/^[a-f0-9]{64}$/.test(result.tracking_token || ''))throw new Error(result.error||'Order confirmation incomplete. Retry the same order; do not create another.');
  status.textContent='';
// Keep the retry credentials until the confirmation is displayed.
if (!showSavedConfirmation(result.order_number, result.tracking_token)) {
  throw new Error('Confirmation could not be displayed. Please retry the same order.');
}
clearOrderAttempt();
// Confirmation details are rendered; now empty the purchased cart.
cart.clear();
updateUI();
 }catch(error){
  status.textContent='Order was not confirmed. '+(error?.message||'Please try again.');
 }finally{
  submitBusy=false;btn.disabled=!(cfg?.enabled && totals().count);
  if(window.turnstile && turnstileWidgetId!==null)window.turnstile.reset(turnstileWidgetId);
 }
};
function showSavedConfirmation(orderNumber, trackingToken){
  if(!totals().count || !validateCheckout()) return false;
  const d=checkoutData(), {total}=totals();
  const card=document.getElementById('confirmationCard');
  const esc=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let itemHtml='';cart.forEach(i=>{
    itemHtml+=`<div class="summary-item"><span>${i.qty}× ${esc(i.name)}<small class="summary-addon"><br>↳ ${esc(i.packaging)}${i.oatMilk?' · Sub Oat Milk':''}</small></span><strong>${peso(itemTotal(i))}</strong></div>`;
  });
  const deliveryHtml=`<div class="summary-section summary-address"><strong>Delivery Address</strong><span>${esc(d.address)}</span></div>${d.landmark?`<div><span>Landmark</span><strong>${esc(d.landmark)}</strong></div>`:''}${d.pin?`<div><span>GPS Pin</span><strong>${esc(d.pin.lat)}, ${esc(d.pin.lng)}</strong></div>`:''}`;
  card.innerHTML=`<div><span>Order Number</span><strong>${esc(orderNumber)}</strong></div><div><span>Customer</span><strong>${esc(d.name)}</strong></div><div><span>Mobile</span><strong>${esc(d.phone)}</strong></div><div class="summary-section"><strong>Items</strong>${itemHtml}</div><div><span>Drinks subtotal (delivery not included)</span><strong>${peso(total)}</strong></div><div><span>Delivery</span><strong>Lalamove / GrabExpress — fee pending</strong></div><div><span>Payment</span><strong>Not yet required</strong></div>${deliveryHtml}${d.notes?`<div class="summary-section summary-address"><strong>Notes</strong><span>${esc(d.notes)}</span></div>`:''}`;
  document.querySelector('#orderConfirmation .phase-badge').textContent='AWAITING DELIVERY FEE';
  document.querySelector('#orderConfirmation h3').textContent='Order #'+orderNumber+' received.';
  document.querySelector('#orderConfirmation > p').textContent='Delivery fee is being calculated. Please wait for final payment instructions.';
  const trackingActions=document.getElementById('trackingActions');
  trackingActions.hidden=true;
  if(typeof trackingToken==='string' && /^[a-f0-9]{64}$/.test(trackingToken)){
    const url=window.DS_TRACKING.makeUrl(trackingToken);
    document.getElementById('trackOrderLink').href=url;
    document.getElementById('copyTrackingLink').onclick=async()=>{
      try { await navigator.clipboard.writeText(url); document.getElementById('copyTrackingLink').textContent='LINK COPIED ✓'; }
      catch { window.prompt('Copy your private tracking link:',url); }
    };
    window.DS_TRACKING.saveOrder({order_number:orderNumber,token:trackingToken,created_at:new Date().toISOString()});
    trackingActions.hidden=false;
  } else {
    document.querySelector('#orderConfirmation > p').textContent='Your order was saved. Tracking link is not available yet; please keep your order number.';
  }
  document.getElementById('newTestOrder').textContent='CREATE ANOTHER ORDER';
  document.getElementById('checkoutForm').style.display='none';
  document.getElementById('orderConfirmation').classList.add('show');
  modal.classList.add('confirmation-active');
  document.querySelector('.order-sheet').scrollTo({top:0,behavior:'smooth'});
  return true;
};

document.getElementById('newTestOrder').onclick=()=>{
  clearOrderAttempt();
  cart.clear(); updateUI();
  document.getElementById('checkoutForm').style.display='block';
  document.getElementById('orderConfirmation').classList.remove('show');
  modal.classList.remove('confirmation-active');
  // Return to the actual menu, not the checkout modal.
  closeModal();
  document.querySelector('.menu').scrollIntoView({behavior:'smooth',block:'start'});
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
  document.querySelector('.checkout-heading span').textContent = 'CHECKOUT';
  document.querySelector('.checkout-note').textContent = 'No payment is collected at checkout. Delivery fee and final payment instructions will be provided after your order is reviewed.';
  document.getElementById('placeOrder').textContent = 'PLACE ORDER';
}
