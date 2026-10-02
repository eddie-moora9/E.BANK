/* ==================================================
   E.BANK MEMBER - INITIALIZATION (v11.6)
   ================================================== */

// ۱. تعریف ثابت‌های اتصال (نام‌ها هماهنگ شد) ✅
const S_URL = 'https://kqnsbnpznkwkwukzokik.supabase.co';
const S_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxbnNibnB6bmt3a3d1a3pva2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1NDc4NjgsImV4cCI6MjA4MjEyMzg2OH0.dsqyFP37JyrfYDVwasNZW_Aid9ah0e6SxdnS8j8xV5s';

// ۲. ساخت کلاینت سوپابیس (با تنظیمات پایداری نشست) ✅
// این تنظیمات را در تمام فایل‌ها جایگزین supabaseClient قبلی کن 👇
var supabaseClient = (typeof supabase === 'undefined') ? null : supabase.createClient(S_URL, S_KEY, {
    auth: {
        persistSession: true,
        storageKey: 'ebank-auth-session', // یک نام ثابت و اختصاصی ✅
        storage: window.localStorage,     // استفاده از localStorage برای پایداری بیشتر در گوشی
        autoRefreshToken: true,
        detectSessionInUrl: false
    }
});


window.generateMemberBadges = function(member) {
    let badgesHtml = '';
    const score = member.credit_score || 100;
    
    // ۱. مدال الماس (خوش‌حساب ۱۰۰٪)
    if (score >= 100) {
        badgesHtml += `<span class="badge-icon bg-cyan-500" title="خوش‌حساب ارشد"><i class="fas fa-gem"></i></span>`;
    }
    
    // ۲. مدال همیار (بخشنده نوبت)
    if (member.turn_given_count > 0) {
        badgesHtml += `<span class="badge-icon bg-emerald-500" title="یارِ صندوق"><i class="fas fa-hands-helping"></i></span>`;
    }
    
    // ۳. مدال پیشکسوت (قدیمی‌تر از ۶ ماه)
    const monthsDiff = (new Date() - new Date(member.created_at)) / (1000 * 60 * 60 * 24 * 30);
    if (monthsDiff > 6) {
        badgesHtml += `<span class="badge-icon bg-indigo-500" title="پیشکسوت"><i class="fas fa-shield-alt"></i></span>`;
    }

    // ۴. نشان هشدار (بدحساب)
    if (score < 40) {
        badgesHtml += `<span class="badge-icon bg-rose-500 animate-pulse" title="نیاز به تسویه"><i class="fas fa-exclamation-triangle"></i></span>`;
    }

    return `<div class="flex gap-1 justify-center">${badgesHtml}</div>`;
};



// ۳. ترفند شیک‌سازی خودکار تمام Alertها (SweetAlert2)
window.alert = function(message) {
    Swal.fire({
        text: message,
        icon: 'info',
        confirmButtonText: 'متوجه شدم',
        confirmButtonColor: '#10b981',
        customClass: { popup: 'rounded-[2rem]' }
    });
};

// ۴. بقیه متغیرهای سراسری شما (اگر داری)
var allMembersData = [];


// ۱. ابزار نگهبان (Validator) - برای رفع اروری که داشتی 👇
const Validator = {
    isMobile: (v) => /^09\d{9}$/.test(v),
    isCard: (v) => /^\d{16}$/.test(v),
    isMinLen: (v, l) => v.trim().length >= l,
    isPositive: (v) => !isNaN(v) && Number(v) > 0
};

// ۲. ابزار لودینگ دکمه‌ها
function toggleLoading(btnId, isLoading, text = "در حال ارسال...") {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = isLoading;
    btn.innerHTML = isLoading ? `<i class="fas fa-spinner fa-spin"></i> ${text}` : `تایید و ارسال نهایی`;
}

// ۲.۵ رسیدگی به جابجایی از پنل مدیر (اگر با دکمه «جابجایی» اومده باشیم) 👇
// وقتی مدیر روی جابجایی می‌زنه، نشست فعلیِ استوریج (ebank-auth-session) هنوز مال خودِ مدیره؛
// توکن‌های عضو جدا زیر ebank_linked_member_session_<adminId> ذخیره شدن.
// اینجا اون توکن‌ها رو پیدا می‌کنیم و جای نشست فعلی می‌ذاریم تا واقعاً با شماره‌ی عضو لاگین بشه.
async function handleAdminLinkedSession() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('linked') !== '1') return;

    const { data: { session: currentSession } } = await supabaseClient.auth.getSession();
    if (!currentSession || !currentSession.user) return;

    const sessionKey = 'ebank_linked_member_session_' + currentSession.user.id;
    const saved = localStorage.getItem(sessionKey);
    if (!saved) return; // نشست ذخیره‌شده‌ای برای این مدیر نیست، همون‌طور که هست ادامه بده

    try {
        const { access_token, refresh_token } = JSON.parse(saved);

        // قبل از جایگزینی، نشستِ خودِ مدیر رو نگه می‌داریم تا دکمه‌ی «بازگشت به پنل مدیر» بتونه برش گردونه
        localStorage.setItem('ebank_admin_return_session', JSON.stringify({
            adminId: currentSession.user.id,
            access_token: currentSession.access_token,
            refresh_token: currentSession.refresh_token
        }));

        const { data: setData, error } = await supabaseClient.auth.setSession({ access_token, refresh_token });
        if (error) {
            console.error('❌ خطا در اتصال به نشست عضو:', error);
            localStorage.removeItem(sessionKey);
            localStorage.removeItem('ebank_admin_return_session');
            return;
        }

        // توکن به‌کاررفته ممکنه خودش موقع setSession تازه شده باشه (اگه منقضی بوده)؛
        // نسخه‌ی ذخیره‌شده رو با آخرین توکن معتبر آپدیت کن تا دفعه‌ی بعد هم کار کنه
        if (setData?.session) {
            localStorage.setItem(sessionKey, JSON.stringify({
                access_token: setData.session.access_token,
                refresh_token: setData.session.refresh_token
            }));
        }

        // pool_id/user_name احتمالی نشست قبلی رو پاک کن تا برای عضوِ جدید دوباره از سرور خونده بشه
        sessionStorage.removeItem('pool_id');
        sessionStorage.removeItem('user_name');
    } catch (e) {
        console.error('❌ خطای پارس نشست عضو:', e);
        localStorage.removeItem(sessionKey);
    }
}

// هر وقت سوپابیس به‌صورت خودکار توکنِ فعلی رو تازه کنه (هر ~۱ ساعت)، اگه این نشست
// از طریق جابجاییِ مدیر باز شده، نسخه‌ی ذخیره‌شده‌ی توکن عضو رو هم به‌روز کن
// تا دفعه‌ی بعدِ «جابجایی» با توکنِ باطل‌شده مواجه نشه و دوباره رمز نخواد.
if (supabaseClient) supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event !== 'TOKEN_REFRESHED' || !session) return;
    try {
        const returnRaw = localStorage.getItem('ebank_admin_return_session');
        if (!returnRaw) return; // این یه نشستِ جابجایی‌شده نیست، کاری لازم نیست
        const { adminId } = JSON.parse(returnRaw);
        if (!adminId) return;
        localStorage.setItem('ebank_linked_member_session_' + adminId, JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token
        }));
    } catch (e) {
        console.error('❌ خطا در همگام‌سازی توکن تازه‌شده:', e);
    }
});

/************************************************
 * بازگشت امن به پنل مدیر (نشستِ ذخیره‌شده‌ی قبل از جابجایی رو برمی‌گردونه)
 ************************************************/
window.returnToAdminPanel = async function() {
    const saved = localStorage.getItem('ebank_admin_return_session');
    if (!saved) return;

    Swal.fire({ title: 'در حال بازگشت به پنل مدیر...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });

    try {
        const { access_token, refresh_token } = JSON.parse(saved);
        const { error } = await supabaseClient.auth.setSession({ access_token, refresh_token });
        if (error) throw error;

        localStorage.removeItem('ebank_admin_return_session');
        sessionStorage.removeItem('pool_id');
        sessionStorage.removeItem('user_name');

        window.location.href = 'admin.html';
    } catch (e) {
        console.error('❌ خطا در بازگشت به نشست مدیر:', e);
        // نشستِ ذخیره‌شده دیگه معتبر نیست (مثلاً منقضی شده) — پاکش کن که دکمه گمراه‌کننده نمونه
        localStorage.removeItem('ebank_admin_return_session');
        Swal.fire({
            title: 'نشست مدیر منقضی شده',
            text: 'باید دوباره از پنل مدیر وارد بشی.',
            icon: 'warning',
            confirmButtonColor: '#4f46e5',
            customClass: { popup: 'rounded-[2.5rem]' }
        });
    }
};

// ۳. مدیریت شروع برنامه با نشست امن JWT
// ---- کمکی‌های شبکه: تشخیص خطای اینترنت + تلاش مجدد خودکار ----
function isNetErr(e) {
    const m = String((e && (e.message || e.msg)) || e || '');
    return !navigator.onLine
        || /fetch|network|load failed|timeout|timed out|ECONN|ERR_/i.test(m)
        || (e && (e.name === 'AuthRetryableFetchError' || e.status === 0));
}
const _sleep = ms => new Promise(r => setTimeout(r, ms));
async function withRetry(fn, tries = 3) {
    let last;
    for (let i = 0; i < tries; i++) {
        try { return await fn(); }
        catch (e) {
            last = e;
            if (!isNetErr(e)) throw e;          // خطای غیرشبکه‌ای: تلاش مجدد بی‌فایده است
            await _sleep(800 * (i + 1));
        }
    }
    throw last;
}

let _memberBootFailed = false;

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 شروع بیدارباش هوشمند پنل اعضا...");
    // اسپلش اسکرین خودش رو مدیریت می‌کنه (اسکریپت داخل member.html)
    // ⚠️ دیگه به navigator.onLine برای «بستن راه» تکیه نمی‌کنیم؛ روی موبایل/فیلترشکن اغلب غلط می‌گه.
    // اتصال واقعی رو با خود درخواست‌ها (و تلاش مجدد) می‌سنجیم.

    const fail = (msg) => {
        _memberBootFailed = true;
        if (typeof window.showNetworkError === 'function') window.showNetworkError(msg);
    };

    if (!supabaseClient) {
        fail('بارگذاری کتابخانه‌ها ناموفق بود ⚠️ اینترنت را بررسی کنید');
        return;
    }

    try {
        // ۱.۵ اگه از دکمه‌ی جابجایی پنل مدیر اومدیم، نشست رو با نشست عضو جایگزین کن
        await handleAdminLinkedSession();

        // ۲. بررسی نشست امن (JWT) — خطای شبکه ≠ نبودن نشست؛ فقط نبودن واقعی نشست به لاگین برمی‌گردونه
        const session = await withRetry(async () => {
            const { data, error } = await supabaseClient.auth.getSession();
            if (!data?.session && error && isNetErr(error)) throw error;
            return data?.session || null;
        });
        if (!session) {
            window.location.replace('index.html');
            return;
        }

        const userId = session.user.id;
        sessionStorage.setItem('user_id', userId); // برای استفاده‌ی showSec موقع رفرش تب‌ها
        let myPoolId = sessionStorage.getItem('pool_id');

        // ۳. بازیابی هوشمند pool_id (اگر گم شده باشد) 👇
        if (!myPoolId || myPoolId === "null") {
            console.log("⚠️ آیدی صندوق یافت نشد، در حال استعلام از سرور...");
            const userMember = await withRetry(async () => {
                const { data, error } = await supabaseClient.from('members').select('pool_id, full_name').eq('id', userId).maybeSingle();
                if (error) throw error;
                return data;
            });
            if (userMember && userMember.pool_id) {
                myPoolId = userMember.pool_id;
                sessionStorage.setItem('pool_id', myPoolId);
                sessionStorage.setItem('user_name', userMember.full_name);
            } else {
                window.location.replace('index.html');
                return;
            }
        }

        // 4. نمایش نام کاربر در هدر و همچنین در پشت کارت
        const userName = sessionStorage.getItem('user_name');
        const nameDisplay = document.getElementById('user-name-display');
        if (nameDisplay) nameDisplay.innerText = userName || "کاربر گرامی";

        // ست کردن اسم عضو در پشت کارت معنوی 👇
        const cardBackName = document.getElementById('card-back-user-name');
        if (cardBackName) cardBackName.innerText = userName || "عزیز";

        // ۴.۵ اگه از پنل مدیر جابجا شدیم، دکمه‌ی بازگشت به پنل مدیر رو نشون بده
        const returnAdminBtn = document.getElementById('return-to-admin-btn');
        if (returnAdminBtn && localStorage.getItem('ebank_admin_return_session')) {
            returnAdminBtn.classList.remove('hidden');
        }

        // ۵. استعلام و نمایش عکس پروفایل واقعی (غیرحیاتی: خطاش نباید پنل رو متوقف کنه)
        try {
            const { data: memberData } = await supabaseClient.from('members').select('avatar_url').eq('id', userId).maybeSingle();
            if (memberData && memberData.avatar_url) {
                const imgEl = document.getElementById('user-avatar-header');
                const iconEl = document.getElementById('default-avatar-icon');
                if (imgEl && iconEl) {
                    imgEl.src = memberData.avatar_url;
                    imgEl.classList.remove('hidden');
                    iconEl.classList.add('hidden');
                }
            }
        } catch (e) { console.warn('avatar load failed', e); }

        // ۶. شلیک تمام لودرهای اطلاعات (خطای یکی از لودرها نباید کل پنل رو از کار بندازه) 🎯
        console.log("📦 در حال فراخوانی داده‌های مالی و خبری...");
        try {
            loadUserFinancials(userId, myPoolId);
            calculateMyTotalDeposits(userId, myPoolId);
            calculateUserTotalProfit(userId, myPoolId);
            loadDebtSummaryCard(userId, myPoolId);
            checkSwapNotifications(userId, myPoolId);
            loadMyTransactions(userId, myPoolId);
            loadManagerCard(myPoolId);
            loadActiveLoans(userId, myPoolId);
            loadUserQueuePosition(userId, myPoolId); // نمایش نوبت
            loadMemberNews(myPoolId);               // لود اخبار (فقط یک‌بار)
            loadActivePoll(userId, myPoolId);       // لود نظرسنجی
            checkDebtWarning(userId).then(() => refreshPaymentIndicator(userId, myPoolId)).catch(() => {});
            initChatUnreadWatcher();
        } catch (loaderErr) {
            console.error('Loader launch error:', loaderErr);
        }

        // موفق: اسپلش تموم بشه
        if (typeof window.finishSplash === 'function') window.finishSplash();

    } catch (err) {
        console.error("Critical Init Error:", err);
        if (isNetErr(err)) fail('اتصال اینترنت برقرار نیست ⚠️');
        else fail('خطا در دریافت اطلاعات ⚠️ دوباره تلاش کنید');
    }
});

