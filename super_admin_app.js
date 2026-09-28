/************************************************
 * E.BANK — Super Admin Command Center v3
 ************************************************/
var SUPABASE_URL = 'https://kqnsbnpznkwkwukzokik.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxbnNibnB6bmt3a3d1a3pva2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1NDc4NjgsImV4cCI6MjA4MjEyMzg2OH0.dsqyFP37JyrfYDVwasNZW_Aid9ah0e6SxdnS8j8xV5s';

var supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, storageKey: 'ebank-super-admin-session', storage: window.localStorage, autoRefreshToken: true, detectSessionInUrl: false }
});

var allPoolsCache = [];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, function (c) {
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
  });
}

function fmtMoney(value) {
  return Number(value || 0).toLocaleString('fa-IR');
}

function fmtDate(value) {
  if (!value) return '—';
  var d = new Date(value);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fa-IR');
}

function firstValue(obj, keys, fallback) {
  for (var i = 0; i < keys.length; i++) {
    var v = obj ? obj[keys[i]] : null;
    if (v !== null && v !== undefined && String(v).trim() !== '') return v;
  }
  return fallback;
}

function requestType(req, pool) {
  var raw = String(req?.request_type || '').trim().toLowerCase();
  if (['subscription','sub','renewal','اشتراک','تمدید'].includes(raw)) return 'subscription';
  if (['quota','share','capacity','member_quota','سهمیه'].includes(raw)) return 'quota';

  // سازگاری با پنل مدیر قدیمی: اگر request_type هنوز توسط پنل مدیر ثبت نشده باشد،
  // نوع درخواست را از مبلغ و تعرفه همان بانک تشخیص می‌دهیم. هیچ گزینه «به عنوان...»
  // به سوپر ادمین نشان داده نمی‌شود.
  var amount = Number(req?.amount || 0);
  var subPrice = Number(pool?.sub_price || 0);
  var sharePrice = Number(pool?.share_price || 0);
  if (amount > 0 && subPrice > 0 && amount === subPrice) return 'subscription';
  if (amount > 0 && sharePrice > 0 && amount === sharePrice) return 'quota';
  if (amount > 0 && sharePrice > 0 && amount % sharePrice === 0 && !(subPrice > 0 && amount % subPrice === 0)) return 'quota';
  if (amount > 0 && subPrice > 0 && amount % subPrice === 0 && !(sharePrice > 0 && amount % sharePrice === 0)) return 'subscription';
  return 'unknown';
}

function requestTypeLabel(req, pool) {
  var t = requestType(req, pool);
  return t === 'subscription' ? 'اشتراک' : t === 'quota' ? 'سهمیه' : 'نوع نامشخص';
}

function isApproved(req) {
  return ['approved','confirmed','completed','paid'].includes(String(req?.status || '').toLowerCase());
}

function swalBase(extra) {
  return Object.assign({ confirmButtonColor:'#4f46e5', cancelButtonColor:'#98a2b3', customClass:{popup:'rounded-[2rem]'} }, extra || {});
}

async function ensureSuperAdmin() {
  var twoFactorPassed = sessionStorage.getItem('super_admin_2fa') === 'true';
  var auth = await supabaseClient.auth.getUser();
  if (auth.error || !auth.data?.user || !twoFactorPassed) throw new Error('NO_SUPER_ADMIN_SESSION');

  var profile = await supabaseClient.from('members').select('id,full_name,is_super_admin,status').eq('id', auth.data.user.id).single();
  if (profile.error || !profile.data || profile.data.is_super_admin !== true || profile.data.status === 'blocked') {
    throw new Error('NO_SUPER_ADMIN_PERMISSION');
  }
  var userName = profile.data.full_name || sessionStorage.getItem('user_name') || 'E.BANK OWNER';
  sessionStorage.setItem('user_name', userName);
  var el = document.getElementById('welcome-name');
  if (el) el.textContent = 'کاربر: ' + userName;
}

async function loadDashboard() {
  var poolRes = await supabaseClient.from('pools').select('*').order('created_at', { ascending:false });
  if (poolRes.error) throw poolRes.error;
  allPoolsCache = poolRes.data || [];

  var usersRes = await supabaseClient.from('members').select('*', { count:'exact', head:true });
  document.getElementById('total-pools').textContent = (allPoolsCache.length || 0).toLocaleString('fa-IR');
  document.getElementById('total-users').textContent = Number(usersRes.count || 0).toLocaleString('fa-IR');

  var pendingPoolsCount = allPoolsCache.filter(function (p) { return !p.approved_at; }).length;
  var ppEl = document.getElementById('pending-pools-count');
  if (ppEl) ppEl.textContent = pendingPoolsCount.toLocaleString('fa-IR');

  var reqRes = await supabaseClient.from('sub_requests').select('id,amount,status,created_at,request_type,pool_id');
  if (!reqRes.error) {
    var approved = (reqRes.data || []).filter(isApproved).reduce(function (sum, r) { return sum + Number(r.amount || 0); }, 0);
    var pending = (reqRes.data || []).filter(function (r) { return String(r.status || '').toLowerCase() === 'pending'; }).length;
    document.getElementById('total-revenue-amt').innerHTML = fmtMoney(approved) + ' <span style="font-size:8px;font-weight:700;color:#98a2b3">تومان</span>';
    document.getElementById('pending-count').textContent = pending.toLocaleString('fa-IR');
  }

  var fbRes = await supabaseClient.from('feedback_reports').select('id', { count:'exact', head:true });
  var fbEl = document.getElementById('feedback-count');
  if (fbEl && !fbRes.error) fbEl.textContent = Number(fbRes.count || 0).toLocaleString('fa-IR');

  var rsRes = await supabaseClient.from('password_reset_requests').select('id', { count:'exact', head:true }).eq('status','pending');
  var rsEl = document.getElementById('reset-count');
  if (rsEl && !rsRes.error) rsEl.textContent = Number(rsRes.count || 0).toLocaleString('fa-IR');

  renderCardValues();
}

async function renderCardValues() {
  var res = await supabaseClient.from('global_config').select('master_card,master_card_name').eq('id',1).maybeSingle();
  if (res.error || !res.data) return;
  var num = String(res.data.master_card || '').replace(/\D/g,'');
  var pretty = num.length >= 16 ? num.slice(0,4)+' '+num.slice(4,8)+' '+num.slice(8,12)+' '+num.slice(12,16) : (num || '•••• •••• •••• ••••');
  var n = document.getElementById('master-card-preview');
  var h = document.getElementById('master-card-name-preview');
  if (n) n.textContent = pretty;
  if (h) h.textContent = res.data.master_card_name || 'نام صاحب حساب';
}

async function openPasswordPrompt(title) {
  var r = await Swal.fire(swalBase({ title:title || 'تأیید هویت', input:'password', inputPlaceholder:'رمز اصلی Super Admin', showCancelButton:true, confirmButtonText:'تأیید', cancelButtonText:'انصراف' }));
  return r.isConfirmed ? String(r.value || '') : '';
}

