/************************************************
 * نسخه نهایی و تضمینی ستاد فرماندهی (Super Admin)
 ************************************************/
var SUPABASE_URL = 'https://kqnsbnpznkwkwukzokik.supabase.co';
var SUPABASE_KEY = 'sb_publishable_ZqXeccdaSzZUivCwU38WcQ_m05uT4y6';
var supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

var allPoolsCache = [];

// جادوی شیک‌سازی خودکار تمام پیام‌های ساده
window.alert = function(msg) {
    Swal.fire({
        text: msg,
        icon: 'info',
        confirmButtonText: 'متوجه شدم',
        confirmButtonColor: '#fbbf24',
        customClass: { popup: 'rounded-[2.5rem] glass-card' }
    });
};


/************************************************
 * موتور شروع به کار ستاد فرماندهی (INIT)
 ************************************************/
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🔍 Checking authenticated Super Admin access...');

    try {
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
        if (authError) throw authError;
        if (!user) return redirectUnauthorized();

        const { data: member, error: memberError } = await supabaseClient
            .from('members')
            .select('id, full_name, is_super_admin, is_admin, status')
            .eq('id', user.id)
            .maybeSingle();

        if (memberError) throw memberError;
        if (!member?.is_super_admin || member.status === 'blocked') {
            return redirectUnauthorized();
        }

        const userName = member.full_name || user.email || 'E.BANK OWNER';
        const userNameEl = document.getElementById('user-name-display');
        if (userNameEl) userNameEl.textContent = userName;

        await Promise.all([loadMasterStats(), loadBillingHistory(), loadMasterCard()]);
        console.log('✅ Super Admin center loaded.');
    } catch (err) {
        console.error('❌ Error loading center:', err);
        await Swal.fire({ title: 'خطا در بارگذاری', text: err.message || 'خطای نامشخص', icon: 'error' });
        redirectUnauthorized(false);
    }
});

supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (!session) redirectUnauthorized(false);
});

async function redirectUnauthorized(showMessage = true) {
    if (showMessage) {
        await Swal.fire({
            title: 'دسترسی غیرمجاز',
            text: 'برای ورود به COMMAND CENTER باید حساب سوپر ادمین داشته باشید.',
            icon: 'error',
            timer: 2200,
            showConfirmButton: false
        });
    }
    window.location.replace('index.html');
}

function getNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function showError(message, title = 'خطا') {
    return Swal.fire({ title, text: message, icon: 'error', confirmButtonColor: '#ef4444' });
}

// --- توابع هسته مرکزی ---

async function loadMasterStats() {
    const [{ data: pools, error: poolsError }, { count: userCount, error: usersError }] = await Promise.all([
        supabaseClient.from('pools').select('id,pool_name,pool_code,is_active,sub_expiry,sub_price,share_price').order('created_at', { ascending: false }),
        supabaseClient.from('members').select('id', { count: 'exact', head: true })
    ]);

    if (poolsError) throw poolsError;
    if (usersError) throw usersError;

    document.getElementById('total-pools').innerText = pools?.length || 0;
    document.getElementById('total-users').innerText = userCount || 0;
    allPoolsCache = pools || [];
    renderPoolsList();
}