// وقتی اینترنت برگشت و بوت قبلاً شکست خورده بود، خودکار دوباره امتحان کن
window.addEventListener('online', () => { if (_memberBootFailed) location.reload(); });


    // ۳. صدا زدن تابع اخطار بدهی 👇
    
/************************************************
 * ۳. محاسبات مالی هوشمند
 ************************************************/

async function loadUserFinancials(userId, poolId) {
    try {
        // ۱. دریافت مبالغ تنظیم شده با پیش‌فرض صفر
        const { data: settings } = await supabaseClient.from('settings').select('*').eq('pool_id', poolId).maybeSingle();
        const basePrice = Number(settings?.base_amount ?? 0);
        const wonPrice = Number(settings?.won_amount ?? 0);

        // ۲. دریافت اطلاعات عضو و وضعیت بدهی وام نوبتی
        const [{ data: user }, debts] = await Promise.all([
            supabaseClient.from('members').select('*').eq('id', userId).single(),
            getMemberDebtSummary(userId, poolId)
        ]);
        
        if (user) {
            const totalShares = Number(user.total_shares) || 1;
            const hasActiveLoan = debts.monthlyLoanDebt > 0;
            
            // اگر عضو وام نوبتی فعال دارد، قسط برنده و در غیر این صورت قسط ثابت محاسبه می‌شود
            const singleShareDue = hasActiveLoan ? (wonPrice > 0 ? wonPrice : basePrice) : basePrice;
            const monthlyDue = totalShares * singleShareDue;

            // نمایش در کارت
            const amountEl = document.getElementById('amount-display');
            if (amountEl) amountEl.innerText = monthlyDue.toLocaleString() + ' تومان';
            
            const badgeEl = document.getElementById('status-badge');
            if (badgeEl) {
                badgeEl.innerText = hasActiveLoan 
                    ? `وضعیت: ${totalShares} سهم (در حال بازپرداخت وام)` 
                    : `وضعیت: ${totalShares} سهم عادی`;
            }
        }
    } catch (e) { 
        console.error("خطا در لود مالی:", e); 
    }
}

async function calculateMyTotalDeposits(userId, poolId) {
    const { data } = await supabaseClient.from('transactions').select('amount, category').eq('member_id', userId).eq('pool_id', poolId).eq('status', 'approved').eq('type', 'in');
    // خیریه پس‌اندازِ شخصی عضو نیست، و مساعده/مساعده‌سکه‌ای هم فقط بازپرداخت بدهیه نه پس‌انداز جدید — پس نباید تو موجودی کل حساب بشن
    const excluded = ['charity', 'emergency', 'coin_assistance', 'loan_repayment'];
    const total = data ? data.filter(t => !excluded.includes(t.category)).reduce((s, i) => s + Number(i.amount), 0) : 0;
    const el = document.getElementById('user-total-balance');
    if (el) el.innerText = total.toLocaleString() + ' تومان';
}

async function calculateUserTotalProfit(userId, poolId) {
    // جستجوی هر تراکنش ورودی که شامل کلمه "سود" باشد
    const { data } = await supabaseClient
        .from('transactions')
        .select('amount')
        .eq('member_id', userId)
        .eq('pool_id', poolId)
        .eq('status', 'approved')
        .eq('type', 'in')
        .ilike('receipt_url', '%سود%');

    const total = data ? data.reduce((s, i) => s + Number(i.amount), 0) : 0;
    const el = document.getElementById('user-total-profit');
    if (el) el.innerText = total.toLocaleString() + ' ت';
}

/************************************************
 * تابع ارسال فیش واریزی با امنیت UUID
 ************************************************/
window.voteOnLoan = async function(loanId, type) {
    const userId = sessionStorage.getItem('user_id');
    const poolId = sessionStorage.getItem('pool_id');

    try {
        // ۱. بررسی اینکه کاربر قبلاً رای نداده باشد
        const { data: existingVote } = await supabaseClient
            .from('loan_votes')
            .select('*')
            .eq('loan_id', loanId)
            .eq('member_id', userId)
            .maybeSingle();

        if (existingVote) {
            return Swal.fire({ text: "شما قبلاً رای خود را برای این درخواست ثبت کرده‌اید.", icon: 'warning' });
        }

        // ۲. ثبت رای در جدول آرا
        await supabaseClient.from('loan_votes').insert([{
            loan_id: loanId,
            member_id: userId,
            vote_type: type
        }]);

        // ۳. آپدیت تعداد آرا در جدول وام‌ها (Atomic Update) 👇
        const column = type === 'up' ? 'votes_up' : 'votes_down';
        
        // دریافت تعداد فعلی
        const { data: loan } = await supabaseClient.from('loans').select(column).eq('id', loanId).single();
        const newValue = (loan[column] || 0) + 1;

        // ذخیره تعداد جدید
        await supabaseClient.from('loans').update({ [column]: newValue }).eq('id', loanId);

        Swal.fire({ title: 'رای ثبت شد', icon: 'success', toast: true, position: 'top', timer: 2000, showConfirmButton: false });
        
        // رفرش لیست وام‌ها بدون رفرش کل صفحه
        loadActiveLoans(userId, poolId);

    } catch (e) {
        Swal.fire({ text: "خطا در ثبت رای", icon: 'error' });
    }
};


/************************************************
 * ۶. نوتیفیکیشن، تماس و امنیت
 ************************************************/
async function loadLastWinner(poolId) {
    const { data } = await supabaseClient.from('lottery_results').select('winner_name').eq('pool_id', poolId).order('draw_date', { ascending: false }).limit(1);
    if (data && data[0]) document.getElementById('lucky-winner').innerText = data[0].winner_name;
}


/************************************************
 * تابع نهایی لود کارت بانکی و تماس مدیر (نسخه ترکیبی)
 ************************************************/
async function loadManagerCard(poolId) {
    const cardContainer = document.getElementById('manager-card-area');
    const waLink = document.getElementById('manager-wa-link');
    
    if (!poolId) return;

    try {
        // دریافت اطلاعات کارت، نام صاحب حساب و موبایل مدیر از جدول Pools
        const { data: pool, error } = await supabaseClient
            .from('pools')
            .select('manager_card, manager_card_name, manager_mobile')
            .eq('id', poolId)
            .single();

        if (error) throw error;

        if (pool) {
            // ۱. رندر کردن کارت عابر بانک در پنل اعضا 👇
            if (cardContainer && pool.manager_card) {
                const cardNum = pool.manager_card;
                const cardName = pool.manager_card_name || 'مدیریت صندوق';

                cardContainer.innerHTML = `
                    <div class="relative w-full bg-slate-900 rounded-[2.5rem] p-6 shadow-2xl border border-emerald-500/20 overflow-hidden mb-6">
                        <div class="flex justify-between items-start mb-6">
                            <span class="text-[10px] font-black text-emerald-500 tracking-tighter">E.BANK OFFICIAL</span>
                            <i class="fas fa-microchip text-2xl text-slate-700 opacity-50"></i>
                        </div>

                        <div onclick="copyManagerCard('${cardNum}')" class="text-center cursor-pointer active:scale-95 transition-all mb-6">
                            <p class="text-white font-[900] text-lg tracking-[0.12em] font-mono">${cardNum}</p>
                            <p class="text-[7px] text-slate-500 mt-1 uppercase font-bold text-center">برای کپی شماره کارت کلیک کنید</p>
                        </div>

                        <div class="flex justify-between items-end border-t border-white/5 pt-4">
                            <div class="text-right">
                                <p class="text-[7px] text-slate-500 uppercase font-black mb-0.5 tracking-widest">Card Holder</p>
                                <p class="text-xs font-black text-emerald-400">${cardName}</p>
                            </div>
                            <div class="flex -space-x-3 opacity-30">
                                <div class="w-6 h-6 bg-emerald-500 rounded-full"></div>
                                <div class="w-6 h-6 bg-emerald-700 rounded-full"></div>
                            </div>
                        </div>
                        <div class="absolute -top-10 -left-10 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl"></div>
                    </div>
                `;
            }

            // ۲. تنظیم لینک واتس‌اپ مدیر 👇
            if (waLink && pool.manager_mobile) {
                let phone = pool.manager_mobile.trim();
                if (phone.startsWith('0')) phone = '98' + phone.substring(1);
                else if (!phone.startsWith('98')) phone = '98' + phone;
                
                waLink.href = `https://wa.me/${phone}`;
            }
        }
    } catch (e) {
        console.error("خطا در لود اطلاعات مدیر:", e.message);
    }
}

// تابع کپی کردن (مطمئن شو این هم در فایل باشد)
window.copyManagerCard = function(text) {
    navigator.clipboard.writeText(text).then(() => {
        if (window.navigator.vibrate) window.navigator.vibrate(20);
        
        // نمایش پیام به صورت Toast (کوچک و سریع)
        const Toast = Swal.mixin({
            toast: true,
            position: 'top',
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: true
        });
        Toast.fire({
            icon: 'success',
            title: 'شماره کارت کپی شد ✅'
        });
    });
}




// ==================================================
// ماه شمسی (به وقت تهران) — هم‌تعریف با پنل مدیر
// ==================================================
function getJalaliMonthBounds(date) {
    const d = date || new Date();
    const DAY = 86400000;
    const parts = (ms, locale) => {
        const o = {};
        new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Tehran', year: 'numeric', month: 'numeric', day: 'numeric' })
            .formatToParts(new Date(ms)).forEach(p => { if (p.type !== 'literal') o[p.type] = Number(p.value); });
        return o;
    };
    try {
        const fa = 'fa-IR-u-nu-latn-ca-persian';
        const pj = parts(d.getTime(), fa), gr = parts(d.getTime(), 'en-US');
        if (!pj.day || !gr.day) throw new Error('Intl persian calendar unsupported');
        const midnight = Date.UTC(gr.year, gr.month - 1, gr.day) - 3.5 * 3600 * 1000; // ایران: UTC+3:30 ثابت
        const start = midnight - (pj.day - 1) * DAY;
        let next = start + 29 * DAY;                       // ماه شمسی ۲۹ تا ۳۱ روزه‌ست
        for (let i = 0; i < 3; i++) {
            const cand = start + (29 + i) * DAY;
            if (parts(cand + 12 * 3600 * 1000, fa).day === 1) { next = cand; break; }
        }
        return { year: pj.year, month: pj.month, day: pj.day,
                 start: new Date(start), nextStart: new Date(next),
                 startISO: new Date(start).toISOString() };
    } catch (e) {
        console.warn('getJalaliMonthBounds fallback (میلادی):', e);
        const st = new Date(d.getFullYear(), d.getMonth(), 1), nx = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), start: st, nextStart: nx, startISO: st.toISOString() };
    }
}

// فاصله‌ی تاریخ تا نزدیک‌ترین «یکم ماه شمسی» (منفی = زودتر از ماه بعد)
function jalaliCoinOffset(date) {
    const b = getJalaliMonthBounds(date);
    const diffToThis = Math.round((date - b.start) / 86400000);
    const diffToNext = Math.round((date - b.nextStart) / 86400000);
    return Math.abs(diffToNext) < Math.abs(diffToThis) ? diffToNext : diffToThis;
}

function formatJalaliDate(d) {
    return new Date(d).toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran', day: 'numeric', month: 'long', year: 'numeric' });
}

// وضعیت پرداخت «این ماه شمسی» برای قسط ثابت و قسط وام نوبتی
// state: 'approved' (پرداخت شده) | 'pending' (در انتظار تایید) | 'none'
async function getMonthPaymentStatus(userId, poolId) {
    const empty = { state: 'none', amount: 0, date: null };
    try {
        const { data } = await supabaseClient
            .from('transactions')
            .select('amount, category, status, created_at')
            .eq('member_id', userId)
            .eq('pool_id', poolId)
            .eq('type', 'in')
            .in('category', ['monthly', 'loan_repayment'])
            .in('status', ['approved', 'pending'])
            .gte('created_at', getJalaliMonthBounds().startISO);

        const pick = (cat) => {
            const rows = (data || []).filter(t => t.category === cat);
            for (const st of ['approved', 'pending']) {
                const r = rows.filter(t => t.status === st);
                if (r.length) {
                    return {
                        state: st,
                        amount: r.reduce((s, t) => s + Number(t.amount || 0), 0),
                        date: r.map(t => t.created_at).sort().pop()
                    };
                }
            }
            return { ...empty };
        };
        return { monthly: pick('monthly'), loan: pick('loan_repayment') };
    } catch (e) {
        console.error('getMonthPaymentStatus failed:', e);
        return { monthly: { ...empty }, loan: { ...empty } };
    }
}

// نشانگر روی دکمه‌ی «+» : سبز ✓ (همه پرداخت شده) / ساعت شنی (در انتظار تایید)
async function refreshPaymentIndicator(userId, poolId) {
    const btn = document.getElementById('main-action-btn');
    const icon = document.getElementById('main-action-icon');
    if (!btn || !icon || btn.classList.contains('warning-pulse')) return; // اخطار مدیر اولویت داره
    const st = await getMonthPaymentStatus(userId, poolId);
    btn.classList.remove('bg-emerald-600', 'bg-amber-500');
    if (st.monthly.state === 'approved') {
        btn.classList.remove('bg-slate-900'); btn.classList.add('bg-emerald-600');
        icon.className = 'fas fa-check text-xl';
    } else if (st.monthly.state === 'pending') {
        btn.classList.remove('bg-slate-900'); btn.classList.add('bg-amber-500');
        icon.className = 'fas fa-hourglass-half text-xl';
    } else {
        btn.classList.add('bg-slate-900');
        icon.className = 'fas fa-plus text-xl';
    }
}

