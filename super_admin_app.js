/************************************************
 * نسخه نهایی و تضمینی ستاد فرماندهی (Super Admin)
 ************************************************/
var SUPABASE_URL = 'https://kqnsbnpznkwkwukzokik.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxbnNibnB6bmt3a3d1a3pva2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1NDc4NjgsImV4cCI6MjA4MjEyMzg2OH0.dsqyFP37JyrfYDVwasNZW_Aid9ah0e6SxdnS8j8xV5s';

// همان تنظیمات ذخیره‌سازی صفحه ورود تا Session Supabase در انتقال به
// super_admin.html روی موبایل و مرورگر حفظ شود.
var supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        persistSession: true,
        storageKey: 'ebank-super-admin-session',
        storage: window.localStorage,
        autoRefreshToken: true,
        detectSessionInUrl: false
    }
});

var allPoolsCache = [];

// جادوی شیک‌سازی خودکار تمام پیام‌های ساده
window.alert = function(msg) {
    Swal.fire({
        text: msg,
        icon: 'info',
        confirmButtonText: 'متوجه شدم',
        confirmButtonColor: '#fbbf24',
        customClass: { popup: 'rounded-را[2.5rem] glass-card' }
    });
};


/************************************************
 * موتور شروع به کار ستاد فرماندهی (INIT)
 ************************************************/
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🔍 Checking Super Admin Access...');

    // نشان محلی فقط مرحله ۲ را تأیید می‌کند؛ مجوز واقعی باید از Supabase Auth + members خوانده شود.
    const twoFactorPassed = sessionStorage.getItem('super_admin_2fa') === 'true';

    try {
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
        if (authError || !user || !twoFactorPassed) {
            throw new Error('NO_SUPER_ADMIN_SESSION');
        }

        const { data: profile, error: profileError } = await supabaseClient
            .from('members')
            .select('id,full_name,is_super_admin,status')
            .eq('id', user.id)
            .single();

        if (profileError || !profile || profile.is_super_admin !== true || profile.status === 'blocked') {
            throw new Error('NO_SUPER_ADMIN_PERMISSION');
        }

        console.log('✅ 👑 مدیریت ارشد تایید شد', { user_id: user.id });

        // نمایش نام کاربر
        const userName = profile.full_name || sessionStorage.getItem('user_name') || 'E.BANK OWNER';
        sessionStorage.setItem('user_name', userName);
        const nameEl = document.getElementById('user-name-display');
        if (nameEl) nameEl.textContent = userName;

        // لود داده‌ها
        await loadMasterStats();
        await loadBillingHistory();
        await loadMasterCard();

        console.log('✅ همه داده‌ها لود شد');

    } catch (err) {
        console.error('❌ Super Admin access denied:', err);
        sessionStorage.removeItem('super_admin_2fa');
        sessionStorage.removeItem('user_name');
        try { await supabaseClient.auth.signOut(); } catch (_) {}

        await Swal.fire({
            title: 'نشست مدیریت منقضی یا نامعتبر است',
            text: 'لطفاً دوباره از صفحه ورود Super Admin وارد شوید.',
            icon: 'warning',
            timer: 1800,
            showConfirmButton: false
        });
        window.location.replace('super-admin-login.html');
    }
});
// --- توابع هسته مرکزی ---

