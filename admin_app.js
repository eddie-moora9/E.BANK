/* ==================================================
   E.BANK ADMIN - INITIALIZATION (v11.7)
   ================================================== */

// ۱. تعریف ثابت‌های اتصال (نام‌ها هماهنگ شد) ✅
const S_URL = 'https://kqnsbnpznkwkwukzokik.supabase.co';
const S_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxbnNibnB6bmt3a3d1a3pva2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1NDc4NjgsImV4cCI6MjA4MjEyMzg2OH0.dsqyFP37JyrfYDVwasNZW_Aid9ah0e6SxdnS8j8xV5s';

var supabaseClient = null;
var allMembersData = [];
var selectedMemberForReport = null;
var allProjectsDataCache = [];

// ۲. تابع مقداردهی اولیه به دیتابیس (نسخه استاندارد و پایدار) ✅
function initSupabase() {
    if (typeof supabase !== 'undefined' && !supabaseClient) {
        supabaseClient = supabase.createClient(S_URL, S_KEY, {
            auth: {
                persistSession: true,
                storageKey: 'ebank-auth-session', // دقیقاً هماهنگ با فایل‌های دیگر
                storage: window.localStorage,     // استفاده از حافظه پایدار
                autoRefreshToken: true,
                detectSessionInUrl: false
            }
        });
        console.log("✅ اتصال مدیر به دیتابیس برقرار شد.");
        return true;
    }
    return !!supabaseClient;
}



// تست ساده برای چک کردن
async function testPoolInfo() {
    const poolId = sessionStorage.getItem('pool_id');
    console.log("Pool ID:", poolId);
    
    if (poolId) {
        const { data, error } = await supabaseClient
            .from('pools')
            .select('*')
            .eq('id', poolId)
            .single();
        
        console.log("Pool Data:", data);
        console.log("Error:", error);
    }
}


/************************************************
 * تابع تولید مدال‌های افتخار
 ************************************************/
window.generateMemberBadges = function(member) {
    let html = '';
    const score = member.coins || 0;
    
    // الماس خوش‌حساب
    if (score >= 100) {
        html += `<div class="badge-icon bg-cyan-500" title="الماس خوش‌حسابی (${score} سکه)"><i class="fas fa-gem"></i></div>`;
    }
    
    // همیار (بخشنده نوبت)
    if (member.turn_given_count > 0) {
        html += `<div class="badge-icon bg-emerald-500" title="یارِ صندوق"><i class="fas fa-hands-helping"></i></div>`;
    }
    
    // پیشکسوت (قدیمی‌تر از ۶ ماه)
    if (member.created_at) {
        const joinDate = new Date(member.created_at);
        const monthsDiff = (new Date() - joinDate) / (1000 * 60 * 60 * 24 * 30);
        if (monthsDiff > 6) {
            html += `<div class="badge-icon bg-purple-500" title="پیشکسوت"><i class="fas fa-shield-alt"></i></div>`;
        }
    }

    // هشدار تسویه — بر اساس بدهکاربودن واقعی این ماه، نه سکه (سکه ربطی به بدهی جاری نداره)
    if (member.debt_warning_msg) {
        html += `<div class="badge-icon bg-rose-500 animate-pulse" title="هشدار تسویه"><i class="fas fa-exclamation-triangle"></i></div>`;
    }

    return html ? `<div class="badge-container">${html}</div>` : '';
};


// ۳. ترفند شیک‌سازی خودکار Alertها برای مدیر
window.alert = function(message) {
    Swal.fire({
        text: message,
        icon: 'info',
        confirmButtonText: 'متوجه شدم',
        confirmButtonColor: '#4f46e5',
        customClass: { popup: 'rounded-[2rem]' }
    });
};