async function checkMonthlyReminder(userId, poolId) {
    const firstDay = getJalaliMonthBounds().startISO;
    const { data } = await supabaseClient.from('transactions').select('*').eq('member_id', userId).eq('pool_id', poolId).in('status', ['approved', 'pending']).eq('type', 'in').eq('category', 'monthly').gte('created_at', firstDay);
    if (!data || data.length === 0) {
        const banner = document.createElement('div');
        banner.className = 'bg-rose-600 text-white p-3 text-[9px] text-center font-bold sticky top-0 z-[200] animate-pulse';
        banner.innerHTML = `🔔 واریز قسط این ماه فراموش نشود! <button onclick="this.parentElement.remove()" class="mr-2 opacity-50 font-black">✕</button>`;
        document.body.prepend(banner);
    }
}


// تمدید و تنظیمات رمز
// تابع باز کردن
window.openPassModal = function() {
    const modal = document.getElementById('pass-modal');
    if (modal) modal.classList.remove('hidden');
};

// تابع بستن (اونی که پرسیدی چیه) 👇
window.closePassModal = function() {
    const modal = document.getElementById('pass-modal');
    if (modal) modal.classList.add('hidden');
};

window.submitNewPassword = async function() {
    const newPass = document.getElementById('new-password').value;
    const btn = document.getElementById('change-pass-btn');

    if (!newPass || newPass.length < 6) {
        return Swal.fire({ text: "رمز جدید باید حداقل ۶ کاراکتر باشد", icon: 'warning' });
    }

    // لودینگ
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "در حال ارتباط با سرور...";

    try {
        // ۱. بررسی مستقیم هویت کاربر از سرور 👇
        const { data: { user }, error: userErr } = await supabaseClient.auth.getUser();

        if (userErr || !user) {
            throw new Error("نشست امنیتی شما تایید نشد. لطفا یکبار خارج و دوباره وارد شوید.");
        }

        // ۲. دستور تغییر رمز در سرور
        const { error: updateErr } = await supabaseClient.auth.updateUser({ 
            password: newPass 
        });

        if (updateErr) throw updateErr;

        // ۳. موفقیت
        await Swal.fire({
            title: 'بروزرسانی موفق ✅',
            text: 'رمز عبور شما با موفقیت تغییر یافت. از این به بعد با رمز جدید وارد شوید.',
            icon: 'success',
            confirmButtonColor: '#10b981'
        });

        if (typeof closePassModal === 'function') closePassModal();

    } catch (e) {
        console.error("Pass Change Error:", e);
        Swal.fire({
            title: 'خطای امنیتی',
            text: e.message,
            icon: 'error',
            confirmButtonColor: '#ef4444'
        });
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
};


// ۲. تابع کپی کردن شماره کارت
window.copyManagerCard = function(text) {
    navigator.clipboard.writeText(text).then(() => {
        if (window.navigator.vibrate) window.navigator.vibrate(20);
        alert("شماره کارت مدیر کپی شد ✅");
    });
}
/************************************************
 * تابع نهایی ارسال فیش واریزی (UUID & JWT Safe)
 ************************************************/
window.uploadReceipt = async function() {
    console.log("شروع فرآیند آپلود فیش...");

    const fileInput = document.getElementById('receipt-input');
    const amountInput = document.getElementById('receipt-amount-input');
    const btn = document.getElementById('upload-btn'); // مطمئن شو آیدی دکمه همین است
    
    if (!fileInput || !amountInput) return;

    const file = fileInput.files[0];
    const amount = amountInput.value;
    const category = selectedPaymentCategory || 'monthly'; // احتیاطی: اگه دسته انتخاب نشده بود، پیش‌فرض قسط ماهانه

    // ۱. اعتبارسنجی ورودی‌ها (Validation)
    // در پرداخت ماهانه، قسط ثابت و بازپرداخت وام هرکدوم می‌تونه صفر باشه (ولی نه هر دو)
    const isMonthlyCat = category === 'monthly';
    const baseAmt = Number(amount) || 0;
    const repayPre = Number(document.getElementById('loan-repay-input')?.value) || 0;
    if (baseAmt < 0 || (isMonthlyCat ? (baseAmt <= 0 && repayPre <= 0) : baseAmt <= 0)) {
        return Swal.fire({ text: "لطفاً مبلغ واریزی را به عدد وارد کنید ❌", icon: 'warning' });
    }
    if (!file) {
        return Swal.fire({ text: "لطفاً تصویر فیش را انتخاب کنید ❌", icon: 'warning' });
    }

    // بازپرداخت وام (اختیاری، علاوه بر قسط ثابت) — فقط در پرداخت ماهانه و حداکثر تا مانده‌ی وام
    const repayRaw = document.getElementById('loan-repay-input')?.value;
    const repayAmount = (category === 'monthly' && repayRaw) ? Number(repayRaw) : 0;
    if (repayAmount < 0 || isNaN(repayAmount)) {
        return Swal.fire({ text: "مبلغ بازپرداخت وام معتبر نیست ❌", icon: 'warning' });
    }
    if (repayAmount > 0 && repayAmount > (Number(paymentModalCache?.monthlyLoanDebt) || 0)) {
        return Swal.fire({ text: "مبلغ بازپرداخت از مانده‌ی وام شما بیشتر است ❌", icon: 'warning' });
    }

    // ۲. فیلتر فقط عکس (JPG, PNG)
    if (!file.type.startsWith('image/')) {
        return Swal.fire({ text: "فقط فایل تصویری مجاز است ❌", icon: 'error' });
    }

    // ۲.۵ پاپ‌آپ تایید: اگه بخشی که پر کرده این ماه قبلاً پرداخت (یا ثبت) شده
    if (isMonthlyCat && paymentModalCache?.payStatus) {
        const ps = paymentModalCache.payStatus;
        const lines = [];
        const warn = (st, paidTxt, pendTxt) => {
            const d = formatJalaliDate(st.date);
            lines.push(st.state === 'approved' ? paidTxt.replace('{d}', d) : pendTxt.replace('{d}', d));
        };
        if (baseAmt > 0 && ps.monthly.state !== 'none') {
            warn(ps.monthly, 'شما در تاریخ {d} واریزی ثابت ماه جاری را پرداخت کرده‌اید.', 'فیش واریزی ثابت ماه جاری شما در تاریخ {d} ثبت شده و هنوز در انتظار تایید مدیر است.');
        }
        if (repayAmount > 0 && ps.loan.state !== 'none') {
            warn(ps.loan, 'شما قسط وام ماه جاری را در تاریخ {d} پرداخت کرده‌اید.', 'فیش قسط وام ماه جاری شما در تاریخ {d} ثبت شده و هنوز در انتظار تایید مدیر است.');
        }
        if (lines.length) {
            const ask = await Swal.fire({
                title: 'پرداخت تکراری؟',
                html: `<p style="font-size:12px;line-height:2;color:#475467;">${lines.join('<br>')}<br><b>در هر صورت ادامه می‌دهید؟</b></p>`,
                icon: 'warning',
                showCancelButton: true,
                focusCancel: true,
                confirmButtonText: 'بله، ادامه می‌دهم',
                cancelButtonText: 'انصراف',
                confirmButtonColor: '#4f46e5',
                customClass: { popup: 'rounded-[2rem]' }
            });
            if (!ask.isConfirmed) return;
        }
    }

    // ۳. فعال کردن حالت لودینگ روی دکمه
    const originalBtnText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> در حال ارسال...`;

    try {
        // ۴. دریافت اطلاعات نشست امن (JWT)
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) throw new Error("نشست شما منقضی شده، لطفا دوباره وارد شوید.");

        const userId = session.user.id;
        const poolId = sessionStorage.getItem('pool_id');
        const fileName = `receipt-${poolId}-${Date.now()}.jpg`;

        // ۵. آپلود تصویر به حافظه (Storage)
        const { error: upErr } = await supabaseClient.storage
            .from('receipts')
            .upload(fileName, file);

        if (upErr) throw upErr;

        const { data: urlData } = supabaseClient.storage.from('receipts').getPublicUrl(fileName);

        // ۶. ثبت سند مالی در جدول تراکنش‌ها
        // یک عکس، دو ردیف: قسط ثابت (سپرده) + بازپرداخت وام (فقط کم‌کردن بدهی) — مدیر هر دو را با هم تایید می‌کند
        const rows = [];
        if (!isMonthlyCat || baseAmt > 0) rows.push({
            member_id: userId,
            pool_id: poolId,
            amount: Number(amount),
            status: 'pending',
            type: 'in',
            category: category,
            receipt_url: urlData.publicUrl
        });
        if (repayAmount > 0) rows.push({
            member_id: userId,
            pool_id: poolId,
            amount: repayAmount,
            status: 'pending',
            type: 'in',
            category: 'loan_repayment',
            receipt_url: urlData.publicUrl
        });
        const { error: dbErr } = await supabaseClient.from('transactions').insert(rows);

        if (dbErr) throw dbErr;

        // ۷. پیام موفقیت نهایی
        await Swal.fire({
            title: 'ارسال موفق ✅',
            text: 'فیش شما با موفقیت ثبت شد و در انتظار تایید مدیر است.',
            icon: 'success',
            confirmButtonColor: '#10b981',
            customClass: { popup: 'rounded-[2rem]' }
        });

        location.reload();

    } catch (e) {
        console.error("Upload Error:", e);
        Swal.fire({ title: 'خطا در ارسال', text: e.message, icon: 'error' });
    } finally {
        // برگرداندن دکمه به حالت عادی در صورت خطا
        btn.disabled = false;
        btn.innerHTML = originalBtnText;
    }
};

/************************************************
 * تابع نهایی ثبت درخواست وام (JWT & UUID Safe)
 ************************************************/
window.submitLoanRequest = async function() {
    // ۱. گرفتن دقیق اطلاعات از نشست امن سرور
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return Swal.fire({text: "لطفا دوباره لاگین کنید", icon:'error'});

    const userId = session.user.id; // UUID واقعی
    const poolId = sessionStorage.getItem('pool_id'); // UUID صندوق
    
    const amt = document.getElementById('loan-amount').value;
    const desc = document.getElementById('loan-desc').value;
    const btn = document.getElementById('loan-submit-btn');

    if(!amt || amt <= 0) return Swal.fire({text: "مبلغ را وارد کنید", icon:'warning'});

    toggleLoading('loan-submit-btn', true, 'در حال ثبت...');

    try {
        // ۲. ثبت وام با دقت بالا
        const { error } = await supabaseClient.from('loans').insert([{
            pool_id: poolId,
            member_id: userId,
            requester_name: sessionStorage.getItem('user_name') || 'عضو صندوق',
            amount: Number(amt),
            description: desc,
            status: 'voting',
            votes_up: 0,
            votes_down: 0
        }]);

        if (error) throw error;

        await Swal.fire({ title: 'ثبت شد ✅', text: 'درخواست شما در لیست رای‌گیری قرار گرفت', icon: 'success' });
        
        // ۳. رفرش آنی لیست
        loadActiveLoans(userId, poolId);
        document.getElementById('loan-amount').value = '';
        document.getElementById('loan-desc').value = '';

    } catch (e) {
        Swal.fire({ title: 'خطا', text: e.message, icon: 'error' });
    } finally {
        toggleLoading('loan-submit-btn', false, 'ارسال درخواست');
    }
};

// کرکره‌ی «درخواست مساعده»
window.toggleLoanRequestAccordion = function() {
    document.getElementById('loan-request-accordion')?.classList.toggle('hidden');
    document.getElementById('loan-request-chevron')?.classList.toggle('rotate-90');
};

// ==================================================
// درخواست مساعده سکه‌ای (تبدیل سکه به وجه نقد)
// ==================================================
let coinRequestContext = { price: 10000, balance: 0 };

window.toggleCoinRequestAccordion = async function() {
    const acc = document.getElementById('coin-request-accordion');
    const chevron = document.getElementById('coin-request-chevron');
    if (!acc) return;
    acc.classList.toggle('hidden');
    chevron?.classList.toggle('rotate-90');
    if (acc.classList.contains('hidden')) return;

    const userId = sessionStorage.getItem('user_id');
    const poolId = sessionStorage.getItem('pool_id');
    const [memberRes, settingsRes] = await Promise.all([
        supabaseClient.from('members').select('coins').eq('id', userId).maybeSingle(),
        supabaseClient.from('settings').select('coin_price_toman').eq('pool_id', poolId).maybeSingle()
    ]);
    coinRequestContext.balance = Number(memberRes.data?.coins) || 0;
    coinRequestContext.price = Number(settingsRes.data?.coin_price_toman) || 10000;

    const balEl = document.getElementById('coin-request-balance');
    if (balEl) balEl.innerText = `موجودی فعلی: ${coinRequestContext.balance.toLocaleString()} سکه (هر سکه ${coinRequestContext.price.toLocaleString()} ت)`;
};

window.updateCoinRequestPreview = function() {
    const input = document.getElementById('coin-request-amount');
    const preview = document.getElementById('coin-request-preview');
    if (!input || !preview) return;
    const coins = Number(input.value) || 0;
    if (coins <= 0) { preview.innerText = ''; return; }
    if (coins > coinRequestContext.balance) {
        preview.innerHTML = `<span class="text-rose-500">بیشتر از سکه‌های فعلیت (${coinRequestContext.balance.toLocaleString()}) نمی‌تونی درخواست بدی</span>`;
        return;
    }
    preview.innerText = `معادل: ${(coins * coinRequestContext.price).toLocaleString()} تومان`;
};

window.submitCoinRequest = async function() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return Swal.fire({ text: "لطفا دوباره لاگین کنید", icon: 'error' });

    const userId = session.user.id;
    const poolId = sessionStorage.getItem('pool_id');
    const coins = Number(document.getElementById('coin-request-amount')?.value);
    const btn = document.getElementById('coin-request-submit-btn');

    if (!coins || coins <= 0) return Swal.fire({ text: "تعداد سکه را وارد کنید", icon: 'warning' });
    if (coins > coinRequestContext.balance) return Swal.fire({ text: "این تعداد سکه رو نداری", icon: 'warning' });

    toggleLoading('coin-request-submit-btn', true, 'در حال ثبت...');
    try {
        const { error } = await supabaseClient.from('coin_requests').insert([{
            pool_id: poolId,
            member_id: userId,
            requester_name: sessionStorage.getItem('user_name') || 'عضو صندوق',
            coins_requested: coins,
            amount: coins * coinRequestContext.price
        }]);
        if (error) throw error;

        await Swal.fire({ title: 'ثبت شد ✅', text: 'درخواست مساعده سکه‌ای شما برای مدیر ارسال شد', icon: 'success' });
        document.getElementById('coin-request-amount').value = '';
        document.getElementById('coin-request-preview').innerText = '';
    } catch (e) {
        Swal.fire({ title: 'خطا', text: e.message, icon: 'error' });
    } finally {
        toggleLoading('coin-request-submit-btn', false, 'ارسال درخواست');
    }
};

/************************************************
 * تابع نمایش تاریخچه تراکنش‌های عضو (History)
 ************************************************/
async function loadMyTransactions(userId, poolId) {
    const container = document.getElementById('transactions-list');
    if (!container) return;

    try {
        const { data, error } = await supabaseClient
            .from('transactions')
            .select('*')
            .eq('member_id', userId) // استفاده از UUID
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = '<p class="text-center py-10 text-slate-300 text-[10px] font-bold">هنوز تراکنشی ثبت نشده است.</p>';
            return;
        }

        container.innerHTML = data.map(t => {
         // فرمت استاندارد برای تاریخ شمسی با اعداد انگلیسی
const date = new Date(t.created_at).toLocaleDateString('fa-IR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    numberingSystem: 'latn' // جادوی تبدیل به اعداد انگلیسی ✅
});
            const isOut = ['out', 'capital_spend'].includes(t.type);

            const outLabels = {
                monthly: '🏆 دریافت وام نوبتی',
                emergency: '💰 دریافت مساعده',
                coin_assistance: '🪙 تبدیل سکه به مساعده',
                capital_spend: '📉 برداشت از سرمایه'
            };
            const inLabels = {
                monthly: '↑ واریز قسط ماهانه',
                emergency: '↑ بازپرداخت مساعده',
                loan_repayment: '↩ بازپرداخت وام نوبتی',
                coin_assistance: '↑ بازپرداخت مساعده سکه‌ای',
                charity: '💚 کمک به خیریه'
            };
            // آورده‌ی اولیه و بدهی انتقالی از بانک سنتی، برچسب جدا دارند (نه «دریافت وام» یا «قسط ماهانه»)
            const isOpeningDebtRow = isOut && (t.receipt_url || '').startsWith('بدهی اولیه');
            const label = t.category === 'opening'
                ? '🏦 آورده‌ی اولیه (بانک سنتی)'
                : isOpeningDebtRow
                    ? '📋 بدهی اولیه (انتقالی از بانک سنتی)'
                    : (isOut ? outLabels[t.category] : inLabels[t.category]) || (isOut ? '🏆 دریافت برندگی / وام' : '↑ واریز قسط ماهانه');

            return `
                <div class="bg-white p-5 rounded-[2rem] border border-slate-50 mb-3 flex justify-between items-center shadow-sm animate__animated animate__fadeIn">
                    <div class="text-right">
                        <p class="text-sm font-[900] ${isOut ? 'text-rose-600' : 'text-slate-800'}">
                            ${isOut ? '-' : '+'}${Number(t.amount).toLocaleString()} تومان
                        </p>
                        <p class="text-[9px] text-slate-400 font-bold mt-1">
                            ${label} • ${date}
                        </p>
                    </div>
                    <div class="text-left">
                        <span class="text-[8px] font-black px-3 py-1 rounded-full ${t.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}">
                            ${t.status === 'approved' ? 'تایید نهایی' : 'در انتظار'}
                        </span>
                    </div>
                </div>`;
        }).join('');
    } catch (e) { console.error("History Error:", e); }
}

/************************************************
 * تابع لود لیست وام‌های فعال (نسخه ضد کرش v11.0)
 ************************************************/
window.loadActiveLoans = async function(uId, pId) {
    const container = document.getElementById('active-loans-list');
    if (!container) return;

    console.log("🔍 در حال فراخوانی لیست وام‌ها...");

    try {
        // ۱. بررسی و بازیابی آیدی‌ها (جلوگیری از ReferenceError) 👇
        const userId = uId || sessionStorage.getItem('user_id');
        const poolId = pId || sessionStorage.getItem('pool_id');

        if (!poolId || poolId === "null") {
            container.innerHTML = '<p class="text-center py-5 text-slate-400 text-[9px]">در حال هماهنگی با مرکز...</p>';
            return;
        }

        // تبدیل آیدی صندوق به عدد (چون در دیتابیس BigInt است) ✅
        const cleanPoolId = Number(poolId);

        // ۲. دریافت اطلاعات از دیتابیس
        const { data: loans, error } = await supabaseClient
            .from('loans')
            .select('*')
            .eq('pool_id', cleanPoolId)
            .eq('status', 'voting')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // ۳. اگر لیست خالی بود
        if (!loans || loans.length === 0) {
            container.innerHTML = `
                <div class="text-center py-10 opacity-30">
                    <i class="fas fa-box-open text-4xl mb-3"></i>
                    <p class="text-[10px] font-black uppercase">درخواستی یافت نشد</p>
                </div>`;
            return;
        }

        // ۴. رندر کردن کارت‌های وام
        container.innerHTML = loans.map(l => {
            const isMyLoan = String(l.member_id) === String(userId);
            const date = new Date(l.created_at).toLocaleDateString('fa-IR');

            return `
                <div class="bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-xl relative overflow-hidden mb-5 border border-white/5 animate__animated animate__fadeInUp">
                    <div class="relative z-10">
                        <div class="flex justify-between items-start mb-4">
                            <div class="text-right">
                                <h5 class="text-xs font-[900] text-indigo-400">${l.requester_name || 'عضو ناشناس'}</h5>
                                <p class="text-[7px] text-slate-500 mt-1 uppercase font-bold">${date}</p>
                            </div>
                            <span class="bg-white/10 px-3 py-1.5 rounded-xl text-[10px] font-black text-white">
                                ${Number(l.amount).toLocaleString()} تومان
                            </span>
                        </div>
                        
                        <p class="text-[10px] text-slate-400 leading-relaxed mb-6 bg-white/5 p-4 rounded-2xl italic text-right">
                            "${l.description || 'توضیحی ثبت نشده'}"
                        </p>

                        <div class="grid grid-cols-2 gap-3">
                            <button onclick="${isMyLoan ? "Swal.fire({text:'نمی‌توانید به درخواست خود رای دهید', icon:'info'})" : `voteOnLoan('${l.id}', 'up')`}" 
                                class="bg-emerald-500 text-white py-3.5 rounded-2xl font-black text-[10px] active:scale-95 shadow-lg">
                                <i class="fas fa-check-circle ml-1"></i> موافقم (${l.votes_up || 0})
                            </button>
                            <button onclick="${isMyLoan ? "Swal.fire({text:'نمی‌توانید به درخواست خود رای دهید', icon:'info'})" : `voteOnLoan('${l.id}', 'down')`}" 
                                class="bg-white/5 text-white border border-white/10 py-3.5 rounded-2xl font-black text-[10px] active:scale-95">
                                <i class="fas fa-times-circle ml-1"></i> مخالفم (${l.votes_down || 0})
                            </button>
                        </div>
                    </div>
                </div>`;
        }).join('');

    } catch (err) {
        console.error("Critical Loan Load Error:", err.message);
        // به جای ارور قرمز، با آرامش پیغام لودینگ بده 👇
        if (container) container.innerHTML = '<p class="text-center py-5 text-slate-500 text-[8px]">در حال نوسازی نشست امن...</p>';
    }
};


/************************************************
 * باز کردن منوی تنظیمات کاربر (تغییر عکس و رمز)
 ************************************************/
// ==================================================
// پروفایل عضو (سبک تلگرام) — باز میشه با کلیک روی آواتار
// ==================================================
window.openMemberProfile = function() {
    const modal = document.getElementById('member-profile-modal');
    if (!modal) return;

    // نام و عکس رو از همون چیزی که تو هدر لود شده کپی کن (نیازی به فچ دوباره نیست)
    const nameEl = document.getElementById('profile-name-display');
    if (nameEl) nameEl.innerText = document.getElementById('user-name-display')?.innerText || 'کاربر گرامی';

    const headerImg = document.getElementById('user-avatar-header');
    const profileImg = document.getElementById('profile-avatar-img');
    const profileIcon = document.getElementById('profile-avatar-icon');
    if (headerImg && !headerImg.classList.contains('hidden') && profileImg && profileIcon) {
        profileImg.src = headerImg.src;
        profileImg.classList.remove('hidden');
        profileIcon.classList.add('hidden');
    }

    modal.classList.remove('hidden');
};

window.closeMemberProfile = function() {
    document.getElementById('member-profile-modal')?.classList.add('hidden');
    // بستن کرکره‌ی تنظیمات برای دفعه‌ی بعد
    document.getElementById('profile-settings-accordion')?.classList.add('hidden');
    document.getElementById('settings-chevron')?.classList.remove('rotate-90');
};

// باز/بسته کردن کرکره‌ی تنظیمات داخل پروفایل
window.toggleProfileSettings = function() {
    document.getElementById('profile-settings-accordion')?.classList.toggle('hidden');
    document.getElementById('settings-chevron')?.classList.toggle('rotate-90');
};

// ==================================================
// کرکره‌ی وضعیت مالی داخل پروفایل
// ==================================================
window.toggleFinancialAccordion = async function() {
    const acc = document.getElementById('financial-status-accordion');
    const chevron = document.getElementById('financial-chevron');
    if (!acc) return;

    const opening = acc.classList.contains('hidden');
    acc.classList.toggle('hidden');
    chevron?.classList.toggle('rotate-90');
    if (!opening) return; // فقط موقع باز شدن دوباره محاسبه کن

    const userId = sessionStorage.getItem('user_id');
    const poolId = sessionStorage.getItem('pool_id');
    if (!userId || !poolId) return;

    const [debts, memberRes, settingsRes] = await Promise.all([
        getMemberDebtSummary(userId, poolId),
        supabaseClient.from('members').select('coins, emergency_due_date, coin_assistance_due_date').eq('id', userId).maybeSingle(),
        supabaseClient.from('settings').select('coin_price_toman').eq('pool_id', poolId).maybeSingle()
    ]);
    const myCoins = Number(memberRes.data?.coins) || 0;
    const coinPrice = Number(settingsRes.data?.coin_price_toman) || 10000;
    const coinsToToman = myCoins * coinPrice;

    const dueSubtitle = (dueDateStr, debtAmount) => {
        if (!dueDateStr || debtAmount <= 0) return '';
        const daysLeft = Math.ceil((new Date(dueDateStr) - new Date()) / 86400000);
        return daysLeft < 0
            ? `<p class="text-[8px] text-rose-500 font-bold mt-0.5">⚠️ ${Math.abs(daysLeft)} روز معوقه</p>`
            : `<p class="text-[8px] text-slate-400 font-bold mt-0.5">${daysLeft} روز تا سررسید</p>`;
    };

    const rows = [
        { icon: 'fa-calendar-check', label: 'مانده وام نوبتی', value: debts.monthlyLoanDebt, color: 'text-indigo-600', due: '' },
        { icon: 'fa-hand-holding-dollar', label: 'مانده مساعده', value: debts.emergency, color: 'text-amber-600', due: dueSubtitle(memberRes.data?.emergency_due_date, debts.emergency) },
        { icon: 'fa-coins', label: 'مانده مساعده سکه‌ای', value: debts.coin_assistance, color: 'text-yellow-600', due: dueSubtitle(memberRes.data?.coin_assistance_due_date, debts.coin_assistance) }
    ];
    acc.innerHTML = `
        <div class="w-full flex items-center justify-between gap-3 p-4 bg-yellow-50 rounded-2xl border border-yellow-100">
            <span class="flex items-center gap-3 text-[11px] font-black text-yellow-700"><i class="fas fa-coins w-5"></i> تعداد سکه</span>
            <span class="text-[11px] font-black text-yellow-800">${myCoins.toLocaleString()} سکه = ${coinsToToman.toLocaleString()} ت</span>
        </div>` + rows.map(r => `
        <div class="w-full flex items-center justify-between gap-3 p-4 bg-slate-50 rounded-2xl">
            <span class="flex items-center gap-3 text-[11px] font-black text-slate-700"><i class="fas ${r.icon} ${r.color} w-5"></i> ${r.label}</span>
            <span class="text-left">
                <span class="block text-[11px] font-black text-slate-800">${r.value > 0 ? r.value.toLocaleString() + ' ت' : 'صفر'}</span>
                ${r.due}
            </span>
        </div>`).join('') + `
        <div class="w-full flex items-center justify-between gap-3 p-4 bg-emerald-50 rounded-2xl">
            <span class="flex items-center gap-3 text-[11px] font-black text-emerald-700"><i class="fas fa-chart-line w-5"></i> سود پروژه (تجمعی)</span>
            <span class="text-[11px] font-black text-emerald-700">${debts.totalProfit.toLocaleString()} ت</span>
        </div>`;
};

/************************************************
 * تابع آپلود عکس پروفایل (نسخه امن و فیکس شده)
 ************************************************/
window.uploadAvatar = async function() {
    const fileInput = document.getElementById('avatar-input');
    const file = fileInput.files[0];
    if (!file) return;

    // رفع ارور Reading User با گرفتن مستقیم آیدی از حافظه 👇
    const userId = sessionStorage.getItem('user_id');
    if (!userId) return Swal.fire({text: "نشست شما منقضی شده است", icon:'error'});

    Swal.fire({ 
        title: 'در حال آپلود...', 
        html: 'لطفاً صبور باشید، عکس پروفایل در حال بروزرسانی است.',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading() 
    });

    try {
        const fileName = `avatar-${userId}-${Date.now()}.jpg`;

        // ۱. آپلود به استوریج
        const { error: upErr } = await supabaseClient.storage
            .from('receipts')
            .upload(fileName, file);

        if (upErr) throw upErr;

        // ۲. دریافت لینک مستقیم
        const { data: urlData } = supabaseClient.storage.from('receipts').getPublicUrl(fileName);
        const publicUrl = urlData.publicUrl;

        // ۳. ثبت در جدول اعضا (از طریق RPC امن، چون مدیریت مستقیم جدول اعضا برای عضو عادی بسته‌ست)
        const { error: dbErr } = await supabaseClient.rpc('update_own_avatar', { new_url: publicUrl });

        if (dbErr) throw dbErr;

        await Swal.fire({
            title: 'بروزرسانی شد ✅',
            text: 'عکس پروفایل جدید شما با موفقیت ثبت گردید.',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false,
            customClass: { popup: 'rounded-[2rem]' }
        });

        location.reload(); // برای نمایش عکس جدید

    } catch (e) {
        console.error(e);
        Swal.fire({ title: 'خطا در آپلود', text: e.message, icon: 'error' });
    }
};


/************************************************
 * تابع خروج قطعی و پاکسازی تمام نشست‌ها
 ************************************************/
// ==================================================
// چت گروهی صندوق
// ==================================================
let chatChannel = null;
let chatSelectedImageFile = null;
let chatPoolNameCache = null;

function renderChatMessage(msg, myId) {
    const isMine = String(msg.sender_id) === String(myId);
    const sender = msg.members || {};
    const time = new Date(msg.created_at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    const avatarHtml = sender.avatar_url
        ? `<img src="${sender.avatar_url}" class="chat-avatar">`
        : `<div class="chat-avatar flex items-center justify-center text-slate-400"><i class="fas fa-user text-[11px]"></i></div>`;

    const senderNameHtml = !isMine
        ? `<p class="chat-sender-name">${sender.is_admin ? '<span class="chat-admin-badge">مدیر</span>' : ''}${sender.full_name || 'عضو'}</p>`
        : '';

    const imageHtml = msg.image_url ? `<img src="${msg.image_url}" onclick="window.open('${msg.image_url}','_blank')">` : '';
    const textHtml = msg.text ? `<p>${msg.text.replace(/</g, '&lt;')}</p>` : '';

    return `
        <div id="chat-msg-row-${msg.id}" class="chat-row ${isMine ? 'mine' : ''}">
            ${avatarHtml}
            <div class="chat-bubble">
                ${senderNameHtml}
                ${textHtml}
                ${imageHtml}
                <span class="chat-time">${time}</span>
            </div>
        </div>`;
}

/************************************************
 * نقطه‌ی قرمز پیام خوانده‌نشده روی دکمه‌ی شناور چت گروهی
 * زمان «آخرین باز کردن چت» در localStorage نگه‌داشته می‌شود (به‌ازای هر بانک)
 ************************************************/
let chatNotifyChannel = null;

function chatLastReadKey(poolId) { return 'chat_last_read_' + poolId; }

function setChatUnreadDot(show) {
    const dot = document.getElementById('chat-unread-dot');
    if (dot) dot.classList.toggle('hidden', !show);
}

function markChatRead() {
    const poolId = sessionStorage.getItem('pool_id');
    if (poolId) localStorage.setItem(chatLastReadKey(poolId), new Date().toISOString());
    setChatUnreadDot(false);
}

async function refreshChatUnreadDot() {
    try {
        const poolId = sessionStorage.getItem('pool_id');
        const userId = sessionStorage.getItem('user_id');
        if (!poolId || !userId) return;

        const lastRead = localStorage.getItem(chatLastReadKey(poolId));
        if (!lastRead) { // اولین بار: پیام‌های قدیمی را «خوانده‌نشده» حساب نکن
            localStorage.setItem(chatLastReadKey(poolId), new Date().toISOString());
            return;
        }
        const { count, error } = await supabaseClient
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('pool_id', poolId)
            .neq('sender_id', userId)
            .gt('created_at', lastRead);
        if (error) return;
        setChatUnreadDot(Number(count || 0) > 0);
    } catch (_) {}
}

async function initChatUnreadWatcher() {
    const poolId = sessionStorage.getItem('pool_id');
    const userId = sessionStorage.getItem('user_id');
    if (!poolId || !userId) return;

    await refreshChatUnreadDot();

    if (chatNotifyChannel) supabaseClient.removeChannel(chatNotifyChannel);
    chatNotifyChannel = supabaseClient
        .channel('chat-notify-' + poolId)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `pool_id=eq.${poolId}` }, (payload) => {
            if (payload.new.sender_id === userId) return;
            const chatOpen = !document.getElementById('group-chat-modal')?.classList.contains('hidden');
            if (chatOpen) markChatRead(); else setChatUnreadDot(true);
        })
        .subscribe();
}

window.openGroupChat = async function() {
    const modal = document.getElementById('group-chat-modal');
    const listEl = document.getElementById('chat-messages-list');
    if (!modal || !listEl) return;

    modal.classList.remove('hidden');
    const userId = sessionStorage.getItem('user_id');
    const poolId = sessionStorage.getItem('pool_id');
    if (!userId || !poolId) return;
    markChatRead();

    // نام صندوق (فقط بار اول فچ میشه)
    if (!chatPoolNameCache) {
        const { data: pool } = await supabaseClient.from('pools').select('pool_name').eq('id', poolId).maybeSingle();
        chatPoolNameCache = pool?.pool_name || 'صندوق';
    }
    document.getElementById('chat-room-title').innerText = chatPoolNameCache;

    // آخرین ۵۰ پیام
    const { data: msgs, error } = await supabaseClient
        .from('messages')
        .select('*, members!sender_id(full_name, is_admin, avatar_url)')
        .eq('pool_id', poolId)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        console.error('❌ خطا در دریافت پیام‌ها:', error);
        listEl.innerHTML = '<p class="text-center text-[10px] text-rose-400 font-bold py-10">خطا در بارگذاری پیام‌ها</p>';
        return;
    }

    const ordered = (msgs || []).slice().reverse();
    listEl.innerHTML = ordered.length
        ? ordered.map(m => renderChatMessage(m, userId)).join('')
        : '<p class="text-center text-[10px] text-slate-300 font-bold py-10">هنوز پیامی ارسال نشده — اولین نفر باش! 👋</p>';
    listEl.scrollTop = listEl.scrollHeight;

    // عضویت زنده روی پیام‌های جدید همین صندوق
    if (chatChannel) supabaseClient.removeChannel(chatChannel);
    chatChannel = supabaseClient
        .channel('chat-' + poolId)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `pool_id=eq.${poolId}` }, async (payload) => {
            // اطلاعات فرستنده رو جدا می‌گیریم چون پیام لحظه‌ای، جوین شده نمیاد
            const { data: sender } = await supabaseClient.from('members').select('full_name, is_admin, avatar_url').eq('id', payload.new.sender_id).maybeSingle();
            const fullMsg = { ...payload.new, members: sender };
            const emptyState = listEl.querySelector('.text-center');
            if (emptyState) emptyState.remove();
            listEl.insertAdjacentHTML('beforeend', renderChatMessage(fullMsg, userId));
            listEl.scrollTop = listEl.scrollHeight;
        })
        .subscribe();
};

window.closeGroupChat = function() {
    document.getElementById('group-chat-modal')?.classList.add('hidden');
    markChatRead();
    if (chatChannel) {
        supabaseClient.removeChannel(chatChannel);
        chatChannel = null;
    }
    clearChatImage();
};

// نمایش لیست اعضا و مدیر با کلیک روی اسم صندوق
window.openChatGroupInfo = async function() {
    const modal = document.getElementById('chat-group-info-modal');
    const listEl = document.getElementById('chat-group-members-list');
    if (!modal || !listEl) return;

    modal.classList.remove('hidden');
    listEl.innerHTML = '<p class="text-center text-[10px] text-slate-300 font-bold py-10">در حال بارگذاری اعضا...</p>';

    const poolId = sessionStorage.getItem('pool_id');
    const { data: members, error } = await supabaseClient
        .from('members')
        .select('id, full_name, avatar_url, is_admin')
        .eq('pool_id', poolId)
        .order('is_admin', { ascending: false });

    if (error || !members) {
        listEl.innerHTML = '<p class="text-center text-[10px] text-rose-400 font-bold py-10">خطا در بارگذاری اعضا</p>';
        return;
    }

    listEl.innerHTML = members.map(m => `
        <div class="flex items-center gap-3 p-3 rounded-2xl border border-slate-50 bg-slate-50/60">
            ${m.avatar_url
                ? `<img src="${m.avatar_url}" class="w-11 h-11 rounded-2xl object-cover">`
                : `<div class="w-11 h-11 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center"><i class="fas fa-user"></i></div>`}
            <span class="text-[11px] font-black text-slate-700 flex-1 text-right">${m.full_name || 'عضو'}</span>
            ${m.is_admin ? '<span class="chat-admin-badge">مدیر</span>' : ''}
        </div>`).join('');
};

window.closeChatGroupInfo = function() {
    document.getElementById('chat-group-info-modal')?.classList.add('hidden');
};

window.handleChatImageSelect = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    chatSelectedImageFile = file;
    const preview = document.getElementById('chat-image-preview');
    preview.src = URL.createObjectURL(file);
    document.getElementById('chat-image-preview-wrap').classList.remove('hidden');
};

window.clearChatImage = function() {
    chatSelectedImageFile = null;
    document.getElementById('chat-image-input').value = '';
    document.getElementById('chat-image-preview-wrap').classList.add('hidden');
};

window.sendChatMessage = async function() {
    const textInput = document.getElementById('chat-text-input');
    const text = textInput.value.trim();
    const userId = sessionStorage.getItem('user_id');
    const poolId = sessionStorage.getItem('pool_id');

    if (!text && !chatSelectedImageFile) return;

    const btn = document.getElementById('chat-send-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin text-xs"></i>';

    try {
        let imageUrl = null;
        if (chatSelectedImageFile) {
            const fileName = `chat-${poolId}-${Date.now()}.jpg`;
            const { error: upErr } = await supabaseClient.storage.from('receipts').upload(fileName, chatSelectedImageFile);
            if (upErr) throw upErr;
            imageUrl = supabaseClient.storage.from('receipts').getPublicUrl(fileName).data.publicUrl;
        }

        const { error } = await supabaseClient.from('messages').insert([{
            pool_id: poolId,
            sender_id: userId,
            text: text || null,
            image_url: imageUrl
        }]);
        if (error) throw error;

        textInput.value = '';
        clearChatImage();
    } catch (e) {
        console.error('❌ خطا در ارسال پیام:', e);
        Swal.fire({ text: 'ارسال پیام ناموفق بود', icon: 'error' });
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane text-xs"></i>';
    }
};

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

/************************************************
 * تابع محاسبه نوبت - نسخه بدون باگ (v12.5)
 ************************************************/
// محاسبه‌ی صف نوبت (مشترک بین کارت خانه و پیش‌نمایش تعویض نوبت)
async function getQueueRanking(poolId) {
    const [membersRes, txsRes] = await Promise.all([
        supabaseClient.from('members').select('id, full_name, eligible_at').eq('pool_id', poolId).eq('is_admin', false),
        supabaseClient.from('transactions').select('member_id, amount, type, category').eq('pool_id', poolId).eq('status', 'approved')
    ]);

    const members = membersRes.data || [];
    const txs = txsRes.data || [];

    const queueData = members.map(m => {
        const userIn = txs.filter(t => t.member_id === m.id && t.type === 'in' && t.category === 'loan_repayment').reduce((s, a) => s + Number(a.amount), 0);
        const userOutMonthly = txs.filter(t => t.member_id === m.id && t.type === 'out' && t.category === 'monthly').reduce((s, a) => s + Number(a.amount), 0);

        // شرط شایستگی: بدهی صفر + داشتن تاریخ صلاحیت
        const isEligible = (userOutMonthly - userIn <= 0) && (m.eligible_at !== null);

        return { id: m.id, isEligible, eligible_at: m.eligible_at };
    });

    // 🔥 مرتب‌سازی جادویی (حل مشکل نفر دوم ماندن) 👇
    return queueData.sort((a, b) => {
        if (a.isEligible && !b.isEligible) return -1;
        if (!a.isEligible && b.isEligible) return 1;
        if (a.isEligible && b.isEligible) return new Date(a.eligible_at) - new Date(b.eligible_at);
        return 0;
    });
}

// پیدا کردن رتبه‌ی یک عضو خاص در صفِ محاسبه‌شده (null یعنی رتبه‌ی مشخصی نداره)
function getRankOf(sortedQueue, userId) {
    const idx = sortedQueue.findIndex(m => String(m.id) === String(userId));
    if (idx === -1 || !sortedQueue[idx].isEligible) return null;
    return idx + 1;
}

// اطلاع‌رسانیِ یک‌باره به فرستنده‌ی درخواست، وقتی یکی درخواست تعویض نوبتش رو قبول کرده باشه
async function checkSwapNotifications(userId, poolId) {
    try {
        const { data: accepted } = await supabaseClient
            .from('turn_swap_requests')
            .select('id, acceptor_id, members!fk_sender(full_name), acceptor:members!acceptor_id(full_name)')
            .eq('sender_id', userId)
            .eq('pool_id', poolId)
            .eq('status', 'accepted')
            .eq('seen', false)
            .limit(1)
            .maybeSingle();

        if (!accepted) return;

        const queue = await getQueueRanking(poolId);
        const myNewRank = getRankOf(queue, userId);
        const acceptorName = accepted.acceptor?.full_name || 'یکی از اعضا';

        await Swal.fire({
            title: 'خبر خوب! 🎉',
            html: `<b>${acceptorName}</b> درخواست تعویض نوبتت رو قبول کرد.<br>نوبت جدیدت: <b style="color:#10b981;">${myNewRank ? 'نفر ' + myNewRank : 'خارج از صف'}</b>`,
            icon: 'success',
            confirmButtonColor: '#10b981',
            customClass: { popup: 'rounded-[2.5rem]' }
        });

        await supabaseClient.from('turn_swap_requests').update({ seen: true }).eq('id', accepted.id);
    } catch (e) {
        console.error('❌ خطا در بررسی اطلاع تعویض نوبت:', e);
    }
}

async function loadUserQueuePosition(userId, poolId) {
    const posText = document.getElementById('queue-pos-text');
    const posNum = document.getElementById('queue-pos-number');
    const card = document.getElementById('queue-status-card');

    if (!posText || !poolId) return;

    try {
        const sortedQueue = await getQueueRanking(poolId);
        const myIndex = sortedQueue.findIndex(m => String(m.id) === String(userId));
        const myInfo = sortedQueue[myIndex];

        if (myIndex !== -1) {
            if (myInfo.isEligible) {
                const rank = myIndex + 1;
                posNum.innerText = rank;
                posText.innerHTML = `تبریک! شما نفر <b class="text-white text-sm">${rank}</b> در صف نوبت هستید. ✅`;
                card.style.background = "linear-gradient(135deg, #10b981 0%, #059669 100%)"; // سبز
            } else {
                // اگر بدهکار است یا تازه وام گرفته
                posNum.innerText = "!";
                posText.innerHTML = `در انتظار تسویه اقساط جهت ورود مجدد به صف ⚠️`;
                card.style.background = "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"; // نارنجی
            }
        }

    } catch (e) { console.error("Queue Error:", e); }
}



/************************************************
 * تابع لود اخبار در پنل اعضا
 ************************************************/
async function loadMemberNews(poolId) {
    const container = document.getElementById('member-news-container');
    if (!container) return;

    try {
        const { data, error } = await supabaseClient
            .from('admin_news')
            .select('*')
            .eq('pool_id', poolId)
            .order('created_at', { ascending: false })
            .limit(3);

        if (data && data.length > 0) {
            container.innerHTML = data.map(n => `
                <div class="bg-amber-50 p-5 rounded-[2.2rem] border border-amber-100 flex items-start gap-4 animate__animated animate__fadeInUp shadow-sm">
                    <div class="w-10 h-10 bg-amber-500 text-white rounded-2xl flex-shrink-0 flex items-center justify-center shadow-lg shadow-amber-200">
                        <i class="fas fa-bullhorn text-sm"></i>
                    </div>
                    <div class="text-right">
                        <p class="text-[11px] font-[900] text-amber-900 leading-relaxed">${n.message}</p>
                        <p class="text-[7px] text-amber-700/50 mt-1.5 font-bold italic">${new Date(n.created_at).toLocaleDateString('fa-IR')}</p>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = `<p class="text-center py-4 text-[9px] text-slate-300 font-black uppercase">اطلاعیه جدیدی موجود نیست ✨</p>`;
        }
    } catch (e) { console.log("News Error:", e); }
}

