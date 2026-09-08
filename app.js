/* ==================================================
   E.BANK MEMBER - INITIALIZATION (v11.6)
   ================================================== */

// ۱. تعریف ثابت‌های اتصال (نام‌ها هماهنگ شد) ✅
const S_URL = 'https://kqnsbnpznkwkwukzokik.supabase.co';
const S_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxbnNibnB6bmt3a3d1a3pva2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1NDc4NjgsImV4cCI6MjA4MjEyMzg2OH0.dsqyFP37JyrfYDVwasNZW_Aid9ah0e6SxdnS8j8xV5s';

// ۲. ساخت کلاینت سوپابیس (با تنظیمات پایداری نشست) ✅
// این تنظیمات را در تمام فایل‌ها جایگزین supabaseClient قبلی کن 👇
const supabaseClient = supabase.createClient(S_URL, S_KEY, {
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

// ۳. مدیریت شروع برنامه با نشست امن JWT
document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 شروع بیدارباش هوشمند پنل اعضا...");
    
    // ۱. تابع کمکی برای حذف اسپلش اسکرین و باز کردن اسکرول
    const clearSplash = () => {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => {
                if(splash) splash.remove();
                document.body.classList.remove('loading');
                document.body.style.overflow = 'auto';
            }, 700);
        }
    };

    try {
        // ۲. بررسی نشست امن (JWT)
        const { data: { session }, error: sErr } = await supabaseClient.auth.getSession();
        if (sErr || !session) { 
            window.location.replace('index.html'); 
            return; 
        }

        const userId = session.user.id;
        let myPoolId = sessionStorage.getItem('pool_id');

        // ۳. بازیابی هوشمند pool_id (اگر گم شده باشد) 👇
        if (!myPoolId || myPoolId === "null") {
            console.log("⚠️ آیدی صندوق یافت نشد، در حال استعلام از سرور...");
            const { data: userMember } = await supabaseClient.from('members').select('pool_id, full_name').eq('id', userId).single();
            if (userMember) {
                myPoolId = userMember.pool_id;
                sessionStorage.setItem('pool_id', myPoolId);
                sessionStorage.setItem('user_name', userMember.full_name);
            } else {
                window.location.replace('index.html');
                return;
            }
        }

        // ۴. نمایش نام کاربر در هدر
        const userName = sessionStorage.getItem('user_name');
        const nameDisplay = document.getElementById('user-name-display');
        if (nameDisplay) nameDisplay.innerText = userName || "کاربر گرامی";

        // ۵. استعلام و نمایش عکس پروفایل واقعی
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

        // ۶. شلیک تمام لودرهای اطلاعات (یکپارچه و بدون تکرار) 🎯
        console.log("📦 در حال فراخوانی داده‌های مالی و خبری...");
        
        loadUserFinancials(userId, myPoolId);
        calculateMyTotalDeposits(userId, myPoolId);
        calculateUserTotalProfit(userId, myPoolId);
        loadMyTransactions(userId, myPoolId);
        loadManagerCard(myPoolId);
        loadActiveLoans(userId, myPoolId);
        loadUserQueuePosition(userId, myPoolId); // نمایش نوبت
        loadMemberNews(myPoolId);               // لود اخبار (فقط یک‌بار)
        loadActivePoll(userId, myPoolId);       // لود نظرسنجی
        
        checkDebtWarning(userId);


    } catch (err) {
        console.error("Critical Init Error:", err);
    } finally {
        // ۷. حذف اسپلش اسکرین در هر صورت (چه ارور باشد چه نه)
        setTimeout(clearSplash, 2000);
    }
});




    // ۳. صدا زدن تابع اخطار بدهی 👇
    
/************************************************
 * ۳. محاسبات مالی هوشمند
 ************************************************/