function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function renderPoolsList() {
    const container = document.getElementById('pools-list');
    if (!container) return;
    container.innerHTML = allPoolsCache.map(pool => {
        const isActive = pool.is_active !== false;
        const expiryDate = pool.sub_expiry ? new Date(pool.sub_expiry).toLocaleDateString('fa-IR') : '---';
        const safeName = escapeHtml(pool.pool_name);
        const safeCode = escapeHtml(pool.pool_code);

        return `
            <div class="bg-slate-800/60 p-6 rounded-[2.5rem] gold-border mb-4 space-y-4 shadow-xl backdrop-blur-sm">
                <div class="flex justify-between items-start">
                    <div class="text-right">
                        <h4 class="text-sm font-black text-white">${safeName}</h4>
                        <p class="text-[9px] text-slate-400 mt-1">کد: <span class="text-yellow-500 font-bold">${safeCode}</span> | انقضا: ${expiryDate}</p>
                    </div>
                    <button onclick="togglePoolStatus(${pool.id}, ${isActive})" 
                        class="w-10 h-10 ${isActive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'} rounded-2xl flex items-center justify-center active:scale-90 transition-all border border-white/5">
                        <i class="fas ${isActive ? 'fa-unlock' : 'fa-lock'} text-xs"></i>
                    </button>
                    
                    <!-- دکمه حذف جدید مخصوص سوپر ادمین 👇 -->
    <button class="js-delete-pool w-10 h-10 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center active:scale-90 border border-rose-500/20" data-pool-id="${pool.id}">
        <i class="fas fa-trash-alt text-xs"></i>
    </button>
                    
                    
                </div>
                <div class="bg-slate-900/50 p-4 rounded-3xl border border-slate-700/50 space-y-3">
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="text-[7px] text-slate-500 block mb-1">هزینه تمدید:</label>
                            <input type="number" id="price-${pool.id}" value="${getNumber(pool.sub_price, 100000)}" class="w-full bg-transparent text-[10px] font-black text-yellow-500 outline-none">
                        </div>
                        <div>
                            <label class="text-[7px] text-slate-500 block mb-1">قیمت سهمیه:</label>
                            <input type="number" id="share-price-${pool.id}" value="${getNumber(pool.share_price, 10000)}" class="w-full bg-transparent text-[10px] font-black text-emerald-400 outline-none">
                        </div>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <button onclick="updatePoolBilling(${pool.id})" class="bg-slate-700 text-white py-3 rounded-2xl text-[9px] font-black active:scale-95 transition-all">بروزرسانی تعرفه</button>
                    <button class="js-view-subs bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 py-3 rounded-2xl text-[9px] font-black active:scale-95 transition-all" data-pool-id="${pool.id}">بررسی فیش‌ها</button>
                </div>
            </div>`;
    }).join('');

    // اتصال دستی دکمه‌های حذف و بررسی فیش‌ها (به‌جای onclick اینلاین)
    // چون اسم صندوق ممکنه آپاستروف یا کوتیشن داشته باشه (مثل "Islamic Brother's Bank")
    // و onclick="...('${name}')" با اون کاراکترها می‌شکنه.
    container.querySelectorAll('.js-delete-pool').forEach(btn => {
        btn.onclick = () => {
            const pool = allPoolsCache.find(p => String(p.id) === btn.dataset.poolId);
            if (pool) deletePool(pool.id, pool.pool_name);
        };
    });
    container.querySelectorAll('.js-view-subs').forEach(btn => {
        btn.onclick = () => {
            const pool = allPoolsCache.find(p => String(p.id) === btn.dataset.poolId);
            if (pool) viewSubRequests(pool.id, pool.pool_name);
        };
    });
}

window.togglePoolStatus = async function(poolId, currentStatus) {
    const { value: pw } = await Swal.fire({
        title: 'تایید هویت', input: 'password', text: 'رمز اصلی (COMMAND CENTER) رو وارد کن',
        confirmButtonColor: '#fbbf24', customClass: { popup: 'rounded-[2.5rem] glass-card' }
    });
    if (!pw) return;
    try {
        const { data: ok, error } = await supabaseClient.rpc('toggle_pool_status', { admin_password: pw, target_pool_id: poolId });
        if (error) throw error;
        if (!ok) return alert("رمز اصلی اشتباه است ❌");
        alert(!currentStatus ? "صندوق باز شد ✅" : "صندوق مسدود شد 🔒");
        loadMasterStats();
    } catch (e) { alert("خطا در تغییر وضعیت"); }
};

window.updatePoolBilling = async function(poolId) {
    const price = document.getElementById(`price-${poolId}`).value;
    const sPrice = document.getElementById(`share-price-${poolId}`).value;
    const { value: pw } = await Swal.fire({
        title: 'تایید هویت', input: 'password', text: 'رمز اصلی (COMMAND CENTER) رو وارد کن',
        confirmButtonColor: '#fbbf24', customClass: { popup: 'rounded-[2.5rem] glass-card' }
    });
    if (!pw) return;
    const { data: ok, error } = await supabaseClient.rpc('update_pool_billing', {
        admin_password: pw, target_pool_id: poolId, new_sub_price: Number(price), new_share_price: Number(sPrice)
    });
    if (error) return alert("خطا در ثبت تعرفه");
    if (!ok) return alert("رمز اصلی اشتباه است ❌");
    alert("تعرفه‌ها با موفقیت ثبت شد ✅");
};

/************************************************
 * نمایش هوشمند فیش‌های تمدید و سهمیه (نسخه ستاد)
 ************************************************/