/************************************************
 * تابع لود نظرسنجی‌ها و درخواست‌های جابجایی (v15.2)
 ************************************************/
async function loadActivePoll(userId, poolId) {
    const container = document.getElementById('active-polls-list');
    if (!container) return;

    try {
        // ۱. ابتدا لود کردن نظرسنجی‌های معمولی (بله/خیر)
        const { data: polls } = await supabaseClient.from('admin_polls').select('*').eq('pool_id', poolId).eq('is_active', true);
        
        container.innerHTML = ''; // پاکسازی اولیه

        if (polls && polls.length > 0) {
            for (const poll of polls) {
                const { data: myVote } = await supabaseClient.from('poll_votes').select('*').eq('poll_id', poll.id).eq('member_id', userId).maybeSingle();
                if (myVote) {
                    await renderPollResults(poll.id, poll.question, container);
                } else {
                    container.innerHTML += `
                        <div class="bg-white p-7 rounded-[3rem] border border-slate-100 shadow-sm space-y-6 mb-4 animate__animated animate__zoomIn">
                            <div class="text-center">
                                <span class="bg-indigo-50 text-indigo-600 text-[8px] font-black px-3 py-1 rounded-full uppercase">Opinion Poll</span>
                                <h4 class="text-sm font-[900] text-slate-800 mt-4 leading-relaxed">${poll.question}</h4>
                            </div>
                            <div class="grid grid-cols-2 gap-3">
                                <button onclick="submitPollVote(${poll.id}, 'yes')" class="bg-emerald-500 text-white py-4 rounded-2xl font-black text-xs">موافقم ✅</button>
                                <button onclick="submitPollVote(${poll.id}, 'no')" class="bg-rose-500 text-white py-4 rounded-2xl font-black text-xs">مخالفم ❌</button>
                            </div>
                        </div>`;
                }
            }
        }

        // ۲. حالا لود کردن درخواست‌های جابجایی نوبت (Turn Swap) 👇
        const { data: swaps, error: swapErr } = await supabaseClient
            .from('turn_swap_requests')
            .select('*, members!fk_sender(full_name)') // استفاده از نام رابطه رسمی ✅
            .eq('pool_id', poolId)
            .eq('status', 'pending');

        if (swapErr) console.error("Swap Fetch Error:", swapErr);

        if (swaps && swaps.length > 0) {
            swaps.forEach(s => {
                // فقط به بقیه نشون بده (خودِ فرستنده نبینه)
                if (String(s.sender_id) !== String(userId)) {
                    container.innerHTML += `
                        <div class="bg-indigo-950 p-7 rounded-[3rem] text-white shadow-2xl mb-6 relative overflow-hidden border border-indigo-500/30 animate__animated animate__fadeIn">
                            <div class="relative z-10">
                                <div class="flex justify-between items-center mb-4">
                                    <span class="bg-indigo-500 text-[7px] px-3 py-1 rounded-full font-black uppercase tracking-widest">Urgent Swap</span>
                                    <i class="fas fa-handshake-angle text-indigo-400 text-lg"></i>
                                </div>
                                <h5 class="text-[12px] font-black text-right leading-relaxed">
                                    <b class="text-yellow-400">${s.members.full_name}</b> درخواست تعویض نوبت دارد:
                                </h5>
                                <p class="text-[10px] text-indigo-200/70 mt-3 italic text-right bg-white/5 p-3 rounded-2xl">"${s.message}"</p>
                                <button data-req-id="${s.id}" data-sender-id="${s.sender_id}" data-sender-name="${s.members.full_name}" onclick="acceptSwap(this)" class="btn-tap w-full mt-5 bg-emerald-500 text-white py-4 rounded-2xl font-black text-[11px] shadow-lg shadow-emerald-500/20">
                                    🤝 من جابجا می‌شوم (+۵ امتیاز)
                                </button>
                            </div>
                            <i class="fas fa-random absolute -bottom-6 -left-6 text-8xl opacity-5 -rotate-12"></i>
                        </div>`;
                }
            });
        }

        // اگر کلاً هیچ موردی نبود
        if (container.innerHTML === '') {
            container.innerHTML = '<p class="text-center py-20 text-slate-300 text-[10px] font-black uppercase tracking-widest">No Active Sessions</p>';
        }

    } catch (e) {
        console.error("Load Poll Error:", e);
    }
}