async function loadUserFinancials(userId, poolId) {
    try {
        // ۱. دریافت مبالغ تنظیم شده از دیتابیس
        const { data: settings } = await supabaseClient.from('settings').select('*').eq('pool_id', poolId).maybeSingle();
        const basePrice = settings ? Number(settings.base_amount) : 2000000;
        const wonPrice = settings ? Number(settings.won_amount) : 2500000;

        // ۲. دریافت اطلاعات عضو
        const { data: user } = await supabaseClient.from('members').select('*').eq('id', userId).single();
        
        if (user) {
            const won = user.won_shares || 0;
            const active = (user.total_shares || 1) - won;
            
            // محاسبه مبلغ قسط این ماه
            const monthlyDue = (won * wonPrice) + (active * basePrice);

            // نمایش مبلغ قسط در کارت سفید پایین 👇
            document.getElementById('amount-display').innerText = monthlyDue.toLocaleString() + ' تومان';
            
            // نمایش وضعیت سهم‌ها
            document.getElementById('status-badge').innerText = `وضعیت: ${user.total_shares} سهم (${won} برنده)`;
        }
    } catch (e) { 
        console.error("خطا در لود مالی:", e); 
    }
}   
async function calculateMyTotalDeposits(userId, poolId) {
    const { data } = await supabaseClient.from('transactions').select('amount').eq('member_id', userId).eq('pool_id', poolId).eq('status', 'approved').eq('type', 'in');
    const total = data ? data.reduce((s, i) => s + Number(i.amount), 0) : 0;
    const el = document.getElementById('user-total-balance');
    if (el) el.innerText = total.toLocaleString() + ' تومان';
}

async function calculateUserTotalProfit(userId, poolId) {
    const { data } = await supabaseClient.from('transactions').select('amount').eq('member_id', userId).eq('pool_id', poolId).eq('status', 'approved').eq('receipt_url', 'سود پروژه');
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
async function notifyManager(title, message, poolId) {
    const APP_ID = "6235857d-565c-4223-bffa-af420f2cd45b"; 
    const API_KEY = "os_v2_app_mi2yk7kwlrbchp72v5ba6lgulm3yudga3sbeet5dt2feqhyer27faufsiea2acnuio5vcmebonhdyyw5vqqo6zfqc3i3gnyw6";
    try {
        await fetch("https://onesignal.com/api/v1/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Basic " + API_KEY },
            body: JSON.stringify({
                app_id: APP_ID,
                filters: [{ "field": "tag", "key": "role", "relation": "=", "value": "admin" }, { "operator": "AND" }, { "field": "tag", "key": "pool_id", "relation": "=", "value": String(poolId) }],
                headings: { "fa": title }, contents: { "fa": message }
            })
        });
    } catch (e) { console.error(e); }
}

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