window.viewSubRequests = async function(poolId, poolName) {
    try {
        // ۱. دریافت فیش‌های منتظر برای این صندوق
        const { data: requests, error: reqErr } = await supabaseClient
            .from('sub_requests')
            .select('*')
            .eq('pool_id', poolId)
            .eq('status', 'pending');

        if (reqErr) throw reqErr;

        if (!requests || requests.length === 0) {
            return Swal.fire({
                text: `هیچ فیش منتظری برای "${poolName}" وجود ندارد.`,
                icon: 'info',
                confirmButtonColor: '#fbbf24',
                customClass: { popup: 'rounded-[2.5rem] glass-card' }
            });
        }

        // ۲. دریافت تنظیمات قیمتی مخصوص این صندوق برای محاسبه تناسب
        const { data: poolInfo, error: poolErr } = await supabaseClient
            .from('pools')
            .select('sub_price, sub_duration_days, share_price')
            .eq('id', poolId)
            .single();
        if (poolErr) throw poolErr;

        // ۳. ساخت محتوای مودال به صورت لیست
        let listHtml = `
            <div style="direction:rtl; text-align:right; max-height:60vh; overflow-y:auto; padding:5px;">
                <p style="font-size:11px; color:#94a3b8; margin-bottom:15px; text-align:center;">تعرفه این صندوق: هر سهمیه ${Number(poolInfo.share_price).toLocaleString()} ت | هر ۳۰ روز ${Number(poolInfo.sub_price).toLocaleString()} ت</p>
        `;

        requests.forEach(req => {
            const reqAmount = getNumber(req.amount);
            const receiptUrl = typeof req.receipt_url === 'string' && /^(https?:\/\/|\/)/i.test(req.receipt_url) ? req.receipt_url : '#';
            const safeReceiptUrl = escapeHtml(receiptUrl);
            // محاسبات هوشمند لحظه‌ای برای نمایش به شما 👇
            const calcDays = Math.floor((reqAmount / (poolInfo.sub_price || 100000)) * (poolInfo.sub_duration_days || 30));
            const calcSlots = Math.floor(reqAmount / (poolInfo.share_price || 10000));

            listHtml += `
                <div style="background:rgba(255,255,255,0.05); padding:20px; border-radius:25px; border:1px solid rgba(255,255,255,0.1); margin-bottom:15px; box-shadow:0 10px 20px rgba(0,0,0,0.2);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                        <span style="color:#fbbf24; font-[900]; font-size:16px;">${reqAmount.toLocaleString('fa-IR')} <small style="font-size:9px; font-weight:normal;">تومان</small></span>
                        <a href="${safeReceiptUrl}" target="_blank" style="background:#4f46e5; color:white; padding:8px 15px; border-radius:12px; font-size:10px; font-weight:black; text-decoration:none;">
                            <i class="fas fa-eye ml-1"></i> مشاهده فیش
                        </a>
                    </div>
                    
                    <div style="display:grid; grid-cols:1; gap:8px;">
                        <!-- دکمه تایید اشتراک با نمایش روز محاسبه شده -->
                        <button onclick="Swal.close(); approveSubscription(${Number(req.id)}, ${Number(poolId)}, ${reqAmount})" 
                                style="width:100%; background:#10b981; color:white; border:none; padding:12px; border-radius:15px; font-[900]; font-size:11px; cursor:pointer;">
                            تایید بعنوان اشتراک (${calcDays} روز اعتبار)
                        </button>
                        
                        <!-- دکمه تایید سهمیه با نمایش تعداد محاسبه شده -->
                        <button onclick="Swal.close(); approveMemberQuota(${Number(req.id)}, ${Number(poolId)}, ${reqAmount})" 
                                style="width:100%; background:#3b82f6; color:white; border:none; padding:12px; border-radius:15px; font-[900]; font-size:11px; cursor:pointer;">
                            تایید بعنوان سهمیه (${calcSlots} نفر ظرفیت)
                        </button>
                    </div>
                    <p style="text-align:center; font-size:8px; color:#475569; margin-top:10px;">تاریخ ارسال: ${new Date(req.created_at).toLocaleDateString('fa-IR')}</p>
                </div>
            `;
        });

        listHtml += `</div>`;

        // ۴. نمایش نهایی با SweetAlert2
        Swal.fire({
            title: `<span style="color:#fff; font-size:18px;">بررسی مالی: ${escapeHtml(poolName)}</span>`,
            html: listHtml,
            showConfirmButton: false,
            showCloseButton: true,
            background: '#0f172a',
            customClass: {
                popup: 'rounded-[3rem] border border-white/10 shadow-2xl'
            }
        });

    } catch (e) {
        console.error(e);
        Swal.fire({ text: "خطا در بارگذاری لیست فیش‌ها", icon: 'error' });
    }
};