window.turnOffSuperAdmin = async function () {
  var confirm = await Swal.fire(swalBase({
    title:'خروج از ستاد؟',
    text:'نشست Super Admin بسته می‌شود و به صفحه ورود برمی‌گردید.',
    icon:'warning',
    showCancelButton:true,
    confirmButtonText:'TURN OFF',
    cancelButtonText:'انصراف',
    confirmButtonColor:'#d92d20'
  }));
  if (!confirm.isConfirmed) return;
  try { await supabaseClient.auth.signOut(); } catch (_) {}
  sessionStorage.removeItem('super_admin_2fa');
  sessionStorage.removeItem('user_name');
  window.location.replace('super-admin-login.html');
};

function openFullPage(title, sub, content, backFn) {
  var dashboard = document.getElementById('dashboard-view');
  var page = document.getElementById('page-view');
  if (!dashboard || !page) return;
  dashboard.style.display = 'none';
  page.classList.add('active');
  page.innerHTML = `<div class="page-head">
    <button type="button" class="page-back" id="page-back"><i class="fas fa-arrow-right"></i></button>
    <div><h2 class="page-title">${escapeHtml(title || '')}</h2><p class="page-sub">${escapeHtml(sub || '')}</p></div>
  </div>${content || ''}`;
  document.getElementById('page-back').onclick = backFn || showHome;
  window.scrollTo({top:0,behavior:'smooth'});
}

window.showHome = function(){
  var dashboard = document.getElementById('dashboard-view');
  var page = document.getElementById('page-view');
  if (dashboard) dashboard.style.display = '';
  if (page) { page.classList.remove('active'); page.innerHTML=''; }
  window.scrollTo({top:0,behavior:'smooth'});
};

window.showBankList = async function () {
  if (!allPoolsCache.length) return Swal.fire(swalBase({text:'هنوز بانکی ثبت نشده است.',icon:'info'}));
  var html = '<div class="full-list">';
  allPoolsCache.forEach(function (pool) {
    var active = pool.is_active !== false;
    html += `<button type="button" class="full-bank" data-full-bank-id="${pool.id}">
      <div class="full-bank-head"><div><div class="full-bank-name">${escapeHtml(pool.pool_name || 'بانک بدون نام')}</div><div class="full-bank-meta">کد صندوق: ${escapeHtml(pool.pool_code || '—')} • ایجاد: ${fmtDate(pool.created_at)}</div></div><span class="modal-tag ${active?'success':'danger'}">${active?'فعال':'مسدود'}</span></div>
    </button>`;
  });
  html += '</div>';
  openFullPage('بانک‌های موجود','برای مشاهده مشخصات مدیر، روی بانک موردنظر بزنید.',html);
  document.querySelectorAll('[data-full-bank-id]').forEach(function(btn){
    btn.onclick=function(){
      var pool=allPoolsCache.find(function(p){return Number(p.id)===Number(btn.dataset.fullBankId);});
      if(pool) showBankProfile(pool);
    };
  });
};

window.showPendingPools = async function () {
  var pending = allPoolsCache.filter(function (p) { return !p.approved_at; });
  if (!pending.length) return Swal.fire(swalBase({text:'بانک تازه‌تأسیسی در انتظار تأیید نیست.',icon:'info'}));
  var html = '<div class="full-list">';
  pending.forEach(function (pool) {
    html += `<button type="button" class="full-bank" data-pending-bank-id="${pool.id}">
      <div class="full-bank-head"><div><div class="full-bank-name">${escapeHtml(pool.pool_name || 'بانک بدون نام')}</div><div class="full-bank-meta">کد صندوق: ${escapeHtml(pool.pool_code || '—')} • ثبت‌نام: ${fmtDate(pool.created_at)}</div></div><span class="modal-tag warning">در انتظار تأیید</span></div>
    </button>`;
  });
  html += '</div>';
  openFullPage('بانک‌های در انتظار تأیید','برای دیدن مشخصات مدیر و تأیید بانک، روی آن بزنید.',html);
  document.querySelectorAll('[data-pending-bank-id]').forEach(function(btn){
    btn.onclick=function(){
      var pool=allPoolsCache.find(function(p){return Number(p.id)===Number(btn.dataset.pendingBankId);});
      if(pool) showBankProfile(pool);
    };
  });
};


async function countPoolMembers(poolId) {
  try {
    var r = await supabaseClient.from('members').select('id', {count:'exact',head:true}).eq('pool_id', poolId);
    if (!r.error) return Number(r.count || 0);
  } catch (_) {}
  return null;
}

async function poolApprovedRevenue(poolId) {
  var r = await supabaseClient.from('sub_requests').select('amount,status').eq('pool_id', poolId);
  if (r.error) return null;
  return (r.data || []).filter(isApproved).reduce(function(s, x){ return s + Number(x.amount || 0); }, 0);
}

async function getPoolManager(poolId) {
  var r = await supabaseClient.from('members').select('id,full_name,mobile').eq('pool_id', poolId).eq('is_admin', true).limit(1).maybeSingle();
  if (r.error) return null;
  return r.data || null;
}

async function showBankProfile(pool, focusRequests) {
  var members = await countPoolMembers(pool.id);
  var revenue = await poolApprovedRevenue(pool.id);
  var manager = await getPoolManager(pool.id);
  var managerName = (manager && manager.full_name) || 'ثبت نشده';
  var managerPhone = (manager && manager.mobile) || 'ثبت نشده';
  var capacity = Number(firstValue(pool, ['member_capacity','max_members','capacity'], 0));
  var expiry = pool.sub_expiry ? new Date(pool.sub_expiry) : null;
  var daysLeft = expiry && !isNaN(expiry.getTime()) ? Math.max(0, Math.ceil((expiry - new Date()) / 86400000)) : 0;
  var html = `<div class="full-profile">
    <div class="profile-grid">
      <div class="profile-item"><div class="profile-label">نام مدیر</div><div class="profile-value">${escapeHtml(managerName)}</div></div>
      <div class="profile-item"><div class="profile-label">شماره تماس</div><div class="profile-value" dir="ltr" style="text-align:right">${escapeHtml(managerPhone)}</div></div>
      <div class="profile-item"><div class="profile-label">تاریخ تأسیس</div><div class="profile-value">${fmtDate(pool.created_at)}</div></div>
      <div class="profile-item"><div class="profile-label">زمان اشتراک باقی‌مانده</div><div class="profile-value">${Number(daysLeft).toLocaleString('fa-IR')} روز</div></div>
      <div class="profile-item"><div class="profile-label">سهمیه فعلی</div><div class="profile-value">${Number(capacity).toLocaleString('fa-IR')} نفر</div></div>
      <div class="profile-item"><div class="profile-label">کل واریزی تأییدشده</div><div class="profile-value">${revenue === null ? '—' : fmtMoney(revenue) + ' تومان'}</div></div>
      <div class="profile-item profile-wide"><div class="profile-label">تعداد اعضای صندوق</div><div class="profile-value">${members === null ? '—' : Number(members).toLocaleString('fa-IR') + ' عضو'}</div></div>
    </div>
    <div class="page-actions">
      <button type="button" id="profile-requests" class="action-btn primary">درخواست‌ها</button>
      <button type="button" id="profile-tariff" class="action-btn secondary">بروزرسانی تعرفه</button>
      <button type="button" id="profile-toggle-active" class="action-btn secondary" style="grid-column:1/-1">${pool.is_active === false ? 'فعال‌سازی بانک' : 'غیرفعال‌سازی بانک'}</button>
      <button type="button" id="profile-reset-pass" class="action-btn danger" style="grid-column:1/-1">بازنشانی رمز مدیر به رمز پیش‌فرض</button>
      <button type="button" id="profile-delete-pool" class="action-btn danger" style="grid-column:1/-1">حذف کامل بانک</button>
    </div>
  </div>`;
  openFullPage(pool.pool_name || 'پروفایل بانک','مشخصات مدیر و وضعیت مالی بانک',html);
  document.getElementById('profile-requests').onclick=function(){ viewSubRequests(pool,false); };
  document.getElementById('profile-tariff').onclick=function(){ openTariffEditor(pool); };
  document.getElementById('profile-toggle-active').onclick=function(){ togglePoolActive(pool); };
  document.getElementById('profile-reset-pass').onclick=function(){ resetPoolManagerPassword(pool); };
  document.getElementById('profile-delete-pool').onclick=function(){ deletePoolCompletely(pool); };
  if (focusRequests) setTimeout(function(){viewSubRequests(pool,false);},0);
}