/************************************************
 * تابع هوشمند تولید مدال‌های افتخار (Badges)
 ************************************************/




 function toggleLoading(btnId, isLoading, loadingText = "در حال پردازش...") {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    if (isLoading) {
        // ذخیره متن فعلی دکمه در حافظه موقتِ خودش 👇
        btn.dataset.originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <span class="mr-2">${loadingText}</span>`;
    } else {
        // برگرداندن متن اصلی به صورت خودکار ✅
        btn.disabled = false;
        if (btn.dataset.originalHtml) {
            btn.innerHTML = btn.dataset.originalHtml;
        }
    }
}

// تابع امنیتی برای تبدیل رمز عبور به کد غیرقابل بازگشت (SHA-256)
async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}


const Validator = {
    isMobile: (v) => /^09\d{9}$/.test(v),
    isCard: (v) => /^\d{16}$/.test(v),
    isMinLen: (v, l) => v.trim().length >= l
};



window.toggleDrawer = function(isOpen) {
    const drawer = document.getElementById('admin-drawer');
    const content = document.getElementById('drawer-content');
    const overlay = document.getElementById('drawer-overlay');

    if (isOpen) {
        drawer.classList.remove('invisible');
        overlay.classList.add('opacity-100');
        content.classList.remove('translate-x-full');
    } else {
        overlay.classList.remove('opacity-100');
        content.classList.add('translate-x-full');
        setTimeout(() => drawer.classList.add('invisible'), 300);
    }
};

window.openDrawerSection = function(sectionId) {
    toggleDrawer(false); // اول منوی همبرگری رو ببند
    
    // شبیه سازی کلیک روی تب کنترل (چون تنظیمات اونجاست)
    showAdminSec(null, sectionId);
    
    // اگر بخش تنظیمات باز شد، کرکره مربوطه رو هم اتوماتیک باز کن 👇
    if (sectionId === 'admin-settings-sec') {
        setTimeout(() => {
            const firstAcc = document.getElementById('set-group-1');
            if (firstAcc) {
                firstAcc.classList.replace('max-h-0', 'max-h-screen');
                document.getElementById('icon-set-1')?.classList.add('rotate-180');
            }
        }, 500);
    }
};

/************************************************
 * تابع مدیریت جابجایی بین بخش‌ها (نسخه اصلاح شده)
 ************************************************/
window.showAdminSec = function(btn, sectionId) {
    // لیست تمام بخش‌های موجود در فایل HTML شما 👇
    const sections = [
        'admin-home-sec', 
        'admin-ops-sec', 
        'admin-comm-sec', 
        'admin-biz-sec', 
        'admin-members-sec', 
        'admin-settings-sec' // آیدی تنظیمات حتماً اینجا باشد ✅
    ];

    // ۱. مخفی کردن تمام بخش‌ها به صورت یکجا
    sections.forEach(s => {
        const el = document.getElementById(s);
        if (el) el.classList.add('hidden');
    });

    // ۲. نمایش بخش انتخاب شده (با ری‌استارت انیمیشن fadeIn، تا همه‌ی تب‌ها یکسان رفتار کنن)
    const target = document.getElementById(sectionId);
    if (target) {
        target.classList.remove('hidden');
        target.classList.remove('animate__fadeIn');
        void target.offsetWidth; // فورس ریفلو برای ری‌استارت انیمیشن
        target.classList.add('animate__animated', 'animate__fadeIn');
        window.scrollTo(0, 0); // پرش به ابتدای صفحه
    }
    

    // ۳. مدیریت رنگ و استایل دکمه‌های منوی پایین
    document.querySelectorAll('.nav-btn').forEach(b => {
        b.classList.remove('active', 'text-indigo-400');
        b.classList.add('text-slate-500');
    });

    // مدیریت رنگ دکمه مرکزی (خانه)
    const centerBtn = document.getElementById('nav-home');
    if (centerBtn) centerBtn.classList.replace('bg-indigo-600', 'bg-slate-700');

    if (sectionId === 'admin-home-sec') {
        if (centerBtn) centerBtn.classList.replace('bg-slate-700', 'bg-indigo-600');
    } else if (btn) {
        btn.classList.add('active', 'text-indigo-400');
        btn.classList.remove('text-slate-500');
    }

    // ۴. لودرهای اختصاصی هر بخش
    const pId = sessionStorage.getItem('pool_id');
    
 
if (sectionId === 'admin-ops-sec') {
    const pId = sessionStorage.getItem('pool_id');
    loadPendingReceipts(pId);   // لود فیش‌ها
    loadAdminLoans(pId);        // لود درخواست‌های مساعده 👈 اضافه شد
    loadCoinRequests(pId);       // لود درخواست‌های مساعده‌ی سکه‌ای
    loadTransactionLog(pId);    // لود لاگ تراکنش‌ها
    checkMonthlyLoanWarning(pId); // چک اخطار وام ماهانه‌ی پرداخت‌نشده
    loadOpsTabContent(pId);     // لود صف نوبت و بدهکاران
}

    
    if (sectionId === 'admin-biz-sec') loadAdminProjects(pId);
    if (sectionId === 'admin-members-sec') loadAllMembers(pId);
    if (sectionId === 'admin-comm-sec') loadUnifiedStream();
};


// ۱. ابتدا تابع را بیرون از بلاک اصلی تعریف کن (برای نظم بیشتر)
async function checkSubscriptionStatus(poolId) {
    const displayHeader = document.getElementById('sub-days-display');
    const displayLarge = document.getElementById('sub-days-left-large');
    const pill = document.getElementById('sub-status-pill');
    
        // داخل تابع showAdminSec
const pId = sessionStorage.getItem('pool_id');
updateTaskBadge(pId); // چک کردن مداوم وضعیت فیش‌ها ✅


    try {
        const { data: pool } = await supabaseClient.from('pools').select('sub_expiry, is_active').eq('id', poolId).single();
        
        if (pool) {
            const now = new Date();
            const expiry = new Date(pool.sub_expiry);
            const diffTime = expiry.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // آپدیت متن در هدر و منوی همبرگری 👇
            if (displayHeader) displayHeader.innerText = diffDays > 0 ? diffDays + " روز باقی‌مانده" : "منقضی شده ⚠️";
            if (displayLarge) displayLarge.innerText = diffDays > 0 ? diffDays : "۰";

            // تغییر رنگ هوشمند نشانگر (Pill)
            if (pill) {
                if (diffDays <= 0 || pool.is_active === false) {
                    pill.className = "inline-flex items-center gap-1.5 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full mt-1 text-rose-600";
                } else if (diffDays <= 7) {
                    pill.className = "inline-flex items-center gap-1.5 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full mt-1 text-amber-600";
                } else {
                    pill.className = "inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full mt-1 text-emerald-600";
                }
            }

            // لایه امنیتی: مسدود سازی اگر بیش از ۶ ساعت از انقضا گذشته بود
            if (pool.is_active === false || diffTime < -21600000) {
                if (typeof showLockPage === 'function') {
                    showLockPage();
                    return false; // یعنی مسدود است
                }
            }
        }
        return true; // یعنی دسترسی باز است
    } catch (e) { 
        console.log("Sub Check Error"); 
        return true;
    }
}

// ۲. حالا موتور اصلی برنامه
document.addEventListener('DOMContentLoaded', async () => {
    // حذف اسپلش (کدهای قبلی خودت...)
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) { splash.style.opacity = '0'; setTimeout(() => splash.remove(), 700); }
    }, 2500);

    if (typeof initSupabase === 'function') initSupabase();
    if (!supabaseClient) return;

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) { window.location.replace('index.html'); return; }

        let _PID = sessionStorage.getItem('pool_id');
        if (!_PID || _PID === "null") {
            const { data: p } = await supabaseClient.from('members').select('pool_id').eq('id', session.user.id).single();
            if (p) { _PID = p.pool_id; sessionStorage.setItem('pool_id', _PID); }
        }

        const homeSec = document.getElementById('admin-home-sec');
        if (homeSec) homeSec.classList.remove('hidden');

        // 🔥 مرحله طلایی: صدا زدن تابع چک اشتراک
        const isAccessGranted = await checkSubscriptionStatus(_PID);
        
        // اگر دسترسی تایید شد، بقیه لودرها اجرا شوند
        if (isAccessGranted) {
            
            testPoolInfo();
            calculateStats(_PID);
            loadPoolHeaderInfo(_PID);
            loadAllMembers(_PID);
            loadPendingReceipts(_PID);
            loadAdminLoans(_PID);
            loadCoinRequests(_PID);
            loadTransactionLog(_PID);
            loadLoanQueue(_PID);
            loadAdminProjects(_PID);
            loadCurrentConfig(_PID);
           updateCapacityDisplay(_PID);
            updateTaskBadge(_PID);
            loadPendingReceipts(_PID);
       
            
            if (typeof initSecurityMonitor === 'function') initSecurityMonitor();
        }

    } catch (err) { console.error(err); }
});
/************************************************
 * تابع کمکی برای بررسی امنیت و حجم فایل‌ها
 ************************************************/
function validateAdminFile(file) {
    const maxSize = 5 * 1024 * 1024; // ۵ مگابایت
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!file) return { valid: false, msg: "لطفاً ابتدا فایل را انتخاب کنید ❌" };
    if (file.size > maxSize) return { valid: false, msg: "حجم فایل نباید بیشتر از ۵ مگابایت باشد ❌" };
    if (!allowedTypes.includes(file.type)) return { valid: false, msg: "فقط عکس (JPG یا PNG) مجاز است ❌" };
    
    return { valid: true };
}

/************************************************
 * تابع مرکزی حسابداری (مدیریت ۳ صندوق و دارایی کل)
 ************************************************/
async function calculateStats(poolId) {
    if (!poolId) return;
    try {
        // فقط یک بار درخواست به دیتابیس شلیک می‌شود 👇
        const { data: txs, error } = await supabaseClient
            .from('transactions')
            .select('*')
            .eq('pool_id', poolId)
            .eq('status', 'approved');

        if (error) throw error;

        let totalIn = 0, totalOut = 0, totalInvestTarget = 0, actualCapitalSpent = 0, totalProfitIn = 0, totalProfitDist = 0;
        let charityIn = 0, charityOut = 0;

        if (txs) {
            txs.forEach(t => {
                const val = Number(t.amount || 0);
                const inv = Number(t.invest_val || 0);

                // خیریه کاملاً جدا از صندوق اصلیه، وارد محاسبه‌ی mainFund نمیشه
                if (t.category === 'charity') {
                    if (t.type === 'in') charityIn += val;
                    else if (t.type === 'out') charityOut += val;
                    return;
                }

                totalInvestTarget += inv;

                if (t.type === 'in') totalIn += val;
                else if (t.type === 'out') totalOut += val;
                else if (t.type === 'capital_spend') actualCapitalSpent += val;
                else if (t.type === 'profit') totalProfitIn += val;
                else if (t.type === 'distribution') totalProfitDist += val;
            });
        }

        const mainFund = (totalIn - totalInvestTarget) - totalOut;
        const investFund = totalInvestTarget - actualCapitalSpent;
        const profitFund = totalProfitIn - totalProfitDist;
        const charityFund = charityIn - charityOut;
        const totalAssets = mainFund + investFund + profitFund; // خیریه عمداً جزو دارایی صندوق حساب نمیشه

        // نمایش در UI
        const updateUI = (id, val) => { if (document.getElementById(id)) document.getElementById(id).innerText = Math.floor(val).toLocaleString() + " تومان"; };
        updateUI('master-total-assets', totalAssets);
        updateUI('main-fund-balance', mainFund);
        updateUI('invest-fund-balance', investFund);
        updateUI('profit-fund-balance', profitFund);
        updateUI('charity-fund-balance', charityFund);

    } catch (e) { console.error("Stats Calc Error:", e.message); }
}


/************************************************
 * تابع تایید فیش - با منطق بازگشت به صف
 ************************************************/
window.updateStatus = async function(id, newStatus) {
    const myPoolId = sessionStorage.getItem('pool_id');
    
    try {
        if (newStatus === 'approved') {
            // ۱. دریافت اطلاعات فیش
            const { data: tx } = await supabaseClient
                .from('transactions')
                .select('*')
                .eq('id', id)
                .single();

            const { data: set } = await supabaseClient
                .from('settings')
                .select('investment_percent, coin_per_day, coin_window_days, coin_charity_rate')
                .eq('pool_id', myPoolId)
                .maybeSingle();

            const currentN = set ? Number(set.investment_percent || 0) : 0;
            const investAmount = Math.floor((Number(tx.amount) * currentN) / 100);

            // ۲. آپدیت وضعیت فیش
            await supabaseClient.from('transactions').update({ 
                status: 'approved', 
                invest_val: investAmount 
            }).eq('id', id);

            if (tx.member_id) {
                // ۳. محاسبه وضعیت مالی عضو
                const { data: allTxs } = await supabaseClient
                    .from('transactions')
                    .select('amount, type, category')
                    .eq('member_id', tx.member_id)
                    .eq('status', 'approved');

                const totalIn = allTxs
                    .filter(t => t.type === 'in' && t.category === 'monthly')
                    .reduce((s, a) => s + Number(a.amount), 0);

                const totalOutMonthly = allTxs
                    .filter(t => t.type === 'out' && t.category === 'monthly')
                    .reduce((s, a) => s + Number(a.amount), 0);

                // ۴. آپدیت نمره خوش‌حسابی
                const { data: mem } = await supabaseClient
                    .from('members')
                    .select('*')
                    .eq('id', tx.member_id)
                    .single();

                const currentCoins = Number(mem.coins) || 0;
                let rawChange;

                if (tx.category === 'charity') {
                    // خیریه: سکه‌ی نسبت به مبلغ، بدون ارتباط با روز پرداخت
                    const rate = Number(set?.coin_charity_rate) || 10000;
                    rawChange = Math.floor(Number(tx.amount) / rate);
                } else {
                    // ۴. سیستم سکه (جایگزین امتیاز ۰-۱۰۰ قدیمی)
                    // مبنا: تاریخ ثبت فیش توسط عضو (100% طبق تایید خودت)
                    // فاصله از نزدیک‌ترین یکم ماه (این ماه یا ماه بعد) رو حساب می‌کنیم
                    // تا پرداخت آخر ماه هم به‌درستی «زودتر از موعد» شناخته بشه
                    const txDate = new Date(tx.created_at);
                    const thisMonthFirst = new Date(txDate.getFullYear(), txDate.getMonth(), 1);
                    const nextMonthFirst = new Date(txDate.getFullYear(), txDate.getMonth() + 1, 1);
                    const diffToThis = Math.round((txDate - thisMonthFirst) / 86400000);   // 0..30
                    const diffToNext = Math.round((txDate - nextMonthFirst) / 86400000);   // منفی = زودتر از ماه بعد
                    const offset = Math.abs(diffToNext) < Math.abs(diffToThis) ? diffToNext : diffToThis;

                    const winDays = Number(set?.coin_window_days) || 10;
                    const perDay = Number(set?.coin_per_day) || 2;
                    const half = Math.floor(winDays / 2);
                    const peak = perDay * winDays;

                    rawChange = offset <= -half ? peak : (peak - perDay * (offset + half));
                }

                const newCoins = Math.max(0, currentCoins + rawChange);

                // ۵. آپدیت نمره خوش‌حسابی
                let memberUpdateData = { 
                    coins: newCoins,
                    debt_warning_msg: null 
                };

                // 🔥 شرط: اگر بدهی نوبتی تسویه شد (فقط برای واریزی ماهانه، نه خیریه)
                if (tx.category === 'monthly' && totalIn >= totalOutMonthly) {
                    // عضو واجد شرایط میشه و میره ته صف
                    memberUpdateData.eligible_at = new Date().toISOString();
                    console.log(`✅ ${mem.full_name} تسویه کرد و وارد صف شد.`);
                }

                // ۶. ثبت نهایی
                await supabaseClient
                    .from('members')
                    .update(memberUpdateData)
                    .eq('id', tx.member_id);
            }
        } else {
            await supabaseClient.from('transactions').update({ status: newStatus }).eq('id', id);
        }

        await Swal.fire({
            title: 'عملیات موفق',
            text: 'تغییرات ثبت شد ✅',
            icon: 'success',
            confirmButtonColor: '#10b981',
            customClass: { popup: 'rounded-[2.5rem]' }
        });

        location.reload();

    } catch (e) {
        console.error("Critical Update Error:", e);
        Swal.fire({ title: 'خطا در تایید', text: e.message, icon: 'error' });
    }
};



/************************************************
 * تابع ثبت ویرایش عضو (نسخه فوق‌امن و ضد کرش)
 ************************************************/
window.updateMember = async function() {
    console.log("در حال تلاش برای ثبت ویرایش...");

    // ۱. دسترسی به المان‌ها با احتیاط کامل 👇
    const elId = document.getElementById('edit-member-id');
    const elName = document.getElementById('edit-member-name');
    const elMobile = document.getElementById('edit-member-mobile');
    const elAddr = document.getElementById('edit-member-address');
    const elShares = document.getElementById('edit-member-shares');
    const elAdmin = document.getElementById('edit-member-is-admin');
    const elPass = document.getElementById('edit-member-pass');
    const btn = document.getElementById('edit-save-btn');

    // ۲. بررسی حیاتی: اگر نام یا موبایل یا آیدی کلاً در صفحه نبودند
    if (!elId || !elName || !elMobile) {
        console.error("❌ برخی از المان‌های اصلی ویرایش در HTML پیدا نشدند!");
        return Swal.fire({ text: "خطای سیستمی: فیلدهای ویرایش در صفحه یافت نشد!", icon: 'error' });
    }

    const memberId = elId.value;
    const poolId = sessionStorage.getItem('pool_id');

    // ۳. شروع لودینگ دکمه
    toggleLoading('edit-save-btn', true, 'در حال بروزرسانی...');

    try {
        // ۴. آماده‌سازی دیتای آپدیت (اگر المانی نبود، مقدار قبلی یا خالی بگذارد)
        let updateData = {
            full_name: elName.value.trim(),
            mobile: elMobile.value.trim(),
            address: elAddr ? elAddr.value.trim() : "",
            total_shares: elShares ? parseInt(elShares.value) : 1,
            is_admin: elAdmin ? elAdmin.checked : false
        };

        // ۵. اگر رمز جدید وارد شده بود
        if (elPass && elPass.value.length >= 6) {
            updateData.password = await hashPassword(elPass.value);
        }

        // ۶. عملیات در دیتابیس
        const { error } = await supabaseClient
            .from('members')
            .update(updateData)
            .eq('id', memberId);

        if (error) throw error;

        // ۷. موفقیت
        Swal.fire({
            title: 'بروزرسانی موفق ✅',
            text: `اطلاعات ${elName.value} با موفقیت تغییر یافت.`,
            icon: 'success',
            timer: 2000,
            showConfirmButton: false,
            customClass: { popup: 'rounded-[2rem]' }
        });
        
        const shares = parseInt(document.getElementById('edit-member-shares').value);
if (isNaN(shares) || shares < 1) {
    return Swal.fire({text: "تعداد سهم باید حداقل ۱ باشد", icon:'warning'});
}

        // بستن مودال و رفرش لیست اعضا بدون رفرش کل صفحه
        document.getElementById('edit-modal').classList.add('hidden');
        loadAllMembers(poolId);

    } catch (e) {
        console.error("Update Error:", e);
        Swal.fire({ title: 'خطا در ذخیره', text: e.message, icon: 'error' });
    } finally {
        toggleLoading('edit-save-btn', false, 'ذخیره تغییرات');
    }
};



/************************************************
 * تابع حذف ریشه‌ای عضو (Auth + Database)
 ************************************************/
window.handleDeleteWithSettlement = async function() {
    const m = selectedMemberForReport;
    const balance = m.finalBalance || 0;
    const absBalance = Math.abs(balance);

    // پیام تایید هوشمند بر اساس تراز
    let warningText = "";
    if (balance > 0) warningText = `عضو مبلغ <b>${absBalance.toLocaleString()} ت</b> پس‌انداز دارد. آیا مطمئنید که تسویه انجام شده و می‌خواهید او را حذف کنید؟`;
    else if (balance < 0) warningText = `عضو مبلغ <b>${absBalance.toLocaleString()} ت</b> بدهکار است. آیا تایید می‌کنید که این بدهی را وصول کرده‌اید؟`;
    else warningText = `حساب عضو صفر است. آیا از حذف نهایی اطمینان دارید؟`;

    const result = await Swal.fire({
        title: 'تایید تسویه و حذف',
        html: `<p style="font-size:12px; color:#475569; line-height:1.9;">${warningText}</p>` +
              (absBalance > 0 ? `<p style="font-size:9px; color:#94a3b8; margin-top:8px;">برای تایید، همین مبلغ را در کادر زیر وارد کنید</p>` : ''),
        icon: 'warning',
        input: absBalance > 0 ? 'number' : undefined,
        inputPlaceholder: absBalance > 0 ? `مثلاً ${absBalance}` : undefined,
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'بله، تسویه شد و حذف کن',
        cancelButtonText: 'انصراف',
        customClass: { popup: 'rounded-[2.5rem]' },
        inputValidator: (value) => {
            if (absBalance > 0 && Number(value) !== absBalance) {
                return 'مبلغ واردشده با تراز محاسبه‌شده مطابقت ندارد ❌';
            }
        }
    });

    if (result.isConfirmed) {
        try {
            const poolId = sessionStorage.getItem('pool_id');

            // چک موجودی صندوق اصلی قبل از هر برداشتی (فقط وقتی واقعاً از صندوق خارج میشه)
            if (balance > 0) {
                const balancesCheck = await getCurrentFundBalances(poolId);
                if (absBalance > balancesCheck.mainFund) {
                    return insufficientFundsAlert('صندوق اصلی', absBalance, balancesCheck.mainFund);
                }
            }

            Swal.fire({ title: 'در حال تسویه نهایی...', didOpen: () => Swal.showLoading() });

            // ۱. ثبت تراکنش تسویه برای اصلاح موجودی کل صندوق 👇
            // اگر بستانکار بود، از صندوق کم می‌شود. اگر بدهکار بود، به صندوق اضافه می‌شود.
            if (absBalance > 0) {
                await supabaseClient.from('transactions').insert([{
                    pool_id: poolId,
                    amount: absBalance,
                    status: 'approved',
                    type: balance > 0 ? 'out' : 'in', // اگر پس‌اندازش را پس دادیم 'out'، اگر بدهی‌اش را گرفتیم 'in'
                    category: 'monthly',
                    receipt_url: `تسویه نهایی با عضو حذف شده: ${m.full_name}`
                }]);
            }

            // ۲. حذف ریشه‌ای (Auth + Database) که قبلاً با RPC ساختیم
            await supabaseClient.rpc('delete_user_from_auth', { target_user_id: m.id });
            await supabaseClient.from('members').delete().eq('id', m.id);

            await Swal.fire({ title: 'حذف و تسویه موفق ✅', text: 'حساب بسته شد و موجودی صندوق آپدیت گردید.', icon: 'success' });
            
            closeReportModal();
            closeMemberProfile();
            loadAllMembers(poolId);
            calculateStats(poolId); // بروزرسانی موجودی کل پلتفرم

        } catch (e) {
            Swal.fire({ text: e.message, icon: 'error' });
        }
    }
};

/************************************************
 * نمایش لیست درخواست‌های مساعده اعضا (v15.0)
 * متصل به تابع جدید payEmergencyLoan
 ************************************************/
async function loadAdminLoans(poolId) {
    const container = document.getElementById('admin-loans-list');
    if (!container || !poolId) return;

    try {
        // دریافت وام‌های در حال رای‌گیری
        const { data: loans, error } = await supabaseClient
            .from('loans')
            .select('*')
            .eq('pool_id', poolId)
            .eq('status', 'voting')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!loans || loans.length === 0) {
            container.innerHTML = '<p class="text-center py-5 text-slate-400 text-[10px]">درخواست مساعده‌ای موجود نیست.</p>';
            updateAccordionDot('dot-ops-loans', 0);
            return;
        }

        container.innerHTML = loans.map(l => `
            <div class="bg-slate-50 p-5 rounded-[2rem] border border-slate-100 mb-4 shadow-sm text-right">
                <div class="flex justify-between items-start mb-3">
                    <h5 class="text-xs font-black text-slate-800">${l.requester_name}</h5>
                    <span class="text-[10px] font-black text-indigo-600">${Number(l.amount).toLocaleString()} ت</span>
                </div>
                
                <p class="text-[9px] text-slate-500 leading-relaxed italic mb-4">"${l.description || 'بدون توضیح'}"</p>
                
                <div class="flex gap-2 mb-4">
                    <span class="text-[8px] bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg">👍 ${l.votes_up || 0} موافق</span>
                    <span class="text-[8px] bg-rose-50 text-rose-600 px-2 py-1 rounded-lg">👎 ${l.votes_down || 0} مخالف</span>
                </div>

                <div class="flex gap-2">
                    <!-- 👇 اتصال به تابع جدید با پاس دادن UUID عضو -->
                    <button onclick="payEmergencyLoan('${l.id}', ${l.amount}, '${l.requester_name}', '${l.member_id}')" 
                            class="flex-1 bg-emerald-500 text-white py-3 rounded-2xl font-black text-[9px] shadow-lg active:scale-95">
                        تایید و واریز مساعده
                    </button>
                    <button onclick="rejectLoan('${l.id}', '${l.requester_name}')" 
                            class="px-4 bg-white text-rose-500 border border-rose-100 py-3 rounded-2xl font-black text-[9px] active:scale-95">
                        رد
                    </button>
                </div>
            </div>`).join('');

        updateAccordionDot('dot-ops-loans', loans.length);

    } catch (e) { console.error("Error loading admin loans:", e); }
}

/************************************************
 * درخواست‌های مساعده‌ی سکه‌ای (جدا از loans رأی‌گیری‌دار)
 ************************************************/
async function loadCoinRequests(poolId) {
    const container = document.getElementById('admin-coin-requests-list');
    if (!container || !poolId) return;

    try {
        const { data: reqs, error } = await supabaseClient
            .from('coin_requests')
            .select('*')
            .eq('pool_id', poolId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!reqs || reqs.length === 0) {
            container.innerHTML = '<p class="text-center py-5 text-slate-400 text-[10px]">درخواست مساعده‌ی سکه‌ای موجود نیست.</p>';
            updateAccordionDot('dot-ops-coins', 0);
            return;
        }

        container.innerHTML = reqs.map(r => `
            <div class="bg-slate-50 p-5 rounded-[2rem] border border-slate-100 mb-4 shadow-sm text-right">
                <div class="flex justify-between items-start mb-3">
                    <h5 class="text-xs font-black text-slate-800">${escapeHtml(r.requester_name)}</h5>
                    <span class="text-[10px] font-black text-yellow-600">${Number(r.amount).toLocaleString()} ت</span>
                </div>
                <p class="text-[9px] text-slate-500 mb-4">با ${r.coins_requested} سکه</p>
                <div class="flex gap-2">
                    <button class="js-approve-coin flex-1 bg-emerald-500 text-white py-3 rounded-2xl font-black text-[9px] shadow-lg active:scale-95" data-id="${r.id}">
                        تایید و واریز
                    </button>
                    <button class="js-reject-coin px-4 bg-white text-rose-500 border border-rose-100 py-3 rounded-2xl font-black text-[9px] active:scale-95" data-id="${r.id}">
                        رد
                    </button>
                </div>
            </div>`).join('');

        container.querySelectorAll('.js-approve-coin').forEach(btn => {
            btn.onclick = () => decideCoinRequest(btn.dataset.id, true);
        });
        container.querySelectorAll('.js-reject-coin').forEach(btn => {
            btn.onclick = () => decideCoinRequest(btn.dataset.id, false);
        });

        updateAccordionDot('dot-ops-coins', reqs.length);

    } catch (e) { console.error("Error loading coin requests:", e); }
}

/************************************************
 * پنل‌های کشویی عمومی (افتتاح پروژه، برداشت خیریه و ...)
 * با کلیک روی دکمه/کارت باز میشن، با کلیک بیرون بسته میشن
 ************************************************/
/************************************************
 * محاسبه‌ی زنده‌ی موجودی هر صندوق (برای جلوگیری از تراکنش منفی)
 ************************************************/
async function getCurrentFundBalances(poolId) {
    const { data: txs } = await supabaseClient
        .from('transactions')
        .select('amount, type, category, invest_val')
        .eq('pool_id', poolId)
        .eq('status', 'approved');

    let totalIn = 0, totalOut = 0, totalInvestTarget = 0, actualCapitalSpent = 0, totalProfitIn = 0, totalProfitDist = 0, charityIn = 0, charityOut = 0;

    (txs || []).forEach(t => {
        const val = Number(t.amount || 0);
        const inv = Number(t.invest_val || 0);
        if (t.category === 'charity') {
            if (t.type === 'in') charityIn += val; else if (t.type === 'out') charityOut += val;
            return;
        }
        totalInvestTarget += inv;
        if (t.type === 'in') totalIn += val;
        else if (t.type === 'out') totalOut += val;
        else if (t.type === 'capital_spend') actualCapitalSpent += val;
        else if (t.type === 'profit') totalProfitIn += val;
        else if (t.type === 'distribution') totalProfitDist += val;
    });

    return {
        mainFund: (totalIn - totalInvestTarget) - totalOut,
        investFund: totalInvestTarget - actualCapitalSpent,
        profitFund: totalProfitIn - totalProfitDist,
        charityFund: charityIn - charityOut
    };
}

function insufficientFundsAlert(fundLabel, needed, available) {
    Swal.fire({
        title: 'موجودی کافی نیست ❌',
        html: `موجودی «${fundLabel}» فقط <b>${Math.max(0, available).toLocaleString()} ت</b> است، ولی مبلغ درخواستی <b>${Number(needed).toLocaleString()} ت</b> است.`,
        icon: 'error',
        confirmButtonColor: '#ef4444',
        customClass: { popup: 'rounded-[2.5rem]' }
    });
}

function updateAccordionDot(dotId, count) {
    const dot = document.getElementById(dotId);
    if (!dot) return;
    dot.classList.toggle('hidden', !(count > 0));
}

/************************************************
 * بنر هشدار پلکانی برای وام نوبتی پرداخت‌نشده (روز ۲ تا ۵ ماه)
 ************************************************/
async function checkMonthlyLoanWarning(poolId) {
    const banner = document.getElementById('monthly-loan-warning-banner');
    const textEl = document.getElementById('monthly-loan-warning-text');
    if (!banner || !textEl || !poolId) return;

    const today = new Date();
    const dayOfMonth = today.getDate();

    if (dayOfMonth < 2) { banner.classList.add('hidden'); return; }

    try {
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
        const { data: paidThisMonth } = await supabaseClient
            .from('transactions')
            .select('id')
            .eq('pool_id', poolId)
            .eq('status', 'approved')
            .eq('type', 'out')
            .eq('category', 'monthly')
            .gte('created_at', firstDayOfMonth)
            .limit(1);

        if (paidThisMonth && paidThisMonth.length > 0) {
            banner.classList.add('hidden');
            return;
        }

        let style, text;
        if (dayOfMonth === 2) {
            style = 'bg-amber-50 border-amber-100 text-amber-600';
            text = `امروز روز ۲ ماهه — وام نوبتی این ماه هنوز پرداخت نشده.`;
        } else if (dayOfMonth === 3 || dayOfMonth === 4) {
            style = 'bg-orange-50 border-orange-100 text-orange-600';
            text = `روز ${dayOfMonth} ماهه — وام نوبتی این ماه هنوز پرداخت نشده، لطفاً هرچه زودتر اقدام کنید.`;
        } else {
            style = 'bg-rose-50 border-rose-200 text-rose-600';
            text = `⚠️ روز ${dayOfMonth} ماهه — وام نوبتی این ماه هنوز پرداخت نشده! از مهلت معمول (تا پنجم) گذشته.`;
        }

        banner.classList.remove('hidden');
        banner.className = `p-5 rounded-[2rem] border flex items-center gap-3 ${style}`;
        textEl.innerText = text;

    } catch (e) { console.error("Error checking monthly loan warning:", e); }
}

function toggleCollapsiblePanel(panelId, event) {
    if (event) event.stopPropagation();
    const panel = document.getElementById(panelId);
    if (!panel) return;
    const wasHidden = panel.classList.contains('hidden');
    document.querySelectorAll('.js-collapsible-panel').forEach(p => p.classList.add('hidden'));
    if (wasHidden) panel.classList.remove('hidden');
}

document.addEventListener('click', function(e) {
    document.querySelectorAll('.js-collapsible-panel:not(.hidden)').forEach(panel => {
        if (!panel.contains(e.target)) panel.classList.add('hidden');
    });
});

function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

/************************************************
 * لاگ کامل و شفاف تراکنش‌ها — هر ورود/خروجی از هر صندوق
 ************************************************/
function txLabel(t) {
    const categoryLabels = { monthly: 'قسط ماهانه', emergency: 'مساعده‌ی رأی‌گیری', charity: 'خیریه', coin_assistance: 'مساعده‌ی سکه‌ای' };
    const typeLabels = { in: 'واریز', out: 'برداشت', capital_spend: 'خرید دارایی پروژه', profit: 'ثبت سود', distribution: 'توزیع سود' };
    if (t.type === 'in' || t.type === 'out') {
        return `${typeLabels[t.type]} ${categoryLabels[t.category] || 'عمومی'}`;
    }
    return typeLabels[t.type] || t.type;
}

let _txLogCache = [];

async function loadTransactionLog(poolId) {
    const container = document.getElementById('admin-transactions-log');
    if (!container || !poolId) return;

    try {
        const { data: txs, error } = await supabaseClient
            .from('transactions')
            .select('*, members(full_name)')
            .eq('pool_id', poolId)
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;

        _txLogCache = txs || [];
        renderTransactionLog();

    } catch (e) { console.error("Error loading transaction log:", e); }
}

function renderTransactionLog() {
    const container = document.getElementById('admin-transactions-log');
    if (!container) return;

    const searchTerm = (document.getElementById('tx-log-search')?.value || '').trim().toLowerCase();
    const typeFilter = document.getElementById('tx-log-type-filter')?.value || 'all';

    let txs = _txLogCache;
    if (typeFilter !== 'all') txs = txs.filter(t => t.type === typeFilter);
    if (searchTerm) txs = txs.filter(t => (t.members?.full_name || '').toLowerCase().includes(searchTerm));

    if (txs.length === 0) {
        container.innerHTML = '<p class="text-center py-5 text-slate-400 text-[10px]">تراکنشی با این فیلتر پیدا نشد.</p>';
        return;
    }

    container.innerHTML = `<p class="text-[8px] text-slate-400 text-center mb-2">${txs.length} تراکنش (از ۱۰۰ تای اخیر)</p>` + txs.map(t => {
            const isCredit = (t.type === 'in' || t.type === 'profit');
            const colorClass = isCredit ? 'text-emerald-600' : 'text-rose-600';
            const sign = isCredit ? '+' : '−';
            const date = new Date(t.created_at).toLocaleDateString('fa-IR-u-nu-latn');
            const who = t.members ? t.members.full_name : (t.category === 'charity' ? 'صندوق خیریه' : 'ستاد صندوق');
            const desc = t.receipt_url || '';
            const isLink = /^https?:\/\//.test(desc);
            const statusBadge = t.status !== 'approved'
                ? `<span class="text-[7px] font-black px-2 py-1 rounded-full ${t.status === 'pending' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400'}">${t.status === 'pending' ? 'در انتظار' : 'رد شده'}</span>`
                : '';

            return `
                <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex justify-between items-center gap-3">
                    <div class="text-right flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                            <p class="text-[10px] font-black text-slate-800">${escapeHtml(txLabel(t))}</p>
                            ${statusBadge}
                        </div>
                        <p class="text-[8px] text-slate-400 mt-1">${escapeHtml(who)} · ${date}</p>
                        ${desc && !isLink ? `<p class="text-[8px] text-slate-500 mt-1">${escapeHtml(desc)}</p>` : ''}
                        ${isLink ? `<a href="${desc}" target="_blank" class="text-[8px] text-indigo-500 underline mt-1 inline-block">مشاهده فیش</a>` : ''}
                    </div>
                    <div class="text-left shrink-0">
                        <p class="text-xs font-black ${colorClass}">${sign}${Number(t.amount).toLocaleString()}</p>
                    </div>
                </div>`;
        }).join('');
}

window.decideCoinRequest = async function(requestId, approve) {
    const poolId = sessionStorage.getItem('pool_id');
    try {
        const { data: ok, error } = await supabaseClient.rpc('decide_coin_request', {
            request_id: Number(requestId),
            approve: approve
        });
        if (error) throw error;
        if (!ok) throw new Error('این درخواست دیگر معتبر نیست یا اجازه‌ی دسترسی ندارید');

        Swal.fire({
            title: approve ? 'مساعده واریز شد ✅' : 'درخواست رد شد',
            icon: approve ? 'success' : 'info',
            timer: 1500,
            showConfirmButton: false
        });
        loadCoinRequests(poolId);
        loadTransactionLog(poolId);
        loadAllMembers(poolId);
    } catch (e) {
        Swal.fire({ title: 'خطا', text: e.message, icon: 'error' });
    }
};


/************************************************
 * ۷. مدیریت پروژه‌های سرمایه‌گذاری
 ************************************************/

/************************************************
 * تابع افتتاح پروژه جدید (v10.1 - رفع باگ عدم نمایش)
 ************************************************/
/************************************************
 * تابع افتتاح پروژه (بدون سوال تکراری - مستقیم)
 ************************************************/
window.createNewProject = async function() {
    const nameInput = document.getElementById('proj-name');
    const capitalInput = document.getElementById('proj-capital'); // گرفتن کادر جدید
    const poolId = sessionStorage.getItem('pool_id');

    // ۱. بررسی پر بودن کادرها
    if (!nameInput.value.trim() || !capitalInput.value) {
        return Swal.fire({ text: "لطفاً نام و مبلغ سرمایه را وارد کنید ❌", icon: 'warning' });
    }

    const projName = nameInput.value.trim();
    const amount = Number(capitalInput.value);

    if (amount <= 0) return Swal.fire({ text: "مبلغ سرمایه باید بیشتر از صفر باشد", icon: 'error' });

    // ۲. فقط یک تاییدیه نهایی (بدون فیلد ورودی تکراری) 👇
    const confirmResult = await Swal.fire({
        title: 'تایید نهایی پروژه',
        html: `آیا از کسر مبلغ <b class="text-indigo-600">${amount.toLocaleString()} ت</b> از "صندوق سرمایه‌گذاری" بابت پروژه <b>"${projName}"</b> اطمینان دارید؟`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'بله، کسر شود و افتتاح کن',
        cancelButtonText: 'انصراف',
        confirmButtonColor: '#4f46e5',
        customClass: { popup: 'rounded-[2.5rem]' }
    });

    if (!confirmResult.isConfirmed) return;

    // چک موجودی صندوق سرمایه‌گذاری قبل از هر برداشتی
    const balancesCheck = await getCurrentFundBalances(poolId);
    if (amount > balancesCheck.investFund) {
        return insufficientFundsAlert('صندوق سرمایه‌گذاری', amount, balancesCheck.investFund);
    }

    // نمایش لودینگ
    Swal.fire({ title: 'در حال ثبت پرونده...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        // ۳. ثبت در جدول پروژه‌ها
        const { error: pErr } = await supabaseClient
            .from('projects')
            .insert([{ 
                pool_id: poolId, 
                name: projName, 
                invested_amount: amount, 
                total_profit: 0 
            }]);

        if (pErr) throw pErr;

        // ۴. ثبت تراکنش کسر از صندوق سرمایه (Type: capital_spend) 👇
        const { error: txErr } = await supabaseClient.from('transactions').insert([{
            pool_id: poolId,
            amount: amount,
            status: 'approved',
            type: 'capital_spend', 
            receipt_url: `افتتاح پروژه: ${projName}`
        }]);

        if (txErr) throw txErr;

        // ۵. پیروزی!
        await Swal.fire({ 
            title: 'عملیات موفق ✅', 
            text: 'پروژه ثبت و مبلغ از موجودی سرمایه کسر گردید.', 
            icon: 'success',
            confirmButtonColor: '#10b981'
        });

        // پاکسازی کادرها و آپدیت لیست
        nameInput.value = '';
        capitalInput.value = '';
        calculateStats(poolId); 
        loadAdminProjects(poolId);
        if (typeof loadTransactionLog === 'function') loadTransactionLog(poolId);

    } catch (e) {
        Swal.fire({ title: 'خطا در ثبت', text: e.message, icon: 'error' });
    }
};

/************************************************
 * برداشت مدیر از صندوق خیریه (مبلغ + توضیح اجباری)
 ************************************************/
window.withdrawFromCharity = async function() {
    const poolId = sessionStorage.getItem('pool_id');
    const amountInput = document.getElementById('charity-withdraw-amount');
    const descInput = document.getElementById('charity-withdraw-desc');
    if (!amountInput || !descInput) return;

    const amount = Number(amountInput.value);
    const desc = descInput.value.trim();

    if (!amount || amount <= 0) return Swal.fire({ text: "مبلغ برداشت را وارد کنید ❌", icon: 'warning' });
    if (!desc) return Swal.fire({ text: "توضیح برداشت (بابت چی/برای کی) الزامی است ❌", icon: 'warning' });

    const confirmResult = await Swal.fire({
        title: 'تایید برداشت از خیریه',
        html: `آیا از برداشت <b class="text-rose-600">${amount.toLocaleString()} ت</b> از «صندوق خیریه» بابت «${desc}» مطمئنید؟`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'بله، برداشت شود',
        cancelButtonText: 'انصراف',
        confirmButtonColor: '#e11d48',
        customClass: { popup: 'rounded-[2.5rem]' }
    });
    if (!confirmResult.isConfirmed) return;

    // چک موجودی صندوق خیریه قبل از هر برداشتی
    const balancesCheck = await getCurrentFundBalances(poolId);
    if (amount > balancesCheck.charityFund) {
        return insufficientFundsAlert('صندوق خیریه', amount, balancesCheck.charityFund);
    }

    try {
        const { error } = await supabaseClient.from('transactions').insert([{
            pool_id: poolId,
            amount: amount,
            status: 'approved',
            type: 'out',
            category: 'charity',
            receipt_url: desc
        }]);
        if (error) throw error;

        await Swal.fire({ title: 'ثبت شد ✅', text: 'مبلغ از صندوق خیریه کسر شد.', icon: 'success', confirmButtonColor: '#10b981' });

        amountInput.value = '';
        descInput.value = '';
        calculateStats(poolId);
        if (typeof loadTransactionLog === 'function') loadTransactionLog(poolId);

    } catch (e) {
        Swal.fire({ title: 'خطا در ثبت', text: e.message, icon: 'error' });
    }
};

  
/************************************************
 * تابع لود پروژه‌ها (رفع ارور t is not defined + تاریخ لاتین)
 ************************************************/
async function loadAdminProjects(poolId) {
    if (!poolId) poolId = sessionStorage.getItem('pool_id');
    const container = document.getElementById('admin-projects-list');
    if (!container) return;

    try {
        const { data: list, error } = await supabaseClient
            .from('projects')
            .select('*')
            .eq('pool_id', poolId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        allProjectsDataCache = list || [];

        if (!list || list.length === 0) {
            container.innerHTML = `<p class="text-center py-10 text-slate-400 text-[10px]">پروژه‌ای یافت نشد.</p>`;
            return;
        }

        container.innerHTML = list.map(project => {
            const prf = Number(project.total_profit || 0);
            const inv = Number(project.invested_amount || 1);
            const rate = inv > 0 ? ((prf / inv) * 100).toFixed(1) : "0.0";
            
            // 👇 اصلاح تاریخ: تبدیل به فرمت لاتین (English Numbers)
            const latinDate = new Date(project.created_at).toLocaleDateString('en-CA', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });

            return `
                <div class="bg-white p-6 rounded-[2.5rem] border border-slate-100 mb-5 shadow-sm relative overflow-hidden transition-all active:shadow-md">
                    <div class="flex justify-between items-start mb-4">
                        <div class="text-right">
                            <h4 class="text-sm font-[900] text-slate-800">${project.name}</h4>
                            <!-- استفاده از latinDate که در بالا تعریف کردیم 👇 -->
                            <p class="text-[9px] text-slate-400 mt-1 font-bold tracking-tighter">Date: ${latinDate}</p>
                        </div>
                        <div class="text-left flex flex-col items-end gap-2">
                            <span class="px-2 py-1 rounded-lg text-[10px] font-black ${prf >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}">
                                ${rate}%
                            </span>
                            <!-- دقت کن که اینجا از project.id استفاده شده نه t.id 👇 -->
                            <button onclick="deleteProject('${project.id}', '${project.name}')" class="w-9 h-9 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center border border-rose-100 active:scale-90">
                                <i class="fas fa-trash-alt text-xs"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div class="bg-slate-50 p-4 rounded-2xl flex justify-between items-center mb-5 shadow-inner border border-slate-100">
                        <span class="text-[9px] font-bold text-slate-500">سود انباشته:</span>
                        <span class="text-xs font-black text-emerald-600">${prf.toLocaleString()} تومان</span>
                    </div>

                    <div class="grid grid-cols-2 gap-2">
                        <button onclick="registerProjectProfit('${project.id}', '${project.name}')" class="btn-tap bg-emerald-600 text-white py-3.5 rounded-2xl font-black text-[9px] shadow-lg shadow-emerald-100">ثبت سود</button>
                        <button onclick="openProfitManager('${project.id}', '${project.name}', ${project.total_profit})" class="btn-tap bg-indigo-600 text-white py-3.5 rounded-2xl font-black text-[9px] shadow-lg shadow-indigo-100">مدیریت سود</button>
                    </div>
                    <button onclick="showProjectFullAnalysis('${project.id}')" class="w-full mt-3 bg-slate-900 text-white py-3 rounded-2xl font-black text-[10px] shadow-xl">تحلیل تخصصی</button>
                </div>`;
        }).join('');

    } catch (err) {
        console.error("Critical Load Error:", err.message);
    }
}
/************************************************
 * تابع ثبت سود جدید برای پروژه با استایل SweetAlert2
 ************************************************/
window.registerProjectProfit = async function(id, name) {
    // ۱. باز کردن کادر ورودی شیک برای دریافت مبلغ سود
    const { value: profitAmt } = await Swal.fire({
        title: 'ثبت سود حاصله',
        html: `<p style="font-size:12px; color:#64748b;">میزان سود دریافتی از پروژه <b>"${name}"</b> را وارد کنید:</p>`,
        icon: 'success',
        input: 'number',
        inputPlaceholder: 'مبلغ سود (تومان)',
        showCancelButton: true,
        confirmButtonText: 'ثبت در صندوق سود',
        cancelButtonText: 'انصراف',
        confirmButtonColor: '#10b981', // سبز
        customClass: {
            popup: 'rounded-[2.5rem]',
            input: 'text-center font-black text-lg'
        },
        inputValidator: (value) => {
            if (!value || value <= 0) {
                return 'لطفاً مبلغ معتبری وارد کنید! ❌';
            }
        }
    });

    // اگر مدیر انصراف داد
    if (!profitAmt) return;

    try {
        const poolId = sessionStorage.getItem('pool_id');
        
        // نمایش لودینگ حین ثبت در دیتابیس
        Swal.showLoading();

        // ۲. ثبت تراکنش از نوع profit (فقط تراز صندوق سود را بالا می‌برد)
        const { error: txErr } = await supabaseClient.from('transactions').insert([{
            pool_id: poolId,
            amount: Number(profitAmt),
            status: 'approved',
            type: 'profit', // نوع مخصوص صندوق سود
            receipt_url: `سود حاصله پروژه: ${name}`
        }]);

        if (txErr) throw txErr;

        // ۳. بروزرسانی "سود کل" در پرونده خود پروژه
        const { data: proj } = await supabaseClient.from('projects').select('total_profit').eq('id', id).single();
        const { error: prErr } = await supabaseClient.from('projects').update({ 
            total_profit: Number(proj.total_profit || 0) + Number(profitAmt) 
        }).eq('id', id);

        if (prErr) throw prErr;

        // ۴. پیام موفقیت نهایی
        await Swal.fire({
            title: 'ثبت شد ✅',
            text: `مبلغ ${Number(profitAmt).toLocaleString()} تومان به صندوق سود اضافه گردید.`,
            icon: 'success',
            confirmButtonColor: '#10b981',
            customClass: { popup: 'rounded-[2rem]' }
        });

        // رفرش آمار و لیست پروژه‌ها
        if (typeof calculateStats === 'function') calculateStats(poolId);
        if (typeof loadAdminProjects === 'function') loadAdminProjects(poolId);

    } catch (e) {
        Swal.fire({
            title: 'خطا در ثبت',
            text: e.message,
            icon: 'error',
            confirmButtonColor: '#ef4444',
            customClass: { popup: 'rounded-[2rem]' }
        });
    }
};



/************************************************
 * تابع توزیع سود بین اعضا (بر اساس تعداد سهم)
 ************************************************/
async function distributeProfitToMembers(poolId, amount, description) {
    try {
        // ۱. دریافت لیست اعضا و مجموع سهام
        const { data: members } = await supabaseClient
            .from('members')
            .select('id, total_shares')
            .eq('pool_id', poolId)
            .eq('is_admin', false);

        if (!members || members.length === 0) {
            console.log("عضویی برای توزیع سود یافت نشد");
            return;
        }

        // ۲. محاسبه مجموع سهام کل
        const totalShares = members.reduce((sum, m) => sum + (m.total_shares || 1), 0);

        // ۳. توزیع به نسبت سهم هر عضو
        const transactions = members.map(m => {
            const memberShares = m.total_shares || 1;
            const memberProfit = Math.floor((amount * memberShares) / totalShares);
            
            return {
                pool_id: poolId,
                member_id: m.id,
                amount: memberProfit,
                status: 'approved',
                type: 'in',
                receipt_url: description || 'سود پروژه'
            };
        });

        // ۴. ثبت یکجای تمام تراکنش‌ها
        const { error } = await supabaseClient
            .from('transactions')
            .insert(transactions);

        if (error) throw error;

        console.log(`✅ سود ${amount.toLocaleString()} ت بین ${members.length} عضو تقسیم شد.`);

    } catch (e) {
        console.error("خطا در توزیع سود:", e.message);
        throw e;
    }
}

window.executeProfitAction = async function(actionType) {
    const poolId = sessionStorage.getItem('pool_id');
    const projId = document.getElementById('pm-proj-id').value;
    const availableProfit = Number(document.getElementById('pm-available-profit').value);

    if (availableProfit <= 0) return Swal.fire({text: "سودی برای مدیریت وجود ندارد!", icon: 'warning'});

    let finalAmt = 0;
    let labelText = "";

    // ۱. تعیین مبلغ بر اساس نوع دکمه 👇
    if (actionType === 'distribute') {
        finalAmt = availableProfit;
        labelText = "توزیع ۱۰۰٪ سود";
    } else if (actionType === 'reinvest') {
        finalAmt = availableProfit;
        labelText = "انتقال ۱۰۰٪ سود به سرمایه";
    } else if (actionType === 'split') {
        finalAmt = availableProfit; // کل مبلغ پردازش می‌شود اما ۵۰/۵۰ تقسیم می‌شود
        labelText = "توزیع ترکیبی ۵۰/۵۰";
    } else if (actionType === 'custom') {
        // --- حالت جدید: دریافت مبلغ دلخواه از مدیر ---
        const { value: customAmt } = await Swal.fire({
            title: 'مبلغ توزیع را وارد کنید',
            input: 'number',
            inputLabel: `حداکثر مبلغ قابل توزیع: ${availableProfit.toLocaleString()} تومان`,
            inputPlaceholder: 'مبلغ به تومان...',
            showCancelButton: true,
            confirmButtonColor: '#fbbf24',
            customClass: { popup: 'rounded-[2.5rem]' },
            inputValidator: (value) => {
                if (!value || value <= 0) return 'لطفاً مبلغ معتبری وارد کنید!';
                if (value > availableProfit) return 'مبلغ وارد شده بیشتر از سود موجود است!';
            }
        });
        if (!customAmt) return;
        finalAmt = Number(customAmt);
        labelText = "توزیع مبلغ دلخواه بین اعضا";
    }

    try {
        Swal.fire({ title: 'در حال پردازش تراکنش...', didOpen: () => Swal.showLoading() });

        if (actionType === 'distribute' || actionType === 'custom') {
            // توزیع کل یا بخشی از مبلغ بین اعضا
            await distributeProfitToMembers(poolId, finalAmt, labelText);
            await supabaseClient.from('transactions').insert([{ pool_id: poolId, amount: finalAmt, status: 'approved', type: 'distribution', receipt_url: labelText }]);

        } else if (actionType === 'reinvest') {
            // انتقال به سرمایه
            await supabaseClient.from('transactions').insert([{ pool_id: poolId, amount: finalAmt, status: 'approved', type: 'distribution', receipt_url: labelText }]);
            await supabaseClient.from('transactions').insert([{ pool_id: poolId, amount: 0, invest_val: finalAmt, status: 'approved', type: 'in', receipt_url: 'افزایش سرمایه از سود' }]);

        } else if (actionType === 'split') {
            const half = Math.floor(finalAmt / 2);
            await distributeProfitToMembers(poolId, half, "۵۰٪ سود پروژه");
            await supabaseClient.from('transactions').insert([{ pool_id: poolId, amount: finalAmt, status: 'approved', type: 'distribution', receipt_url: labelText }]);
            await supabaseClient.from('transactions').insert([{ pool_id: poolId, amount: 0, invest_val: half, status: 'approved', type: 'in', receipt_url: '۵۰٪ سود سهم سرمایه' }]);
        }

        // کسر مبلغ پردازش شده از پرونده پروژه
        const { data: proj } = await supabaseClient.from('projects').select('total_profit').eq('id', projId).single();
        await supabaseClient.from('projects').update({ total_profit: Math.max(0, Number(proj.total_profit) - finalAmt) }).eq('id', projId);

        await Swal.fire({ title: 'عملیات موفقیت‌آمیز ✅', text: 'حسابداری پروژه و صندوق‌ها بروزرسانی شد.', icon: 'success' });
        
        document.getElementById('profit-manager-modal').classList.add('hidden');
        calculateStats(poolId);
        loadAdminProjects(poolId);

    } catch (e) {
        Swal.fire({ text: e.message, icon: 'error' });
    }
};

/************************************************
 * تابع ذخیره تمامی تنظیمات (نسخه اصلاح شده)
 ************************************************/
window.saveNewAmounts = async function() {
    const poolId = sessionStorage.getItem('pool_id');
    const btn = document.getElementById('save-settings-btn');
    
    // گرفتن مقادیر
    const b = document.getElementById('set-base-amount').value;
    const w = document.getElementById('set-won-amount').value;
    const n = document.getElementById('set-invest-percent').value;
    const card = document.getElementById('set-manager-card').value;
    const cardName = document.getElementById('set-manager-card-name').value;
    const mob = document.getElementById('set-manager-mobile').value;
    const coinPerDay = document.getElementById('set-coin-per-day')?.value;
    const coinWindow = document.getElementById('set-coin-window-days')?.value;
    const coinCoop = document.getElementById('set-coin-cooperation-bonus')?.value;
    const coinPrice = document.getElementById('set-coin-price')?.value;
    const coinCharityRate = document.getElementById('set-coin-charity-rate')?.value;

    if (!poolId) return;

    toggleLoading('save-settings-btn', true, 'در حال ثبت...');

    try {
        // ۱. آپدیت جدول تنظیمات
        await supabaseClient.from('settings').update({ 
            base_amount: Number(b), 
            won_amount: Number(w), 
            investment_percent: Number(n),
            coin_per_day: coinPerDay !== undefined ? Number(coinPerDay) : undefined,
            coin_window_days: coinWindow !== undefined ? Number(coinWindow) : undefined,
            coin_cooperation_bonus: coinCoop !== undefined ? Number(coinCoop) : undefined,
            coin_price_toman: coinPrice !== undefined ? Number(coinPrice) : undefined,
            coin_charity_rate: coinCharityRate !== undefined ? Number(coinCharityRate) : undefined
        }).eq('pool_id', poolId);

        // ۲. آپدیت جدول صندوق (کارت و موبایل)
        await supabaseClient.from('pools').update({ 
            manager_card: card,
            manager_card_name: cardName,
            manager_mobile: mob
        }).eq('id', poolId);

        Swal.fire({
            title: 'بروزرسانی موفق ✅',
            text: 'تمامی تنظیمات با موفقیت در قلب دیتابیس ثبت شد.',
            icon: 'success',
            confirmButtonColor: '#10b981',
            customClass: { popup: 'rounded-[2.5rem]' }
        });

        calculateStats(poolId); // آپدیت آنی مبالغ در صفحه خانه

    } catch (e) {
        Swal.fire({ text: "خطا در ثبت: " + e.message, icon: 'error' });
    } finally {
        toggleLoading('save-settings-btn', false, 'ذخیره نهایی تنظیمات');
    }
};

/************************************************
 * تابع لود کردن تنظیمات صندوق و شماره کارت مدیر
 ************************************************/
/************************************************
 * تابع لود تنظیمات (نسخه فوق‌امن و ضد کرش)
 ************************************************/
async function loadCurrentConfig(poolId) {
    if (!poolId) return;
    console.log("🛠 در حال لود ایمن تنظیمات...");

    try {
        // ۱. دریافت مبالغ اقساط از جدول settings
        const { data: settings } = await supabaseClient
            .from('settings')
            .select('*')
            .eq('pool_id', poolId)
            .maybeSingle();

        if (settings) { 
            const baseInput = document.getElementById('set-base-amount');
            const wonInput = document.getElementById('set-won-amount');
            const investInput = document.getElementById('set-invest-percent');

            // فقط اگر المان در صفحه وجود داشت، مقداردهی کن 👇
            if (baseInput) baseInput.value = settings.base_amount || 0; 
            if (wonInput) wonInput.value = settings.won_amount || 0; 
            if (investInput) investInput.value = settings.investment_percent || 0;

            const coinPerDayInput = document.getElementById('set-coin-per-day');
            const coinWindowInput = document.getElementById('set-coin-window-days');
            const coinCoopInput = document.getElementById('set-coin-cooperation-bonus');
            const coinPriceInput = document.getElementById('set-coin-price');
            if (coinPerDayInput) coinPerDayInput.value = settings.coin_per_day ?? 2;
            if (coinWindowInput) coinWindowInput.value = settings.coin_window_days ?? 10;
            if (coinCoopInput) coinCoopInput.value = settings.coin_cooperation_bonus ?? 20;
            if (coinPriceInput) coinPriceInput.value = settings.coin_price_toman ?? 10000;
            const coinCharityInput = document.getElementById('set-coin-charity-rate');
            if (coinCharityInput) coinCharityInput.value = settings.coin_charity_rate ?? 10000;
        }

        // ۲. دریافت اطلاعات کارت و موبایل از جدول pools
        const { data: pool } = await supabaseClient
            .from('pools')
            .select('manager_card, manager_card_name, manager_mobile')
            .eq('id', poolId)
            .single();

        if (pool) {
            const cardInput = document.getElementById('set-manager-card');
            const cardNameInput = document.getElementById('set-manager-card-name');
            const mobileInput = document.getElementById('set-manager-mobile');

            if (cardInput) cardInput.value = pool.manager_card || "";
            if (cardNameInput) cardNameInput.value = pool.manager_card_name || "";
            if (mobileInput) mobileInput.value = pool.manager_mobile || "";
            
            console.log("✅ اطلاعات مدیر با موفقیت لود شد.");
        }
    } catch (e) { 
        console.warn("⚠️ هشدار: برخی از فیلدهای تنظیمات در این صفحه یافت نشدند، اما برنامه به کار خود ادامه می‌دهد."); 
    }
}
/************************************************
 * تابع تولید و دانلود گزارش اکسل (نهایی)
 ************************************************/
window.exportTransactionsToExcel = async function() {
    // ۱. گرفتن آیدی صندوق از حافظه موقت (سشن)
    const myPoolId = sessionStorage.getItem('pool_id');
    const btn = event.currentTarget;
    
    if (!myPoolId) return alert("خطا: جلسه کاری شما منقضی شده. لطفا دوباره لاگین کنید.");

    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i> در حال استخراج داده...';

    try {
        // ۲. دریافت تراکنش‌های تایید شده با نام عضو
        const { data: txs, error } = await supabaseClient
            .from('transactions')
            .select(`
                amount,
                type,
                created_at,
                invest_val,
                members ( full_name )
            `)
            .eq('pool_id', myPoolId)
            .eq('status', 'approved');

        if (error) throw error;

        if (!txs || txs.length === 0) {
            alert("تراکنش تایید شده‌ای برای گزارش‌گیری یافت نشد ❌");
            btn.disabled = false; btn.innerHTML = originalText;
            return;
        }

        // ۳. مرتب‌سازی و فارسی‌سازی برای فایل اکسل
        const excelData = txs.map(t => ({
            "نام و نام خانوادگی": t.members ? t.members.full_name : "نامشخص/سیستمی",
            "مبلغ (تومان)": Number(t.amount),
            "نوع تراکنش": t.type === 'in' ? "واریزی (قسط/سود)" : (t.type === 'out' ? "خروجی (پرداخت)" : "خرید پروژه"),
            "سهم سرمایه‌گذاری": Number(t.invest_val || 0),
            "تاریخ ثبت": new Date(t.created_at).toLocaleDateString('fa-IR'),
        }));

        // ۴. ساخت فایل اکسل با کتابخانه XLSX
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "گزارش مالی");

        // ۵. تنظیم راست‌چین برای اکسل
        worksheet['!dir'] = "rtl";

        // ۶. نام‌گذاری و دانلود فایل در گوشی
        const dateStr = new Date().toLocaleDateString('fa-IR').replace(/\//g, '-');
        XLSX.writeFile(workbook, `Report_Bank_${dateStr}.xlsx`);

        alert("فایل اکسل با موفقیت تولید و دانلود شد ✅");

    } catch (e) {
        console.error("Excel Error:", e);
        alert("خطا در تولید فایل: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};
// توابع مودال‌ها
/************************************************
 * تابع باز کردن پنجره مدیریت سود (ضد ارور)
 ************************************************/
window.openProfitManager = function(id, name, profit) {
    const modal = document.getElementById('profit-manager-modal');
    const idInput = document.getElementById('pm-proj-id');
    const profitInput = document.getElementById('pm-available-profit');
    const infoText = document.getElementById('pm-info-text');

    // لایه محافظتی برای جلوگیری از ارور Null 👇
    if (!modal || !idInput || !profitInput) {
        console.error("❌ خطای بحرانی: المان‌های مودال مدیریت سود در HTML یافت نشدند!");
        return Swal.fire({ text: "خطای سیستمی: مودال مدیریت سود در صفحه نیست", icon: "error" });
    }

    // ۱. مقداردهی به فیلدها
    idInput.value = id;
    profitInput.value = profit;
    if (infoText) infoText.innerText = `پروژه: ${name} | سود انباشته: ${Number(profit).toLocaleString()} تومان`;

    // ۲. نمایش پنجره
    modal.classList.remove('hidden');
};
/************************************************
 * تابع حذف کامل یک پروژه (نسخه شیک و نهایی)
 ************************************************/
async function deleteProject(id, name) {
    // ۱. نمایش سوال تایید حذف با استایل شیک
    const result = await Swal.fire({
        title: 'حذف پروژه سرمایه‌گذاری',
        text: `آیا از حذف کامل پروژه "${name}" مطمئن هستید؟ تمام پرونده و آمارهای این پروژه پاک خواهد شد.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444', // قرمز برای حذف
        cancelButtonColor: '#64748b',  // خاکستری
        confirmButtonText: 'بله، حذف شود',
        cancelButtonText: 'انصراف',
        customClass: {
            popup: 'rounded-[2rem]'
        }
    });

    // ۲. اگر مدیر دکمه "بله" را زد:
    if (result.isConfirmed) {
        try {
            // ۳. اجرای دستور حذف در دیتابیس
            const { error } = await supabaseClient
                .from('projects')
                .delete()
                .eq('id', id);

            if (error) throw error;

            // ۴. نمایش پیام موفقیت و رفرش صفحه
            await Swal.fire({
                title: 'عملیات موفق',
                text: `پروژه "${name}" با موفقیت حذف گردید 🗑️`,
                icon: 'success',
                confirmButtonText: 'تایید',
                confirmButtonColor: '#10b981',
                customClass: { popup: 'rounded-[2rem]' }
            });

            location.reload();

        } catch (e) {
            // نمایش خطا اگر مشکلی پیش آمد
            Swal.fire({
                title: 'خطا',
                text: 'مشکلی در حذف پروژه رخ داد: ' + e.message,
                icon: 'error',
                confirmButtonColor: '#ef4444',
                customClass: { popup: 'rounded-[2rem]' }
            });
        }
    }
}