async function checkMonthlyReminder(userId, poolId) {
    const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const { data } = await supabaseClient.from('transactions').select('*').eq('member_id', userId).eq('pool_id', poolId).eq('status', 'approved').eq('type', 'in').gte('created_at', firstDay);
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

    // ۱. اعتبارسنجی ورودی‌ها (Validation)
    if (!amount || Number(amount) <= 0) {
        return Swal.fire({ text: "لطفاً مبلغ واریزی را به عدد وارد کنید ❌", icon: 'warning' });
    }
    if (!file) {
        return Swal.fire({ text: "لطفاً تصویر فیش را انتخاب کنید ❌", icon: 'warning' });
    }

    // ۲. فیلتر فقط عکس (JPG, PNG)
    if (!file.type.startsWith('image/')) {
        return Swal.fire({ text: "فقط فایل تصویری مجاز است ❌", icon: 'error' });
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
        const { error: dbErr } = await supabaseClient.from('transactions').insert([{
            member_id: userId,
            pool_id: poolId,
            amount: Number(amount),
            status: 'pending',
            type: 'in',
            receipt_url: urlData.publicUrl
        }]);

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
            
            return `
                <div class="bg-white p-5 rounded-[2rem] border border-slate-50 mb-3 flex justify-between items-center shadow-sm animate__animated animate__fadeIn">
                    <div class="text-right">
                        <p class="text-sm font-[900] ${isOut ? 'text-rose-600' : 'text-slate-800'}">
                            ${isOut ? '-' : '+'}${Number(t.amount).toLocaleString()} تومان
                        </p>
                        <p class="text-[9px] text-slate-400 font-bold mt-1">
                            ${isOut ? '🏆 دریافت برندگی / وام' : '↑ واریز قسط ماهانه'} • ${date}
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
window.openUserMenu = function() {
    Swal.fire({
        title: 'تنظیمات حساب کاربری',
        text: 'قصد تغییر کدام مورد را دارید؟',
        icon: 'info',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: '📸 تغییر عکس پروفایل',
        denyButtonText: '🔐 تغییر رمز عبور',
        cancelButtonText: 'انصراف',
        confirmButtonColor: '#10b981',
        denyButtonColor: '#4f46e5',
        customClass: { popup: 'rounded-[2.5rem]' }
    }).then((result) => {
        if (result.isConfirmed) {
            // شلیک به اینپوت فایل
            document.getElementById('avatar-input').click();
        } else if (result.isDenied) {
            // باز کردن مودال تغییر رمز (که قبلا داشتی)
            if(typeof openPassModal === 'function') openPassModal();
        }
    });
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

        // ۳. ثبت در جدول اعضا
        const { error: dbErr } = await supabaseClient
            .from('members')
                .update({ avatar_url: publicUrl })
                .eq('id', userId);

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
async function loadUserQueuePosition(userId, poolId) {
    const posText = document.getElementById('queue-pos-text');
    const posNum = document.getElementById('queue-pos-number');
    const card = document.getElementById('queue-status-card');

    if (!posText || !poolId) return;

    try {
        // ۱. دریافت اعضا و تراکنش‌ها
        const [membersRes, txsRes] = await Promise.all([
            supabaseClient.from('members').select('id, full_name, eligible_at').eq('pool_id', poolId).eq('is_admin', false),
            supabaseClient.from('transactions').select('member_id, amount, type, category').eq('pool_id', poolId).eq('status', 'approved')
        ]);

        const members = membersRes.data;
        const txs = txsRes.data;

        // ۲. آنالیز وضعیت هر عضو
        const queueData = members.map(m => {
            const userIn = txs.filter(t => t.member_id === m.id && t.type === 'in').reduce((s, a) => s + Number(a.amount), 0);
            const userOutMonthly = txs.filter(t => t.member_id === m.id && t.type === 'out' && t.category === 'monthly').reduce((s, a) => s + Number(a.amount), 0);
            
            // شرط شایستگی: بدهی صفر + داشتن تاریخ صلاحیت
            const isEligible = (userOutMonthly - userIn <= 0) && (m.eligible_at !== null);
            
            return { id: m.id, isEligible, eligible_at: m.eligible_at };
        });

        // ۳. 🔥 مرتب‌سازی جادویی (حل مشکل نفر دوم ماندن) 👇
        const sortedQueue = queueData.sort((a, b) => {
            // قانون اول: شایسته‌ها اول باشند
            if (a.isEligible && !b.isEligible) return -1;
            if (!a.isEligible && b.isEligible) return 1;
            
            // قانون دوم: اگر هر دو شایسته هستند، بر اساس زمان (قدیمی به جدید)
            if (a.isEligible && b.isEligible) {
                return new Date(a.eligible_at) - new Date(b.eligible_at);
            }
            
            return 0;
        });

        // ۴. پیدا کردن رتبه شما
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
                        <div class="bg-indigo-950 p-7 rounded-[3rem] text-white shadow-2xl mb-6 relative overflow-hidden border border-indigo-500/30 animate__animated animate__pulse animate__infinite">
                            <div class="relative z-10">
                                <div class="flex justify-between items-center mb-4">
                                    <span class="bg-indigo-500 text-[7px] px-3 py-1 rounded-full font-black uppercase tracking-widest">Urgent Swap</span>
                                    <i class="fas fa-handshake-angle text-indigo-400 text-lg"></i>
                                </div>
                                <h5 class="text-[12px] font-black text-right leading-relaxed">
                                    <b class="text-yellow-400">${s.members.full_name}</b> درخواست تعویض نوبت دارد:
                                </h5>
                                <p class="text-[10px] text-indigo-200/70 mt-3 italic text-right bg-white/5 p-3 rounded-2xl">"${s.message}"</p>
                                <button onclick="acceptSwap(${s.id}, '${s.sender_id}')" class="btn-tap w-full mt-5 bg-emerald-500 text-white py-4 rounded-2xl font-black text-[11px] shadow-lg shadow-emerald-500/20">
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
        await supabaseClient.from('turn_swap_requests').insert([{ sender_id: uId, pool_id: pId, message: msg }]);
        Swal.fire({ text: 'فراخوان شما در بخش نظرسنجی منتشر شد.', icon: 'success' });
    }
};

/************************************************
 * تابع تایید جابجایی نوبت (نسخه نفوذناپذیر RPC)
 ************************************************/
window.acceptSwap = async function(requestId, requesterId) {
    const myId = sessionStorage.getItem('user_id');
    const pId = sessionStorage.getItem('pool_id');
    
    const result = await Swal.fire({
        title: 'تایید جابجایی نوبت؟',
        text: "با این کار نوبت شما با این عضو عوض شده و ۵ امتیاز هدیه می‌گیرید. 🤝",
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
        const { data: swaps } = await supabaseClient.from('turn_swap_requests')
            .select('*, members!fk_sender(full_name)')
            .eq('pool_id', poolId)
            .eq('status', 'pending');

        if (!swaps || swaps.length === 0) {
            container.innerHTML = '<p class="text-center py-5 text-slate-400 text-[9px]">درخواست جابجایی فعالی نیست.</p>';
            return;
        }

        container.innerHTML = swaps.map(s => {
            if (String(s.sender_id) === String(userId)) return ''; // درخواست خودش را نبیند

            return `
            <div class="feed-card swap-item animate__animated animate__pulse animate__infinite animate__slow">
                <div class="card-tag">تعویض نوبت</div>
                <h5 class="text-[11px] font-[900] text-indigo-300 text-right mt-2">${s.members.full_name}</h5>
                <p class="text-[10px] text-slate-300 mt-2 text-right leading-relaxed italic">"${s.message}"</p>
                <button onclick="acceptSwap(${s.id}, '${s.sender_id}')" class="w-full mt-4 bg-emerald-600 text-white py-4 rounded-[1.5rem] font-black text-[10px] shadow-lg">
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
    if (id === 'loan-sec') { loadActiveLoans(uId, pId); loadTurnSwapsInLoans(pId, uId); }
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

// ۲. باز کردن کشو و فراخوان مبلغ قسط 👇
window.openDepositDrawer = function() {
    const drawer = document.getElementById('deposit-drawer');
    const amountInput = document.getElementById('receipt-amount-input');
    const displayAmount = document.getElementById('amount-display')?.innerText;

    if (drawer) {
        drawer.classList.remove('hidden');
        
        // استخراج عدد از کارت "قسط این ماه" و پر کردن خودکار اینپوت ✅
        if (displayAmount && amountInput) {
            // پاک کردن حروف فارسی و کاما برای تبدیل به عدد خالص
            const pureNumber = displayAmount.replace(/[^0-9]/g, '');
            amountInput.value = pureNumber;
        }

        if (window.navigator.vibrate) window.navigator.vibrate(20);
    }
};

// ۲. تابع بستن کشوی واریز وجه
window.closeDepositDrawer = function() {
    const drawer = document.getElementById('deposit-drawer');
    if (drawer) {
        // اضافه کردن کلاس hidden برای مخفی شدن
        drawer.classList.add('hidden');
        console.log("کشوی پرداخت بسته شد.");
    }
};