/************************************************
 * فعال / غیرفعال‌سازی بانک — با ورود مدیر مسدود می‌شود (admin_app.js پرچم is_active را چک می‌کند)
 ************************************************/
async function togglePoolActive(pool) {
  var willActivate = pool.is_active === false;
  var ask = await Swal.fire(swalBase({
    title: willActivate ? 'فعال‌سازی بانک؟' : 'غیرفعال‌سازی بانک؟',
    html: '<div style="font-size:11px;line-height:2;color:#475467">' +
          (willActivate
            ? 'مدیر «' + escapeHtml(pool.pool_name || '') + '» دوباره می‌تواند وارد پنل شود.'
            : 'مدیر «' + escapeHtml(pool.pool_name || '') + '» تا فعال‌سازی مجدد نمی‌تواند وارد پنل شود.') +
          '</div>',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: willActivate ? 'فعال‌سازی' : 'غیرفعال‌سازی',
    cancelButtonText: 'انصراف',
    confirmButtonColor: willActivate ? '#10b981' : '#d92d20'
  }));
  if (!ask.isConfirmed) return;

  var pw = await openPasswordPrompt(willActivate ? 'تأیید فعال‌سازی بانک' : 'تأیید غیرفعال‌سازی بانک');
  if (!pw) return;

  Swal.fire({title:'در حال انجام...',allowOutsideClick:false,didOpen:function(){Swal.showLoading();}});
  var r = await supabaseClient.rpc('super_admin_toggle_pool_active',{admin_password:pw,target_pool_id:pool.id,new_active:willActivate});
  Swal.close();
  if (r.error) return Swal.fire(swalBase({title:'خطا',text:r.error.message,icon:'error'}));
  if (!r.data) return Swal.fire(swalBase({title:'انجام نشد',text:'رمز اصلی اشتباه است یا بانک پیدا نشد.',icon:'error'}));

  pool.is_active = willActivate;
  await Swal.fire(swalBase({title:'انجام شد ✅',icon:'success',timer:1200,showConfirmButton:false}));
  await loadDashboard();
  showBankProfile(pool);
}

/************************************************
 * حذف کامل بانک — غیرقابل بازگشت؛ نیاز به رمز اصلی و تایپ کد بانک
 ************************************************/
async function deletePoolCompletely(pool) {
  var code = pool.pool_code || '';
  var ask = await Swal.fire(swalBase({
    title: 'حذف کامل بانک؟',
    html: '<div style="font-size:11px;line-height:2;color:#b42318">این عملیات <b>غیرقابل بازگشت</b> است و همه‌ی اعضا، تراکنش‌ها، وام‌ها و درخواست‌های «' +
          escapeHtml(pool.pool_name || '') + '» را برای همیشه پاک می‌کند.<br><br>برای تأیید، کد بانک را دقیقاً وارد کنید: <b dir="ltr">' + escapeHtml(code) + '</b></div>' +
          '<input id="delete-pool-code" class="swal2-input" placeholder="کد بانک" style="width:85%;max-width:100%;box-sizing:border-box;margin:8px auto;direction:ltr;text-align:left;text-transform:uppercase;">',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'حذف کامل',
    cancelButtonText: 'انصراف',
    confirmButtonColor: '#d92d20',
    focusConfirm: false,
    preConfirm: function () {
      var typed = (document.getElementById('delete-pool-code').value || '').trim().toUpperCase();
      if (typed !== String(code).toUpperCase()) {
        Swal.showValidationMessage('کد وارد‌شده با کد بانک مطابقت ندارد');
        return false;
      }
      return typed;
    }
  }));
  if (!ask.isConfirmed) return;

  var pw = await openPasswordPrompt('تأیید نهایی حذف بانک');
  if (!pw) return;

  Swal.fire({title:'در حال حذف...',allowOutsideClick:false,didOpen:function(){Swal.showLoading();}});
  var r = await supabaseClient.rpc('super_admin_delete_pool',{admin_password:pw,target_pool_id:pool.id,confirm_pool_code:ask.value});
  Swal.close();
  if (r.error) return Swal.fire(swalBase({title:'حذف انجام نشد',text:r.error.message,icon:'error'}));
  if (!r.data) return Swal.fire(swalBase({title:'حذف انجام نشد',text:'رمز اصلی اشتباه است یا بانک قبلاً حذف شده.',icon:'error'}));

  await Swal.fire(swalBase({title:'حذف شد ✅',text:'بانک و تمام اطلاعات آن حذف شد.',icon:'success'}));
  var idx = allPoolsCache.findIndex(function(p){ return Number(p.id) === Number(pool.id); });
  if (idx > -1) allPoolsCache.splice(idx,1);
  await loadDashboard();
}