/************************************************
 * تابع نمایش نتایج نظرسنجی (هماهنگ با استایل جدید)
 ************************************************/
async function renderPollResults(pollId, question, container) {
    const { data: votes } = await supabaseClient.from('poll_votes').select('vote_type').eq('poll_id', pollId);
    const yes = votes ? votes.filter(v => v.vote_type === 'yes').length : 0;
    const no = votes ? votes.filter(v => v.vote_type === 'no').length : 0;
    const total = yes + no || 1;
    const yesP = Math.round((yes / total) * 100);

    // اینجا به جای bg-slate-900 از feed-card poll-item استفاده می‌کنیم 👇
    container.innerHTML += `
        <div class="feed-card poll-item expanded animate__animated animate__fadeIn">
            <div class="card-tag">نتایج نظرسنجی</div>
            <h5 class="text-[11px] font-[900] text-right text-slate-100 mb-6 leading-relaxed">${question}</h5>
            
            <div class="space-y-4 pt-2 border-t border-white/5">
                <div class="space-y-1">
                    <div class="flex justify-between text-[7px] font-black opacity-50 uppercase">
                        <span>موافق (${yes} نفر)</span>
                        <span>${yesP}%</span>
                    </div>
                    <div class="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                        <div class="bg-emerald-500 h-full shadow-[0_0_10px_#10b981]" style="width:${yesP}%"></div>
                    </div>
                </div>
                <div class="space-y-1">
                    <div class="flex justify-between text-[7px] font-black opacity-50 uppercase">
                        <span>مخالف (${no} نفر)</span>
                        <span>${100 - yesP}%</span>
                    </div>
                    <div class="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                        <div class="bg-rose-500 h-full shadow-[0_0_10px_#f43f5e]" style="width:${100 - yesP}%"></div>
                    </div>
                </div>
            </div>
            <p class="text-center text-[7px] text-emerald-400 font-black mt-6 tracking-widest uppercase">رای شما ثبت شده است ✅</p>
        </div>`;
}