/************************************************
 * تایید هوشمند اشتراک (محاسبه دقیق بر اساس مبلغ)
 ************************************************/
window.approveSubscription = async function(requestId, poolId, paidAmount) {
    if (!Number.isFinite(Number(paidAmount)) || Number(paidAmount) <= 0) {
        return showError('مبلغ واریزی معتبر نیست.');
    }

    const { value: pw } = await Swal.fire({
        title: 'تأیید هویت',
        input: 'password',
        inputAttributes: { autocomplete: 'current-password' },
        text: 'رمز اصلی COMMAND CENTER را وارد کنید',
        showCancelButton: true,
        cancelButtonText: 'انصراف',
        confirmButtonColor: '#fbbf24',
        customClass: { popup: 'rounded-[2.5rem] glass-card' }
    });
    if (!pw) return;

    Swal.fire({ title: 'در حال ثبت...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        const { data, error } = await supabaseClient.rpc('super_admin_approve_subscription', {
            admin_password: pw,
            request_id_param: Number(requestId),
            pool_id_param: Number(poolId),
            paid_amount: Math.trunc(Number(paidAmount))
        });
        if (error) throw error;
        if (!data?.ok) throw new Error(data?.reason === 'bad_password' ? 'رمز اصلی اشتباه است.' : (data?.reason || 'عملیات تأیید انجام نشد.'));

        await Swal.fire({
            title: 'تمدید با موفقیت ثبت شد',
            text: `${data.days_granted || data.days_to_grant || 0} روز به اعتبار صندوق اضافه شد.`,
            icon: 'success',
            confirmButtonColor: '#10b981',
            customClass: { popup: 'rounded-[2.5rem] glass-card' }
        });
        await Promise.all([loadMasterStats(), loadBillingHistory()]);
    } catch (e) {
        await showError('خطا در تمدید: ' + (e.message || 'خطای نامشخص'));
    }
};

window.approveMemberQuota = async function(requestId, poolId, paidAmount) {
    if (!Number.isFinite(Number(paidAmount)) || Number(paidAmount) <= 0) {
        return showError('مبلغ واریزی معتبر نیست.');
    }

    const { value: pw } = await Swal.fire({
        title: 'تأیید هویت',
        input: 'password',
        inputAttributes: { autocomplete: 'current-password' },
        text: 'رمز اصلی COMMAND CENTER را وارد کنید',
        showCancelButton: true,
        cancelButtonText: 'انصراف',
        confirmButtonColor: '#fbbf24',
        customClass: { popup: 'rounded-[2.5rem] glass-card' }
    });
    if (!pw) return;

    Swal.fire({ title: 'در حال ثبت...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        const { data, error } = await supabaseClient.rpc('super_admin_approve_quota', {
            admin_password: pw,
            request_id_param: Number(requestId),
            pool_id_param: Number(poolId),
            paid_amount: Math.trunc(Number(paidAmount))
        });
        if (error) throw error;
        if (!data?.ok) throw new Error(data?.reason === 'bad_password' ? 'رمز اصلی اشتباه است.' : (data?.reason || 'عملیات تأیید انجام نشد.'));

        await Swal.fire({
            title: 'افزایش سهمیه ثبت شد',
            text: `${data.new_slots || 0} سهمیه جدید اضافه شد.`,
            icon: 'success',
            confirmButtonColor: '#10b981',
            customClass: { popup: 'rounded-[2.5rem] glass-card' }
        });
        await Promise.all([loadMasterStats(), loadBillingHistory()]);
    } catch (e) {
        await showError('خطا در سهمیه: ' + (e.message || 'خطای نامشخص'));
    }
};