async function openTariffEditor(pool) {
  var html = `<div style="direction:rtl;text-align:right">
    <div class="settings-block"><div class="settings-title">تعرفه این بانک</div><div class="settings-sub">مبلغ اشتراک و سهمیه را به‌صورت مستقل تغییر دهید.</div>
      <div class="settings-fields">
        <div><div class="field-label">هزینه اشتراک</div><input id="tariff-sub" class="field-input" type="number" min="0" value="${Number(pool.sub_price || 0)}"></div>
        <div><div class="field-label">هزینه سهمیه</div><input id="tariff-share" class="field-input" type="number" min="0" value="${Number(pool.share_price || 0)}"></div>
      </div>
      <button type="button" id="save-tariff" class="save-btn">ذخیره تعرفه</button>
    </div>
  </div>`;
  Swal.fire(swalBase({title:'بروزرسانی تعرفه',html:html,showConfirmButton:false,showCloseButton:true,width:510}));
  document.getElementById('save-tariff').onclick = async function () {
    var sub = Number(document.getElementById('tariff-sub').value || 0);
    var share = Number(document.getElementById('tariff-share').value || 0);
    if (sub <= 0 || share <= 0) return Swal.fire(swalBase({text:'هر دو مبلغ باید بزرگ‌تر از صفر باشند.',icon:'warning'}));
    var pw = await openPasswordPrompt('تأیید تغییر تعرفه');
    if (!pw) return;
    var r = await supabaseClient.rpc('update_pool_billing_admin', {admin_password:pw,target_pool_id:pool.id,new_sub_price:sub,new_share_price:share});
    if (r.error) {
      // سازگاری با نام RPC قبلی پروژه
      r = await supabaseClient.rpc('update_pool_billing', {admin_password:pw,target_pool_id:pool.id,new_sub_price:sub,new_share_price:share});
    }
    if (r.error) return Swal.fire(swalBase({title:'خطا',text:r.error.message,icon:'error'}));
    if (!r.data) return Swal.fire(swalBase({title:'عدم تأیید',text:'رمز اصلی صحیح نیست یا عملیات رد شد.',icon:'error'}));
    pool.sub_price = sub; pool.share_price = share;
    Swal.close();
    await Swal.fire(swalBase({title:'انجام شد ✅',text:'تعرفه‌های بانک با موفقیت ذخیره شد.',icon:'success'}));
    await loadDashboard();
  };
}

async function getRequestsForPool(poolId, pendingOnly) {
  var q = supabaseClient.from('sub_requests').select('id,amount,status,created_at,request_type,receipt_url,pool_id').eq('pool_id',poolId).neq('status','deleted').order('created_at',{ascending:false});
  if (pendingOnly) q = q.eq('status','pending');
  var r = await q;
  if (r.error) throw r.error;
  return r.data || [];
}

function requestActionButtons(req, pool) {
  var approved = isApproved(req);
  var type = requestType(req, pool);
  var html = '<div class="request-actions">';
  if (req.receipt_url) html += `<button class="request-btn receipt" data-action="receipt" data-id="${req.id}">مشاهده فیش</button>`;
  else html += '<button class="request-btn disabled" disabled>فیش ثبت نشده</button>';
  if (approved) {
    html += '<button class="request-btn disabled" disabled>قبلاً تأیید شده</button>';
  } else if (type === 'subscription') {
    html += `<button class="request-btn approve-sub" data-action="approve-sub" data-id="${req.id}">تأیید و شارژ اشتراک</button>`;
  } else if (type === 'quota') {
    html += `<button class="request-btn approve-quota" data-action="approve-quota" data-id="${req.id}">تأیید و شارژ سهمیه</button>`;
  } else {
    html += '<button class="request-btn disabled" disabled>نوع درخواست قابل تشخیص نیست</button>';
  }
  html += `<button class="request-btn delete" data-action="delete" data-id="${req.id}">حذف درخواست</button>`;
  html += '</div>';
  return html;
}

function renderRequestsHtml(requests, pool) {
  if (!requests.length) return '<div class="empty">درخواستی برای نمایش وجود ندارد.</div>';
  var html = '<div class="modal-list">';
  requests.forEach(function(req){
    var type = requestType(req,pool);
    var status = isApproved(req) ? 'تأیید شده' : 'در انتظار';
    var tagClass = isApproved(req) ? 'success' : (type === 'unknown' ? 'warning' : '');
    html += `<div class="request-card ${isApproved(req)?'approved':''}">
      <div class="request-head"><div><div class="request-amount">${fmtMoney(req.amount)} تومان</div><div class="request-meta">${escapeHtml(requestTypeLabel(req,pool))} • ${fmtDate(req.created_at)}</div></div><span class="modal-tag ${tagClass}">${status}</span></div>
      ${type === 'unknown' ? '<div class="request-meta" style="color:#b54708;margin-top:6px">نوع درخواست از روی اطلاعات ثبت‌شده قابل تشخیص نیست؛ لطفاً تعرفه بانک را بررسی کنید.</div>' : ''}
      ${requestActionButtons(req,pool)}
    </div>`;
  });
  html += '</div>';
  return html;
}

async function viewSubRequests(pool, showAll) {
  try {
    var requests = await getRequestsForPool(pool.id, !showAll);
    var html = `<div class="page-section"><h3 class="page-section-title">درخواست‌های این بانک</h3><div id="page-request-list" class="page-request-list"></div></div>`;
    openFullPage(pool.pool_name || 'درخواست‌ها','اشتراک و سهمیه این بانک',html,function(){showBankProfile(pool);});
    var list=document.getElementById('page-request-list');
    if(!requests.length){ list.innerHTML='<div class="page-empty">درخواستی برای نمایش وجود ندارد.</div>'; return; }
    list.innerHTML=renderRequestsPageHtml(requests,pool);
    wireRequestButtons(requests,pool);
  } catch (e) {
    console.error('viewSubRequests:',e);
    Swal.fire(swalBase({title:'خطا در بررسی درخواست‌ها',text:e.message || 'بارگذاری درخواست‌ها انجام نشد.',icon:'error'}));
  }
}

function renderRequestsPageHtml(requests,pool){
  return requests.map(function(req){
    var type=requestType(req,pool);
    var approved=isApproved(req);
    var status=approved?'تأیید شده':'در انتظار';
    var tagClass=approved?'success':(type==='unknown'?'warning':'');
    return `<article class="page-request-card ${approved?'approved':''}">
      <div class="page-request-head"><div><div class="request-amount">${fmtMoney(req.amount)} تومان</div><div class="request-meta">${escapeHtml(requestTypeLabel(req,pool))} • ${fmtDate(req.created_at)}</div></div><span class="modal-tag ${tagClass}">${status}</span></div>
      ${type==='unknown'?'<div class="request-meta" style="color:#b54708;margin-top:7px">نوع درخواست از اطلاعات ثبت‌شده قابل تشخیص نیست.</div>':''}
      <div class="page-request-actions">${requestActionButtons(req,pool)}</div>
    </article>`;
  }).join('');
}

function wireRequestButtons(requests,pool) {
  document.querySelectorAll('[data-action]').forEach(function(btn){
    btn.onclick = async function(){
      var id = Number(btn.getAttribute('data-id'));
      var req = requests.find(function(x){return Number(x.id)===id;});
      if (!req) return;
      var action = btn.getAttribute('data-action');
      if (action === 'receipt') {
        if (!req.receipt_url) return;
        window.open(req.receipt_url,'_blank','noopener,noreferrer');
      } else if (action === 'delete') {
        await deleteRequest(req,pool);
      } else if (action === 'approve-sub') {
        await approveRequest(req,pool,'subscription');
      } else if (action === 'approve-quota') {
        await approveRequest(req,pool,'quota');
      }
    };
  });
}