// ۱. ثبت درخواست جابجایی
window.requestTurnSwap = async function() {
    const { value: msg } = await Swal.fire({
        title: 'تعویض نوبت نوبتی',
        input: 'textarea',
        inputPlaceholder: 'دلیل نیاز فوری خود را بنویسید (مثلاً: نیاز برای درمان)',
        confirmButtonText: 'ارسال فراخوان 📢',
        confirmButtonColor: '#4f46e5',
        showCancelButton: true,
        customClass: { popup: 'rounded-[3rem]' }
    });

    if (msg) {
        const uId = sessionStorage.getItem('user_id');
        const pId = sessionStorage.getItem('pool_id');
        const { error } = await supabaseClient.from('turn_swap_requests').insert([{ sender_id: uId, pool_id: pId, message: msg }]);
        if (error) {
            console.error('❌ خطا در ثبت درخواست تعویض نوبت:', error);
            return Swal.fire({ text: 'ثبت درخواست ناموفق بود، دوباره تلاش کنید ❌', icon: 'error' });
        }
        Swal.fire({ text: 'فراخوان شما در بخش نظرسنجی منتشر شد.', icon: 'success' });
    }
};

/************************************************
 * تابع تایید جابجایی نوبت (نسخه نفوذناپذیر RPC)
 ************************************************/