/************************************************
 * تابع نمایش صفحه مسدودی با مشخصات کامل صاحب حساب
 ************************************************/
async function showLockPage() {
    const isSuper = sessionStorage.getItem('is_super_admin') === 'true';
    const hasMasterKey = localStorage.getItem('master_access_key') === 'Idris_Master_Admin_X';
    const myPoolId = sessionStorage.getItem('pool_id');

    // ۱. دریافت مشخصات کارت و نام از دیتابیس
    let cardInfo = { num: '---', name: '---' };
    try {
        const { data } = await supabaseClient.from('global_config').select('master_card, master_card_name').eq('id', 1).maybeSingle();
        if (data) {
            cardInfo.num = data.master_card || '---';
            cardInfo.name = data.master_card_name || '---';
        }
    } catch (e) { console.error("Database Error"); }

    // ۲. طراحی بدنه صفحه
    document.body.innerHTML = `
        <div id="lock-screen-container" style="height:100vh; background:#020617; color:white; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:30px; font-family:Vazirmatn; direction:rtl;">
            
            <div style="position:relative; cursor:pointer;" id="secret-lock-zone">
                <i class="fas fa-shield-alt" style="font-size:70px; color:#ef4444; margin-bottom:20px; filter: drop-shadow(0 0 15px rgba(239,68,68,0.2));"></i>
            </div>

            <h2 style="font-weight:900; font-size:24px;">دسترسی محدود شد</h2>
            <p style="color:#64748b; font-size:13px; margin-top:10px;">اعتبار زمانی یا سهمیه این صندوق به اتمام رسیده است.</p>

            <button onclick="openBlockedPaymentModal()" style="margin-top:30px; background:#4f46e5; color:white; padding:16px 40px; border-radius:22px; font-weight:900; border:none; width:100%; max-width:280px; cursor:pointer; box-shadow:0 10px 20px rgba(79,70,229,0.3);">
                <i class="fas fa-redo ml-2"></i> تمدید اشتراک و رفع مسدودی
            </button>

            ${(isSuper && hasMasterKey) ? `<button onclick="window.location.href='super_admin.html'" style="margin-top:15px; background:none; color:#fbbf24; padding:12px; border:1px solid #fbbf24; border-radius:18px; font-weight:bold; width:100%; max-width:280px; font-size:11px; cursor:pointer;">ورود به ستاد فرماندهی</button>` : ''}

            <button onclick="handleLogout()" style="margin-top:40px; color:#475569; background:none; border:none; font-size:12px; font-weight:bold; text-decoration:underline; cursor:pointer;">خروج از حساب</button>

            <!-- مودال پرداخت در زمان مسدودی -->
            <div id="blocked-pay-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.9); backdrop-filter:blur(10px); z-index:2000; align-items:center; justify-content:center; padding:20px;">
                <div style="background:#1e293b; width:100%; max-width:340px; padding:30px; border-radius:35px; border:1px solid #334155; box-shadow:0 25px 50px rgba(0,0,0,0.5);">
                    <h3 style="font-weight:900; font-size:18px; margin-bottom:10px;">ارسال فیش تمدید</h3>
                    <p style="font-size:10px; color:#94a3b8; margin-bottom:15px;">واریز به حساب مدیریت کل پلتفرم:</p>

                    <!-- کارت هوشمند داخل مودال مسدودی 👇 -->
                    <div style="background:#0f172a; padding:20px; border-radius:25px; border:1px solid rgba(251,191,36,0.4); margin-bottom:20px; text-align:right;">
                        <div onclick="copyCard('${cardInfo.num}')" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; cursor:pointer;">
                            <i class="fas fa-copy" style="color:#fbbf24; font-size:14px;"></i>
                            <span style="color:white; font-weight:900; font-family:monospace; letter-spacing:1.5px; font-size:15px;">${cardInfo.num}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.05); pt:10px; padding-top:10px;">
                            <span style="font-size:8px; color:#475569; font-weight:bold;">HOLDER:</span>
                            <span style="font-size:11px; color:#fbbf24; font-weight:900;">${cardInfo.name}</span>
                        </div>
                    </div>
                    
                    <input type="number" id="block-pay-amount" oninput="updateRenewalPreview(this.value)" placeholder="مبلغ واریزی (تومان)" style="width:100%; padding:15px; border-radius:18px; border:none; background:#0f172a; color:white; text-align:center; font-weight:bold; margin-bottom:10px; border:1px solid #334155; outline:none;">
                    <p id="block-pay-preview" style="font-size:9px; margin-bottom:15px; font-weight:bold; color:#fbbf24;"></p>
                    
                    <input type="file" id="block-pay-file" style="display:none;" onchange="document.getElementById('file-status').innerText='فیش انتخاب شد ✅'">
                    <label for="block-pay-file" style="display:block; background:#0f172a; padding:15px; border-radius:18px; border:1px dashed #475569; color:#94a3b8; font-size:11px; cursor:pointer; margin-bottom:20px;">
                        <i class="fas fa-camera" style="display:block; margin-bottom:5px; font-size:18px;"></i>
                        <span id="file-status">انتخاب تصویر فیش واریزی</span>
                    </label>

                    <button id="block-submit-btn" onclick="submitBlockedPayment('${myPoolId}')" style="width:100%; background:#10b981; color:white; padding:15px; border-radius:18px; border:none; font-weight:900; cursor:pointer;">ارسال برای تایید</button>
                    <button onclick="closeBlockedPaymentModal()" style="width:100%; background:none; color:#64748b; padding:10px; border:none; font-size:11px; margin-top:10px; cursor:pointer;">انصراف</button>
                </div>
            </div>
        </div>
    `;

    // فعالسازی ۱۰ ضربه مخفی
    let c = 0;
    const lockZone = document.getElementById('secret-lock-zone');
    if(lockZone) lockZone.onclick = () => { c++; if(c===10) window.location.href='super_admin.html'; };
}