async function deleteRequest(req,pool) {
  var confirm = await Swal.fire(swalBase({title:'حذف درخواست؟',text:'این عملیات قابل بازگشت نیست.',icon:'warning',showCancelButton:true,confirmButtonText:'حذف',cancelButtonText:'انصراف',confirmButtonColor:'#d92d20'}));
  if (!confirm.isConfirmed) return;

  // حذف از طریق RPC از نوع SECURITY DEFINER؛ دسترسی فقط برای سوپر ادمین واردشده است (بدون رمز اصلی).
  var r = await supabaseClient.rpc('super_admin_delete_request',{request_id_param:req.id});
  if (r.error) {
    return Swal.fire(swalBase({title:'حذف انجام نشد',text:r.error.message,icon:'error'}));
  }
  if (!r.data) {
    return Swal.fire(swalBase({title:'حذف انجام نشد',text:'درخواست پیدا نشد؛ ممکن است قبلاً حذف شده باشد.',icon:'warning'}));
  }
  await loadDashboard();
  await Swal.fire(swalBase({title:'حذف شد ✅',text:'درخواست از دیتابیس حذف شد.',icon:'success',timer:1400,showConfirmButton:false}));
  return viewSubRequests(pool,true);
}

async function approveRequest(req,pool,kind) {
  if (isApproved(req)) return Swal.fire(swalBase({title:'قبلاً تأیید شده',text:'این درخواست قبلاً نهایی شده است.',icon:'info'}));
  var detectedType = requestType(req,pool);
  if (detectedType !== kind) {
    return Swal.fire(swalBase({title:'نوع درخواست نامعتبر',text:'نوع این درخواست با تعرفه و اطلاعات ثبت‌شده مطابقت ندارد.',icon:'error'}));
  }
  var pw = await openPasswordPrompt('تأیید نهایی ' + (kind==='subscription'?'اشتراک':'سهمیه'));
  if (!pw) return;

  // اگر پنل مدیر هنوز request_type را ننوشته باشد، همین‌جا نوع قطعی تشخیص‌داده‌شده را ثبت می‌کنیم.
  // این باعث می‌شود درخواست فعلی و درخواست‌های بعدی هم به‌عنوان اشتراک/سهمیه شناخته شوند.
  if (!req.request_type && detectedType !== 'unknown') {
    var typeUpdate = await supabaseClient.from('sub_requests').update({request_type:detectedType}).eq('id',req.id).select('id,request_type').maybeSingle();
    if (!typeUpdate.error && typeUpdate.data) req.request_type = detectedType;
  }

  Swal.fire({title:'در حال پردازش...',allowOutsideClick:false,didOpen:function(){Swal.showLoading();}});
  var rpcName = kind === 'subscription' ? 'super_admin_approve_subscription' : 'super_admin_approve_quota';
  var r = await supabaseClient.rpc(rpcName,{admin_password:pw,request_id_param:req.id,pool_id_param:pool.id,paid_amount:Number(req.amount)});
  if (r.error) {
    Swal.close();
    return Swal.fire(swalBase({title:'خطا در تأیید',text:r.error.message,icon:'error'}));
  }
  if (!r.data) {
    Swal.close();
    return Swal.fire(swalBase({title:'تأیید انجام نشد',text:'رمز اصلی اشتباه است یا عملیات توسط دیتابیس رد شده است.',icon:'error'}));
  }
  Swal.close();
  await loadDashboard();
  await Swal.fire(swalBase({title:'تأیید و شارژ انجام شد ✅',text:'مبلغ همان درخواست روی همان بانک اعمال شد.',icon:'success'}));
  await viewSubRequests(pool,true);
}

window.showPendingRequests = async function () {
  try {
    var r = await supabaseClient.from('sub_requests').select('id,amount,status,created_at,request_type,receipt_url,pool_id,pools(pool_name)').eq('status','pending').order('created_at',{ascending:false}).limit(20);
    if (r.error) throw r.error;
    var rows=r.data||[];
    var html='<div class="page-section"><div id="pending-request-list" class="page-request-list"></div></div>';
    openFullPage('وضعیت فیش‌ها','آخرین درخواست‌های تأییدنشده',html);
    var list=document.getElementById('pending-request-list');
    if(!rows.length){list.innerHTML='<div class="page-empty">در حال حاضر درخواست تأییدنشده‌ای وجود ندارد.</div>';return;}
    list.innerHTML=rows.map(function(req){
      var pool=allPoolsCache.find(function(p){return Number(p.id)===Number(req.pool_id);})||{id:req.pool_id,pool_name:req.pools?.pool_name||'بانک'};
      var type=requestType(req,pool);
      return `<article class="page-request-card">
        <div class="page-request-head"><div><div class="request-amount">${fmtMoney(req.amount)} تومان</div><div class="request-meta">${escapeHtml(pool.pool_name)} • ${escapeHtml(requestTypeLabel(req,pool))} • ${fmtDate(req.created_at)}</div></div><span class="modal-tag warning">در انتظار</span></div>
        <div class="page-request-actions">
          <button class="request-btn approve-sub" data-pending-review="${req.id}" data-pool-id="${pool.id}">بررسی درخواست</button>
          <button class="request-btn delete" data-pending-delete="${req.id}" data-pool-id="${pool.id}">حذف درخواست</button>
        </div>
      </article>`;
    }).join('');
    document.querySelectorAll('[data-pending-review]').forEach(function(btn){btn.onclick=function(){var p=allPoolsCache.find(function(x){return Number(x.id)===Number(btn.dataset.poolId);});if(p)showBankProfile(p,true);};});
    document.querySelectorAll('[data-pending-delete]').forEach(function(btn){btn.onclick=async function(){var q=rows.find(function(x){return Number(x.id)===Number(btn.dataset.pendingDelete);});var p=allPoolsCache.find(function(x){return Number(x.id)===Number(q?.pool_id);});if(q&&p)await deleteRequest(q,p);};});
  } catch(e) {
    Swal.fire(swalBase({title:'خطا در دریافت درخواست‌ها',text:e.message,icon:'error'}));
  }
};

/************************************************
 * گزارش مشکل / پیشنهاد مدیران (جدول feedback_reports)
 ************************************************/
var feedbackCache = [];

function fmtDateTime(value) {
  if (!value) return '—';
  var d = new Date(value);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('fa-IR', { dateStyle:'short', timeStyle:'short' });
}

function poolNameById(poolId) {
  var p = allPoolsCache.find(function (x) { return Number(x.id) === Number(poolId); });
  return p ? (p.pool_name || 'بانک بدون نام') : 'بانک نامشخص';
}