async function loadMasterStats() {
    try {
        const { data: pools } = await supabaseClient.from('pools').select('*').order('created_at', { ascending: false });
        const { count: userCount } = await supabaseClient.from('members').select('*', { count: 'exact', head: true });

        document.getElementById('total-pools').innerText = pools ? pools.length : 0;
        document.getElementById('total-users').innerText = userCount || 0;

        allPoolsCache = pools || [];
        renderPoolsList();
    } catch (e) { console.error(e); }
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
                            <input type="number" id="price-${pool.id}" value="${pool.sub_price || 100000}" class="w-full bg-transparent text-[10px] font-black text-yellow-500 outline-none">
                        </div>
                        <div>
                            <label class="text-[7px] text-slate-500 block mb-1">قیمت سهمیه:</label>
                            <input type="number" id="share-price-${pool.id}" value="${pool.share_price || 10000}" class="w-full bg-transparent text-[10px] font-black text-emerald-400 outline-none">
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
        const { data: poolInfo } = await supabaseClient
            .from('pools')
            .select('sub_price, sub_duration_days, share_price')
            .eq('id', poolId)
            .single();

        // ۳. ساخت محتوای مودال به صورت لیست
        let listHtml = `
            <div style="direction:rtl; text-align:right; max-height:60vh; overflow-y:auto; padding:5px;">
                <p style="font-size:11px; color:#94a3b8; margin-bottom:15px; text-align:center;">تعرفه این صندوق: هر سهمیه ${Number(poolInfo.share_price).toLocaleString()} ت | هر ۳۰ روز ${Number(poolInfo.sub_price).toLocaleString()} ت</p>
        `;

        requests.forEach(req => {
            // محاسبات هوشمند لحظه‌ای برای نمایش به شما 👇
            const calcDays = Math.floor((req.amount / (poolInfo.sub_price || 100000)) * (poolInfo.sub_duration_days || 30));
            const calcSlots = Math.floor(req.amount / (poolInfo.share_price || 10000));

            listHtml += `
                <div style="background:rgba(255,255,255,0.05); padding:20px; border-radius:25px; border:1px solid rgba(255,255,255,0.1); margin-bottom:15px; box-shadow:0 10px 20px rgba(0,0,0,0.2);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                        <span style="color:#fbbf24; font-[900]; font-size:16px;">${Number(req.amount).toLocaleString()} <small style="font-size:9px; font-weight:normal;">تومان</small></span>
                        <a href="${req.receipt_url}" target="_blank" style="background:#4f46e5; color:white; padding:8px 15px; border-radius:12px; font-size:10px; font-weight:black; text-decoration:none;">
                            <i class="fas fa-eye ml-1"></i> مشاهده فیش
                        </a>
                    </div>
                    
                    <div style="display:grid; grid-cols:1; gap:8px;">
                        <!-- دکمه تایید اشتراک با نمایش روز محاسبه شده -->
                        <button onclick="Swal.close(); approveSubscription(${req.id}, ${poolId}, ${req.amount})" 
                                style="width:100%; background:#10b981; color:white; border:none; padding:12px; border-radius:15px; font-[900]; font-size:11px; cursor:pointer;">
                            تایید بعنوان اشتراک (${calcDays} روز اعتبار)
                        </button>
                        
                        <!-- دکمه تایید سهمیه با نمایش تعداد محاسبه شده -->
                        <button onclick="Swal.close(); approveMemberQuota(${req.id}, ${poolId}, ${req.amount})" 
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
            title: `<span style="color:#fff; font-size:18px;">بررسی مالی: ${poolName}</span>`,
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
    try {
        // ۱. گرفتن تنظیمات قیمت و تاریخ انقضای فعلی این صندوق
        const { data: pool } = await supabaseClient
            .from('pools')
            .select('sub_expiry, sub_price, sub_duration_days')
            .eq('id', poolId)
            .single();

        const unitPrice = Number(pool.sub_price || 100000); // قیمت یک دوره
        const unitDays = Number(pool.sub_duration_days || 30); // طول یک دوره (مثلا ۳۰ روز)

        // ۲. فرمول طلایی محاسبه روزهای تعلق گرفته 👇
        // روزهای جایزه = (مبلغ واریزی تقسیم بر قیمت واحد) ضربدر تعداد روز واحد
        const daysToGrant = Math.floor((Number(paidAmount) / unitPrice) * unitDays);

        if (daysToGrant <= 0) {
            return Swal.fire({ text: "مبلغ واریزی حتی برای ۱ روز اشتراک هم کافی نیست!", icon: 'error' });
        }

        // ۳. محاسبه تاریخ جدید
        let currentExpiry = new Date(pool.sub_expiry);
        let now = new Date();
        let startDate = currentExpiry > now ? currentExpiry : now;
        startDate.setDate(startDate.getDate() + daysToGrant);

        // ۴. بروزرسانی در دیتابیس
        await supabaseClient.from('pools').update({
            sub_expiry: startDate.toISOString(),
            is_active: true
        }).eq('id', poolId);

        await supabaseClient.from('sub_requests').update({ status: 'approved' }).eq('id', requestId);

        await Swal.fire({
            title: 'تمدید هوشمند انجام شد',
            html: `مبلغ <b>${Number(paidAmount).toLocaleString()}</b> تایید شد.<br>مطابق تعرفه، <b>${daysToGrant} روز</b> به اعتبار این صندوق اضافه گردید. ✅`,
            icon: 'success',
            confirmButtonColor: '#10b981',
            customClass: { popup: 'rounded-[2.5rem] glass-card' }
        });

        location.reload();
    } catch (e) { alert("خطا در تمدید: " + e.message); }
};

/************************************************
 * تایید هوشمند سهمیه (محاسبه بر اساس قیمت واحد)
 ************************************************/
window.approveMemberQuota = async function(requestId, poolId, paidAmount) {
    try {
        const { data: pool } = await supabaseClient.from('pools').select('member_capacity, share_price').eq('id', poolId).single();
        
        const pricePerShare = Number(pool.share_price || 10000);
        
        // محاسبه تعداد سهمیه‌ها 👇
        const newSlots = Math.floor(Number(paidAmount) / pricePerShare);

        if (newSlots <= 0) {
            return Swal.fire({ text: "مبلغ برای خرید حتی ۱ سهمیه هم کافی نیست!", icon: 'error' });
        }

        await supabaseClient.from('pools').update({
            member_capacity: (pool.member_capacity || 0) + newSlots
        }).eq('id', poolId);

        await supabaseClient.from('sub_requests').update({ status: 'approved' }).eq('id', requestId);

        await Swal.fire({
            title: 'افزایش سهمیه انجام شد',
            text: `تعداد ${newSlots} سهمیه جدید به صندوق اضافه شد. ✅`,
            icon: 'success',
            confirmButtonColor: '#10b981',
            customClass: { popup: 'rounded-[2.5rem] glass-card' }
        });

        location.reload();
    } catch (e) { alert("خطا در سهمیه"); }
};

async function loadBillingHistory() {
    try {
        const { data } = await supabaseClient.from('sub_requests').select('amount, status, created_at, pools(pool_name)').order('created_at', { ascending: false });
        
        const totalRevenue = data?.filter(req => req.status === 'approved').reduce((sum, current) => sum + Number(current.amount), 0) || 0;
        const revEl = document.getElementById('total-revenue-amt');
        if (revEl) revEl.innerHTML = `${totalRevenue.toLocaleString()} <span class="text-sm font-normal text-slate-500">تومان</span>`;

        const container = document.getElementById('billing-container');
        if (!container || !data) return;

        container.innerHTML = data.map(req => `
            <div class="glass-card p-5 rounded-[2rem] flex justify-between items-center border-white/5 mb-3">
                <div class="text-right">
                    <p class="text-[10px] font-black text-white">${req.pools ? req.pools.pool_name : 'نامشخص'}</p>
                    <p class="text-[8px] text-slate-500 mt-1">${new Date(req.created_at).toLocaleDateString('fa-IR')}</p>
                </div>
                <div class="text-left">
                    <p class="text-xs font-black text-emerald-400">${Number(req.amount).toLocaleString()} ت</p>
                    <span class="text-[7px] font-bold px-2 py-0.5 rounded-full ${req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-orange-500/10 text-orange-500'}">
                        ${req.status === 'approved' ? 'تایید نهایی' : 'در انتظار'}
                    </span>
                </div>
            </div>`).join('');
    } catch (e) { console.error(e); }
}

window.exportBillingToExcel = async function() {
    try {
        const { data } = await supabaseClient.from('sub_requests').select('amount, status, created_at, pools(pool_name)');
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
window.saveMasterCard = async function() {
    const newCard = document.getElementById('master-card-input').value.trim();
    const newName = document.getElementById('master-card-name-input').value.trim();
    const btn = event.currentTarget;

    if (newCard.length < 16 || !newName) {
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
            const { data: success, error } = await supabaseClient.rpc('delete_pool_complete', {
                pool_id_param: poolId
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
window.handleChangeMasterPassword = async function() {
    const { value: formValues } = await Swal.fire({
        title: '<span style="color:#fff; font-size:18px;">تغییر کلید دسترسی ستاد</span>',
        html: `
            <div style="padding: 10px; overflow-x: hidden;">
                <input id="swal-input1" class="swal2-input" type="password" placeholder="رمز عبور فعلی" 
                    style="width: 100%; margin: 10px 0; box-sizing: border-box; text-align: center; border-radius: 15px; background: #0f172a; border: 1px solid #334155; color: #fbbf24;">
                <input id="swal-input2" class="swal2-input" type="password" placeholder="رمز عبور جدید" 
                    style="width: 100%; margin: 10px 0; box-sizing: border-box; text-align: center; border-radius: 15px; background: #0f172a; border: 1px solid #334155; color: #fff;">
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'بروزرسانی رمز',
        cancelButtonText: 'انصراف',
        confirmButtonColor: '#ef4444',
        background: '#1e293b',
        customClass: { popup: 'rounded-[2.5rem] border border-white/10 shadow-2xl' },
        preConfirm: () => {
            const p1 = document.getElementById('swal-input1').value;
            const p2 = document.getElementById('swal-input2').value;
            if (!p1 || !p2) {
                Swal.showValidationMessage('لطفاً هر دو کادر را پر کنید');
                return false;
            }
            return [p1, p2];
        }
    });

    if (formValues) {
        const [oldPass, newPass] = formValues;
        if (newPass.length < 8) return Swal.fire({ text: "رمز جدید باید حداقل ۸ کاراکتر باشد", icon: 'error' });

        Swal.fire({ title: 'در حال ایمن‌سازی...', didOpen: () => Swal.showLoading() });

        try {
            const { data: success, error } = await supabaseClient.rpc('update_master_password', {
                current_pass: oldPass,
                new_pass: newPass
            });
            if (error) throw error;

            if (success) {
                await Swal.fire({ title: 'موفقیت‌آمیز', text: 'رمز عبور ستاد با موفقیت تغییر یافت ✅', icon: 'success', confirmButtonColor: '#10b981', customClass: { popup: 'rounded-[2rem]' } });
            } else {
                await Swal.fire({ title: 'خطا', text: 'رمز فعلی اشتباه است! ❌', icon: 'error', confirmButtonColor: '#ef4444', customClass: { popup: 'rounded-[2rem]' } });
            }
        } catch (e) { alert("خطای سیستمی: " + e.message); }
    }
};

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
        preConfirm: () => [document.getElementById('old-p').value, document.getElementById('new-p').value]
    });

    if (formValues && formValues[0] && formValues[1]) {
        Swal.fire({ title: 'در حال ایمن‌سازی...', didOpen: () => Swal.showLoading() });
        const { data: isOk } = await supabaseClient.rpc('update_master_password', {
            current_pass: formValues[0],
            new_pass: formValues[1]
        });

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
        preConfirm: () => [document.getElementById('p-auth').value, document.getElementById('new-otp').value]
    });

    if (formValues && formValues[0] && formValues[1]) {
        Swal.fire({ title: 'در حال ثبت...', didOpen: () => Swal.showLoading() });
        const { data: isOk } = await supabaseClient.rpc('update_master_otp_secret', {
            current_pass: formValues[0],
            new_secret_num: parseInt(formValues[1])
        });

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
window.saveClickConstant = async function() {
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
    const btn = event.currentTarget;
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "در حال ثبت...";

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
        btn.disabled = false;
        btn.innerText = originalText;
    }
};