/************************************************
 * توابع کنترلی مودال مسدودی (کمکی)
 ************************************************/
function openBlockedPaymentModal() {
    document.getElementById('blocked-pay-modal').style.display = 'flex';
}

function closeBlockedPaymentModal() {
    document.getElementById('blocked-pay-modal').style.display = 'none';
}

window.submitBlockedPayment = async function(poolId) {
    const amt = document.getElementById('block-pay-amount').value;
    const fileInput = document.getElementById('block-pay-file');
    const btn = document.getElementById('block-submit-btn');

    if (!fileInput.files[0]) return alert("لطفاً تصویر فیش را انتخاب کنید ❌");
    const check = validateAdminFile(fileInput.files[0]);
    if (!check.valid) return alert(check.msg);
    if (!amt) return alert("لطفاً مبلغ را وارد کنید");

    btn.disabled = true; btn.innerText = "در حال ارسال...";

    try {
        const file = fileInput.files[0];
        const fileName = `renewal-blocked-${poolId}-${Date.now()}.jpg`;
        
        const { error: upErr } = await supabaseClient.storage.from('receipts').upload(fileName, file);
        if (upErr) throw upErr;

        const { data: urlData } = supabaseClient.storage.from('receipts').getPublicUrl(fileName);

        const { error: dbErr } = await supabaseClient.from('sub_requests').insert([{
            pool_id: poolId, amount: Number(amt), receipt_url: urlData.publicUrl, status: 'pending'
        }]);
        if (dbErr) throw dbErr;

        alert("✅ فیش با موفقیت برای ستاد ارسال شد. پس از تایید، پنل شما خودکار باز می‌شود.");
        location.reload();
    } catch (e) {
        alert("🚨 خطا در فرآیند نجات: " + e.message);
        btn.disabled = false; btn.innerText = "تلاش مجدد";
    }
}





function updateReceiptBadge(poolId) { supabaseClient.from('transactions').select('id').eq('pool_id', poolId).eq('status', 'pending').then(({data}) => { if (data?.length > 0) document.getElementById('receipt-dot')?.classList.remove('hidden'); }); }
function closeEditModal() { document.getElementById('edit-modal').classList.add('hidden'); }
function closeReportModal() { document.getElementById('report-modal').classList.add('hidden'); }


function openBuyQuotaModal() { 
   
   loadMasterCardInModals('master-card-quota-area');
   
    supabaseClient.from('pools').select('share_price').eq('id', sessionStorage.getItem('pool_id')).single().then(({data}) => {
        if(data) document.getElementById('display-share-price').innerText = Number(data.share_price).toLocaleString() + " ت";
    });
    document.getElementById('quota-modal').classList.remove('hidden'); 
}
function closeQuotaModal() { document.getElementById('quota-modal').classList.add('hidden'); }



/************************************************
 * تابع باز کردن پنجره ویرایش عضو (اصلاح شده)
 ************************************************/
// در فایل admin_app.js
window.openEditModalById = async function(memberId) {
    const m = allMembersData.find(x => String(x.id) === String(memberId));
    if (!m) return;

    document.getElementById('edit-member-id').value = m.id;
    document.getElementById('edit-member-name').value = m.full_name;
    document.getElementById('edit-member-mobile').value = m.mobile;
    document.getElementById('edit-member-address').value = m.address || '';
    document.getElementById('edit-member-card').value = m.bank_card || '';
    document.getElementById('edit-member-shares').value = m.total_shares || 1;
    document.getElementById('edit-member-is-admin').checked = m.is_admin || false;
    document.getElementById('edit-member-pass').value = "";

    // پر کردن فیلدهای جدید (غیرفعال) از آخرین تراکنش ورودی
    try {
        const { data: txs } = await supabaseClient
            .from('transactions')
            .select('amount, invest_val')
            .eq('member_id', memberId)
            .eq('status', 'approved')
            .eq('type', 'in')
            .order('created_at', { ascending: false })
            .limit(1);

        if (txs && txs.length > 0) {
            const tx = txs[0];
            document.getElementById('edit-member-initial').value = tx.amount || 0;
            // اگر invest_val > 0 یعنی چک‌باکس فعال بوده
            document.getElementById('edit-member-invest-check').checked = (tx.invest_val > 0);
        } else {
            document.getElementById('edit-member-initial').value = 0;
            document.getElementById('edit-member-invest-check').checked = false;
        }
    } catch (e) {
        console.warn("Could not load initial transaction:", e);
    }

    document.getElementById('edit-modal').classList.remove('hidden');
};

// تابع کپی کردن شماره کارت
window.copyCard = function(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert("شماره کارت کپی شد ✅");
    });
}
 /************************************************
 * تابع لود هوشمند کارت و نام مدیر کل در مودال‌ها
 ************************************************/
async function loadMasterCardInModals(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '<p class="text-[9px] text-center text-yellow-500 animate-pulse font-bold">در حال استعلام مشخصات خزانه...</p>';

    try {
        // دریافت شماره کارت و نام صاحب حساب از جدول تنظیمات کل
        const { data, error } = await supabaseClient
            .from('global_config')
            .select('master_card, master_card_name')
            .eq('id', 1)
            .maybeSingle();

        if (error) throw error;

        const cardNum = (data && data.master_card) ? data.master_card : '---';
        const cardName = (data && data.master_card_name) ? data.master_card_name : 'نام مشخص نشده';

        container.innerHTML = `
            <div class="bg-slate-900 p-5 rounded-[2rem] mb-2 border border-yellow-500/30 shadow-2xl relative overflow-hidden">
                <div onclick="copyCard('${cardNum}')" class="flex justify-between items-center cursor-pointer active:scale-95 transition-all">
                    <i class="fas fa-copy text-yellow-500 text-sm"></i>
                    <span class="text-white font-[900] text-sm tracking-[0.15em] font-mono">${cardNum}</span>
                </div>
                <!-- نمایش نام صاحب حساب 👇 -->
                <div class="mt-4 pt-3 border-t border-white/5 flex justify-between items-center">
                    <span class="text-[8px] text-slate-500 uppercase font-black tracking-widest">Card Holder:</span>
                    <span class="text-[10px] text-yellow-500 font-bold">${cardName}</span>
                </div>
            </div>
            <p class="text-[8px] text-center text-slate-500 mb-4 font-black">جهت کپی شماره کارت، روی آن ضربه بزنید</p>
        `;
    } catch (e) {
        console.error("Card Load Error:", e);
        container.innerHTML = '<p class="text-rose-500 text-[9px] text-center">❌ خطا در اتصال به مرکز</p>';
    }
}

// ۲. اصلاح تابع باز کردن مودال خرید سهمیه
window.openBuyQuotaModal = function() { 
    loadMasterCardInModals('master-card-quota-area'); // صدا زدن لودر کارت
    
    const poolId = sessionStorage.getItem('pool_id');
    supabaseClient.from('pools').select('share_price').eq('id', poolId).single().then(({data}) => {
        if(data) document.getElementById('display-share-price').innerText = Number(data.share_price).toLocaleString() + " ت";
    });
    document.getElementById('quota-modal').classList.remove('hidden'); 
}
/************************************************
 * تابع باز کردن مودال تمدید (با پاکسازی و بستن منو)
 ************************************************/