async function loadBillingHistory() {
    const { data, error } = await supabaseClient
        .from('sub_requests')
        .select('amount,status,created_at,pool_id,pools(pool_name)')
        .order('created_at', { ascending: false });
    if (error) throw error;

    const totalRevenue = (data || [])
        .filter(req => req.status === 'approved')
        .reduce((sum, current) => sum + getNumber(current.amount), 0);

    const revEl = document.getElementById('total-revenue-amt');
    if (revEl) {
        revEl.innerHTML = `${totalRevenue.toLocaleString('fa-IR')} <span class="text-sm font-normal text-slate-500">تومان</span>`;
    }

    const container = document.getElementById('billing-container');
    if (!container) return;

    container.innerHTML = (data || []).map(req => {
        const poolName = escapeHtml(req.pools?.pool_name || 'نامشخص');
        const statusText = req.status === 'approved' ? 'تایید نهایی' : escapeHtml(req.status || 'در انتظار');
        const amount = getNumber(req.amount).toLocaleString('fa-IR');
        const date = req.created_at ? new Date(req.created_at).toLocaleDateString('fa-IR') : '---';
        return `
            <div class="glass-card p-5 rounded-[2rem] flex justify-between items-center border-white/5 mb-3">
                <div class="text-right">
                    <p class="text-[10px] font-black text-white">${poolName}</p>
                    <p class="text-[8px] text-slate-500 mt-1">${date}</p>
                </div>
                <div class="text-left">
                    <p class="text-xs font-black text-emerald-400">${amount} ت</p>
                    <span class="text-[7px] font-bold px-2 py-0.5 rounded-full ${req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-orange-500/10 text-orange-500'}">${statusText}</span>
                </div>
            </div>`;
    }).join('');
}