window.acceptSwap = async function(btn) {
    const requestId = btn.dataset.reqId;
    const requesterId = btn.dataset.senderId;
    const requesterName = btn.dataset.senderName;
    const myId = sessionStorage.getItem('user_id');
    const pId = sessionStorage.getItem('pool_id');

    // ۱. پیش‌نمایش نوبت فعلی هر دو طرف، قبل از نمایش تاییدیه
    Swal.fire({ title: 'در حال محاسبه‌ی نوبت‌ها...', didOpen: () => Swal.showLoading() });
    const queue = await getQueueRanking(pId);
    const myRank = getRankOf(queue, myId);
    const theirRank = getRankOf(queue, requesterId);
    const rankLabel = (r) => r ? `نفر ${r}` : 'خارج از صف';

    const result = await Swal.fire({
        title: 'تایید جابجایی نوبت؟',
        html: `
            <div style="background:#f8fafc;border-radius:20px;padding:14px;margin-bottom:10px;display:flex;align-items:center;justify-content:center;gap:10px;font-weight:900;font-size:13px;">
                <span style="color:#e11d48;">${rankLabel(myRank)}</span>
                <i class="fas fa-arrow-left" style="color:#94a3b8;font-size:11px;"></i>
                <span style="color:#10b981;">${rankLabel(theirRank)}</span>
            </div>
            <p style="font-size:12px;">با این کار نوبت شما با <b>${requesterName}</b> عوض شده و ۵ امتیاز هدیه می‌گیرید. 🤝</p>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'بله، نوبتم را می‌دهم',
        confirmButtonColor: '#10b981',
        cancelButtonText: 'انصراف',
        customClass: { popup: 'rounded-[3rem]' }
    });

    if (result.isConfirmed) {
        try {
            Swal.fire({ title: 'در حال جابجایی نوبت‌ها...', didOpen: () => Swal.showLoading() });

            // شلیک به تابع دیتابیس برای انجام جابجایی 👇
            const { error } = await supabaseClient.rpc('process_turn_swap', {
                req_id: requestId,
                acceptor_uid: myId
            });

            if (error) throw error;

            await Swal.fire({
                title: 'نوبت‌ها جابجا شد! 🤝',
                text: 'پاداش فداکاری (۵ امتیاز) به حساب شما واریز گردید.',
                icon: 'success',
                confirmButtonColor: '#10b981',
                customClass: { popup: 'rounded-[2.5rem]' }
            });

            location.reload();

        } catch (e) {
            console.error(e);
            Swal.fire({ title: 'خطا در عملیات', text: "متاسفانه جابجایی انجام نشد. دوباره تلاش کنید.", icon: 'error' });
        }
    }
};



/************************************************
 * تابع لود جابجایی نوبت در تب وام
 ************************************************/
window.loadTurnSwapsInLoans = async function(userId, poolId) {
    const container = document.getElementById('turn-swap-list');
    if (!container) return;

    try {
        const { data: swaps, error } = await supabaseClient.from('turn_swap_requests')
            .select('*, members!fk_sender(full_name)')
            .eq('pool_id', poolId)
            .eq('status', 'pending');

        if (error) console.error('❌ خطا در دریافت درخواست‌های تعویض نوبت:', error);

        if (!swaps || swaps.length === 0) {
            container.innerHTML = '<p class="text-center py-5 text-slate-400 text-[9px]">درخواست جابجایی فعالی نیست.</p>';
            return;
        }

        container.innerHTML = swaps.map(s => {
            if (String(s.sender_id) === String(userId)) return ''; // درخواست خودش را نبیند

            return `
            <div class="feed-card swap-item animate__animated animate__fadeIn">
                <div class="card-tag">تعویض نوبت</div>
                <h5 class="text-[11px] font-[900] text-indigo-300 text-right mt-2">${s.members.full_name}</h5>
                <p class="text-[10px] text-slate-300 mt-2 text-right leading-relaxed italic">"${s.message}"</p>
                <button data-req-id="${s.id}" data-sender-id="${s.sender_id}" data-sender-name="${s.members.full_name}" onclick="acceptSwap(this)" class="w-full mt-4 bg-emerald-600 text-white py-4 rounded-[1.5rem] font-black text-[10px] shadow-lg">
                    🤝 قبول جابجایی (+۵ امتیاز)
                </button>
            </div>`;
        }).join('');
    } catch (e) { console.error(e); }
};

// تابع کمکی برای باز و بسته شدن متن‌های طولانی
window.toggleCard = function(el, isLong) {
    if (!isLong) return;
    const text = el.querySelector('.card-text');
    const btn = el.querySelector('.more-btn');
    if (el.classList.contains('expanded')) {
        el.classList.remove('expanded');
        if(text) text.classList.add('text-truncate');
        if(btn) btn.innerText = "ادامه متن...";
    } else {
        el.classList.add('expanded');
        if(text) text.classList.remove('text-truncate');
        if(btn) btn.innerText = "بستن متن";
        if(window.navigator.vibrate) window.navigator.vibrate(10);
    }
};



/************************************************
 * تابع جابجایی تب‌ها (نسخه ضد سفید شدن صفحه)
 ************************************************/
window.showSec = async function(btn, id) {
    const sections = ['home-sec', 'comm-sec', 'trans-sec', 'loan-sec'];
    sections.forEach(s => document.getElementById(s)?.classList.add('hidden'));

    const target = document.getElementById(id);
    if (target) target.classList.remove('hidden');

    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    if (btn) btn.classList.add('active');

    // ۱. بازیابی فوق‌هوشمند آیدی‌ها 👇
    let pId = sessionStorage.getItem('pool_id');
    let uId = sessionStorage.getItem('user_id');

    // اگر آیدی‌ها به هر دلیلی null بودند (دلیل ارور شما)
    if (!pId || pId === "null") {
        console.log("⚠️ آیدی مفقود شده، در حال بازیابی اضطراری...");
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            const { data: prof } = await supabaseClient.from('members').select('pool_id').eq('id', session.user.id).single();
            if (prof) {
                pId = prof.pool_id;
                sessionStorage.setItem('pool_id', pId);
            }
        }
    }

    // ۲. شلیک لودرها
    if (id === 'comm-sec') loadUnifiedComm(pId);
    if (id === 'trans-sec') loadMyTransactions(uId, pId);
    if (id === 'loan-sec') { loadActiveLoans(uId, pId); loadTurnSwapsInLoans(uId, pId); }
    if (id === 'home-sec') loadUserQueuePosition(uId, pId);
};

/************************************************
 * تابع لود اخبار و نظرسنجی (نسخه ضدِ گیر)
 ************************************************/
window.loadUnifiedComm = async function(poolId) {
    const container = document.getElementById('unified-comm-list');
    if (!container) return;

    const uId = sessionStorage.getItem('user_id');
    const pId = poolId || sessionStorage.getItem('pool_id');
    const cleanId = Number(pId);

    container.innerHTML = '<p class="text-center py-20 text-slate-400 text-[10px] animate-pulse">📡 در حال به روزرسانی تابلو...</p>';

    try {
        // ۱. دریافت اطلاعات (اخبار + نظرسنجی‌ها + آرای من)
        const [newsRes, pollsRes, votesRes] = await Promise.all([
            supabaseClient.from('admin_news').select('*').eq('pool_id', cleanId),
            supabaseClient.from('admin_polls').select('*').eq('pool_id', cleanId),
            supabaseClient.from('poll_votes').select('*').eq('member_id', uId)
        ]);

        let stream = [];
        if (newsRes.data) newsRes.data.forEach(n => stream.push({ ...n, sType: 'news' }));
        if (pollsRes.data) pollsRes.data.forEach(p => stream.push({ ...p, sType: 'poll' }));

        if (stream.length === 0) {
            container.innerHTML = '<div class="text-center py-20 opacity-30"><i class="fas fa-ghost text-4xl mb-2"></i><p class="text-[10px]">اعلانیه ای یافت نشد</p></div>';
            return;
        }

        stream.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // ۲. رندر کردن کارت‌ها
        container.innerHTML = stream.map(item => {
            const isNews = item.sType === 'news';
            const content = isNews ? item.message : item.question;
            const isLong = content.length > 120;
            const myVote = votesRes.data ? votesRes.data.find(v => v.poll_id === item.id) : null;

            if (isNews) {
                return `
                <div onclick="toggleCard(this, ${isLong})" class="feed-card news-item animate__animated animate__fadeIn">
                    <div class="card-tag">اطلاعیه</div>
                    <p class="card-text text-[11px] font-bold text-right text-slate-200 ${isLong ? 'text-truncate' : ''}">${content}</p>
                    ${isLong ? `<p class="more-btn text-[8px] text-amber-500 mt-2 font-black italic">بیشتر بخوانید...</p>` : ''}
                </div>`;
            } else {
                // اگر نظرسنجی بود 👇
                return `
                <div onclick="toggleCard(this, ${isLong})" class="feed-card poll-item animate__animated animate__fadeIn">
                    <div class="card-tag">نظرسنجی</div>
                    <h5 class="card-text text-[11px] font-[900] text-right text-white ${isLong ? 'text-truncate' : ''}">${content}</h5>
                    
                    <div class="mt-4 pt-4 border-t border-white/5">
                        ${!myVote ? `
                            <!-- اگر هنوز رای نداده باشد، دکمه‌ها را نشان بده 👇 -->
                            <div class="grid grid-cols-2 gap-3">
                                <button onclick="event.stopPropagation(); submitPollVote(${item.id}, 'yes')" class="bg-emerald-500 text-white py-2.5 rounded-2xl font-black text-[10px] active:scale-95 shadow-lg">موافقم ✅</button>
                                <button onclick="event.stopPropagation(); submitPollVote(${item.id}, 'no')" class="bg-rose-500 text-white py-2.5 rounded-2xl font-black text-[10px] active:scale-95 shadow-lg">مخالفم ❌</button>
                            </div>
                        ` : `
                            <!-- اگر رای داده باشد، پیام تایید نشان بده 👇 -->
                            <div class="text-center">
                                <p class="text-emerald-400 text-[9px] font-black italic">رای شما با موفقیت ثبت شده است ✅</p>
                                <p class="text-[7px] text-slate-500 mt-1 uppercase font-bold">Thank you for participating</p>
                            </div>
                        `}
                    </div>
                </div>`;
            }
        }).join('');

    } catch (e) { console.error(e); }
};

/************************************************
 * تابع ثبت رای نظرسنجی (مطمئن شو این هم در app.js باشد)
 ************************************************/
window.submitPollVote = async function(pollId, type) {
    const userId = sessionStorage.getItem('user_id');
    const pId = sessionStorage.getItem('pool_id');

    Swal.fire({ title: 'در حال ثبت نظر...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const { error } = await supabaseClient
            .from('poll_votes')
            .insert([{ poll_id: pollId, member_id: userId, vote_type: type }]);

        if (error) throw error;

        await Swal.fire({ title: 'رای شما ثبت شد ✅', icon: 'success', timer: 1500, showConfirmButton: false });
        
        // رفرش آنی بخش ارتباطات برای نمایش وضعیت جدید
        loadUnifiedComm(pId);

    } catch (e) {
        Swal.fire({ text: "خطا: قبلاً رای داده‌اید یا مشکلی پیش آمده است.", icon: 'error' });
    }
};

// ۱. بررسی اخطار بدهی و تغییر شکل دکمه منو 👇
async function checkDebtWarning(userId) {
    const btn = document.getElementById('main-action-btn'); // دایره وسط منو
    const icon = document.getElementById('main-action-icon');
    const warningArea = document.getElementById('drawer-warning-area');
    const warningText = document.getElementById('drawer-warning-text');

    if (!userId) return;

    try {
        const { data: member } = await supabaseClient
            .from('members')
            .select('full_name, debt_warning_msg')
            .eq('id', userId)
            .single();

        if (member && member.debt_warning_msg && member.debt_warning_msg.trim() !== "") {
            // الف) قرمز کردن دکمه وسط منو (پالس زدن) ✅
            if (btn) btn.classList.add('warning-pulse');
            if (icon) icon.className = "fas fa-exclamation-triangle";

            // ب) نمایش و پر کردن متن داخل پاپ‌آپ واریز ✅
            if (warningArea && warningText) {
                warningArea.classList.remove('hidden'); // حذف مخفی بودن
                warningArea.classList.add('animate__animated', 'animate__headShake');
                warningText.innerHTML = `<span class="text-rose-600 font-black">${member.full_name} عزیز؛</span> ${member.debt_warning_msg}`;
            }
            console.log("⚠️ اخطار مدیریت فعال شد.");
        } else {
            // اگر پیامی نبود، همه‌چیز به حالت عادی برگردد
            if (btn) btn.classList.remove('warning-pulse');
            if (icon) icon.className = "fas fa-plus";
            if (warningArea) warningArea.classList.add('hidden');
        }
    } catch (e) {
        console.error("Warning logic failed:", e);
    }
}

// ==================================================
// سیستم انتخاب نوع پرداخت (وام ماهانه / مساعده / مساعده سکه‌ای / خیریه)
// ==================================================
let selectedPaymentCategory = null;
let paymentModalCache = null; // کش تنظیمات و بدهی‌ها در هر بار باز شدن کشو

// محاسبه‌ی همه‌ی مانده‌بدهی‌های عضو (وام نوبتی، مساعده، مساعده‌سکه‌ای) + سود کل تجمعی
async function getMemberDebtSummary(userId, poolId) {
    const [{ data: txs }, { data: profitTxs }] = await Promise.all([
        supabaseClient
            .from('transactions')
            .select('amount, type, category')
            .eq('member_id', userId)
            .eq('pool_id', poolId)
            .eq('status', 'approved')
            .in('category', ['monthly', 'loan_repayment', 'emergency', 'coin_assistance']),
        supabaseClient
            .from('transactions')
            .select('amount')
            .eq('member_id', userId)
            .eq('pool_id', poolId)
            .eq('status', 'approved')
            .eq('receipt_url', 'سود پروژه')
    ]);

    const sumBy = (type, cat) => (txs || [])
        .filter(t => t.type === type && t.category === cat)
        .reduce((s, t) => s + Number(t.amount || 0), 0);

    return {
        monthlyLoanDebt: Math.max(0, sumBy('out', 'monthly') - sumBy('in', 'loan_repayment')), // مانده‌ی وام نوبتی = دریافتی منهای «بازپرداخت وام» (قسط ثابت بدهی را کم نمی‌کند)
        emergency: Math.max(0, sumBy('out', 'emergency') - sumBy('in', 'emergency')),
        coin_assistance: Math.max(0, sumBy('out', 'coin_assistance') - sumBy('in', 'coin_assistance')),
        totalProfit: (profitTxs || []).reduce((s, t) => s + Number(t.amount || 0), 0)
    };
}

// نمایش خلاصه‌ی بدهی‌ها روی کارت اصلی (هم نشانِ رو کارت، هم ردیف‌های پشت کارت)
async function loadDebtSummaryCard(userId, poolId) {
    const debts = await getMemberDebtSummary(userId, poolId);
    const totalDebt = debts.monthlyLoanDebt + debts.emergency + debts.coin_assistance;

    // نشان مجموع بدهی روی خودِ کارت (بدون نیاز به کلیک دیده میشه) 👇
    const badge = document.getElementById('front-debt-badge');
    if (badge) {
        badge.classList.remove('hidden');
        if (totalDebt > 0) {
            badge.className = 'debt-badge';
            badge.innerHTML = `<i class="fas fa-triangle-exclamation"></i> مجموع بدهی: ${totalDebt.toLocaleString()} ت`;
        } else {
            badge.className = 'debt-badge clear';
            badge.innerHTML = `<i class="fas fa-check-circle"></i> بدون بدهی`;
        }
    }

    // ردیف‌های پشت کارت
    const rowsEl = document.getElementById('debt-summary-rows');
    if (rowsEl) {
        const rows = [
            { icon: 'fa-calendar-check', label: 'مانده وام نوبتی', value: debts.monthlyLoanDebt },
            { icon: 'fa-hand-holding-dollar', label: 'مانده مساعده', value: debts.emergency },
            { icon: 'fa-coins', label: 'مانده مساعده سکه‌ای', value: debts.coin_assistance }
        ];
        rowsEl.innerHTML = rows.map(r => `
            <div class="debt-row">
                <span class="debt-row-label"><i class="fas ${r.icon}"></i> ${r.label}</span>
                <span class="debt-row-value">${r.value > 0 ? r.value.toLocaleString() + ' ت' : 'صفر'}</span>
            </div>`).join('') + `
            <div class="debt-row" style="background:rgba(52,211,153,.12);border-color:rgba(52,211,153,.22);">
                <span class="debt-row-label"><i class="fas fa-chart-line"></i> سود پروژه (تجمعی)</span>
                <span class="debt-row-value" style="color:#6ee7b7;">${debts.totalProfit.toLocaleString()} ت</span>
            </div>`;
    }
}

// چرخوندن کارت موجودی/بدهی با کلیک
window.toggleBalanceCardFlip = function() {
    document.getElementById('balance-flip-inner')?.classList.toggle('flipped');
    if (window.navigator.vibrate) window.navigator.vibrate(15);
};

// محاسبه‌ی میزان سکه‌ای که «امروز» با پرداخت به این عضو تعلق می‌گیره (همون فرمول تایید فیش در پنل مدیر)
// محاسبه‌ی سکه بر اساس سررسید (برای مساعده و مساعده‌سکه‌ای) — دقیقاً هم‌فرمول با پنل مدیر
function calculateCoinChangeByDueDate(dueDateStr, coinPerDay, coinWindowDays) {
    const perDay = Number(coinPerDay) || 2;
    const winDays = Number(coinWindowDays) || 10;
    const peak = perDay * winDays;

    if (!dueDateStr) return { rawChange: 0, peak, perDay };

    const today = new Date();
    const dueDate = new Date(dueDateStr);
    const daysBeforeDue = Math.round((dueDate - today) / 86400000); // مثبت = زودتر، منفی = معوقه

    const rawChange = daysBeforeDue >= winDays ? peak : perDay * daysBeforeDue;
    return { rawChange, peak, perDay };
}

function calculateTodayCoinChange(coinPerDay, coinWindowDays) {
    const perDay = Number(coinPerDay) || 2;
    const winDays = Number(coinWindowDays) || 10;
    const half = Math.floor(winDays / 2);
    const peak = perDay * winDays;

    const offset = jalaliCoinOffset(new Date()); // نزدیک‌ترین یکم ماه «شمسی»

    const rawChange = offset <= -half ? peak : (peak - perDay * (offset + half));
    return { rawChange, peak, perDay };
}

// ساخت پیام انگیزشی سکه بر اساس محاسبه‌ی بالا
function buildCoinPreviewMessage({ rawChange, peak, perDay }) {
    if (rawChange >= peak) {
        return { html: `🎉 اگه امروز پرداخت کنی <b>${peak}</b> سکه می‌گیری!`, cls: 'bg-emerald-50 text-emerald-700' };
    }
    if (rawChange > perDay) {
        return { html: `⏳ اگه امروز پرداخت کنی <b>${rawChange}</b> سکه می‌گیری، ولی داره کم میشه — دیر نکن!`, cls: 'bg-amber-50 text-amber-700' };
    }
    if (rawChange > 0) {
        return { html: `⚠️ اگه امروز پرداخت کنی فقط <b>${rawChange}</b> سکه می‌گیری. امروز آخرین روز شانس دریافت سکه‌ست!`, cls: 'bg-rose-50 text-rose-700' };
    }
    return { html: `🔻 دیگه دیر شده! اگه الان پرداخت کنی <b>${Math.abs(rawChange)}</b> سکه از سکه‌های فعلیت کم میشه.`, cls: 'bg-rose-100 text-rose-800' };
}

// ۱. باز کردن کشو: نمایش مرحله‌ی «قصد انجام چه کاری دارید؟»
// باز کردن کشوی پرداخت و محاسبه هوشمند مبلغ قابل پرداخت
window.openDepositDrawer = async function() {
    const drawer = document.getElementById('deposit-drawer');
    if (!drawer) return;

    drawer.classList.remove('hidden');
    if (window.navigator.vibrate) window.navigator.vibrate(20);

    document.getElementById('drawer-step-1')?.classList.remove('hidden');
    document.getElementById('drawer-step-2')?.classList.add('hidden');
    selectedPaymentCategory = null;

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) return;
        const userId = session.user.id;
        const poolId = sessionStorage.getItem('pool_id');

        // دریافت اطلاعات کاربر (تعداد سهام) و تنظیمات صندوق
        const [{ data: user }, { data: settings }, debts, { data: mData }, payStatus] = await Promise.all([
            supabaseClient.from('members').select('total_shares').eq('id', userId).single(),
            supabaseClient.from('settings').select('base_amount, won_amount, coin_per_day, coin_window_days, coin_charity_rate').eq('pool_id', poolId).maybeSingle(),
            getMemberDebtSummary(userId, poolId),
            supabaseClient.from('members').select('emergency_due_date, coin_assistance_due_date').eq('id', userId).maybeSingle(),
            getMonthPaymentStatus(userId, poolId)
        ]);

        const totalShares = Number(user?.total_shares) || 1;
        const basePrice = (Number(settings?.base_amount) || 0) * totalShares; // مبلغ ثابت بر اساس تعداد سهم
        const wonPrice = Number(settings?.won_amount) || 0;                   // سقف قسط بازپرداخت
        const loanDebt = Number(debts.monthlyLoanDebt) || 0;                  // مانده کل بدهی وام

        // محاسبه داینامیک سهم بازپرداخت وام (تا سقف wonPrice یا به اندازه مانده بدهی)
        let autoRepayPortion = 0;
        if (loanDebt > 0 && wonPrice > 0) {
            autoRepayPortion = Math.min(wonPrice, loanDebt);
        }

        // کل مبلغی که باید این ماه واریز کند (ثابت + بازپرداخت وام)
        const totalMonthlyDue = basePrice + autoRepayPortion;

        // نمایش در مرحله ۱ روی دکمه «وام ماهانه»
        const monthlyEl = document.getElementById('pay-amount-monthly');
        if (monthlyEl) monthlyEl.innerText = totalMonthlyDue.toLocaleString() + ' ت';

        // زیرنویس مانده کل وام
        const totalMonthlyEl = document.getElementById('pay-total-monthly');
        if (totalMonthlyEl) {
            if (loanDebt > 0) {
                totalMonthlyEl.innerText = `مانده کل وام: ${loanDebt.toLocaleString()} ت`;
                totalMonthlyEl.classList.remove('hidden');
            } else {
                totalMonthlyEl.classList.add('hidden');
            }
        }

        // وضعیت پرداخت این ماه (شمسی) روی دکمه‌ی «وام ماهانه»
        const chipEl = document.getElementById('pay-status-monthly');
        if (chipEl) {
            const chip = (label, st) => {
                if (st.state === 'approved') return `<span class="inline-block bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-lg">${label}: ✓ پرداخت شده</span>`;
                if (st.state === 'pending') return `<span class="inline-block bg-amber-100 text-amber-700 px-2 py-0.5 rounded-lg">${label}: ⏳ در انتظار تایید</span>`;
                return `<span class="inline-block bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg">${label}: پرداخت نشده</span>`;
            };
            let chips = chip('قسط ماهانه', payStatus.monthly);
            if (loanDebt > 0 || payStatus.loan.state !== 'none') chips += ' ' + chip('قسط وام', payStatus.loan);
            chipEl.innerHTML = chips;
        }

        // مساعده و مساعده سکه‌ای
        const emergencyBtn = document.getElementById('pay-option-emergency');
        const coinAssistBtn = document.getElementById('pay-option-coin_assistance');

        if (debts.emergency > 0) {
            document.getElementById('pay-amount-emergency').innerText = debts.emergency.toLocaleString() + ' ت';
            emergencyBtn?.classList.remove('hidden');
        } else {
            emergencyBtn?.classList.add('hidden');
        }

        if (debts.coin_assistance > 0) {
            document.getElementById('pay-amount-coin_assistance').innerText = debts.coin_assistance.toLocaleString() + ' ت';
            coinAssistBtn?.classList.remove('hidden');
        } else {
            coinAssistBtn?.classList.add('hidden');
        }

        // ذخیره کش با تمام محاسبات انجام شده
        paymentModalCache = {
            totalMonthlyDue: totalMonthlyDue,
            payStatus: payStatus,
            basePrice: basePrice,
            autoRepayPortion: autoRepayPortion,
            monthlyLoanDebt: loanDebt,
            emergencyDebt: debts.emergency,
            coinAssistDebt: debts.coin_assistance,
            emergencyDueDate: mData?.emergency_due_date || null,
            coinAssistDueDate: mData?.coin_assistance_due_date || null,
            coinPerDay: settings?.coin_per_day ?? 2,
            coinWindowDays: settings?.coin_window_days ?? 10,
            coinCharityRate: settings?.coin_charity_rate ?? 10000
        };

    } catch (e) {
        console.error('خطا در آماده‌سازی کشوی پرداخت:', e);
    }
};

// انتخاب دسته‌ی پرداخت و تفکیک خودکار قسط پایه و بازپرداخت وام
// رفتن به فرم پرداخت با تفکیک خودکار و هوشمند مبالغ
window.selectPaymentCategory = function(category) {
    if (!paymentModalCache) return;
    selectedPaymentCategory = category;

    document.getElementById('drawer-step-1')?.classList.add('hidden');
    document.getElementById('drawer-step-2')?.classList.remove('hidden');

    const titleEl = document.getElementById('drawer-step-2-title');
    const labelEl = document.getElementById('receipt-amount-label');
    const amountInput = document.getElementById('receipt-amount-input');
    const repayInput = document.getElementById('loan-repay-input');
    const repayWrap = document.getElementById('loan-repay-wrap');
    const coinMsgEl = document.getElementById('coin-preview-msg');

    const labels = {
        monthly: 'قسط ماهانه و بازپرداخت وام',
        emergency: 'مساعده',
        coin_assistance: 'مساعده تبدیل سکه',
        charity: 'کمک به خیریه'
    };
    if (titleEl) titleEl.innerText = 'پرداخت: ' + (labels[category] || '');

    // تغییر نام لیبل اینپوت اول متناسب با کار
    if (labelEl) {
        if (category === 'monthly') labelEl.innerText = 'مبلغ ثابت ماهانه (سپرده شما)';
        else if (category === 'emergency') labelEl.innerText = 'مبلغ بازپرداخت مساعده';
        else if (category === 'coin_assistance') labelEl.innerText = 'مبلغ بازپرداخت مساعده سکه‌ای';
        else if (category === 'charity') labelEl.innerText = 'مبلغ کمک داوطلبانه به خیریه';
    }

    const monthlyNote = document.getElementById('monthly-paid-note');
    const loanNote = document.getElementById('loan-paid-note');
    if (monthlyNote) { monthlyNote.classList.add('hidden'); monthlyNote.innerHTML = ''; }
    if (loanNote) { loanNote.classList.add('hidden'); loanNote.innerHTML = ''; }
    amountInput.placeholder = 'مبلغ به تومان';

    if (category === 'monthly') {
        const basePortion = paymentModalCache.basePrice;
        const repayPortion = paymentModalCache.autoRepayPortion;
        const loanDebt = paymentModalCache.monthlyLoanDebt;
        const ps = paymentModalCache.payStatus || { monthly: { state: 'none' }, loan: { state: 'none' } };

        const noteHtml = (st, paidTxt, pendTxt) => st.state === 'approved'
            ? `<div class="bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl p-2.5 text-[9px] font-black leading-relaxed">✅ ${paidTxt.replace('{d}', formatJalaliDate(st.date)).replace('{a}', Number(st.amount).toLocaleString())}</div>`
            : `<div class="bg-amber-50 border border-amber-100 text-amber-700 rounded-xl p-2.5 text-[9px] font-black leading-relaxed">⏳ ${pendTxt.replace('{d}', formatJalaliDate(st.date)).replace('{a}', Number(st.amount).toLocaleString())}</div>`;

        // قسط ثابت: اگه این ماه پرداخت شده، خالی می‌مونه (پر نمیشه) تا ناخواسته دوباره پرداخت نشه
        if (ps.monthly.state !== 'none' && monthlyNote) {
            monthlyNote.innerHTML = noteHtml(ps.monthly,
                'شما در تاریخ {d} واریزی ثابت ماه جاری ({a} ت) را پرداخت کرده‌اید.',
                'فیش واریزی ثابت ماه جاری شما در تاریخ {d} ({a} ت) ثبت شده و هنوز در انتظار تایید مدیر است.');
            monthlyNote.classList.remove('hidden');
            amountInput.value = '';
        } else {
            amountInput.value = basePortion || '';
        }

        // قسط وام نوبتی: هر وقت بدهی داره نمایش داده می‌شه؛ خالی/صفر = پرداخت نمی‌کنم
        if (loanDebt > 0) {
            repayWrap.classList.remove('hidden');
            const hintEl = document.getElementById('loan-repay-hint');
            if (hintEl) hintEl.innerText = `کسر از اصل وام (مانده: ${loanDebt.toLocaleString()} ت)`;
            if (ps.loan.state !== 'none' && loanNote) {
                loanNote.innerHTML = noteHtml(ps.loan,
                    'شما قسط وام ماه جاری را در تاریخ {d} ({a} ت) پرداخت کرده‌اید.',
                    'فیش قسط وام ماه جاری شما در تاریخ {d} ({a} ت) ثبت شده و هنوز در انتظار تایید مدیر است.');
                loanNote.classList.remove('hidden');
                repayInput.value = '';
            } else {
                repayInput.value = repayPortion > 0 ? repayPortion : '';
            }
            amountInput.placeholder = 'مبلغ به تومان — خالی = پرداخت نمی‌کنم';
        } else {
            repayInput.value = '';
            repayWrap.classList.add('hidden');
        }
    } else {
        repayWrap.classList.add('hidden');
        if (category === 'emergency') amountInput.value = paymentModalCache.emergencyDebt || '';
        else if (category === 'coin_assistance') amountInput.value = paymentModalCache.coinAssistDebt || '';
        else amountInput.value = '';
    }

    // مدیریت دقیق پیام سکه
    if (coinMsgEl) {
        if (category === 'charity') {
            // پاداش سکه خیریه بر اساس نرخ تنظیم‌شده در پنل مدیر
            const rate = Number(paymentModalCache.coinCharityRate) || 10000;
            coinMsgEl.className = 'mb-4 p-3.5 rounded-2xl text-[10px] font-black leading-relaxed text-center bg-emerald-50 text-emerald-800 border border-emerald-100';
            coinMsgEl.innerHTML = `🎗️ دست خیر شما پربرکت باد: به ازای هر <b>${rate.toLocaleString()} تومان</b> کمک، ۱ سکه پاداش بگیرید.`;
            coinMsgEl.classList.remove('hidden');
        } else {
            const calc = (category === 'emergency' || category === 'coin_assistance')
                ? calculateCoinChangeByDueDate(paymentModalCache.emergencyDueDate, paymentModalCache.coinPerDay, paymentModalCache.coinWindowDays)
                : calculateTodayCoinChange(paymentModalCache.coinPerDay, paymentModalCache.coinWindowDays);
            const msg = buildCoinPreviewMessage(calc);
            coinMsgEl.className = 'mb-4 p-3.5 rounded-2xl text-[10px] font-black leading-relaxed text-center ' + msg.cls;
            coinMsgEl.innerHTML = msg.html;
            coinMsgEl.classList.remove('hidden');
        }
    }
};

// ۳. بازگشت از فرم پرداخت به مرحله‌ی انتخاب دسته
window.backToPaymentCategories = function() {
    document.getElementById('drawer-step-2')?.classList.add('hidden');
    document.getElementById('drawer-step-1')?.classList.remove('hidden');
    selectedPaymentCategory = null;
};

// ۴. بستن کامل کشوی واریز وجه
window.closeDepositDrawer = function() {
    const drawer = document.getElementById('deposit-drawer');
    if (drawer) {
        drawer.classList.add('hidden');
        // برگردوندن به مرحله‌ی اول برای دفعه‌ی بعد
        document.getElementById('drawer-step-1')?.classList.remove('hidden');
        document.getElementById('drawer-step-2')?.classList.add('hidden');
        selectedPaymentCategory = null;
        console.log("کشوی پرداخت بسته شد.");
    }
};