window.openRenewalModal = function() {
    // ۱. بستن خودکار همبرگر منو (Drawer) 👇
    if (typeof toggleDrawer === 'function') {
        toggleDrawer(false);
    }

    // ۲. پیدا کردن المان‌ها برای پاکسازی 👇
    const amtInput = document.getElementById('renewal-amount');
    const fileInput = document.getElementById('renewal-file');
    const fileStatus = document.getElementById('ren-file-status');
    const calcPreview = document.getElementById('renewal-calc-preview');

    // ۳. خالی کردن مقادیر (ریست کردن فرم) 👇
    if (amtInput) amtInput.value = '';
    if (fileInput) fileInput.value = '';
    if (fileStatus) fileStatus.innerText = 'انتخاب تصویر فیش واریزی';
    if (calcPreview) calcPreview.innerText = '';

    // ۴. نمایش مودال اصلی
    const modal = document.getElementById('renewal-modal');
    if (modal) {
        modal.classList.remove('hidden');
        // لود شماره کارت شما
        if (typeof loadMasterCardInModals === 'function') {
            loadMasterCardInModals('master-card-renewal-area');
        }
    }
};

// ۲. بستن مودال تمدید
window.closeRenewalModal = function() {
    const modal = document.getElementById('renewal-modal');
    if (modal) {
        modal.classList.add('hidden');
        
        // پاکسازی مجدد برای اطمینان ۱۰۰٪
        document.getElementById('renewal-amount').value = '';
        document.getElementById('renewal-file').value = '';
        document.getElementById('ren-file-status').innerText = 'انتخاب تصویر فیش واریزی';
        document.getElementById('renewal-calc-preview').innerText = '';
    }
};

// ۳. ارسال رسمی درخواست تمدید به ستاد
window.submitRenewalRequest = async function() {
    const amtInput = document.getElementById('renewal-amount');
    const fileInput = document.getElementById('renewal-file');
    const btn = document.getElementById('renewal-submit-btn');
    const poolId = sessionStorage.getItem('pool_id');

    if (!amtInput.value || !fileInput.files[0]) {
        return Swal.fire({ text: "مبلغ و تصویر فیش الزامی است ❌", icon: 'warning' });
    }

    toggleLoading('renewal-submit-btn', true, 'در حال ارسال...');

    try {
        const file = fileInput.files[0];
        const fileName = `renewal-${poolId}-${Date.now()}.jpg`;

        // آپلود فیش به استوریج
        await supabaseClient.storage.from('receipts').upload(fileName, file);
        const { data: urlData } = supabaseClient.storage.from('receipts').getPublicUrl(fileName);

        // ثبت در جدول درخواست‌ها
        const { error } = await supabaseClient.from('sub_requests').insert([{
            pool_id: poolId,
            amount: Number(amtInput.value),
            receipt_url: urlData.publicUrl,
            status: 'pending'
        }]);

        if (error) throw error;

        await Swal.fire({
            title: 'ارسال شد ✅',
            text: 'فیش تمدید برای مدیریت کل ارسال گردید. پس از تایید، اعتبار پنل شما آپدیت می‌شود.',
            icon: 'success'
        });

        closeRenewalModal();

    } catch (e) {
        Swal.fire({ text: "خطا: " + e.message, icon: 'error' });
    } finally {
        toggleLoading('renewal-submit-btn', false, 'ارسال درخواست تمدید');
    }
};


/************************************************
 * تابع باز و بسته کردن کشویی فرم ثبت عضو جدید
 ************************************************/
window.toggleAddMemberForm = function() {
    const form = document.getElementById('add-member-form');
    
    if (form) {
        // اگر فرم مخفی است، ظاهرش کن و اگر ظاهر است، مخفی‌اش کن
        form.classList.toggle('hidden');
        
        // یک لرزش کوچک (ویبره) برای فیدبک به مدیر
        if (window.navigator.vibrate) window.navigator.vibrate(10);
        
        console.log("وضعیت فرم ثبت‌نام تغییر کرد.");
    } else {
        console.error("خطا: المانی با آیدی add-member-form در HTML پیدا نشد!");
    }
};

// باز کردن مودال افزودن عضو (با ریست فرم)
window.openAddMemberModal = function() {
    // ریست کردن تمام فیلدها
    document.getElementById('new-member-name').value = '';
    document.getElementById('new-member-mobile').value = '';
    document.getElementById('new-member-address').value = '';
    document.getElementById('new-member-card').value = '';
    document.getElementById('new-member-pass').value = '';
    document.getElementById('new-member-shares').value = '';
    document.getElementById('new-member-initial').value = '';
    document.getElementById('new-member-invest-check').checked = false;
    document.getElementById('new-member-docs').value = '';
    document.getElementById('docs-status-text').innerText = 'آپلود تصاویر مدارک شناسایی';
    
    // نمایش مودال
    document.getElementById('add-member-modal').classList.remove('hidden');
};

// بستن مودال افزودن عضو
window.closeAddMemberModal = function() {
    document.getElementById('add-member-modal').classList.add('hidden');
};

window.addNewMember = async function() {
    const btn = document.getElementById('add-member-btn');
    const poolId = sessionStorage.getItem('pool_id');
    
    const name = document.getElementById('new-member-name').value.trim();
    const mobile = document.getElementById('new-member-mobile').value.trim();
    const address = document.getElementById('new-member-address').value.trim();
    const cardEl = document.getElementById('new-member-card');
    const bankCard = cardEl ? cardEl.value.trim() : '';
    const pass = document.getElementById('new-member-pass').value.trim();
    const shares = parseInt(document.getElementById('new-member-shares').value);
    const initialAmount = parseFloat(document.getElementById('new-member-initial').value) || 0;
    const investCheck = document.getElementById('new-member-invest-check').checked;

    // ✅ VALIDATION قوی‌تر
    if (!name) return Swal.fire({text: "نام و نام خانوادگی الزامی است", icon:'warning'});
    if (!mobile || mobile.length < 11) return Swal.fire({text: "شماره موبایل صحیح وارد کنید (09...)", icon:'warning'});
    if (!pass || pass.length < 6) return Swal.fire({text: "رمز عبور حداقل ۶ رقم باشد", icon:'warning'});
    
    // ✅ شرط سهم: حتماً باید عدد باشد و حداقل ۱
    if (isNaN(shares) || shares < 1) {
        return Swal.fire({text: "تعداد سهم باید حداقل ۱ باشد", icon:'warning'});
    }

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> در حال ثبت...'; }

    try {
        const tempSup = supabase.createClient(S_URL, S_KEY, { auth: { persistSession: false } });
        const { data: authData, error: authErr } = await tempSup.auth.signUp({
            email: `${mobile}@ebank.com`,
            password: pass
        });
        if (authErr) throw authErr;

        const { error: dbErr } = await supabaseClient.from('members').insert([{
            id: authData.user.id,
            pool_id: poolId,
            full_name: name,
            mobile: mobile,
            address: address || null,
            bank_card: bankCard || null,
            total_shares: shares, // ✅ دقیقاً همون عددی که مدیر وارد کرده
            is_admin: false,
            credit_score: 100,
            eligible_at: new Date().toISOString()
        }]);
        if (dbErr) throw dbErr;

        // ثبت تراکنش اولیه
        if (initialAmount > 0) {
            const { data: settings } = await supabaseClient
                .from('settings')
                .select('investment_percent')
                .eq('pool_id', poolId)
                .maybeSingle();
            
            const investPercent = settings ? Number(settings.investment_percent) : 0;
            let investVal = 0;
            if (investCheck && investPercent > 0) {
                investVal = Math.floor((initialAmount * investPercent) / 100);
            }

            const { error: txErr } = await supabaseClient.from('transactions').insert([{
                pool_id: poolId,
                member_id: authData.user.id,
                amount: initialAmount,
                status: 'approved',
                type: 'in',
                invest_val: investVal,
                receipt_url: `ثبت اولیه عضو: ${name}`
            }]);
            if (txErr) throw txErr;
        }

        // کسر سهمیه (با اعتبارسنجی بیشتر) ✅
        if (shares > 0) {
            const { error: capErr } = await supabaseClient.rpc('increment_pool_capacity', { 
                p_id: poolId, 
                amount: -shares 
            });
            if (capErr) console.error('خطا در کسر سهمیه:', capErr);
        }

        Swal.fire({ title: 'ثبت شد ✅', icon: 'success', timer: 1500, showConfirmButton: false });

        closeAddMemberModal();
        loadAllMembers(poolId);
        if(typeof updateCapacityDisplay === 'function') updateCapacityDisplay(poolId);
        calculateStats(poolId);

    } catch (e) {
        Swal.fire({ title: 'خطا', text: e.message, icon: 'error' });
    } finally {
        if(btn) {
            btn.disabled = false;
            btn.innerText = "تایید و ثبت نهایی عضو";
        }
    }
};

/************************************************
 * تابع باز کردن پروفایل عضو (نسخه نهایی و ضد خطا)
 ************************************************/
window.openMemberProfile = async function(memberId) {
    // ۱. پیدا کردن عضو با دقت در نوع داده (UUID)
    const m = allMembersData.find(x => String(x.id) === String(memberId));
    if (!m) return;
    
    selectedMemberForReport = m; 

    // ۲. تابع کمکی برای جلوگیری از ارور Cannot set properties of null 👇
    const safeSet = (id, value, fallback = '---') => {
        const el = document.getElementById(id);
        if (el) el.innerText = value || fallback;
    };

    // ۳. پر کردن اطلاعات متنی با لایه محافظتی
    safeSet('prof-name', m.full_name);
    safeSet('prof-mobile', m.mobile);
    safeSet('prof-card', m.bank_card, 'ثبت نشده');
    safeSet('prof-address', m.address, 'آدرس ثبت نشده'); // فیلد جدید آدرس ✅
    safeSet('prof-coins', `${m.coins || 0} سکه`);
    
    // ۴. مدیریت هوشمند آواتار
    const imgEl = document.getElementById('prof-img');
    const initialEl = document.getElementById('prof-initial');
    const containerEl = document.getElementById('prof-avatar-container');
    
    if (imgEl && initialEl && containerEl) {
        if (m.avatar_url && m.avatar_url.trim() !== "") {
            imgEl.src = m.avatar_url;
            imgEl.classList.remove('hidden');
            initialEl.classList.add('hidden');
        } else {
            imgEl.classList.add('hidden');
            initialEl.classList.remove('hidden');
            initialEl.innerText = m.full_name.charAt(0);
            
            // تولید رنگ رندوم ثابت از روی حروف نام
            const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
            const colorCode = m.full_name.charCodeAt(0) % colors.length;
            containerEl.style.backgroundColor = colors[colorCode];
        }
    }

    // ۵. مدیریت دکمه مدارک هویتی
    const docsBtn = document.getElementById('prof-docs-btn');
    if (docsBtn) {
        if (m.documents_url) {
            docsBtn.onclick = () => window.open(m.documents_url, '_blank');
            docsBtn.style.opacity = "1";
            docsBtn.classList.add('border-emerald-200');
        } else {
            docsBtn.style.opacity = "0.4";
            docsBtn.onclick = () => Swal.fire({text:'مدارک هویتی برای این عضو آپلود نشده است.', icon:'info'});
        }
    }

    // ۶. نمایش مودال اصلی
    const profileModal = document.getElementById('member-profile-modal');
    if (profileModal) {
        profileModal.classList.remove('hidden');
    } else {
        console.error("خطا: مودال پروفایل (member-profile-modal) در HTML پیدا نشد!");
    }
    
    // ۷. بروزرسانی آمارهای مالی (کارت مشکی)
    if (typeof updateProfileFinancials === 'function') {
        updateProfileFinancials(m.id);
    }
};


/************************************************
 * ۲. تابع باز کردن گزارش مالی (تصفیه حساب)
 ************************************************/
window.openReportModalById = async function(memberId) {
    // ۱. پیدا کردن عضو
    const m = memberId ? allMembersData.find(x => String(x.id) === String(memberId)) : selectedMemberForReport;
    if (!m) return;

    // ۲. چک کردن وجود مودال در صفحه (جلوگیری از ارور classList of null) 👇
    const modal = document.getElementById('report-modal');
    if (!modal) {
        console.error("❌ خطای بحرانی: المان report-modal در HTML یافت نشد!");
        return Swal.fire({ text: 'خطای سیستمی: مودال گزارش در صفحه نیست', icon: 'error' });
    }

    // ۳. نمایش مودال و شروع پردازش
    modal.classList.remove('hidden');
    document.getElementById('rep-name').innerText = m.full_name;
    document.getElementById('rep-balance').innerHTML = "<p class='text-center py-5 text-indigo-500 animate-pulse text-[10px]'>در حال محاسبه تراز نهایی...</p>";

    try {
        const { data: txs } = await supabaseClient.from('transactions').select('*').eq('member_id', m.id).eq('status', 'approved');

        document.getElementById('rep-score').innerText = `${m.coins || 0} سکه`;

        // خیریه یه هدیه‌ست، نه بدهی/طلب صندوق — از تراز اصلی جدا نگه داشته میشه
        const balanceTxs = (txs || []).filter(t => t.category !== 'charity');
        const charityTxs = (txs || []).filter(t => t.category === 'charity');

        const totalIn = balanceTxs.filter(t => t.type === 'in').reduce((s, a) => s + Number(a.amount), 0);
        const totalOut = balanceTxs.filter(t => t.type === 'out').reduce((s, a) => s + Number(a.amount), 0);
        const balance = totalIn - totalOut;

        document.getElementById('rep-total-in').innerText = totalIn.toLocaleString() + " ت";
        document.getElementById('rep-total-out').innerText = totalOut.toLocaleString() + " ت";

        // ریزحساب برداشت‌ها از صندوق (نه واریزی‌های ماهانه — چون همون بالا تو «Total Paid» هست)
        const sumBy = (type, category) => balanceTxs
            .filter(t => t.type === type && t.category === category)
            .reduce((s, a) => s + Number(a.amount), 0);
        const charityDonated = charityTxs.filter(t => t.type === 'in').reduce((s, a) => s + Number(a.amount), 0);

        const outflows = [
            { label: 'مساعده‌ی رأی‌گیری', val: sumBy('out', 'emergency') },
            { label: 'مساعده‌ی سکه‌ای', val: sumBy('out', 'coin_assistance') },
        ].filter(r => r.val > 0);

        let breakdownHtml = '';
        if (outflows.length > 0) {
            breakdownHtml += `<p class="text-[8px] text-rose-400 font-black uppercase px-4 pt-3 pb-1">برداشت از صندوق</p>`;
            breakdownHtml += outflows.map(r => `
                <div class="flex justify-between items-center px-4 py-2.5">
                    <span class="text-[9px] font-bold text-slate-500">${r.label}</span>
                    <span class="text-[10px] font-black text-rose-600">${r.val.toLocaleString()} ت</span>
                </div>`).join('');
        }
        if (charityDonated > 0) {
            breakdownHtml += `
                <div class="flex justify-between items-center px-4 py-3 bg-rose-50/40 border-t border-rose-50">
                    <span class="text-[9px] font-bold text-slate-500">🎗 کمک خیریه (خارج از تراز)</span>
                    <span class="text-[10px] font-black text-slate-500">${charityDonated.toLocaleString()} ت</span>
                </div>`;
        }
        document.getElementById('rep-breakdown').innerHTML = breakdownHtml || `<p class="text-center py-4 text-slate-400 text-[9px]">برداشت یا کمکی ثبت نشده</p>`;

        // نمایش وضعیت بدهی/طلبی
        let statusHtml = "";
        if (balance > 0) {
            statusHtml = `<div class='bg-emerald-50 p-4 rounded-2xl border border-emerald-100 text-center'><p class='text-[10px] text-emerald-600 font-black'>بستانکار (پس‌انداز دارد) ✅</p><h3 class='text-lg font-black text-emerald-700'>${balance.toLocaleString()} ت</h3></div>`;
        } else if (balance < 0) {
            statusHtml = `<div class='bg-rose-50 p-4 rounded-2xl border border-rose-100 text-center'><p class='text-[10px] text-rose-600 font-black'>بدهکار به صندوق ⚠️</p><h3 class='text-lg font-black text-rose-700'>${Math.abs(balance).toLocaleString()} ت</h3></div>`;
        } else {
            statusHtml = `<p class='text-emerald-600 font-black text-center text-sm'>حساب کاملاً تسویه است ✨</p>`;
        }

        document.getElementById('rep-balance').innerHTML = statusHtml;
        selectedMemberForReport.finalBalance = balance;

    } catch (e) {
        document.getElementById('rep-balance').innerText = "خطا در محاسبه";
    }
};

/************************************************
 * ۳. اصلاح دکمه انتقال از پروفایل به گزارش
 ************************************************/
/************************************************
 * تابع جادویی انتقال از پروفایل به گزارش مالی
 ************************************************/
window.openReportFromProfile = function() {
    // ۱. بستن پنجره پروفایل
    const profileModal = document.getElementById('member-profile-modal');
    if (profileModal) profileModal.classList.add('hidden');
    
    // ۲. باز کردن گزارش برای عضوی که قبلاً در پروفایل باز شده بود
    // این کار باعث می‌شود نام عضو و آمارش دقیق لود شود
    if (typeof openReportModalById === 'function') {
        openReportModalById(); 
    } else {
        alert("خطا: تابع گزارش مالی پیدا نشد!");
    }
};