function feedbackTypeInfo(type) {
  return String(type || '').toLowerCase() === 'idea'
    ? { label:'💡 پیشنهاد', tag:'success' }
    : { label:'🐞 باگ', tag:'danger' };
}

function renderFeedbackList(filter) {
  var list = document.getElementById('feedback-list');
  if (!list) return;
  document.querySelectorAll('[data-feedback-filter]').forEach(function (b) {
    b.classList.toggle('active', b.getAttribute('data-feedback-filter') === filter);
  });
  var rows = feedbackCache.filter(function (r) {
    return filter === 'all' || String(r.report_type || '').toLowerCase() === filter;
  });
  if (!rows.length) {
    list.innerHTML = '<div class="page-empty">موردی برای نمایش وجود ندارد.</div>';
    return;
  }
  list.innerHTML = rows.map(function (r) {
    var t = feedbackTypeInfo(r.report_type);
    var mobile = String(r.reporter_mobile || '').trim();
    var tel = mobile.replace(/[^\d+]/g, '');
    var hasReply = !!r.reply_message;
    return `<article class="page-request-card">
      <div class="page-request-head">
        <div>
          <div class="request-amount" style="font-size:11px">${escapeHtml(r.reporter_name || 'بدون نام')}</div>
          <div class="request-meta">${escapeHtml(poolNameById(r.pool_id))} • ${fmtDateTime(r.created_at)}</div>
        </div>
        <span class="modal-tag ${t.tag}">${t.label}</span>
      </div>
      <div class="report-message">${escapeHtml(r.message)}</div>
      ${mobile ? `<a class="report-call" href="tel:${escapeHtml(tel)}" dir="ltr"><i class="fas fa-phone"></i> ${escapeHtml(mobile)}</a>` : ''}
      ${hasReply ? `<div class="report-reply"><div class="report-reply-label">پاسخ شما • ${fmtDateTime(r.replied_at)}</div><div class="report-reply-text">${escapeHtml(r.reply_message)}</div></div>` : ''}
      <div class="filter-row" style="margin-top:10px">
        <button type="button" class="filter-chip" data-quick-reply="${r.id}" data-text="✅ انجام شده">✅ انجام شده</button>
        <button type="button" class="filter-chip" data-quick-reply="${r.id}" data-text="🔎 در حال بررسی">🔎 در حال بررسی</button>
        <button type="button" class="filter-chip" data-quick-reply="${r.id}" data-text="⛔ غیرممکن است">⛔ غیرممکن است</button>
        <button type="button" class="filter-chip" data-quick-reply="${r.id}" data-text="🚫 قابل اجرا نیست">🚫 قابل اجرا نیست</button>
      </div>
      <textarea id="reply-text-${r.id}" placeholder="یا متن دلخواه بنویسید..." class="report-reply-input">${hasReply ? escapeHtml(r.reply_message) : ''}</textarea>
      <button type="button" class="request-btn approve-sub" data-send-reply="${r.id}" style="width:100%;margin-top:6px">${hasReply ? 'به‌روزرسانی پاسخ' : 'ارسال پاسخ'}</button>
    </article>`;
  }).join('');

  document.querySelectorAll('[data-quick-reply]').forEach(function (b) {
    b.onclick = function () {
      var ta = document.getElementById('reply-text-' + b.getAttribute('data-quick-reply'));
      if (ta) ta.value = b.getAttribute('data-text');
    };
  });
  document.querySelectorAll('[data-send-reply]').forEach(function (b) {
    b.onclick = function () {
      var id = b.getAttribute('data-send-reply');
      var ta = document.getElementById('reply-text-' + id);
      sendFeedbackReply(Number(id), ta ? ta.value : '');
    };
  });
}

async function sendFeedbackReply(reportId, text) {
  var msg = (text || '').trim();
  if (!msg) return Swal.fire(swalBase({ title:'متن پاسخ خالی است', icon:'warning' }));
  var r = await supabaseClient.rpc('super_admin_reply_feedback', { report_id_param: reportId, reply_text: msg });
  if (r.error) return Swal.fire(swalBase({ title:'ارسال نشد', text:r.error.message, icon:'error' }));
  var row = feedbackCache.find(function (x) { return Number(x.id) === reportId; });
  if (row) { row.reply_message = msg; row.replied_at = new Date().toISOString(); }
  await Swal.fire(swalBase({ title:'پاسخ ارسال شد ✅', icon:'success', timer:1200, showConfirmButton:false }));
  var activeFilter = document.querySelector('[data-feedback-filter].active');
  renderFeedbackList(activeFilter ? activeFilter.getAttribute('data-feedback-filter') : 'all');
}

window.showFeedbackReports = async function () {
  try {
    var r = await supabaseClient.from('feedback_reports')
      .select('id,pool_id,member_id,reporter_name,reporter_mobile,report_type,message,status,created_at,reply_message,replied_at')
      .order('created_at', { ascending:false })
      .limit(200);
    if (r.error) throw r.error;
    feedbackCache = r.data || [];

    var html = `<div class="page-section">
      <div class="filter-row">
        <button type="button" class="filter-chip active" data-feedback-filter="all">همه (${feedbackCache.length.toLocaleString('fa-IR')})</button>
        <button type="button" class="filter-chip" data-feedback-filter="bug">🐞 باگ</button>
        <button type="button" class="filter-chip" data-feedback-filter="idea">💡 پیشنهاد</button>
      </div>
      <div id="feedback-list" class="page-request-list"></div>
    </div>`;
    openFullPage('گزارش مشکل و پیشنهاد', 'گزارش‌هایی که مدیران بانک‌ها از پنل خودشان ارسال کرده‌اند', html);
    document.querySelectorAll('[data-feedback-filter]').forEach(function (b) {
      b.onclick = function () { renderFeedbackList(b.getAttribute('data-feedback-filter')); };
    });
    renderFeedbackList('all');
  } catch (e) {
    console.error('showFeedbackReports:', e);
    Swal.fire(swalBase({ title:'خطا در دریافت گزارش‌ها', text:e.message || 'بارگذاری گزارش‌ها انجام نشد.', icon:'error' }));
  }
};

/************************************************
 * بازیابی رمز مدیر (جدول password_reset_requests)
 * رمز جدید در خود دیتابیس (RPC) تنظیم می‌شود؛ مقدار آن عمداً در این فایل عمومی نوشته نشده است.
 ************************************************/