window.exportBillingToExcel = async function() {
    try {
        const { data, error } = await supabaseClient.from('sub_requests').select('amount,status,created_at,pools(pool_name)');
        if (error) throw error;
        const excelData = data.map(r => ({
            "نام صندوق": r.pools ? r.pools.pool_name : "نامشخص",
            "مبلغ (تومان)": Number(r.amount),
            "وضعیت": r.status === 'approved' ? "تایید شده" : "در انتظار",
            "تاریخ": new Date(r.created_at).toLocaleDateString('fa-IR')
        }));
        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Revenues");
        ws['!dir'] = "rtl";
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const dataBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(dataBlob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `EBank_Report_${Date.now()}.xlsx`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        window.URL.revokeObjectURL(url);
        alert("فایل به پوشه Downloads ارسال شد ✅");
    } catch (e) { alert("خطا در تولید اکسل"); }
};


// لود شماره کارت در شروع برنامه
// ۱. لود کردن اطلاعات کارت هنگام ورود به ستاد
/************************************************
 * تابع لود کردن تمام تنظیمات عمومی (کارت و کلیک)
 ************************************************/
async function loadMasterCard() {
    try {
        // دریافت تمام ستون‌ها از جدول تنظیمات کل
        const { data, error } = await supabaseClient
            .from('global_config')
            .select('master_card, master_card_name, click_constant')
            .eq('id', 1)
            .maybeSingle();

        if (error) throw error;

        if (data) {
            // ۱. لود اطلاعات کارت بانکی
            const cardInput = document.getElementById('master-card-input');
            const nameInput = document.getElementById('master-card-name-input');
            if (cardInput) cardInput.value = data.master_card || "";
            if (nameInput) nameInput.value = data.master_card_name || "";

            // ۲. لود عدد ثابت برای ماشه کلیک 👇
            const clickInput = document.getElementById('click-constant-input');
            if (clickInput) {
                clickInput.value = data.click_constant !== null ? data.click_constant : 5;
            }
            
            console.log("✅ تمام تنظیمات ستاد با موفقیت بارگذاری شد.");
        }
    } catch (e) {
        console.error("Error loading master config:", e.message);
    }
}

// ۲. ذخیره اطلاعات کارت جدید
window.saveMasterCard = async function(btn) {
    const newCard = document.getElementById('master-card-input').value.trim();
    const newName = document.getElementById('master-card-name-input').value.trim();
    if (!/^\d{16}$/.test(newCard) || !newName) {
        return Swal.fire({ text: "شماره کارت ۱۶ رقمی و نام صاحب حساب الزامی است", icon: 'warning', confirmButtonColor: '#fbbf24' });
    }

    // تایید رمز اصلی قبل از هر تغییری در global_config (چون نوشتن مستقیم دیگه مجاز نیست)
    const { value: pw } = await Swal.fire({
        title: 'تایید هویت',
        input: 'password',
        text: 'برای ذخیره، رمز اصلی (COMMAND CENTER) رو وارد کن',
        confirmButtonColor: '#fbbf24',
        customClass: { popup: 'rounded-[2.5rem] glass-card' }
    });
    if (!pw) return;

    btn.disabled = true; btn.innerText = "در حال ثبت...";

    try {
        const { data: ok, error } = await supabaseClient.rpc('update_global_config', {
            admin_password: pw,
            new_master_card: newCard,
            new_master_card_name: newName,
            new_click_constant: null
        });

        if (error) throw error;
        if (!ok) throw new Error('رمز اصلی اشتباه است ❌');

        Swal.fire({
            title: 'بروزرسانی موفق',
            text: 'اطلاعات کارت عابر بانک ستاد تغییر یافت ✅',
            icon: 'success',
            confirmButtonColor: '#fbbf24',
            customClass: { popup: 'rounded-[2.5rem] glass-card' }
        });

    } catch (e) {
        alert("خطا در ذخیره: " + e.message);
    } finally {
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> ذخیره تنظیمات کارت بانکی';
    }
};


/************************************************
 * تابع حذف کامل یک صندوق (مخصوص سوپر ادمین)
 ************************************************/
/************************************************
 * تابع حذف کامل صندوق با تأییدیه امنیتی (Super Admin)
 ************************************************/
window.deletePool = async function(poolId, poolName) {
    // ۱. تولید یک عدد تصادفی ۴ رقمی برای تأییدیه
    const securityCode = Math.floor(1000 + Math.random() * 9000);

    // ۲. نمایش پنجره چالش امنیتی 👇
    const { value: userInput } = await Swal.fire({
        title: 'تأیید امنیتی حذف نهایی',
        html: `
            <div style="text-align:center; direction:rtl;">
                <p style="font-size:13px; color:#94a3b8; margin-bottom:15px;">
                    شما در حال حذف کامل بانک <b style="color:#fff;">"${poolName}"</b> هستید.<br>
                    تمام اطلاعات اعضا و تراکنش‌ها برای همیشه پاک خواهد شد.
                </p>
                <p style="font-size:11px; color:#f87171; font-weight:bold; margin-bottom:10px;">
                    برای تأیید عملیات، عدد زیر را وارد کنید:
                </p>
                <div style="font-size:28px; font-[900]; color:#fbbf24; letter-spacing:10px; margin-bottom:15px; background:rgba(255,255,255,0.05); padding:10px; border-radius:15px; border:1px dashed #fbbf24;">
                    ${securityCode}
                </div>
            </div>
        `,
        input: 'text',
        inputPlaceholder: 'کد بالا را اینجا بنویسید...',
        showCancelButton: true,
        confirmButtonText: 'تخریب و حذف کامل',
        cancelButtonText: 'انصراف',
        confirmButtonColor: '#ef4444', // قرمز
        cancelButtonColor: '#64748b',
        customClass: {
            popup: 'rounded-[2.5rem] glass-card',
            input: 'text-center font-black text-xl tracking-widest'
        },
        // چک کردن درستی عدد وارد شده
        inputValidator: (value) => {
            if (!value) return 'لطفاً کد امنیتی را وارد کنید!';
            if (value !== securityCode.toString()) return 'کد وارد شده اشتباه است! ❌';
        }
    });

    // ۳. اگر کاربر عدد را درست وارد کرد:
    if (userInput === securityCode.toString()) {
        try {
            // نمایش لودینگ حین حذف
            Swal.fire({
                title: 'در حال پاکسازی خزانه...',
                html: 'لطفاً صبور باشید، این عملیات غیرقابل بازگشت است.',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });

            // دستور حذف کامل (شامل اکانت‌های Supabase Auth) از طریق RPC
            const { value: pw } = await Swal.fire({
                title: 'رمز اصلی برای حذف',
                input: 'password',
                inputAttributes: { autocomplete: 'current-password' },
                text: 'برای حذف نهایی رمز اصلی COMMAND CENTER را وارد کنید.',
                showCancelButton: true,
                cancelButtonText: 'انصراف',
                confirmButtonColor: '#ef4444'
            });
            if (!pw) return;

            const { data: success, error } = await supabaseClient.rpc('delete_pool_complete', {
                pool_id_param: Number(poolId),
                admin_password: pw
            });

            if (error) throw error;
            if (!success) throw new Error('حذف کامل انجام نشد');

            // پیام موفقیت نهایی
            await Swal.fire({
                title: 'حذف موفقیت‌آمیز',
                text: `بانک "${poolName}" و تمام متعلقات آن با موفقیت از سیستم پاک شد.`,
                icon: 'success',
                confirmButtonColor: '#10b981',
                customClass: { popup: 'rounded-[2.5rem]' }
            });

            // بروزرسانی لیست در صفحه سوپر ادمین
            loadMasterStats();

        } catch (e) {
            Swal.fire({
                title: 'خطای سیستمی',
                text: 'مشکلی در حذف بوجود آمد: ' + e.message,
                icon: 'error',
                confirmButtonColor: '#ef4444'
            });
        }
    }
};


/************************************************
 * تابع تغییر رمز عبور ستاد فرماندهی (نسخه امنیتی)
 ************************************************/
/************************************************
 * تابع مدیریت باز و بسته شدن کرکره‌ها (Accordion)
 ************************************************/
window.toggleAccordion = function(contentId, iconId) {
    const content = document.getElementById(contentId);
    const icon = document.getElementById(iconId);
    
    if (content && icon) {
        // باز یا بسته کردن کلاس open
        content.classList.toggle('open');
        icon.classList.toggle('open');
        
        // ایجاد یک لرزش بسیار خفیف برای حس بهتر در گوشی
        if (window.navigator.vibrate) window.navigator.vibrate(10);
        
        console.log(`بخش ${contentId} تغییر وضعیت داد.`);
    } else {
        console.error("خطا: المان‌های کرکره پیدا نشدند!");
    }
};


/************************************************
 * تابع تغییر رمز عبور (مرحله اول) - نسخه لوکس و فیکس
 ************************************************/
window.handleChangeMasterPassword = async function() {
    const { value: formValues } = await Swal.fire({
        title: '<span style="color:#fff; font-size:18px; font-weight:900;">تغییر کلید امنیتی (لایه ۱)</span>',
        html: `
            <div style="padding: 5px; overflow: hidden;">
                <input id="old-p" class="swal2-input" type="password" placeholder="رمز عبور فعلی" 
                    style="width: 100%; margin: 15px 0 5px 0; box-sizing: border-box; text-align: center; border-radius: 20px; background: #0f172a; border: 1px solid #334155; color: #fbbf24; font-size: 14px;">
                <input id="new-p" class="swal2-input" type="password" placeholder="رمز عبور جدید" 
                    style="width: 100%; margin: 10px 0; box-sizing: border-box; text-align: center; border-radius: 20px; background: #0f172a; border: 1px solid #334155; color: #fff; font-size: 14px;">
            </div>
        `,
        confirmButtonText: 'بروزرسانی رمز',
        showCancelButton: true,
        cancelButtonText: 'انصراف',
        confirmButtonColor: '#fbbf24',
        cancelButtonColor: '#334155',
        background: '#1e293b', // تم تیره
        color: '#fff',
        customClass: {
            popup: 'rounded-[3rem] border border-white/10 shadow-2xl',
            confirmButton: 'rounded-2xl py-3 px-6 font-black text-slate-900',
            cancelButton: 'rounded-2xl py-3 px-6'
        },
        preConfirm: () => {
            const oldPass = document.getElementById('old-p').value;
            const newPass = document.getElementById('new-p').value;
            if (!oldPass || newPass.length < 8) { Swal.showValidationMessage('رمز جدید باید حداقل ۸ کاراکتر باشد'); return false; }
            return [oldPass, newPass];
        }
    });

    if (formValues && formValues[0] && formValues[1]) {
        Swal.fire({ title: 'در حال ایمن‌سازی...', didOpen: () => Swal.showLoading() });
        const { data: isOk, error } = await supabaseClient.rpc('update_master_password', {
            current_pass: formValues[0],
            new_pass: formValues[1]
        });

        if (error) throw error;
        if (isOk) {
            Swal.fire({ title: 'انجام شد ✅', text: 'رمز عبور با موفقیت تغییر کرد.', icon: 'success', confirmButtonColor: '#10b981', customClass: { popup: 'rounded-[2rem]' } });
        } else {
            Swal.fire({ title: 'خطا ❌', text: 'رمز عبور فعلی اشتباه است.', icon: 'error', confirmButtonColor: '#ef4444', customClass: { popup: 'rounded-[2rem]' } });
        }
    }
};

/************************************************
 * تابع تغییر عدد مخفی (مرحله دوم) - نسخه لوکس و فیکس
 ************************************************/
window.handleChangeSecretNumber = async function() {
    const { value: formValues } = await Swal.fire({
        title: '<span style="color:#fff; font-size:18px; font-weight:900;">تغییر عدد فرمول (لایه ۲)</span>',
        html: `
            <div style="padding: 5px; overflow: hidden;">
                <input id="p-auth" class="swal2-input" type="password" placeholder="رمز عبور اصلی جهت تایید" 
                    style="width: 100%; margin: 15px 0 5px 0; box-sizing: border-box; text-align: center; border-radius: 20px; background: #0f172a; border: 1px solid #334155; color: #fbbf24; font-size: 14px;">
                <input id="new-otp" class="swal2-input" type="number" placeholder="عدد مخفی جدید (۴ یا ۵ رقم)" 
                    style="width: 100%; margin: 10px 0; box-sizing: border-box; text-align: center; border-radius: 20px; background: #0f172a; border: 1px solid #334155; color: #fff; font-size: 14px;">
            </div>
        `,
        confirmButtonText: 'ثبت عدد جدید',
        showCancelButton: true,
        cancelButtonText: 'انصراف',
        confirmButtonColor: '#fbbf24',
        background: '#1e293b',
        color: '#fff',
        customClass: {
            popup: 'rounded-[3rem] border border-white/10 shadow-2xl',
            confirmButton: 'rounded-2xl py-3 px-6 font-black text-slate-900',
            cancelButton: 'rounded-2xl py-3 px-6'
        },
        preConfirm: () => {
            const auth = document.getElementById('p-auth').value;
            const otp = document.getElementById('new-otp').value;
            if (!auth || !/^\d{4,5}$/.test(otp)) { Swal.showValidationMessage('رمز و عدد مخفی ۴ یا ۵ رقمی الزامی است'); return false; }
            return [auth, otp];
        }
    });

    if (formValues && formValues[0] && formValues[1]) {
        Swal.fire({ title: 'در حال ثبت...', didOpen: () => Swal.showLoading() });
        const { data: isOk, error } = await supabaseClient.rpc('update_master_otp_secret', {
            current_pass: formValues[0],
            new_secret_num: parseInt(formValues[1])
        });

        if (error) throw error;
        if (isOk) {
            Swal.fire({ title: 'تغییر یافت ✅', text: 'عدد مخفی فرمول بروزرسانی شد.', icon: 'success', confirmButtonColor: '#10b981', customClass: { popup: 'rounded-[2rem]' } });
        } else {
            Swal.fire({ title: 'عدم تایید ❌', text: 'رمز عبور اصلی اشتباه است.', icon: 'error', confirmButtonColor: '#ef4444', customClass: { popup: 'rounded-[2rem]' } });
        }
    }
};





/************************************************
 * تابع ذخیره عدد ثابت ماشه (تعداد کلیک‌ها)
 ************************************************/
window.saveClickConstant = async function(btn) {
    const clickInput = document.getElementById('click-constant-input');
    if (!clickInput) return;

    const newVal = parseInt(clickInput.value);

    // ۱. اعتبار سنجی (عدد نباید خیلی کوچک یا خیلی بزرگ باشد)
    if (isNaN(newVal) || newVal < 3 || newVal > 20) {
        return Swal.fire({
            text: "عدد ثابت باید بین ۳ تا ۲۰ باشد ❌",
            icon: 'warning',
            confirmButtonColor: '#fbbf24',
            customClass: { popup: 'rounded-[2.5rem] glass-card' }
        });
    }

    // تایید رمز اصلی قبل از هر تغییری در global_config (چون نوشتن مستقیم دیگه مجاز نیست)
    const { value: pw } = await Swal.fire({
        title: 'تایید هویت',
        input: 'password',
        text: 'برای ذخیره، رمز اصلی (COMMAND CENTER) رو وارد کن',
        confirmButtonColor: '#fbbf24',
        customClass: { popup: 'rounded-[2.5rem] glass-card' }
    });
    if (!pw) return;

    // تغییر وضعیت دکمه
    const originalText = btn ? btn.innerText : 'ذخیره';
    if (btn) { btn.disabled = true; btn.innerText = "در حال ثبت..."; }

    try {
        // ۲. آپدیت از طریق RPC امن (نه نوشتن مستقیم روی جدول)
        const { data: ok, error } = await supabaseClient.rpc('update_global_config', {
            admin_password: pw,
            new_master_card: null,
            new_master_card_name: null,
            new_click_constant: newVal
        });

        if (error) throw error;
        if (!ok) throw new Error('رمز اصلی اشتباه است ❌');

        // ۳. پیام موفقیت شیک
        await Swal.fire({
            title: 'ماشه بروزرسانی شد ✅',
            text: `از این به بعد تعداد ضربات مرحله اول ${newVal} بار خواهد بود.`,
            icon: 'success',
            confirmButtonColor: '#fbbf24',
            customClass: { popup: 'rounded-[2.5rem] glass-card' }
        });

    } catch (e) {
        console.error(e);
        Swal.fire({ text: "خطا در ذخیره‌سازی: " + e.message, icon: 'error' });
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = originalText; }
    }
};