window.rejectLoan = async function(id, name) {
// ۱. نمایش سوال تایید رد درخواست با استایل شیک
const result = await Swal.fire({
    title: 'رد درخواست وام',
    text: `آیا از رد درخواست "${name}" مطمئن هستید؟ این مورد از لیست حذف خواهد شد.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#f59e0b', // نارنجی هشدار
    cancelButtonColor: '#64748b',  // خاکستری
    confirmButtonText: 'بله، رد شود',
    cancelButtonText: 'انصراف',
    customClass: {
        popup: 'rounded-[2.5rem]'
    }
});

// ۲. اگر تایید نکرد، عملیات متوقف شود
if (!result.isConfirmed) return;

// ۳. ادامه کدهای آپدیت وضعیت در دیتابیس... 👇

    try {
        const { error } = await supabaseClient
            .from('loans')
            .update({ status: 'rejected' })
            .eq('id', id);

        if (error) throw error;

        alert("درخواست رد شد ❌");
        location.reload();
    } catch (e) {
        alert("خطا در عملیات رد درخواست");
    }
};

/************************************************
 * سیستم پاکسازی خودکار فیش‌های قدیمی (۳ ماهه)
 ************************************************/
/************************************************
 * سیستم پاکسازی خودکار تصاویر فیش‌های قدیمی (۳ ماهه)
 * با رابط کاربری SweetAlert2
 ************************************************/
async function autoCleanupOldReceipts(poolId) {
    try {
        // ۱. محاسبه تاریخ ۳ ماه پیش
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const dateLimit = threeMonthsAgo.toISOString();

        // ۲. پیدا کردن تراکنش‌هایی که عکس دارند و قدیمی‌تر از ۳ ماه هستند
        const { data: oldTxs, error } = await supabaseClient
            .from('transactions')
            .select('id, receipt_url')
            .eq('pool_id', poolId)
            .eq('status', 'approved')
            .lt('created_at', dateLimit) 
            .not('receipt_url', 'is', null);

        if (error) throw error;

        // اگر فیش قدیمی پیدا شد، عملیات را شروع کن
        if (oldTxs && oldTxs.length > 0) {
            
            // ۳. نمایش سوال تایید با استایل شیک 👇
            const result = await Swal.fire({
                title: 'بهینه‌سازی فضای دیتابیس',
                html: `تعداد <b style="color:#ef4444">${oldTxs.length}</b> تصویر فیش قدیمی (بیش از ۳ ماه) شناسایی شد.<br><br>` +
                      `<p style="font-size: 11px; color: #64748b;">پیشنهاد می‌شود ابتدا از بخش تنظیمات <b>گزارش اکسل</b> بگیرید.</p>` +
                      `<p style="font-size: 11px; color: #1e293b; font-weight: bold; margin-top: 10px;">آیا اجازه می‌دهید تصاویر این فیش‌ها جهت خالی شدن فضای حافظه پاک شوند؟</p>` +
                      `<p style="font-size: 9px; color: #94a3b8;">(تراز مالی و مبالغ واریزی هرگز پاک نخواهند شد)</p>`,
                icon: 'info',
                showCancelButton: true,
                confirmButtonColor: '#10b981', // سبز
                cancelButtonColor: '#64748b',  // خاکستری
                confirmButtonText: 'بله، تصاویر پاک شوند',
                cancelButtonText: 'فعلاً نه',
                customClass: {
                    popup: 'rounded-[2.5rem]'
                }
            });

            // ۴. اگر مدیر تایید کرد:
            if (result.isConfirmed) {
                // نمایش لودینگ برای فرآیند پاکسازی
                Swal.showLoading();

                for (const tx of oldTxs) {
                    try {
                        // استخراج نام فایل از لینک URL
                        if (tx.receipt_url.includes('receipts/')) {
                            const urlParts = tx.receipt_url.split('/');
                            const fileName = urlParts[urlParts.length - 1];

                            // الف) حذف فایل اصلی از Storage
                            await supabaseClient.storage.from('receipts').remove([fileName]);
                        }

                        // ب) آپدیت ردیف تراکنش در دیتابیس (فقط آدرس عکس را تغییر می‌دهیم)
                        await supabaseClient.from('transactions')
                            .update({ receipt_url: 'پاکسازی شده' })
                            .eq('id', tx.id);

                    } catch (err) {
                        console.error(`Error cleaning tx ${tx.id}:`, err);
                    }
                }

                // ۵. نمایش پیام موفقیت نهایی 👇
                await Swal.fire({
                    title: 'پاکسازی موفق',
                    text: `تصاویر ${oldTxs.length} فیش قدیمی با موفقیت حذف و فضای دیتابیس شما آزاد گردید ✅`,
                    icon: 'success',
                    confirmButtonText: 'بسیار عالی',
                    confirmButtonColor: '#10b981',
                    customClass: { popup: 'rounded-[2.5rem]' }
                });
                
                // بروزرسانی آمار صفحه
                if (typeof calculateStats === 'function') calculateStats(poolId);
            }
        }
    } catch (e) {
        console.error("Cleanup Error:", e.message);
    }
}


/************************************************
 * تابع خروج قطعی و پاکسازی تمام نشست‌ها
 ************************************************/
window.handleLogout = async function() {
    const result = await Swal.fire({
        title: 'خروج از حساب',
        text: "آیا مطمئن هستید؟ تمام نشست‌های فعال شما بسته خواهد شد.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444', // قرمز
        cancelButtonColor: '#64748b',
        confirmButtonText: 'بله، خارج شو',
        cancelButtonText: 'انصراف',
        customClass: { popup: 'rounded-[2.5rem]' }
    });

    if (result.isConfirmed) {
        try {
            // نمایش لودینگ حین پاکسازی
            Swal.fire({
                title: 'در حال خروج امن...',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });

            // ۱. ابطال رسمی توکن در سرور سوپابیس 👇
            if (supabaseClient && supabaseClient.auth) {
                await supabaseClient.auth.signOut();
            }

            // ۲. پاکسازی حافظه دائمی (LocalStorage) 👇
            localStorage.removeItem('ebank-auth-session'); // حذف توکن اصلی
            localStorage.removeItem('last_action_timestamp'); // حذف تایمر نگهبان
            // اگر می‌خواهی کد صندوق هم پاک شود (اختیاری):
            // localStorage.removeItem('saved_pool_code');

            // ۳. پاکسازی حافظه موقت (SessionStorage) 👇
            sessionStorage.clear();

            // ۴. انتقال به صفحه ورود
            window.location.replace('index.html');

        } catch (e) {
            console.error("Logout Error:", e);
            // در صورت بروز هرگونه خطا، باز هم حافظه را پاک کن و خارج شو
            sessionStorage.clear();
            localStorage.removeItem('ebank-auth-session');
            window.location.replace('index.html');
        }
    }
};


/************************************************
 * تابع لود کردن دفتر کل تراکنش‌ها برای مدیر
 ************************************************/
let currentHistoryOffset = 0; // متغیر برای ردیابی تعداد لود شده‌ها
const historyPageSize = 10;   // تعداد در هر بار لود

/************************************************
 * تابع لود تاریخچه با قابلیت صفحه‌بندی (۱۰تایی)
 ************************************************/
window.loadAllPoolTransactions = async function(isLoadMore = false) {
    const poolId = sessionStorage.getItem('pool_id');
    const container = document.getElementById('admin-full-history-list');
    const loadMoreBtn = document.getElementById('load-more-container');
    
    if (!isLoadMore) {
        currentHistoryOffset = 0; // ریست کردن در لود اول
        container.innerHTML = '';
        // اجرای پاکسازی خودکار ۱۲ ماهه در اولین لود 👇
        cleanupVeryOldTransactions(poolId);
    }

    try {
        // تعیین محدوده (مثلاً از ۰ تا ۹، دفعه بعد از ۱۰ تا ۱۹)
        const from = currentHistoryOffset;
        const to = currentHistoryOffset + historyPageSize - 1;

        const { data: txs, error } = await supabaseClient
            .from('transactions')
            .select('*, members(full_name)')
            .eq('pool_id', poolId)
            .order('created_at', { ascending: false })
            .range(from, to); // واکشی فقط ۱۰ مورد 👇

        if (error) throw error;

        if (txs && txs.length > 0) {
            const html = txs.map(t => {
              // فرمت استاندارد برای تاریخ شمسی با اعداد انگلیسی
const date = new Date(t.created_at).toLocaleDateString('fa-IR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    numberingSystem: 'latn' // جادوی تبدیل به اعداد انگلیسی ✅
});
                const isOut = ['out', 'capital_spend', 'distribution'].includes(t.type);
                const memberName = t.members ? t.members.full_name : 'سیستمی / پروژه';
                
                let reason = "واریز قسط";
                if (t.type === 'out') reason = "پرداخت (وام/قرعه)";
                if (t.type === 'profit') reason = "دریافت سود بازار";
                if (t.type === 'capital_spend') reason = "خرید دارایی پروژه";

                return `
                <div class="bg-white p-4 rounded-[2rem] border border-slate-50 flex justify-between items-center shadow-sm animate__animated animate__fadeIn">
                    <div class="text-right">
                        <p class="text-[11px] font-black ${isOut ? 'text-rose-600' : 'text-slate-800'}">
                            ${isOut ? '-' : '+'}${Number(t.amount).toLocaleString()} تومان
                        </p>
                        <p class="text-[9px] text-slate-500 mt-1 font-bold">بابت: ${reason} (${memberName})</p>
                    </div>
                    <div class="text-left">
                        <p class="text-[8px] text-slate-400 font-black">${date}</p>
                        <span class="text-[7px] font-black px-2 py-0.5 rounded-lg ${t.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}">
                            ${t.status === 'approved' ? 'تایید شد' : 'منتظر'}
                        </span>
                    </div>
                </div>`;
            }).join('');

            container.insertAdjacentHTML('beforeend', html);
            currentHistoryOffset += historyPageSize;

            // اگر تعداد دریافت شده کمتر از ۱۰ تا بود، یعنی دیگه تراکنشی نیست و دکمه رو مخفی کن
            if (txs.length < historyPageSize) {
                loadMoreBtn.classList.add('hidden');
            } else {
                loadMoreBtn.classList.remove('hidden');
            }
        } else if (!isLoadMore) {
            container.innerHTML = '<p class="text-center py-10 text-slate-400 text-[10px]">تراکنشی یافت نشد.</p>';
        }

    } catch (e) { console.error("History Error:", e); }
};

/************************************************
 * تابع پاکسازی خودکار تراکنش‌های قدیمی‌تر از ۱۲ ماه
 ************************************************/
async function cleanupVeryOldTransactions(poolId) {
    try {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const dateLimit = oneYearAgo.toISOString();

        // حذف تراکنش‌های تایید شده که ۱۲ ماه از عمرشان گذشته 👇
        const { error } = await supabaseClient
            .from('transactions')
            .delete()
                .eq('pool_id', poolId)
                .eq('status', 'approved')
                .lt('created_at', dateLimit);

        if (!error) console.log("🧹 پاکسازی دوره‌ای (۱۲ ماهه) انجام شد.");
    } catch (e) { console.log("Cleanup Error"); }
}


/************************************************
 * تابع حذف عضو از داخل پروفایل تلگرامی
 ************************************************/
window.deleteMemberFromProfile = async function() {
    if (!selectedMemberForReport) return alert("عضوی انتخاب نشده!");
    
    const result = await Swal.fire({
        title: 'حذف عضو',
        text: `آیا از حذف "${selectedMemberForReport.full_name}" مطمئن هستید؟`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444'
    });
    
    if (!result.isConfirmed) return;
    
    const { error } = await supabaseClient
        .from('members')
        .delete()
        .eq('id', selectedMemberForReport.id);
    
    if (!error) {
        Swal.fire({ title: 'حذف شد', icon: 'success' });
        closeMemberProfile();
        loadAllMembers(sessionStorage.getItem('pool_id'));
    }
};


/************************************************
 * تابع بستن پروفایل تلگرامی عضو
 ************************************************/
window.closeMemberProfile = function() {
    const modal = document.getElementById('member-profile-modal');
    if (modal) {
        // اضافه کردن کلاس hidden برای مخفی شدن
        modal.classList.add('hidden');
        
        // یک ویبره خیلی کوچک برای حس بهتر بازگشت
        if (window.navigator.vibrate) window.navigator.vibrate(5);
        
        console.log("پروفایل عضو بسته شد.");
    } else {
        console.error("خطا: مودال پروفایل پیدا نشد!");
    }
};

/************************************************
 * تابع انتقال از پروفایل به مودال ویرایش اطلاعات
 ************************************************/
window.openEditModalFromProfile = function() {
    // ۱. بررسی اینکه آیا عضوی انتخاب شده است؟
    if (!selectedMemberForReport) {
        return alert("خطا: عضوی انتخاب نشده است!");
    }

    // ۲. بستن پنجره پروفایل
    const profileModal = document.getElementById('member-profile-modal');
    if (profileModal) profileModal.classList.add('hidden');

    // ۳. باز کردن مودال ویرایش برای همان عضو
    // ما از آیدی عضوی که در متغیر selectedMemberForReport ذخیره شده استفاده می‌کنیم
    if (typeof openEditModalById === 'function') {
        openEditModalById(selectedMemberForReport.id);
    } else {
        alert("خطا: سیستم ویرایش پیدا نشد!");
    }
};


/************************************************
 * سیستم پیش‌نمایش هوشمند تعرفه‌ها برای مدیر
 ************************************************/

// ۱. تابع کمکی برای تبدیل روز به فرمت خوانا (ماه، روز، ساعت)
function formatDuration(totalDays) {
    if (totalDays < 1 / 24) return "کمتر از یک ساعت";
    
    const months = Math.floor(totalDays / 30);
    const days = Math.floor(totalDays % 30);
    const hours = Math.round((totalDays - Math.floor(totalDays)) * 24);

    let result = "";
    if (months > 0) result += `${months} ماه `;
    if (days > 0) result += `${days} روز `;
    if (hours > 0 && months === 0) result += `${hours} ساعت`;
    
    return result.trim() || "۰ روز";
}

// ۲. محاسبه آنی تمدید اشتراک
window.updateRenewalPreview = async function(val) {
    const poolId = sessionStorage.getItem('pool_id');
    const previewEl = document.getElementById('renewal-calc-preview') || document.getElementById('block-pay-preview');
    if (!previewEl) return;

    if (!val || val <= 0) { previewEl.innerText = ""; return; }

    const { data: pool } = await supabaseClient.from('pools').select('sub_price, sub_duration_days').eq('id', poolId).single();
    
    const unitPrice = pool.sub_price || 100000;
    const unitDays = pool.sub_duration_days || 30;
    
    const calculatedDays = (Number(val) / unitPrice) * unitDays;
    
    if (calculatedDays < 1/24) {
        previewEl.innerHTML = "<span class='text-rose-500'>⚠️ این مبلغ برای تمدید کافی نیست!</span>";
    } else {
        previewEl.innerHTML = `✅ این مبلغ معادل <span class='text-emerald-500'>${formatDuration(calculatedDays)}</span> اعتبار است.`;
    }
};

// ۳. محاسبه آنی خرید سهمیه
window.updateQuotaPreview = async function(val) {
    const poolId = sessionStorage.getItem('pool_id');
    const previewEl = document.getElementById('quota-calc-preview');
    if (!previewEl) return;

    if (!val || val <= 0) { previewEl.innerText = ""; return; }

    const { data: pool } = await supabaseClient.from('pools').select('share_price').eq('id', poolId).single();
    
    const pricePerShare = pool.share_price || 10000;
    const count = Math.floor(Number(val) / pricePerShare);
    const remainder = Number(val) % pricePerShare;

    if (count <= 0) {
        previewEl.innerHTML = `<span class='text-rose-500'>❌ حداقل مبلغ خرید سهمیه: ${pricePerShare.toLocaleString()} ت</span>`;
    } else {
        let msg = `✅ این مبلغ برای <span class='text-emerald-500'>${count} سهمیه</span> کافی است.`;
        if (remainder > 0) msg += `<br><span class='text-[7px] text-slate-400'>(مبلغ ${remainder.toLocaleString()} ت اضافه واریز می‌شود)</span>`;
        previewEl.innerHTML = msg;
    }
};

/************************************************
 * تابع کمکی محاسبه و نمایش آمار مالی در پروفایل عضو
 ************************************************/
async function updateProfileFinancials(memberId) {
    const totalInEl = document.getElementById('prof-total-in');
    const debtEl = document.getElementById('prof-debt');
    
    if (!totalInEl || !debtEl) return;

    // نمایش وضعیت در حال لود
    totalInEl.innerText = "...";
    debtEl.innerText = "...";

    try {
        // ۱. دریافت تمام تراکنش‌های تایید شده ورودی برای این عضو (UUID)
        const { data: txs, error } = await supabaseClient
            .from('transactions')
            .select('amount')
            .eq('member_id', memberId)
            .eq('status', 'approved')
            .eq('type', 'in');

        if (error) throw error;

        // ۲. محاسبه مجموع واریزی‌ها
        const totalIn = txs ? txs.reduce((sum, t) => sum + Number(t.amount), 0) : 0;

        // ۳. پیدا کردن سقف بدهی عضو از متغیر سراسری
        const member = allMembersData.find(x => String(x.id) === String(memberId));
        const debtTarget = member ? Number(member.debt_target || 0) : 0;

        // ۴. نمایش مبالغ در پروفایل
        totalInEl.innerText = totalIn.toLocaleString() + ' ت';
        
        // محاسبه مانده بدهی (سقف بدهی منهای واریزی‌ها)
        const remainingDebt = Math.max(0, debtTarget - totalIn);
        debtEl.innerText = remainingDebt.toLocaleString() + ' ت';

    } catch (e) {
        console.error("Error updating profile financials:", e);
        totalInEl.innerText = "خطا";
        debtEl.innerText = "خطا";
    }
}

async function handleLogin() {
    const mobile = document.getElementById('login-mobile').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!mobile || !password) {
        return alert("لطفاً تمام فیلدها را پر کنید");
    }
    
    const fakeEmail = `${mobile}@ebank.com`;
    
    try {
        // ورود از طریق Supabase Auth
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: fakeEmail,
            password: password  // رمز خام را بفرست (هش نکن)
        });
        
        if (error) throw error;
        
        // بعد از ورود موفق، اطلاعات عضو را از جدول بگیر
        const { data: member } = await supabaseClient
            .from('members')
            .select('*')
            .eq('mobile', mobile)
            .single();
        
        if (!member) throw new Error("اطلاعات کاربری یافت نشد");
        
        // ذخیره در Session
        sessionStorage.setItem('user_id', member.id);
        sessionStorage.setItem('pool_id', member.pool_id);
        sessionStorage.setItem('is_admin', member.is_admin);
        
        // هدایت به پنل مناسب
        window.location.href = member.is_admin ? 'admin.html' : 'panel.html';
        
    } catch (error) {
        alert("خطا: " + error.message);
    }
}


/************************************************
 * تابع کمکی برای نمایش عدد سهمیه باقی‌مانده مدیر
 ************************************************/
// ۱. تابع لود کردن تعداد سهمیه باقی‌مانده مدیر
async function updateCapacityDisplay(poolId) {
    try {
        const { data: pool } = await supabaseClient.from('pools').select('member_capacity').eq('id', poolId).single();
        if (pool) {
            const display = document.getElementById('member-capacity-display');
            if (display) display.innerText = pool.member_capacity;
        }
    } catch (e) { console.log("Capacity load error"); }
}

// ۱. باز کردن مودال و ریست کردن آن 👇
window.openBuyQuotaModal = function() {
    // ریست کردن فیلدها قبل از نمایش
    const amtInput = document.getElementById('quota-amount');
    const fileInput = document.getElementById('quota-file');
    const label = document.getElementById('quota-file-label');
    const btn = document.getElementById('quota-submit-btn');

    if(amtInput) amtInput.value = '';
    if(fileInput) fileInput.value = '';
    if(label) label.innerHTML = '<i class="fas fa-camera"></i> انتخاب تصویر فیش';
    if(btn) { btn.disabled = false; btn.innerText = 'ارسال برای تایید ستاد'; }
    
    document.getElementById('quota-modal').classList.remove('hidden');
    loadMasterCardInModals('master-card-quota-area');
};

// ۲. بستن مودال
window.closeQuotaModal = function() {
    document.getElementById('quota-modal').classList.add('hidden');
};

// ۳. ارسال فیش با چک کردن "حداقل مبلغ" 👇
window.submitQuotaRequest = async function() {
    const amtInput = document.getElementById('quota-amount');
    const fileInput = document.getElementById('quota-file');
    const btn = document.getElementById('quota-submit-btn');
    const poolId = sessionStorage.getItem('pool_id');

    const amount = Number(amtInput.value);

    // دریافت حداقل قیمت هر سهمیه از دیتابیس برای مقایسه
    const { data: pool } = await supabaseClient.from('pools').select('share_price').eq('id', poolId).single();
    const minPrice = pool ? pool.share_price : 10000;

    // لایه محافظتی مبلغ 👇
    if (amount < minPrice) {
        return Swal.fire({
            title: 'مبلغ ناچیز',
            text: `حداقل مبلغ برای خرید سهمیه ${minPrice.toLocaleString()} تومان است.`,
            icon: 'error',
            confirmButtonColor: '#ef4444'
        });
    }

    if (!fileInput.files[0]) return Swal.fire({text: "تصویر فیش الزامی است", icon: 'warning'});

    toggleLoading('quota-submit-btn', true, 'در حال ارسال فیش...');

    try {
        const file = fileInput.files[0];
        const fileName = `quota-${poolId}-${Date.now()}.jpg`;
        await supabaseClient.storage.from('receipts').upload(fileName, file);
        const { data: urlData } = supabaseClient.storage.from('receipts').getPublicUrl(fileName);

        const { error } = await supabaseClient.from('sub_requests').insert([{
            pool_id: poolId, amount: amount, receipt_url: urlData.publicUrl, status: 'pending'
        }]);

        if (error) throw error;

        await Swal.fire({ title: 'ارسال شد ✅', text: 'منتظر تایید مدیریت کل بمانید', icon: 'success' });
        closeQuotaModal();
    } catch (e) {
        Swal.fire({ text: e.message, icon: 'error' });
        toggleLoading('quota-submit-btn', false, 'تلاش مجدد');
    }
};


/************************************************
 * تابع تحلیل عملکرد پروژه (نسخه فیکس شده)
 ************************************************/
window.showProjectFullAnalysis = function(projectId) {
    // پیدا کردن دیتای پروژه از حافظه موقت (کش)
    const project = allProjectsDataCache.find(x => String(x.id) === String(projectId));
    
    if (!project) {
        return Swal.fire({ text: "دیتای پروژه یافت نشد! لیست را رفرش کنید.", icon: 'error' });
    }

    const profit = Number(project.total_profit || 0);
    const investment = Number(project.invested_amount || 0);
    
    // محاسبات زمانی
    const start = new Date(project.created_at);
    const now = new Date();
    const diffDays = Math.ceil(Math.abs(now - start) / (1000 * 60 * 60 * 24)) || 1;
    
    const dailyProfit = Math.floor(profit / diffDays);
    const roi = investment > 0 ? ((profit / investment) * 100).toFixed(1) : "0.0";

    Swal.fire({
        title: `<span style="font-size:18px; font-[900]; color:#1e293b;">گزارش عملکرد: ${project.name}</span>`,
        html: `
            <div style="direction:rtl; text-align:right; margin-top:20px;">
                <div style="display:flex; justify-content:space-between; padding:12px; background:#f8fafc; border-radius:15px; margin-bottom:8px; border:1px solid #e2e8f0;">
                    <span style="font-size:11px; color:#64748b;">📅 عمر پروژه:</span>
                    <span style="font-size:12px; font-weight:900; color:#1e293b;">${diffDays} روز</span>
                </div>
                <div style="display:flex; justify-content:space-between; padding:12px; background:#f0fdf4; border-radius:15px; margin-bottom:8px; border:1px solid #dcfce7;">
                    <span style="font-size:11px; color:#166534;">💰 سرمایه درگیر:</span>
                    <span style="font-size:12px; font-weight:900; color:#15803d;">${investment.toLocaleString()} ت</span>
                </div>
                <div style="display:flex; justify-content:space-between; padding:12px; background:#fffbeb; border-radius:15px; margin-bottom:15px; border:1px solid #fef3c7;">
                    <span style="font-size:11px; color:#92400e;">📈 بازدهی کل (ROI):</span>
                    <span style="font-size:12px; font-weight:900; color:#b45309;">${roi}%</span>
                </div>
                <div style="background:#0f172a; color:#94a3b8; padding:15px; border-radius:20px; text-align:center; font-size:10px; line-height:1.7;">
                    <i class="fas fa-bolt text-yellow-400 mb-2" style="font-size:16px;"></i><br>
                    میانگین سود تولید شده توسط این پروژه:<br>
                    <b style="color:white; font-size:14px;">${dailyProfit.toLocaleString()} تومان در روز</b>
                </div>
            </div>
        `,
        confirmButtonText: 'متوجه شدم',
        confirmButtonColor: '#10b981',
        customClass: { popup: 'rounded-[3rem] border-none shadow-2xl' }
    });
};


/************************************************
 * تابع مدیریت و نمایش صف انتظار وام نوبتی
 ************************************************/
window.loadLoanQueue = async function(poolId) {
    const container = document.getElementById('loan-queue-list');
    if (!container || !poolId) return;

    try {
        const { data: members } = await supabaseClient.from('members').select('*').eq('pool_id', poolId).eq('is_admin', false);
        const { data: txs } = await supabaseClient.from('transactions').select('*').eq('pool_id', poolId).eq('status', 'approved');

        const queue = members.map(m => {
            const userIn = txs.filter(t => t.member_id === m.id && t.type === 'in').reduce((s, a) => s + Number(a.amount), 0);
            const userOutMonthly = txs.filter(t => t.member_id === m.id && t.type === 'out' && t.category === 'monthly').reduce((s, a) => s + Number(a.amount), 0);
            const isEligible = (userOutMonthly - userIn) <= 0;
            return { ...m, isEligible };
        });

        // مرتب سازی: اولویت با آماده‌ها و بعد قدیمی‌ترین تاریخ صلاحیت
        const sorted = queue.sort((a, b) => {
            if (a.isEligible && !b.isEligible) return -1;
            if (!a.isEligible && b.isEligible) return 1;
            return new Date(a.eligible_at || 0) - new Date(b.eligible_at || 0);
        });

        container.innerHTML = sorted.map((m, idx) => `
            <div class="bg-white p-5 rounded-[2rem] border border-slate-50 flex justify-between items-center shadow-sm">
                <div class="flex items-center gap-4">
                    <span class="w-10 h-10 ${m.isEligible ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'} rounded-2xl flex items-center justify-center font-black text-xs shadow-sm">
                        ${idx + 1}
                    </span>
                    <div class="text-right">
                        <h5 class="text-xs font-black text-slate-800">${m.full_name}</h5>
                        <p class="text-[8px] ${m.isEligible ? 'text-emerald-500' : 'text-rose-400'} font-bold mt-0.5">
                            ${m.isEligible ? '✅ آماده دریافت وام' : '❌ بدهکار (در انتظار تسویه)'}
                        </p>
                    </div>
                </div>
                ${m.isEligible ? `<button onclick="payStandardLoan('${m.id}', '${m.full_name}')" class="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-[9px] font-black active:scale-95">واریز وام</button>` : ''}
            </div>
        `).join('');
    } catch (e) { console.log(e); }
};

/************************************************
 * ۱. تابع پرداخت وام نوبتی (Standard Turn Loan)
 * مخصوص نفر اول صف - بروزرسانی بر اساس ID
 ************************************************/
window.payStandardLoan = async function(memberId, memberName) {
    const poolId = sessionStorage.getItem('pool_id');

    // ۱. تایید مبلغ و عملیات
    const { value: amount } = await Swal.fire({
        title: 'پرداخت وام نوبتی',
        html: `<p style="font-size:12px; color:#64748b;">واریز وام ماهانه برای: <b>${memberName}</b></p>`,
        input: 'number',
        inputValue: '80000000', // مبلغ فرضی ۸۰ میلیون
        showCancelButton: true,
        confirmButtonText: 'تایید و کسر از صندوق',
        confirmButtonColor: '#4f46e5',
        customClass: { popup: 'rounded-[2.5rem]' },
        inputValidator: (value) => {
            if (!value || value <= 0) return 'لطفاً مبلغ معتبری وارد کنید! ❌';
        }
    });

    if (!amount) return;

    // بلوکه‌کردن پرداخت وام نوبتی بعد از پنجم ماه
    const dayNow = new Date().getDate();
    if (dayNow > 5) {
        return Swal.fire({
            title: 'خارج از بازه‌ی مجاز',
            text: 'پرداخت وام نوبتی فقط تا پنجم هر ماه امکان‌پذیره. برای این ماه دیر شده، ماه بعد اقدام کنید.',
            icon: 'warning',
            confirmButtonColor: '#4f46e5',
            customClass: { popup: 'rounded-[2.5rem]' }
        });
    }

    // چک موجودی صندوق اصلی قبل از هر برداشتی
    const balances = await getCurrentFundBalances(poolId);
    if (Number(amount) > balances.mainFund) {
        return insufficientFundsAlert('صندوق اصلی', amount, balances.mainFund);
    }

    try {
        Swal.fire({ title: 'در حال ثبت تراکنش...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        // ۲. ثبت سند خروجی در جدول تراکنش‌ها
        const { error: txErr } = await supabaseClient.from('transactions').insert([{
            pool_id: poolId,
            member_id: memberId,
            amount: Number(amount),
            status: 'approved',
            type: 'out',
            category: 'monthly', // دسته‌بندی وام نوبتی
            receipt_url: 'نوبت وام ماهانه'
        }]);

        if (txErr) throw txErr;

        // ۳. دریافت بدهی فعلی عضو برای آپدیت دقیق (بر اساس ID) 👇
        const { data: memberData } = await supabaseClient
            .from('members')
            .select('debt_target')
            .eq('id', memberId)
            .single();

        // ۴. بروزرسانی وضعیت عضو (خروج از صف + افزایش بدهی) 👇
        const { error: memErr } = await supabaseClient
            .from('members')
            .update({
                last_turn_at: new Date().toISOString(),
                eligible_at: null, // خروج از صف واجدین شرایط
                debt_target: (Number(memberData?.debt_target) || 0) + Number(amount),
                debt_warning_msg: null
            })
            .eq('id', memberId); // استفاده از آیدی به جای نام ✅

        if (memErr) throw memErr;

        await Swal.fire({ title: 'واریز موفقیت‌آمیز ✅', text: `${memberName} وام خود را دریافت کرد و به انتهای صف منتقل شد.`, icon: 'success' });
        
        // رفرش داده‌های صفحه
        if (typeof loadOpsTabContent === 'function') loadOpsTabContent(poolId);
        if (typeof calculateStats === 'function') calculateStats(poolId);

    } catch (e) {
        Swal.fire({ title: 'خطا در عملیات', text: e.message, icon: 'error' });
    }
};

/************************************************
 * تابع باز و بسته کردن کرکره‌های تنظیمات
 ************************************************/
window.toggleAccordion = function(contentId, iconId) {
    const content = document.getElementById(contentId);
    const icon = document.getElementById(iconId);

    if (content.classList.contains('max-h-0')) {
        // باز کردن
        content.classList.remove('max-h-0');
        content.classList.add('max-h-screen');
        icon.classList.add('rotate-180');
    } else {
        // بستن
        content.classList.remove('max-h-screen');
        content.classList.add('max-h-0');
        icon.classList.remove('rotate-180');
    }
    
    // لرزش خفیف برای حس بهتر
    if (window.navigator.vibrate) window.navigator.vibrate(10);
};

/************************************************
 * سیستم نگهبان: انقضای خودکار نشست (Auto-Logout)
 ************************************************/
const INACTIVITY_LIMIT = 30 * 60 * 1000; // زمان انتظار: ۳۰ دقیقه (به میلی‌ثانیه)

// ۱. بروزرسانی زمان آخرین فعالیت
function updateLastActivity() {
    localStorage.setItem('last_action_timestamp', Date.now());
}

// ۲. چک کردن وضعیت انقضا
async function checkInactivityTimeout() {
    const lastAction = localStorage.getItem('last_action_timestamp');
    const now = Date.now();
    
    if (lastAction && (now - lastAction > INACTIVITY_LIMIT)) {
        console.log("⏰ زمان قانونی نشست به پایان رسید. خروج خودکار...");
        
        // پاکسازی و خروج رسمی
        if (typeof supabaseClient !== 'undefined') {
            await supabaseClient.auth.signOut();
        }
        
        sessionStorage.clear();
        // حذف توکن‌های حساس از حافظه دائمی
        localStorage.removeItem('ebank-auth-session');
        localStorage.removeItem('last_action_timestamp');
        
        // نمایش پیام اطلاع‌رسانی قبل از انتقال
        Swal.fire({
            title: 'پایان نشست امنیتی',
            text: 'به دلیل عدم فعالیت طولانی، جهت حفظ امنیت حساب شما، خروج خودکار انجام شد.',
            icon: 'info',
            confirmButtonText: 'ورود مجدد',
            confirmButtonColor: '#10b981',
            allowOutsideClick: false
        }).then(() => {
            window.location.replace('index.html');
        });
    }
}

// ۳. فعال‌سازی شنودگرهای فعالیت کاربر
function initSecurityMonitor() {
    // رویدادهایی که نشانه فعالیت کاربر هستند
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    activityEvents.forEach(event => {
        window.addEventListener(event, updateLastActivity, true);
    });
    
    // چک کردن اولیه در زمان لود صفحه
    checkInactivityTimeout();
    
    // چک کردن دوره‌ای هر ۱ دقیقه یکبار در پس‌زمینه
    setInterval(checkInactivityTimeout, 60000);
}


window.loadUnifiedStream = async function() {
    const container = document.getElementById('unified-admin-stream');
    const pId = sessionStorage.getItem('pool_id');
    if (!container || !pId) return;

    try {
        const [newsRes, pollsRes, votesRes, membersCountRes] = await Promise.all([
            supabaseClient.from('admin_news').select('*').eq('pool_id', pId),
            supabaseClient.from('admin_polls').select('*').eq('pool_id', pId),
            supabaseClient.from('poll_votes').select('poll_id, vote_type'),
            supabaseClient.from('members').select('id', { count: 'exact', head: true }).eq('pool_id', pId).eq('is_admin', false)
        ]);

        const totalInPool = membersCountRes.count || 0;
        let stream = [];
        if (newsRes.data) newsRes.data.forEach(n => stream.push({ ...n, sType: 'news' }));
        if (pollsRes.data) pollsRes.data.forEach(p => stream.push({ ...p, sType: 'poll' }));
        stream.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        if (stream.length === 0) {
            container.innerHTML = '<p class="text-center py-20 text-slate-400 text-[10px] font-black uppercase">No Data Found</p>';
            return;
        }

        container.innerHTML = stream.map(item => {
            const isNews = item.sType === 'news';
            const content = isNews ? item.message : item.question;
            // استفاده از fa-IR همراه با اعداد انگلیسی (latn) 👇
const date = new Date(item.created_at).toLocaleDateString('fa-IR', { numberingSystem: 'latn' });

            if (isNews) {
                return `
                <div onclick="this.classList.toggle('expanded')" class="glass-feed-card news-theme animate__animated animate__fadeInUp">
                    <div class="category-label bg-amber-500 shadow-lg shadow-amber-500/20">خبر جدید</div>
                    <div class="flex justify-between items-center mb-3 pt-2">
                        <span class="text-[10px] text-slate-300 font-bold">${date}</span>
                        <button onclick="event.stopPropagation(); deleteItem('admin_news', ${item.id})" class="text-white/30 p-1 hover:text-rose-500 transition-all">
                            <i class="fas fa-trash-alt text-[10px]"></i>
                        </button>
                    </div>
                    <p class="text-[11px] font-bold text-right text-slate-200 leading-relaxed pr-1">${content}</p>
                    <div class="content-overlay"></div>
                </div>`;
            } else {
                const votes = votesRes.data ? votesRes.data.filter(v => v.poll_id === item.id) : [];
                const yes = votes.filter(v => v.vote_type === 'yes').length;
                const no = votes.filter(v => v.vote_type === 'no').length;
                const totalVotes = yes + no;
                const notVoted = Math.max(0, totalInPool - totalVotes);
                const yesP = totalInPool > 0 ? Math.round((yes / totalInPool) * 100) : 0;
                const noP = totalInPool > 0 ? Math.round((no / totalInPool) * 100) : 0;
                const nvP = totalInPool > 0 ? Math.round((notVoted / totalInPool) * 100) : 0;

                return `
                <div onclick="this.classList.toggle('expanded')" class="glass-feed-card poll-theme animate__animated animate__fadeInUp">
                    <div class="category-label bg-indigo-600 shadow-lg shadow-indigo-600/20">نظرسنجی</div>
                    <div class="flex justify-between items-center mb-3 pt-2">
                        <span class="text-[10px] text-slate-300 font-bold">${date}</span>
                        <button onclick="event.stopPropagation(); deleteItem('admin_polls', ${item.id})" class="text-white/30 p-1 hover:text-rose-500 transition-all">
                            <i class="fas fa-trash-alt text-[10px]"></i>
                        </button>
                    </div>
                    <h5 class="text-[11px] font-black text-right text-white leading-relaxed pr-1">${item.question}</h5>
                    <div class="content-overlay"></div>
                    <div class="stats-area space-y-4 border-t border-white/5 pt-4">
                        <div class="space-y-1">
                            <div class="flex justify-between text-[7px] font-black uppercase"><span class="text-emerald-400">موافق: ${yes}</span><span class="text-slate-500">${yesP}%</span></div>
                            <div class="w-full bg-white/5 h-1.5 rounded-full overflow-hidden"><div class="bg-emerald-500 h-full shadow-[0_0_8px_#10b981]" style="width:${yesP}%"></div></div>
                        </div>
                        <div class="space-y-1">
                            <div class="flex justify-between text-[7px] font-black uppercase"><span class="text-rose-400">مخالف: ${no}</span><span class="text-slate-500">${noP}%</span></div>
                            <div class="w-full bg-white/5 h-1.5 rounded-full overflow-hidden"><div class="bg-rose-500 h-full shadow-[0_0_8px_#ef4444]" style="width:${noP}%"></div></div>
                        </div>
                        <div class="space-y-1">
                            <div class="flex justify-between text-[7px] font-black uppercase"><span class="text-slate-400">شرکت نکرده: ${notVoted}</span><span class="text-slate-600">${nvP}%</span></div>
                            <div class="w-full bg-white/5 h-1.5 rounded-full overflow-hidden border border-white/5"><div class="bg-slate-600 h-full shadow-[0_0_8px_#475569]" style="width:${nvP}%"></div></div>
                        </div>
                    </div>
                </div>`;
            }
            
            // در انتهای تابع loadUnifiedStream بعد از چسباندن کدها 👇
setTimeout(() => {
    const container = document.getElementById('unified-admin-stream');
    if (container) container.scrollTop = 0;
}, 300);
            
            
        }).join('');
    } catch (e) { console.error(e); }
};

/************************************************
 * توابع کمکی جابجایی و حذف (حتما باید باشند)
 ************************************************/
window.handleCardClick = function(cardEl, isLong) {
    if (!isLong) return;
    const text = cardEl.querySelector('.text-content');
    const btn = cardEl.querySelector('.read-more-btn');
    
    if (cardEl.classList.contains('expanded')) {
        cardEl.classList.remove('expanded');
        if(text) text.classList.add('line-clamp-3');
        if(btn) btn.innerText = "مشاهده کامل...";
    } else {
        cardEl.classList.add('expanded');
        if(text) text.classList.remove('line-clamp-3');
        if(btn) btn.innerText = "بستن متن";
        if(navigator.vibrate) navigator.vibrate(10);
    }
};

window.deleteItem = async function(table, id) {
    const result = await Swal.fire({
        title: 'حذف از تایم‌لاین؟',
        text: 'این مورد برای همیشه از دید اعضا خارج خواهد شد.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'بله، پاک کن',
        cancelButtonText: 'انصراف',
        customClass: { popup: 'rounded-[2.5rem] glass-card' }
    });

    if (result.isConfirmed) {
        await supabaseClient.from(table).delete().eq('id', id);
        loadUnifiedStream(); // رفرش لیست
    }
};
/************************************************
 * ۱. تابع ثبت خبر جدید (پاپ‌آپ مدرن)
 ************************************************/
window.openCreateNews = async function() {
    const { value: text } = await Swal.fire({
        title: 'انتشار اطلاعیه جدید',
        input: 'textarea',
        inputPlaceholder: 'متن خبر یا اعلان را اینجا بنویسید...',
        showCancelButton: true,
        confirmButtonText: 'ارسال و انتشار 🚀',
        cancelButtonText: 'انصراف',
        confirmButtonColor: '#f59e0b', // رنگ Amber هماهنگ با تم خبر
        customClass: { popup: 'rounded-[2.5rem] glass-card' },
        inputValidator: (value) => {
            if (!value) return 'نمیتوانید خبر خالی منتشر کنید!';
        }
    });

    if (text) {
        Swal.showLoading();
        const pId = sessionStorage.getItem('pool_id');
        const { error } = await supabaseClient.from('admin_news').insert([{ 
            pool_id: pId, 
            message: text 
        }]);

        if (!error) {
            Swal.fire({ title: 'منتشر شد ✅', icon: 'success', toast: true, position: 'top-end', timer: 2500, showConfirmButton: false });
            loadUnifiedStream(); // رفرش آنی لیست
        } else {
            Swal.fire({ text: 'خطا در ثبت خبر', icon: 'error' });
        }
    }
};

/************************************************
 * ۲. تابع ایجاد نظرسنجی جدید (پاپ‌آپ مدرن)
 ************************************************/
window.openCreatePoll = async function() {
    const { value: question } = await Swal.fire({
        title: 'طرح نظرسنجی جدید',
        input: 'text',
        inputPlaceholder: 'سوال خود را مطرح کنید (مثلاً: موافقید طلا بخریم؟)',
        showCancelButton: true,
        confirmButtonText: 'شروع رای‌گیری 🗳️',
        cancelButtonText: 'انصراف',
        confirmButtonColor: '#6366f1', // رنگ Indigo هماهنگ با تم رای
        customClass: { popup: 'rounded-[2.5rem] glass-card' },
        inputValidator: (value) => {
            if (!value) return 'لطفاً سوال نظرسنجی را بنویسید!';
        }
    });

    if (question) {
        Swal.showLoading();
        const pId = sessionStorage.getItem('pool_id');
        const { error } = await supabaseClient.from('admin_polls').insert([{ 
            pool_id: pId, 
            question: question, 
            is_active: true 
        }]);

        if (!error) {
            Swal.fire({ title: 'نظرسنجی فعال شد ✅', icon: 'success', toast: true, position: 'top-end', timer: 2500, showConfirmButton: false });
            loadUnifiedStream(); // رفرش آنی لیست
        } else {
            Swal.fire({ text: 'خطا در ثبت نظرسنجی', icon: 'error' });
        }
    }
};

/************************************************
 * ۳. تابع حذف آیتم از تایم‌لاین (خبر یا نظرسنجی)
 ************************************************/
window.deleteItem = async function(tableName, id) {
    const result = await Swal.fire({
        title: 'حذف از تایم‌لاین؟',
        text: "این عملیات غیرقابل بازگشت است و تمام آرای مربوط به آن (اگر نظرسنجی باشد) پاک خواهد شد.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'بله، حذف شود',
        cancelButtonText: 'انصراف',
        customClass: { popup: 'rounded-[2.5rem] glass-card' }
    });

    if (result.isConfirmed) {
        Swal.showLoading();
        const { error } = await supabaseClient.from(tableName).delete().eq('id', id);

        if (!error) {
            Swal.fire({ title: 'پاکسازی شد 🗑️', icon: 'success', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
            loadUnifiedStream(); // رفرش آنی لیست
        } else {
            Swal.fire({ text: 'خطا در حذف آیتم', icon: 'error' });
        }
    }
};




window.sendPushToUnpaid = async function() {
    const poolId = sessionStorage.getItem('pool_id');
    const { value: customMsg } = await Swal.fire({
        title: 'ارسال اخطار داخلی',
        text: 'متن یادآوری برای بدهکاران این ماه را بنویسید:',
        input: 'textarea',
        inputValue: 'لطفاً نسبت به پرداخت واریزی ماه جاری اقدام فرمایید.',
        showCancelButton: true,
        confirmButtonColor: '#ef4444'
    });

    if (customMsg) {
        Swal.showLoading();
        // ۱. پیدا کردن بدهکاران (همان منطق قبلی)
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const { data: members } = await supabaseClient.from('members').select('id').eq('pool_id', poolId).eq('is_admin', false);
        const { data: paidUsers } = await supabaseClient.from('transactions').select('member_id').eq('pool_id', poolId).eq('status', 'approved').gte('created_at', firstDay);
        
        const paidIds = paidUsers.map(p => String(p.member_id));
        const unpaidIds = members.filter(m => !paidIds.includes(String(m.id))).map(m => m.id);

        // ۲. آپدیت ستون اخطار برای تمام بدهکاران به صورت یکجا 👇
        await supabaseClient
            .from('members')
            .update({ debt_warning_msg: customMsg })
            .in('id', unpaidIds);

        // ۳. پاک کردن اخطار برای کسانی که پرداخت کرده‌اند
        await supabaseClient
            .from('members')
            .update({ debt_warning_msg: null })
            .eq('pool_id', poolId)
            .in('id', paidIds);

        Swal.fire({ title: 'پیام‌ها روی تابلوی اعضا ثبت شد ✅', icon: 'success' });
    }
};


/************************************************
 * تابع نمایش فیش‌های منتظر (نسخه اصلاح شده v14.5)
 ************************************************/
async function loadPendingReceipts(poolId) {
    const container = document.getElementById('admin-verify-list');
    if (!container || !poolId) return;

    // تبدیل آیدی صندوق به عدد برای دیتابیس ✅
    const cleanPoolId = poolId;

    try {
        // دریافت فیش‌های 'pending' همراه با نام عضو
        const { data: txs, error } = await supabaseClient
            .from('transactions')
            .select('*, members(full_name)')
            .eq('pool_id', cleanPoolId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!txs || txs.length === 0) {
            container.innerHTML = '<p class="text-center py-10 text-slate-400 text-[10px] font-black uppercase">هیچ فیش منتظری یافت نشد ✨</p>';
            updateAccordionDot('dot-ops-1', 0);
            if (typeof updateTaskBadge === 'function') updateTaskBadge(cleanPoolId);
            return;
        }

        container.innerHTML = txs.map(t => {
            const date = new Date(t.created_at).toLocaleDateString('fa-IR-u-nu-latn');
            const senderName = t.members ? t.members.full_name : 'عضو ناشناس';

            return `
            <div class="receipt-card mb-4 shadow-sm" onclick="this.classList.toggle('active')">
                <div class="receipt-actions-overlay">
                    <button onclick="event.stopPropagation(); updateStatus('${t.id}', 'rejected')" class="action-btn-circle bg-rose-500/20 text-rose-500"><i class="fas fa-times"></i></button>
                    <a href="${t.receipt_url}" target="_blank" onclick="event.stopPropagation()" class="action-btn-circle bg-indigo-600 text-white"><i class="fas fa-eye"></i></a>
                    <button onclick="event.stopPropagation(); updateStatus('${t.id}', 'approved')" class="action-btn-circle bg-emerald-500 text-white"><i class="fas fa-check"></i></button>
                </div>
                <div class="flex justify-between items-center h-full">
                    <div class="text-left">
                        <p class="text-[11px] font-black text-emerald-600">${Number(t.amount).toLocaleString()} ت</p>
                        <p class="text-[8px] text-slate-400 font-bold mt-1">${date}</p>
                    </div>
                    <div class="text-right">
                        <h5 class="text-xs font-[900] text-slate-800">${senderName}</h5>
                        <p class="text-[7px] text-slate-400 mt-1 uppercase font-bold italic">Tap to verify</p>
                    </div>
                </div>
            </div>`;
        }).join('');

        updateAccordionDot('dot-ops-1', txs.length);
        if (typeof updateTaskBadge === 'function') updateTaskBadge(cleanPoolId);

    } catch (e) {
        console.error("Critical Receipt Error:", e.message);
        container.innerHTML = `<p class="text-red-500 text-center py-5 text-[9px]">خطا در لود فیش‌ها: ${e.message}</p>`;
    }
}


/************************************************
 * تابع بروزرسانی نشانگر اعلان (Red Dot) برای مدیر
 ************************************************/
window.updateTaskBadge = async function(poolId) {
    // ۱. بررسی وجود المان دایره قرمز در منوی پایین
    const badge = document.getElementById('tasks-badge');
    if (!badge || !poolId) return;

    try {
        // ۲. شمارش همه‌ی موارد در انتظار اقدام مدیر: فیش‌ها + مساعده‌های رأی‌گیری + مساعده‌های سکه‌ای
        const [{ count: pendingReceipts }, { count: pendingLoans }, { count: pendingCoins }] = await Promise.all([
            supabaseClient.from('transactions').select('*', { count: 'exact', head: true }).eq('pool_id', Number(poolId)).eq('status', 'pending'),
            supabaseClient.from('loans').select('*', { count: 'exact', head: true }).eq('pool_id', Number(poolId)).eq('status', 'voting'),
            supabaseClient.from('coin_requests').select('*', { count: 'exact', head: true }).eq('pool_id', Number(poolId)).eq('status', 'pending')
        ]);

        const count = (pendingReceipts || 0) + (pendingLoans || 0) + (pendingCoins || 0);

        // ۳. نمایش یا مخفی کردن دایره قرمز
        if (count > 0) {
            badge.innerText = count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    } catch (e) {
        console.warn("⚠️ مشکلی در آپدیت نشانگر فیش‌ها رخ داد:", e.message);
    }
};


/************************************************
 * تابع لود لیست اعضا با مدال‌های افتخار
 ************************************************/
async function loadAllMembers(poolId) {
    try {
        const { data: members, error } = await supabaseClient
            .from('members')
            .select('*')
            .eq('pool_id', poolId);
        
        if (error) throw error;

        // چه کسانی این ماه قسط ماهانه رو پرداخت (و تایید) کردن؟ + تنظیمات سکه برای تشخیص شدت تاخیر
        const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
        const [{ data: paidTxs }, { data: coinSettings }] = await Promise.all([
            supabaseClient.from('transactions').select('member_id')
                .eq('pool_id', poolId).eq('status', 'approved').eq('category', 'monthly').eq('type', 'in')
                .gte('created_at', firstDayOfMonth),
            supabaseClient.from('settings').select('coin_window_days').eq('pool_id', poolId).maybeSingle()
        ]);
        const paidThisMonth = new Set((paidTxs || []).map(t => String(t.member_id)));

        // آیا اگه همین امروز پرداخت بشه، تو منطقه‌ی کسر سکه‌ایم؟ (پلکانی، نه فقط پرداخت‌شده/نشده)
        const winDays = Number(coinSettings?.coin_window_days) || 10;
        const half = Math.floor(winDays / 2);
        const today = new Date();
        const thisMonthFirst = new Date(today.getFullYear(), today.getMonth(), 1);
        const nextMonthFirst = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        const diffToThis = Math.round((today - thisMonthFirst) / 86400000);
        const diffToNext = Math.round((today - nextMonthFirst) / 86400000);
        const todaysOffset = Math.abs(diffToNext) < Math.abs(diffToThis) ? diffToNext : diffToThis;
        const inCoinDeductionZone = todaysOffset > half;

        // مرتب‌سازی (مدیر اول، بعد بر اساس نام)
        const sorted = members.sort((a, b) => {
            if (a.is_admin && !b.is_admin) return -1;
            if (!a.is_admin && b.is_admin) return 1;
            return a.full_name.localeCompare(b.full_name);
        });
        
        allMembersData = sorted;

        const container = document.getElementById('members-list');
        if (!container) return;

        container.innerHTML = sorted.map(m => {
            // رنگ رندوم بر اساس حرف اول نام
            const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500', 'bg-indigo-500'];
            const randomColor = colors[Math.abs(m.full_name.charCodeAt(0)) % colors.length];
            
            // آواتار (عکس یا حرف اول)
            const avatarContent = m.avatar_url ? 
                `<img src="${m.avatar_url}" class="w-12 h-12 rounded-full object-cover">` : 
                `<div class="w-12 h-12 ${m.is_admin ? 'bg-slate-900' : randomColor} rounded-full flex items-center justify-center text-white font-black">${m.is_admin ? '<i class="fas fa-crown text-yellow-400"></i>' : m.full_name.charAt(0)}</div>`;

            // مدال‌های افتخار
            const badgesHtml = window.generateMemberBadges ? generateMemberBadges(m) : '';

            // نشانه‌ی پرداخت قسط این ماه — پلکانی (فقط برای اعضای عادی، نه مدیر)
            let paymentDot = '';
            if (!m.is_admin) {
                if (paidThisMonth.has(String(m.id))) {
                    paymentDot = `<span title="قسط این ماه پرداخت شده" class="w-2.5 h-2.5 bg-emerald-500 rounded-full shrink-0"></span>`;
                } else if (inCoinDeductionZone) {
                    paymentDot = `<span title="پرداخت نشده — دیگه از سکه‌هاش کم میشه!" class="w-2.5 h-2.5 bg-rose-600 rounded-full shrink-0 animate-pulse ring-2 ring-rose-200"></span>`;
                } else {
                    paymentDot = `<span title="هنوز پرداخت نکرده، ولی هنوز تو مهلته" class="w-2.5 h-2.5 bg-amber-400 rounded-full shrink-0"></span>`;
                }
            }

            return `
                <div onclick="openMemberProfile('${m.id}')" class="flex items-center gap-4 p-4 border-b border-slate-50 transition-all hover:bg-slate-50 active:bg-slate-100 ${m.is_admin ? 'bg-indigo-50/40' : ''}">
                    ${avatarContent}
                    <div class="flex-1 text-right">
                        <div class="flex items-center gap-2">
                            <h4 class="text-[13px] font-[900] text-slate-800">${m.full_name}</h4>
                            ${m.is_admin ? '<span class="text-[7px] bg-slate-900 text-white px-1.5 py-0.5 rounded">مدیر</span>' : ''}
                            ${paymentDot}
                        </div>
                        ${badgesHtml}
                    </div>
                    <i class="fas fa-chevron-left text-slate-200 text-[10px]"></i>
                </div>`;
        }).join('');

    } catch (e) { 
        console.error("Load Members Error:", e); 
    }
}

/************************************************
 * تابع جامع لود عملیات (با قفل هوشمند نوبت)
 ************************************************/
window.loadOpsTabContent = async function(poolId) {
    const queueContainer = document.getElementById('loan-queue-list');
    const debtorsContainer = document.getElementById('admin-debtors-list');
    if (!queueContainer || !debtorsContainer) return;

    try {
        // ۱. دریافت اطلاعات زنده
        const [mRes, tRes] = await Promise.all([
            supabaseClient.from('members').select('*').eq('pool_id', poolId).eq('is_admin', false),
            supabaseClient.from('transactions').select('*').eq('pool_id', poolId).eq('status', 'approved')
        ]);

        const members = mRes.data || [];
        const txs = tRes.data || [];

        // ۲. محاسبات مالی تک‌تک اعضا
        const processed = members.map(m => {
            // کل واریزی (قسط)
            const totalIn = txs.filter(t => t.member_id === m.id && t.type === 'in').reduce((s, a) => s + Number(a.amount), 0);
            // کل دریافتی نوبتی
            const totalOutMonthly = txs.filter(t => t.member_id === m.id && t.type === 'out' && t.category === 'monthly').reduce((s, a) => s + Number(a.amount), 0);
            // کل دریافتی مساعده
            const totalOutEmergency = txs.filter(t => t.member_id === m.id && t.type === 'out' && t.category === 'emergency').reduce((s, a) => s + Number(a.amount), 0);

            const monthlyDebt = Math.max(0, totalOutMonthly - totalIn);
            const emergencyDebt = totalOutEmergency; // بدهی مساعده

            // شرط حضور در صف: بدهی نوبتی نداشته باشد و تاریخ صلاحیت داشته باشد ✅
            const isEligible = monthlyDebt <= 0 && m.eligible_at !== null;

            return { ...m, monthlyDebt, emergencyDebt, isEligible };
        });

        // ۳. مدیریت کرکره "صف نوبت" (با دکمه قفل شونده) 👇
        const readyList = processed.filter(m => m.isEligible).sort((a,b) => new Date(a.eligible_at) - new Date(b.eligible_at));
        
        queueContainer.innerHTML = readyList.length > 0 ? readyList.map((m, i) => {
            const isFirst = (i === 0); // آیا این شخص نفر اول صف است؟

            return `
            <div class="bg-slate-50 p-4 rounded-2xl flex justify-between items-center border border-slate-100 mb-2 ${!isFirst ? 'opacity-60' : 'border-indigo-200 shadow-sm'}">
                <div class="flex items-center gap-3">
                    <span class="w-7 h-7 ${isFirst ? 'bg-indigo-600' : 'bg-slate-400'} text-white rounded-lg flex items-center justify-center font-black text-[10px]">${i+1}</span>
                    <div class="text-right">
                        <h5 class="text-xs font-black text-slate-800">${m.full_name}</h5>
                        ${isFirst ? '<span class="text-[7px] text-indigo-500 font-bold animate-pulse">● نوبت پرداخت</span>' : ''}
                    </div>
                </div>
                
                <!-- اگر نفر اول نباشد، دکمه غیرفعال و کمرنگ می‌شود 👇 -->
                <button 
                    onclick="${isFirst ? `payStandardLoan('${m.id}', '${m.full_name}')` : ''}" 
                    class="${isFirst ? 'bg-indigo-600 shadow-indigo-200 shadow-lg' : 'bg-slate-300 pointer-events-none'} text-white px-4 py-2 rounded-xl text-[9px] font-black transition-all">
                    ${isFirst ? 'پرداخت وام' : 'در انتظار نوبت'}
                </button>
            </div>`;
        }).join('') : '<p class="text-center py-6 text-slate-300 text-[9px]">کسی در صف انتظار نیست.</p>';

        // ۴. مدیریت کرکره "لیست بدهکاران" 👇
        const debtorList = processed.filter(m => m.monthlyDebt > 0 || m.emergencyDebt > 0);
        
        debtorsContainer.innerHTML = debtorList.length > 0 ? debtorList.map(m => {
            const totalDebt = m.monthlyDebt + m.emergencyDebt;
            return `
            <div class="bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm mb-4">
                <div class="flex justify-between items-start mb-4">
                    <div class="text-right">
                        <h5 class="text-xs font-[900] text-slate-800">${m.full_name}</h5>
                        <p class="text-[7px] text-slate-400 mt-1 uppercase font-bold tracking-widest">Active Debt</p>
                    </div>
                    <span class="bg-rose-500 text-white text-[10px] font-black px-3 py-1 rounded-xl">${totalDebt.toLocaleString()} ت</span>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    ${m.monthlyDebt > 0 ? `<div class="bg-indigo-50 p-2 rounded-xl text-center border border-indigo-100"><p class="text-[7px] text-indigo-500 font-black">وام نوبتی</p><p class="text-[9px] font-black text-indigo-800">${m.monthlyDebt.toLocaleString()}</p></div>` : '<div class="bg-slate-50 opacity-20 rounded-xl flex items-center justify-center"><i class="fas fa-check text-[8px]"></i></div>'}
                    ${m.emergencyDebt > 0 ? `<div class="bg-amber-50 p-2 rounded-xl text-center border border-amber-100"><p class="text-[7px] text-amber-600 font-black">مساعده</p><p class="text-[9px] font-black text-amber-800">${m.emergencyDebt.toLocaleString()}</p></div>` : '<div class="bg-slate-50 opacity-20 rounded-xl flex items-center justify-center"><i class="fas fa-check text-[8px]"></i></div>'}
                </div>
            </div>`;
        }).join('') : '<p class="text-center py-8 text-emerald-500 text-[9px] font-black italic">بدهکاری در سیستم نیست ✨</p>';

    } catch (e) { console.error("Ops Sync Error:", e); }
};

/************************************************
 * ۲. تابع پرداخت مساعده فوری (Emergency/Instant Loan)
 * تایید درخواست‌های ثبت شده توسط اعضا
 ************************************************/
window.payEmergencyLoan = async function(loanId, amount, memberName, memberId) {
    const poolId = sessionStorage.getItem('pool_id');

    const result = await Swal.fire({
        title: 'تایید و پرداخت مساعده',
        text: `آیا از واریز مبلغ ${Number(amount).toLocaleString()} ت به حساب ${memberName} اطمینان دارید؟`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        confirmButtonText: 'بله، واریز شود',
        cancelButtonText: 'انصراف',
        customClass: { popup: 'rounded-[2.5rem]' }
    });

    if (result.isConfirmed) {
        // چک موجودی صندوق اصلی قبل از هر برداشتی
        const balances = await getCurrentFundBalances(poolId);
        if (Number(amount) > balances.mainFund) {
            return insufficientFundsAlert('صندوق اصلی', amount, balances.mainFund);
        }

        try {
            Swal.fire({ title: 'در حال کسر از موجودی...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

            // ۱. ثبت تراکنش خروجی (Category: emergency)
            const { error: txErr } = await supabaseClient.from('transactions').insert([{
                pool_id: poolId,
                member_id: memberId,
                amount: Number(amount),
                status: 'approved',
                type: 'out',
                category: 'emergency', // دسته‌بندی مساعده فوری
                receipt_url: `مساعده: ${memberName}`
            }]);

            if (txErr) throw txErr;

            // ۲. تغییر وضعیت درخواست در جدول وام‌ها
            const { error: loanErr } = await supabaseClient.from('loans').update({ status: 'paid' }).eq('id', loanId);
            if (loanErr) throw loanErr;

            // ۳. افزایش بدهی عضو (بر اساس ID) 👇
            const { data: mData } = await supabaseClient.from('members').select('debt_target').eq('id', memberId).single();
            
            await supabaseClient.from('members').update({
                debt_target: (Number(mData?.debt_target) || 0) + Number(amount)
            }).eq('id', memberId);

            await Swal.fire({ title: 'پرداخت شد ✅', text: 'مبلغ مساعده از موجودی صندوق کسر و در بدهی عضو ثبت شد.', icon: 'success' });
            
            // رفرش لیست‌ها
            if (typeof loadAdminLoans === 'function') loadAdminLoans(poolId);
            if (typeof loadCoinRequests === 'function') loadCoinRequests(poolId);
            if (typeof loadTransactionLog === 'function') loadTransactionLog(poolId);
            if (typeof loadOpsTabContent === 'function') loadOpsTabContent(poolId);
            if (typeof calculateStats === 'function') calculateStats(poolId);

        } catch (e) {
            Swal.fire({ title: 'خطا', text: e.message, icon: 'error' });
        }
    }
};

/************************************************
 * تابع لود اطلاعات صندوق در هدر
 ************************************************/
async function loadPoolHeaderInfo(poolId) {
    try {
        const { data: pool } = await supabaseClient
            .from('pools')
            .select('pool_code, created_at')  // 👈 pool_code نه code
            .eq('id', poolId)
            .single();

        if (pool) {
            // کد صندوق
            const codeEl = document.getElementById('display-pool-code');
            if (codeEl) codeEl.innerText = pool.pool_code || poolId;
            
            // تاریخ تاسیس
            const dateEl = document.getElementById('display-init-date');
            if (dateEl) {
                const date = new Date(pool.created_at);
                dateEl.innerText = date.toLocaleDateString('fa-IR');
            }
        }
    } catch (e) {
        console.log("Pool Header Error:", e.message);
    }
}