async function resetManagerPassword(memberId, displayName) {
  var ask = await Swal.fire(swalBase({
    title:'بازنشانی رمز مدیر؟',
    html:'<div style="font-size:11px;line-height:2;color:#475467">رمز ورود <b>' + escapeHtml(displayName || 'مدیر') + '</b> به رمز پیش‌فرض سیستم تغییر می‌کند.<br>بعد از انجام، رمز را به خود مدیر اطلاع بدهید و بگویید بلافاصله بعد از ورود آن را عوض کند.</div>',
    icon:'warning',
    showCancelButton:true,
    confirmButtonText:'ادامه',
    cancelButtonText:'انصراف'
  }));
  if (!ask.isConfirmed) return false;

  var pw = await openPasswordPrompt('تأیید بازنشانی رمز مدیر');
  if (!pw) return false;

  Swal.fire({title:'در حال انجام...',allowOutsideClick:false,didOpen:function(){Swal.showLoading();}});
  var r = await supabaseClient.rpc('super_admin_reset_manager_to_default',{admin_password:pw,target_member_id:memberId});
  Swal.close();
  if (r.error) {
    await Swal.fire(swalBase({title:'خطا',text:r.error.message,icon:'error'}));
    return false;
  }
  if (!r.data) {
    await Swal.fire(swalBase({title:'انجام نشد',text:'رمز اصلی اشتباه است یا این حساب مدیر قابل بازنشانی نیست.',icon:'error'}));
    return false;
  }
  await Swal.fire(swalBase({title:'انجام شد ✅',text:'رمز مدیر به رمز پیش‌فرض تغییر کرد. آن را به مدیر اطلاع دهید.',icon:'success'}));
  await loadDashboard();
  return true;
}

async function resetPoolManagerPassword(pool) {
  var r = await supabaseClient.from('members').select('id,full_name,is_super_admin').eq('pool_id',pool.id).eq('is_admin',true);
  if (r.error) return Swal.fire(swalBase({title:'خطا',text:r.error.message,icon:'error'}));
  var managers = (r.data || []).filter(function(m){ return m.is_super_admin !== true; });
  if (!managers.length) {
    return Swal.fire(swalBase({title:'مدیر قابل بازنشانی نیست',text:'برای این بانک حساب مدیری پیدا نشد (حساب‌های Super Admin از این مسیر بازنشانی نمی‌شوند).',icon:'info'}));
  }
  await resetManagerPassword(managers[0].id, managers[0].full_name);
}

function resetStatusInfo(status) {
  var s = String(status || '').toLowerCase();
  if (s === 'done') return { label:'انجام شد', tag:'success' };
  if (s === 'rejected') return { label:'رد شد', tag:'danger' };
  return { label:'در انتظار', tag:'warning' };
}

window.showResetRequests = async function () {
  try {
    var r = await supabaseClient.from('password_reset_requests')
      .select('id,member_id,pool_id,full_name,mobile,status,created_at,resolved_at')
      .order('created_at', { ascending:false })
      .limit(50);
    if (r.error) throw r.error;
    var rows = r.data || [];
    // در انتظارها اول
    rows.sort(function(a,b){
      var ap = a.status === 'pending' ? 0 : 1, bp = b.status === 'pending' ? 0 : 1;
      return ap - bp;
    });

    openFullPage('بازیابی رمز مدیران','درخواست‌هایی که مدیران از صفحه ورود ثبت کرده‌اند','<div class="page-section"><div id="reset-list" class="page-request-list"></div></div>');
    var list = document.getElementById('reset-list');
    if (!rows.length) { list.innerHTML = '<div class="page-empty">درخواستی برای بازیابی رمز ثبت نشده است.</div>'; return; }

    list.innerHTML = rows.map(function(q){
      var st = resetStatusInfo(q.status);
      var mobile = String(q.mobile || '').trim();
      var tel = mobile.replace(/[^\d+]/g,'');
      var actions = q.status === 'pending'
        ? `<div class="page-request-actions">
            <button type="button" class="request-btn approve-sub" data-reset-approve="${q.id}">بازنشانی به رمز پیش‌فرض</button>
            <button type="button" class="request-btn delete" data-reset-reject="${q.id}">رد درخواست</button>
          </div>`
        : '';
      return `<article class="page-request-card ${q.status === 'done' ? 'approved' : ''}">
        <div class="page-request-head">
          <div>
            <div class="request-amount" style="font-size:11px">${escapeHtml(q.full_name || 'مدیر')}</div>
            <div class="request-meta">${escapeHtml(poolNameById(q.pool_id))} • ${fmtDateTime(q.created_at)}</div>
          </div>
          <span class="modal-tag ${st.tag}">${st.label}</span>
        </div>
        ${mobile ? `<a class="report-call" href="tel:${escapeHtml(tel)}" dir="ltr"><i class="fas fa-phone"></i> ${escapeHtml(mobile)}</a>` : ''}
        ${actions}
      </article>`;
    }).join('');

    document.querySelectorAll('[data-reset-approve]').forEach(function(btn){
      btn.onclick = async function(){
        var q = rows.find(function(x){ return Number(x.id) === Number(btn.getAttribute('data-reset-approve')); });
        if (!q) return;
        var ok = await resetManagerPassword(q.member_id, q.full_name);
        if (ok) showResetRequests();
      };
    });
    document.querySelectorAll('[data-reset-reject]').forEach(function(btn){
      btn.onclick = async function(){
        var q = rows.find(function(x){ return Number(x.id) === Number(btn.getAttribute('data-reset-reject')); });
        if (!q) return;
        var c = await Swal.fire(swalBase({title:'رد درخواست؟',text:'رمز مدیر تغییر نمی‌کند و درخواست بسته می‌شود.',icon:'question',showCancelButton:true,confirmButtonText:'رد درخواست',cancelButtonText:'انصراف',confirmButtonColor:'#d92d20'}));
        if (!c.isConfirmed) return;
        var rr = await supabaseClient.rpc('super_admin_reject_reset_request',{request_id_param:q.id});
        if (rr.error) return Swal.fire(swalBase({title:'خطا',text:rr.error.message,icon:'error'}));
        if (!rr.data) return Swal.fire(swalBase({title:'انجام نشد',text:'این درخواست دیگر در انتظار نیست.',icon:'warning'}));
        await loadDashboard();
        showResetRequests();
      };
    });
  } catch (e) {
    console.error('showResetRequests:', e);
    Swal.fire(swalBase({ title:'خطا در دریافت درخواست‌ها', text:e.message || 'بارگذاری انجام نشد.', icon:'error' }));
  }
};

window.openSettings = async function () {
  var r = await supabaseClient.from('global_config').select('master_card,master_card_name').eq('id',1).maybeSingle();
  var data = r.data || {};
  var card = String(data.master_card || '');
  var html = `<div style="direction:rtl;text-align:right">
    <div class="settings-block"><div class="settings-title">امنیت ستاد</div><div class="settings-sub">کلیدهای امنیتی ورود Super Admin را مدیریت کنید.</div><button type="button" id="change-master-password" class="save-btn">تغییر رمز ستاد</button><button type="button" id="change-formula-secret" class="save-btn" style="background:#101828">تغییر رمز فرمول ساعت</button></div>
    <div class="settings-block"><div class="settings-title">حساب دریافت مرکزی</div><div class="settings-sub">شماره کارت و نام صاحب حساب.</div>
      <div class="settings-fields">
        <div><div class="field-label">شماره کارت</div><input id="master-card-input" class="field-input" inputmode="numeric" maxlength="16" value="${escapeHtml(card)}"></div>
        <div><div class="field-label">نام صاحب حساب</div><input id="master-card-name-input" class="field-input" value="${escapeHtml(data.master_card_name || '')}"></div>
      </div>
      <button type="button" id="save-master-card" class="save-btn">ذخیره</button>
    </div>
  </div>`;
  Swal.fire(swalBase({title:'تنظیمات',html:html,showConfirmButton:false,showCloseButton:true,width:530}));
  document.getElementById('change-master-password').onclick = function(){ Swal.close(); handleChangeMasterPassword(); };
  document.getElementById('change-formula-secret').onclick = function(){ Swal.close(); handleChangeSecretNumber(); };
  document.getElementById('save-master-card').onclick = saveMasterCard;
};

async function saveMasterCard() {
  var card = String(document.getElementById('master-card-input').value || '').replace(/\D/g,'');
  var name = String(document.getElementById('master-card-name-input').value || '').trim();
  if (card.length !== 16 || !name) return Swal.fire(swalBase({text:'شماره کارت باید ۱۶ رقم باشد و نام صاحب حساب الزامی است.',icon:'warning'}));
  var pw = await openPasswordPrompt('تأیید ذخیره حساب دریافت مرکزی');
  if (!pw) return;
  var r = await supabaseClient.rpc('update_global_config',{admin_password:pw,new_master_card:card,new_master_card_name:name,new_click_constant:null});
  if (r.error) return Swal.fire(swalBase({title:'خطا در ذخیره',text:r.error.message,icon:'error'}));
  if (!r.data) return Swal.fire(swalBase({title:'ذخیره انجام نشد',text:'رمز اصلی صحیح نیست.',icon:'error'}));
  Swal.close();
  await renderCardValues();
  await Swal.fire(swalBase({title:'ذخیره شد ✅',text:'اطلاعات حساب دریافت مرکزی بروزرسانی شد.',icon:'success'}));
};

window.handleChangeMasterPassword = async function () {
  var r = await Swal.fire(swalBase({
    title:'تغییر رمز ستاد',
    html:`<div style="direction:rtl;text-align:right;overflow-x:hidden"><div class="settings-fields">
      <div><div class="field-label">رمز فعلی</div><input id="old-pass" class="field-input" type="password" autocomplete="current-password" placeholder="رمز فعلی"></div>
      <div><div class="field-label">رمز جدید</div><input id="new-pass" class="field-input" type="password" autocomplete="new-password" placeholder="رمز جدید"></div>
    </div></div>`,
    focusConfirm:false,showCancelButton:true,confirmButtonText:'ذخیره',cancelButtonText:'انصراف',
    customClass:{popup:'security-popup'},
    preConfirm:function(){
      var a=document.getElementById('old-pass').value,b=document.getElementById('new-pass').value;
      if(!a||!b){Swal.showValidationMessage('هر دو کادر الزامی است');return false;}
      if(b.length<8){Swal.showValidationMessage('رمز جدید حداقل ۸ کاراکتر باشد');return false;}
      return [a,b];
    }
  }));
  if(!r.isConfirmed)return;
  var rpc=await supabaseClient.rpc('update_master_password',{current_pass:r.value[0],new_pass:r.value[1]});
  if(rpc.error)return Swal.fire(swalBase({title:'خطا',text:rpc.error.message,icon:'error'}));
  await Swal.fire(swalBase({title:rpc.data?'انجام شد ✅':'خطا',text:rpc.data?'رمز ستاد تغییر کرد.':'رمز فعلی اشتباه است.',icon:rpc.data?'success':'error'}));
};

window.handleChangeSecretNumber = async function () {
  var r = await Swal.fire(swalBase({
    title:'تغییر رمز فرمول ساعت',
    html:`<div style="direction:rtl;text-align:right;overflow-x:hidden"><div class="settings-fields">
      <div><div class="field-label">رمز اصلی برای تأیید</div><input id="formula-auth" class="field-input" type="password" autocomplete="current-password" placeholder="رمز اصلی ستاد"></div>
      <div><div class="field-label">عدد مخفی جدید</div><input id="formula-secret" class="field-input" type="number" inputmode="numeric" min="1000" max="99999" placeholder="۴ یا ۵ رقم"></div>
    </div></div>`,
    focusConfirm:false,showCancelButton:true,confirmButtonText:'ثبت عدد جدید',cancelButtonText:'انصراف',
    customClass:{popup:'security-popup'},
    preConfirm:function(){
      var p=document.getElementById('formula-auth').value,n=document.getElementById('formula-secret').value;
      if(!p||!n){Swal.showValidationMessage('هر دو کادر الزامی است');return false;}
      if(!/^\d{4,5}$/.test(n)){Swal.showValidationMessage('عدد فرمول باید ۴ یا ۵ رقم باشد');return false;}
      return [p,n];
    }
  }));
  if(!r.isConfirmed)return;
  var rpc=await supabaseClient.rpc('update_master_otp_secret',{current_pass:r.value[0],new_secret_num:parseInt(r.value[1],10)});
  if(rpc.error)return Swal.fire(swalBase({title:'خطا',text:rpc.error.message,icon:'error'}));
  await Swal.fire(swalBase({title:rpc.data?'انجام شد ✅':'خطا',text:rpc.data?'رمز فرمول ساعت بروزرسانی شد.':'رمز اصلی اشتباه است.',icon:rpc.data?'success':'error'}));
};

// نسخه‌های قدیمی togglePoolStatus/deletePool از این فایل حذف شدند: اولی تکراری بود (نسخه‌ی جدید
// profile-toggle-active همان کار را با رمز اصلی انجام می‌دهد) و دومی به RPC ناامنی وصل بود که
// حذف شد (پایین را ببینید) — این دو تابع دیگر جایی صدا زده نمی‌شدند.

// این تابع دیگر در UI نمایش داده نمی‌شود؛ فقط برای سازگاری پروژه قدیمی باقی مانده است.
window.saveClickConstant = async function(){ return Swal.fire(swalBase({text:'این گزینه از پنل Super Admin حذف شده است.',icon:'info'})); };

async function init() {
  try {
    await ensureSuperAdmin();
      await loadDashboard();
    console.log('✅ Super Admin v3 ready');
  } catch (e) {
    console.error('Super Admin access denied:',e);
    sessionStorage.removeItem('super_admin_2fa');
    sessionStorage.removeItem('user_name');
    try { await supabaseClient.auth.signOut(); } catch (_) {}
    await Swal.fire(swalBase({title:'نشست مدیریت معتبر نیست',text:'لطفاً دوباره وارد Super Admin شوید.',icon:'warning',timer:1800,showConfirmButton:false}));
    window.location.replace('super-admin-login.html');
  }
}

document.addEventListener('DOMContentLoaded',init);
