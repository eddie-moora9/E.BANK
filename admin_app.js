/************************************************
 * ۱. تنظیمات اتصال و متغیرهای سراسری
 ************************************************/
var SUPABASE_URL = 'https://kqnsbnpznkwkwukzokik.supabase.co';
var SUPABASE_KEY = 'sb_publishable_ZqXeccdaSzZUivCwU38WcQ_m05uT4y6';
var supabaseClient = null;

// تابع راه‌اندازی اتصال (ضد کرش)
function initSupabase() {
    if (typeof supabase !== 'undefined' && !supabaseClient) {
        // دقت کن: S و U در Supabase و C در createClient
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        return true;
    }
    return !!supabaseClient;
}

var allMembersData = [];
var selectedMemberForReport = null;


window.showAdminSec = function(btn, id) {
    // ۱. لیست تمام بخش‌های موجود در HTML
    const sections = [
        'admin-home-sec', 
        'admin-verify-sec', 
        'admin-loans-verify-sec', 
        'admin-projects-sec', 
        'admin-members-sec', 
        'admin-settings-sec'
    ];

    // ۲. مخفی کردن تمام بخش‌ها
    sections.forEach(s => {
        const el = document.getElementById(s);
        if (el) el.classList.add('hidden');
    });

    // ۳. نمایش بخش انتخاب شده
    const target = document.getElementById(id);
    if (target) {
        target.classList.remove('hidden');
        console.log("تغییر وضعیت به بخش: " + id);
    } else {
        console.error("خطا: بخش با آیدی " + id + " یافت نشد!");
    }

    // ۴. مدیریت رنگ آیکون‌های منوی پایین
    document.querySelectorAll('.nav-btn').forEach(b => {
        b.classList.remove('text-indigo-400');
        b.classList.add('text-slate-500');
    });

    // رنگی کردن دکمه‌ای که کلیک شده
    if (btn) {
        btn.classList.remove('text-slate-500');
        btn.classList.add('text-indigo-400');
    }

    // لرزش خفیف گوشی برای بازخورد لمسی
    if (window.navigator.vibrate) window.navigator.vibrate(15);
};

/************************************************
 * ۲. موتور اصلی برنامه (DOMContentLoaded)
 ************************************************/
/************************************************
 * موتور اصلی شروع به کار پنل مدیریت (INIT)
 ************************************************/
document.addEventListener('DOMContentLoaded', async () => {
    
    // ۱. حذف سریع لوگو (اسپلش اسکرین) تحت هر شرایطی
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => {
                splash.remove();
                document.body.classList.remove('loading');
            }, 700);
        }
    }, 2000);

    // ۲. بررسی لود کتابخانه دیتابیس
    if (!initSupabase()) {
        console.log("در حال انتظار برای کتابخانه...");
        setTimeout(() => location.reload(), 1500);
        return;
    }

    // ۳. دریافت اطلاعات از حافظه موقت (Session)
    const isAdmin = sessionStorage.getItem('is_admin');
    const myPoolId = sessionStorage.getItem('pool_id');
    const userId = sessionStorage.getItem('user_id');

    // ۴. امنیت: بررسی لاگین مدیر
    if (isAdmin !== 'true' || !myPoolId) {
        window.location.replace('index.html');
        return;
    }

    // ۵. بررسی وضعیت اشتراک، تاریخ انقضا و ظرفیت (بخش هوشمند)
    try {
        // ابتدا اطلاعات صندوق را از دیتابیس واکشی می‌کنیم 👇
        const { data: pool, error } = await supabaseClient
            .from('pools')
            .select('*')
            .eq('id', myPoolId)
            .maybeSingle();

        if (error) throw error;

        if (pool) {
            const now = new Date();
            const expiry = new Date(pool.sub_expiry);

            // محاسبه اختلاف به میلی‌ثانیه و تبدیل به روز صاف (دقیق)
            const diffTime = expiry.getTime() - now.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

            // الف) نمایش روزهای باقی‌مانده و تاریخ انقضا
            const daysDisplay = document.getElementById('sub-days-display');
            const dateDisplay = document.getElementById('sub-date-display');

            if (daysDisplay) {
                daysDisplay.innerText = diffDays > 0 ? diffDays + " روز باقی‌مانده" : "اعتبار تمام شده ⚠️";
            }
            if (dateDisplay) {
                dateDisplay.innerText = "انقضا: " + expiry.toLocaleDateString('fa-IR');
            }

            // ب) نمایش ظرفیت سهمیه باقی‌مانده
            const capElements = document.querySelectorAll('#member-capacity-display');
            capElements.forEach(el => {
                el.innerText = (pool.member_capacity || 0) + " سهمیه";
            });

            // ج) بررسی قفل بودن حساب (دستی یا انقضای زمان)
            if (pool.is_active === false || diffDays <= 0) {
                if (typeof showLockPage === 'function') showLockPage();
                return; // توقف اجرای بقیه کدها
            }
        }
    } catch (err) { 
        console.error("Security/Stats Check Error:", err.message); 
    }

    // ۶. بارگذاری تمام توابع داشبورد مدیریت
    calculateStats(myPoolId);
    loadPendingReceipts(myPoolId);
    loadAllMembers(myPoolId);
    loadCurrentConfig(myPoolId);
    loadAdminLoans(myPoolId);
    loadAdminProjects(myPoolId);
    
    // ۷. اجرای ابزارهای سیستمی و اعلان
    if (typeof injectSuperAdminButton === 'function') injectSuperAdminButton(userId);
    if (typeof initSecretClick === 'function') initSecretClick();
    if (typeof updateReceiptBadge === 'function') updateReceiptBadge(myPoolId);
    if (typeof initOneSignalAdmin === 'function') initOneSignalAdmin(myPoolId);
});
/************************************************
 * ۳. حسابداری (۳ صندوق: جاری، سرمایه، سود)
 ************************************************/
async function calculateStats(poolId) {
    try {
        const { data: txs } = await supabaseClient
            .from('transactions')
            .select('amount, type, invest_val, status')
            .eq('pool_id', poolId)
            .eq('status', 'approved');

        if (txs) {
            let totalIn = 0;            // واریزی اعضا
            let totalOut = 0;           // پرداختی وام/برنده
            let totalInvestTarget = 0;  // سهمیه‌های کسر شده برای سرمایه
            let actualCapitalSpent = 0; // پول خرج شده برای خرید پروژه
            let totalProfitIn = 0;      // سودهای دریافتی
            let totalProfitDist = 0;    // سودهای تقسیم شده

            txs.forEach(t => {
                const val = Number(t.amount || 0);
                const inv = Number(t.invest_val || 0);
                totalInvestTarget += inv;

                if (t.type === 'in') totalIn += val;
                else if (t.type === 'out') totalOut += val;
                else if (t.type === 'capital_spend') actualCapitalSpent += val;
                else if (t.type === 'profit') totalProfitIn += val;
                else if (t.type === 'distribution') totalProfitDist += val;
            });

            const mainFund = (totalIn - totalInvestTarget) - totalOut; 
            const investFund = totalInvestTarget - actualCapitalSpent;
            const profitFund = totalProfitIn - totalProfitDist;

            if(document.getElementById('main-fund-balance')) document.getElementById('main-fund-balance').innerText = Math.floor(mainFund).toLocaleString() + " تومان";
            if(document.getElementById('invest-fund-balance')) document.getElementById('invest-fund-balance').innerText = Math.floor(investFund).toLocaleString();
            if(document.getElementById('profit-fund-balance')) document.getElementById('profit-fund-balance').innerText = Math.floor(profitFund).toLocaleString();
            
            // نمایش دارایی کل در Master Balance
            const totalAssets = mainFund + investFund + profitFund;
            if(document.getElementById('master-total-assets')) document.getElementById('master-total-assets').innerText = Math.floor(totalAssets).toLocaleString() + " تومان";
        }
    } catch (e) { console.error(e); }
}

/************************************************
 * ۴. تایید فیش + سهم سرمایه + امتیاز خوش‌حسابی
 ************************************************/
window.updateStatus = async function(id, newStatus) {
    const myPoolId = sessionStorage.getItem('pool_id');
    try {
        if (newStatus === 'approved') {
            const { data: tx } = await supabaseClient.from('transactions').select('*').eq('id', id).single();
            const { data: set } = await supabaseClient.from('settings').select('investment_percent').eq('pool_id', myPoolId).maybeSingle();

            const currentN = set ? Number(set.investment_percent || 0) : 0;
            const investAmount = Math.floor((Number(tx.amount) * currentN) / 100);

            await supabaseClient.from('transactions').update({ status: 'approved', invest_val: investAmount }).eq('id', id);

            if (tx.member_id) {
                const day = new Date(tx.created_at).getDate();
                const { data: mem } = await supabaseClient.from('members').select('credit_score').eq('id', tx.member_id).single();
                let newScore = (Number(mem.credit_score) || 100) + (day <= 10 ? 2 : -10);
                newScore = Math.max(0, Math.min(100, newScore));
                await supabaseClient.from('members').update({ credit_score: newScore }).eq('id', tx.member_id);
            }
        } else {
            await supabaseClient.from('transactions').update({ status: newStatus }).eq('id', id);
        }
        alert("عملیات با موفقیت انجام شد ✅"); location.reload();
    } catch (e) { alert("خطا در تایید"); }
};

async function loadPendingReceipts(poolId) {
    const { data } = await supabaseClient.from('transactions').select('*').eq('pool_id', poolId).eq('status', 'pending');
    const container = document.getElementById('pending-list');
    const badge = document.getElementById('pending-count');
    if (data && container) {
        container.innerHTML = data.map(t => `
            <div class="bg-white p-4 rounded-[2rem] border flex items-center justify-between mb-3 shadow-sm">
                <div class="flex gap-1.5">
                    <button onclick="updateStatus(${t.id},'rejected')" class="w-9 h-9 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center"><i class="fas fa-times"></i></button>
                    <button onclick="updateStatus(${t.id},'approved')" class="w-9 h-9 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center"><i class="fas fa-check"></i></button>
                </div>
                <div class="text-right flex-1 px-3">
                    <p class="text-[10px] font-black text-slate-800">عضو کد: ${t.member_id}</p>
                    <p class="text-[9px] text-slate-400">${Number(t.amount).toLocaleString()} ت</p>
                </div>
                <a href="${t.receipt_url}" target="_blank" class="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-sm"><i class="fas fa-eye text-xs"></i></a>
            </div>`).join('');
        if(badge) badge.innerText = data.length;
    }
}

/************************************************
 * ۵. مدیریت اعضا (لیست، گزارش، ویرایش)
 ************************************************/
async function loadAllMembers(poolId) {
    try {
        const { data: members } = await supabaseClient.from('members').select('*').eq('pool_id', poolId).eq('is_admin', false).order('credit_score', { ascending: false });
        const { data: txs } = await supabaseClient.from('transactions').select('member_id, amount, type').eq('pool_id', poolId).eq('status', 'approved');
        allMembersData = members || [];
        const container = document.getElementById('members-list');
        if (!container) return;

        container.innerHTML = members.map(m => {
            const userIn = txs ? txs.filter(t => t.member_id === m.id && t.type === 'in').reduce((s, a) => s + Number(a.amount), 0) : 0;
            const adminBadge = m.is_admin ? `<span class="bg-amber-100 text-amber-600 text-[7px] px-1 py-0.5 rounded ml-1 font-black">مدیر</span>` : '';
            
            return `
                <div class="bg-white p-4 rounded-[2rem] border border-slate-50 flex justify-between items-center mb-3 shadow-sm">
                    <div class="text-right">
                        <div class="flex items-center gap-1"><p class="text-[11px] font-black text-slate-800">${m.full_name}</p>${adminBadge}</div>
                        <div class="flex items-center gap-2 mt-1">
                            <span class="text-[8px] text-amber-500 font-black"><i class="fas fa-star text-[7px]"></i> ${m.credit_score || 100}%</span>
                            <span class="text-[8px] text-emerald-600 font-black">واریزی: ${userIn.toLocaleString()} ت</span>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="openReportModalById(${m.id})" class="w-10 h-10 bg-slate-900 text-white rounded-2xl flex items-center justify-center active:scale-90"><i class="fas fa-chart-line text-xs"></i></button>
                        <button onclick="openEditModalById(${m.id})" class="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center active:scale-90"><i class="fas fa-edit text-xs"></i></button>
                    </div>
                </div>`;
        }).join('');
    } catch (e) { console.error(e); }
}

async function openReportModalById(id) {
    const m = allMembersData.find(x => x.id === id);
    if (!m) return;
    selectedMemberForReport = m;
    document.getElementById('rep-name').innerText = m.full_name;
    document.getElementById('rep-mobile').innerText = m.mobile;
    document.getElementById('rep-score').innerText = (m.credit_score || 100) + "%";
    
    const { data: txs } = await supabaseClient.from('transactions').select('amount, type').eq('member_id', m.id).eq('status', 'approved');
    const tin = txs ? txs.filter(t => t.type === 'in').reduce((s, a) => s + Number(a.amount), 0) : 0;
    const debt = Number(m.debt_target || 0);
    const remain = Math.max(0, debt - tin);
    const progress = debt > 0 ? Math.min(Math.floor((tin / debt) * 100), 100) : 0;

    document.getElementById('rep-total-in').innerText = tin.toLocaleString() + " ت";
    document.getElementById('rep-total-out').innerText = debt.toLocaleString() + " ت";
    document.getElementById('rep-balance').innerHTML = `<div class="space-y-2"><div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden"><div class="bg-emerald-500 h-full" style="width:${progress}%"></div></div><p class="text-[10px] font-black text-rose-600 pt-1">${remain.toLocaleString()} تومان مانده بدهی</p></div>`;
    document.getElementById('report-modal').classList.remove('hidden');
}

async function updateMember() {
    const id = document.getElementById('edit-member-id').value;
    const newShares = parseInt(document.getElementById('edit-member-shares').value);
    const myPoolId = sessionStorage.getItem('pool_id');
    const newPass = document.getElementById('edit-member-pass').value;

    const { data: oldM } = await supabaseClient.from('members').select('total_shares').eq('id', id).single();
    const { data: pool } = await supabaseClient.from('pools').select('member_capacity').eq('id', myPoolId).single();
    const diff = newShares - oldM.total_shares;

    if (diff > pool.member_capacity) return alert("سهمیه کافی ندارید ❌");

    let upData = { full_name: document.getElementById('edit-member-name').value, mobile: document.getElementById('edit-member-mobile').value, total_shares: newShares, is_admin: document.getElementById('edit-member-is-admin').checked };
    if(newPass) upData.password = newPass;

    await supabaseClient.from('members').update(upData).eq('id', id);
    await supabaseClient.from('pools').update({ member_capacity: pool.member_capacity - diff }).eq('id', myPoolId);
    alert("بروزرسانی شد ✅"); location.reload();
}

async function addNewMember() {
    const poolId = sessionStorage.getItem('pool_id');
    const n = document.getElementById('new-member-name').value, m = document.getElementById('new-member-mobile').value, p = document.getElementById('new-member-pass').value, s = parseInt(document.getElementById('new-member-shares').value) || 1, adm = document.getElementById('new-member-is-admin').checked;
    
    const { data: pool } = await supabaseClient.from('pools').select('member_capacity').eq('id', poolId).single();
    if (pool.member_capacity < s) return alert("سهمیه کافی ندارید ❌");
    if(!n || !m) return alert("اطلاعات ناقص است");

    const { error } = await supabaseClient.from('members').insert([{ pool_id: poolId, full_name: n, mobile: m, password: p, total_shares: s, won_shares: 0, has_won: false, is_admin: adm, credit_score: 100 }]);
    if(!error) {
        await supabaseClient.from('pools').update({ member_capacity: pool.member_capacity - s }).eq('id', poolId);
        alert("عضو ثبت شد ✅"); location.reload();
    }
}

async function handleDeleteWithSettlement() {
    const m = selectedMemberForReport;
    const amt = Number(document.getElementById('settle-amount').value);
    if (!confirm(`حذف نهایی "${m.full_name}"؟`)) return;
    if (amt > 0) await supabaseClient.from('transactions').insert([{ pool_id: m.pool_id, amount: amt, status: 'approved', type: 'out', receipt_url: 'تسویه نهایی عضو' }]);
    await supabaseClient.from('members').delete().eq('id', m.id);
    alert("انجام شد ✅"); location.reload();
}

/************************************************
 * ۶. قرعه‌کشی و مدیریت وام
 ************************************************/
async function runLottery() {
    const poolId = sessionStorage.getItem('pool_id');
    const { data: members } = await supabaseClient.from('members').select('*').eq('pool_id', poolId);
    let hat = [];
    members.forEach(m => { for(let i=0; i< (m.total_shares - m.won_shares); i++) hat.push(m); });
    if (hat.length === 0) return alert("همه سهم‌ها برنده شده‌اند!");
    const winner = hat[Math.floor(Math.random() * hat.length)];
    let amt = prompt(`🏆 برنده: ${winner.full_name}\nچه مبلغی کسر شود؟`, "80000000");
    if (!amt) return;

    await supabaseClient.from('lottery_results').insert([{ pool_id: poolId, winner_name: winner.full_name, month_name: 'دی' }]);
    await supabaseClient.from('transactions').insert([{ pool_id: poolId, member_id: winner.id, amount: Number(amt), status: 'approved', type: 'out', receipt_url: 'پرداخت قرعه‌کشی' }]);
    await supabaseClient.from('members').update({ won_shares: winner.won_shares + 1, has_won: (winner.won_shares + 1) >= winner.total_shares, debt_target: (Number(winner.debt_target) || 0) + Number(amt) }).eq('id', winner.id);
    alert("اوکی شد ✅"); location.reload();
}

/************************************************
 * نمایش لیست وام‌ها با درصد موافقت و دکمه رد
 ************************************************/
async function loadAdminLoans(poolId) {
    try {
        // ۱. گرفتن تعداد کل اعضای این صندوق برای محاسبه درصد
        const { count: totalMembers } = await supabaseClient
            .from('members')
            .select('*', { count: 'exact', head: true })
            .eq('pool_id', poolId)
            .eq('is_admin', false);

        // ۲. گرفتن لیست درخواست‌های وام
        const { data: loans, error } = await supabaseClient
            .from('loans')
            .select('*')
            .eq('pool_id', poolId)
            .order('created_at', { ascending: false });

        const container = document.getElementById('admin-loans-list');
        if (!container) return;

        if (error || !loans || loans.length === 0) {
            container.innerHTML = '<p class="text-center text-[10px] text-slate-400 py-10 font-bold uppercase">درخواستی یافت نشد</p>';
            return;
        }

        container.innerHTML = loans.map(l => {
            const isPaid = l.status === 'paid';
            
            // ۳. محاسبه درصد موافقت (نسبت به کل اعضای صندوق)
            const approvalRate = totalMembers > 0 ? Math.round((l.votes_up / totalMembers) * 100) : 0;
            
            // رنگ درصد بر اساس میزان محبوبیت
            const rateColor = approvalRate >= 50 ? 'text-emerald-500' : 'text-orange-500';

            return `
                <div class="bg-white p-5 rounded-[2.5rem] border border-slate-100 mb-4 shadow-sm text-right relative overflow-hidden">
                    <div class="flex justify-between items-start mb-4">
                        <div class="flex-1">
                            <p class="text-[11px] font-[900] text-slate-800">${l.requester_name}</p>
                            <p class="text-[10px] text-slate-500 font-bold">${Number(l.amount).toLocaleString()} تومان</p>
                        </div>
                        <!-- نمایش درصد موافقت نئونی 👇 -->
                        <div class="text-left">
                            <div class="bg-slate-50 px-3 py-1 rounded-xl border border-slate-100 flex flex-col items-center">
                                <span class="text-[7px] text-slate-400 font-black uppercase">Approval</span>
                                <span class="text-sm font-black ${rateColor}">${approvalRate}%</span>
                            </div>
                        </div>
                    </div>

                    <!-- نوار آمار ریز -->
                    <div class="flex gap-4 mb-4 text-[9px] font-bold text-slate-400 border-b border-slate-50 pb-3">
                        <span class="text-emerald-600"><i class="fas fa-thumbs-up ml-1"></i> ${l.votes_up || 0} موافق</span>
                        <span class="text-rose-500"><i class="fas fa-thumbs-down ml-1"></i> ${l.votes_down || 0} مخالف</span>
                    </div>

                    <div class="flex gap-2">
                        <!-- دکمه تایید و پرداخت -->
                        <button onclick="payLoan(${l.id}, ${l.amount}, '${l.requester_name}')" 
                                class="flex-[2] py-3.5 rounded-2xl font-black text-[10px] transition-all ${isPaid ? 'bg-slate-100 text-slate-400 pointer-events-none' : 'bg-indigo-600 text-white shadow-lg active:scale-95'}">
                            ${isPaid ? 'واریز شده' : 'تایید و واریز وام'}
                        </button>
                        
                        <!-- دکمه رد درخواست (جدید) 👇 -->
                        ${!isPaid ? `
                        <button onclick="rejectLoan(${l.id}, '${l.requester_name}')" 
                                class="flex-1 bg-rose-50 text-rose-500 py-3.5 rounded-2xl font-black text-[10px] border border-rose-100 active:scale-95 transition-all">
                            رد درخواست
                        </button>` : ''}
                    </div>
                </div>`;
        }).join('');
    } catch (err) { console.error(err); }
}




/************************************************
 * تابع ریست کل دوره (شروع دوره جدید)
 ************************************************/
window.resetLotterySeason = async function() {
    // ۱. گرفتن آیدی صندوق از حافظه موقت (سشن)
    const myPoolId = sessionStorage.getItem('pool_id');
    
    if (!myPoolId) {
        alert("خطا: جلسه کاری شما منقضی شده. لطفا دوباره لاگین کنید.");
        window.location.replace('index.html');
        return;
    }

    // ۲. تاییدیه اول از مدیر
    const confirm1 = confirm("⚠️ هشدار جدی!\nآیا مطمئن هستید که می‌خواهید کل دوره را ریست کنید؟\nبا این کار وضعیت تمام برنده‌ها صفر شده و تاریخچه برنده‌های قبلی پاک می‌شود.");
    if (!confirm1) return;

    // ۳. تاییدیه دوم (برای جلوگیری از کلیک تصادفی)
    const confirm2 = confirm("این عملیات غیرقابل بازگشت است. آیا واقعاً ادامه می‌دهید؟");
    if (!confirm2) return;

    try {
        console.log("در حال ریست کردن صندوق شماره: " + myPoolId);

        // الف) صفر کردن وضعیت تمام اعضا در این صندوق
        const { error: memError } = await supabaseClient
            .from('members')
            .update({ 
                won_shares: 0, 
                has_won: false, 
                debt_target: 0 
            })
            .eq('pool_id', myPoolId);

        if (memError) throw memError;

        // ب) پاک کردن تاریخچه برنده‌های قرعه‌کشی این صندوق
        const { error: lotError } = await supabaseClient
            .from('lottery_results')
            .delete()
            .eq('pool_id', myPoolId);

        if (lotError) throw lotError;

        // ج) ثبت یک تراکنش سیستمی برای سوابق (اختیاری)
        await supabaseClient.from('transactions').insert([{
            pool_id: myPoolId,
            amount: 0,
            status: 'approved',
            type: 'in',
            receipt_url: 'دوره جدید شروع شد (ریست سیستم)'
        }]);

        alert("صندوق با موفقیت ریست شد و آماده دوره جدید است! 🔄✨");
        location.reload(); // رفرش صفحه برای اعمال تغییرات

    } catch (err) {
        console.error("Reset Error:", err);
        alert("خطا در ریست کردن دیتابیس: " + err.message);
    }
};



async function payLoan(id, amt, name) {
    let finalPay = prompt(`مبلغ واریزی برای وام ${name}؟ (از گاوصندوق کسر می‌شود)`, amt);
    if (!finalPay) return;
    const poolId = sessionStorage.getItem('pool_id');
    await supabaseClient.from('transactions').insert([{ pool_id: poolId, member_id: null, amount: Number(finalPay), status: 'approved', type: 'out', receipt_url: `وام: ${name}` }]);
    await supabaseClient.from('loans').update({ status: 'paid' }).eq('id', id);
    const { data: m } = await supabaseClient.from('members').select('debt_target').eq('full_name', name).maybeSingle();
    await supabaseClient.from('members').update({ debt_target: (Number(m?.debt_target) || 0) + Number(finalPay) }).eq('full_name', name);
    alert("وام پرداخت و کسر شد ✅"); location.reload();
}

/************************************************
 * ۷. مدیریت پروژه‌های سرمایه‌گذاری
 ************************************************/
async function createNewProject() {
    const n = document.getElementById('proj-name').value, c = document.getElementById('proj-capital').value, poolId = sessionStorage.getItem('pool_id');
    if(!n || !c) return alert("نام و سرمایه الزامی است");
    await supabaseClient.from('transactions').insert([{ pool_id: poolId, amount: Number(c), status: 'approved', type: 'capital_spend', receipt_url: `خرید دارایی: ${n}` }]);
    await supabaseClient.from('projects').insert([{ pool_id: poolId, name: n, target_amount: Number(c), invested_amount: Number(c), status: 'active' }]);
    alert("پروژه افتتاح شد 🏗️"); location.reload();
}

async function loadAdminProjects(poolId) {
    const { data: projs } = await supabaseClient.from('projects').select('*').eq('pool_id', poolId).order('created_at', {ascending: false});
    const container = document.getElementById('admin-projects-list');
    if (container && projs) {
        container.innerHTML = projs.map(p => {
            const roi = (((p.total_profit || 0) / (p.invested_amount || 1)) * 100).toFixed(1);
            return `<div class="bg-white p-5 rounded-[2.5rem] border border-slate-100 mb-4 shadow-sm text-right">
                <div class="flex justify-between items-start mb-3">
                    <div><h4 class="text-xs font-black">${p.name}</h4><p class="text-[8px] text-slate-400 uppercase">سرمایه: ${Number(p.invested_amount).toLocaleString()} ت</p></div>
                    <div class="text-left"><span class="px-2 py-0.5 rounded text-[9px] font-black ${p.total_profit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}">${roi}% بازدهی</span><button onclick="deleteProject(${p.id}, '${p.name}')" class="block mt-2 w-8 h-8 bg-rose-50 text-rose-600 rounded-xl mx-auto"><i class="fas fa-trash-alt text-[10px]"></i></button></div>
                </div>
                <div class="flex gap-2">
                    <button onclick="registerProjectProfit(${p.id}, '${p.name}')" class="flex-1 bg-emerald-600 text-white py-3 rounded-2xl font-black text-[9px]">ثبت سود</button>
                    <button onclick="openProfitManager(${p.id}, '${p.name}', ${p.total_profit || 0})" class="flex-1 bg-indigo-600 text-white py-3 rounded-2xl font-black text-[9px]">مدیریت سود</button>
                </div>
            </div>`;
        }).join('');
    }
}

async function registerProjectProfit(id, name) {
    let prof = prompt(`سود دریافتی از پروژه "${name}"؟`); if (!prof) return;
    const poolId = sessionStorage.getItem('pool_id');
    await supabaseClient.from('transactions').insert([{ pool_id: poolId, amount: Number(prof), status: 'approved', type: 'profit', receipt_url: `سود حاصله: ${name}` }]);
    const { data: p } = await supabaseClient.from('projects').select('total_profit').eq('id', id).single();
    await supabaseClient.from('projects').update({ total_profit: (p.total_profit || 0) + Number(prof) }).eq('id', id);
    alert("سود ثبت شد"); location.reload();
}

async function executeProfitAction(type) {
    const pId = sessionStorage.getItem('pool_id'), prId = document.getElementById('pm-proj-id').value, amt = Number(document.getElementById('pm-available-profit').value);
    if (type === 'distribute') {
        const { data: ms } = await supabaseClient.from('members').select('id, total_shares').eq('pool_id', pId);
        const totS = ms.reduce((s, m) => s + (m.total_shares || 1), 0), pps = amt / totS;
        for (const m of ms) { await supabaseClient.from('transactions').insert([{ pool_id: pId, member_id: m.id, amount: Math.floor(pps * m.total_shares), status: 'approved', type: 'in', receipt_url: 'توزیع سود پروژه' }]); }
        await supabaseClient.from('transactions').insert([{ pool_id: pId, amount: amt, status: 'approved', type: 'distribution', receipt_url: 'خروج سود' }]);
    } else if (type === 'reinvest') {
        await supabaseClient.from('transactions').insert([{ pool_id: pId, amount: amt, status: 'approved', type: 'distribution', receipt_url: 'سود به سرمایه' }]);
        await supabaseClient.from('transactions').insert([{ pool_id: pId, amount: 0, invest_val: amt, status: 'approved', type: 'in', receipt_url: 'افزایش سرمایه' }]);
    }
    await supabaseClient.from('projects').update({ total_profit: 0 }).eq('id', prId);
    alert("انجام شد"); location.reload();
}

/************************************************
 * ۸. تنظیمات، امنیت و PWA
 ************************************************/
async function saveNewAmounts() {
    const pId = sessionStorage.getItem('pool_id');
    const b = document.getElementById('set-base-amount').value, w = document.getElementById('set-won-amount').value, i = document.getElementById('set-invest-percent').value;
    await supabaseClient.from('settings').update({ base_amount: Number(b), won_amount: Number(w), investment_percent: Number(i) }).eq('pool_id', pId);
    alert("ذخیره شد ✅");
}

async function loadCurrentConfig(poolId) {
    const { data } = await supabaseClient.from('settings').select('*').eq('pool_id', poolId).maybeSingle();
    if (data) { document.getElementById('set-base-amount').value = data.base_amount; document.getElementById('set-won-amount').value = data.won_amount; document.getElementById('set-invest-percent').value = data.investment_percent || 0; }
}

async function injectSuperAdminButton(userId) {
    // ۱. بررسی کلید مخفی دستگاه و وضعیت سوپر ادمین از هر دو حافظه
    const hasDeviceKey = localStorage.getItem('master_access_key') === 'Idris_Master_Admin_X';
    const isSuper = sessionStorage.getItem('is_super_admin') === 'true' || localStorage.getItem('is_super_admin') === 'true';

    if (hasDeviceKey && isSuper && supabaseClient) {
        try {
            // ۲. استعلام نهایی از دیتابیس برای امنیت ۱۰۰٪
            const { data: user } = await supabaseClient
                .from('members')
                .select('is_super_admin')
                .eq('id', userId)
                .maybeSingle();

            if (user && user.is_super_admin === true) {
                // ۳. اگر دکمه از قبل بود حذفش کن تا تکراری نشود
                const oldBtn = document.getElementById('super-btn');
                if (oldBtn) oldBtn.remove();

                // ۴. ساخت دکمه طلایی جدید
                const superBtn = document.createElement('button');
                superBtn.id = "super-btn";
                superBtn.innerHTML = `<i class="fas fa-crown ml-2"></i> ورود به ستاد فرماندهی`;
                superBtn.className = "btn-tap w-full bg-yellow-500 text-slate-900 py-4 rounded-2xl font-black text-sm shadow-xl mt-4 flex items-center justify-center gap-2";
                
                superBtn.onclick = () => { window.location.href = 'super_admin.html'; };

                // ۵. پیدا کردن محل تزریق (کارت گرادینت پیشخوان)
                const container = document.querySelector('.admin-card-gradient');
                if (container) {
                    container.appendChild(superBtn);
                    console.log("👑 دکمه ستاد فرماندهی با موفقیت تزریق شد.");
                }
            }
        } catch (e) { console.log("Super button injection failed"); }
    }
}
function initSecretClick() {
    let c = 0; const icon = document.querySelector('header i.fa-user-shield');
    if (icon) icon.parentElement.onclick = () => { c++; if (c === 10) { const k = localStorage.getItem('master_access_key'); if(k) localStorage.removeItem('master_access_key'); else localStorage.setItem('master_access_key', 'Idris_Master_Admin_X'); location.reload(); } };
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
function openProfitManager(id, name, profit) { document.getElementById('pm-proj-id').value = id; document.getElementById('pm-available-profit').value = profit; document.getElementById('pm-info-text').innerText = `پروژه: ${name} | سود: ${profit.toLocaleString()} ت`; document.getElementById('profit-manager-modal').classList.remove('hidden'); }
async function deleteProject(id, name) { if(confirm(`حذف "${name}"؟`)) { await supabaseClient.from('projects').delete().eq('id', id); location.reload(); } }


/************************************************
 * تابع نمایش صفحه مسدودی با درِ پشتی برای مدیر کل
 ************************************************/
/************************************************
 * تابع نمایش صفحه مسدودی + دکمه تمدید هوشمند
 ************************************************/
function showLockPage() {
    const isSuper = sessionStorage.getItem('is_super_admin') === 'true';
    const hasMasterKey = localStorage.getItem('master_access_key') === 'Idris_Master_Admin_X';
    const myPoolId = sessionStorage.getItem('pool_id');

    // ۱. طراحی بدنه اصلی صفحه مسدودی
    document.body.innerHTML = `
        <div id="lock-screen-container" style="height:100vh; background:#020617; color:white; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:30px; font-family:Vazirmatn; direction:rtl;">
            
            <div style="position:relative; cursor:pointer;" id="secret-lock-zone">
                <i class="fas fa-shield-alt" style="font-size:70px; color:#ef4444; margin-bottom:20px; filter: drop-shadow(0 0 15px rgba(239,68,68,0.3));"></i>
                <div style="position:absolute; top:0; right:0; width:12px; height:12px; background:#fbbf24; border-radius:50%; display:${isSuper ? 'block' : 'none'}"></div>
            </div>

            <h2 style="font-[900]; font-size:24px;">دسترسی محدود شد</h2>
            <p style="color:#64748b; font-size:13px; margin-top:10px; line-height:1.7;">
                اعتبار زمانی این صندوق به اتمام رسیده است.<br>
                برای فعال‌سازی مجدد، لطفاً نسبت به تمدید اشتراک اقدام کنید.
            </p>

            <!-- دکمه پرداخت و تمدید برای مدیر صندوق -->
            <button onclick="openBlockedPaymentModal()" style="margin-top:30px; background:#4f46e5; color:white; padding:16px 40px; border-radius:22px; font-weight:900; border:none; box-shadow: 0 10px 25px rgba(79,70,229,0.4); font-family:Vazirmatn; cursor:pointer; width:100%; max-width:280px;">
                <i class="fas fa-credit-card" style="margin-left:8px;"></i> تمدید اشتراک و رفع مسدودی
            </button>

            <!-- دکمه ورود اضطراری (مخصوص شما) -->
            ${(isSuper && hasMasterKey) ? `
            <button onclick="window.location.href='super_admin.html'" style="margin-top:15px; background:none; color:#fbbf24; padding:12px; border:1px solid #fbbf24; border-radius:18px; font-weight:bold; font-family:Vazirmatn; cursor:pointer; width:100%; max-width:280px; font-size:11px;">
                ورود به ستاد فرماندهی (ادیسون)
            </button>` : ''}

            <button onclick="sessionStorage.clear(); location.href='index.html'" style="margin-top:40px; color:#475569; background:none; border:none; font-size:12px; font-weight:bold; text-decoration:underline; cursor:pointer;">خروج از حساب</button>

            <!-- مودال مخفی پرداخت (Injected Modal) -->
            <div id="blocked-pay-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.9); backdrop-filter:blur(10px); z-index:2000; align-items:center; justify-content:center; padding:20px;">
                <div style="background:#1e293b; width:100%; max-width:340px; padding:30px; border-radius:35px; border:1px solid #334155; box-shadow:0 25px 50px rgba(0,0,0,0.5);">
                    <h3 style="font-weight:900; font-size:18px; margin-bottom:10px;">ارسال فیش تمدید</h3>
                    <p style="font-size:11px; color:#94a3b8; margin-bottom:20px;">مبلغ اشتراک را واریز کرده و تصویر فیش را بفرستید.</p>
                    
                    <input type="number" id="block-pay-amount" placeholder="مبلغ واریزی (تومان)" style="width:100%; padding:15px; border-radius:18px; border:none; background:#0f172a; color:white; text-align:center; font-weight:bold; margin-bottom:15px; outline:none; border:1px solid #334155;">
                    
                    <input type="file" id="block-pay-file" style="display:none;" onchange="document.getElementById('file-status').innerText='فیش انتخاب شد ✅'">
                    <label for="block-pay-file" style="display:block; background:#0f172a; padding:15px; border-radius:18px; border:1px dashed #475569; color:#94a3b8; font-size:11px; cursor:pointer; margin-bottom:20px;">
                        <i class="fas fa-camera" style="margin-bottom:5px; font-size:18px; display:block;"></i>
                        <span id="file-status">انتخاب تصویر فیش واریزی</span>
                    </label>

                    <button id="block-submit-btn" onclick="submitBlockedPayment('${myPoolId}')" style="width:100%; background:#10b981; color:white; padding:15px; border-radius:18px; border:none; font-weight:900; cursor:pointer; box-shadow:0 10px 20px rgba(16,185,129,0.2);">ارسال برای تایید مدیریت</button>
                    <button onclick="closeBlockedPaymentModal()" style="width:100%; background:none; color:#64748b; padding:10px; border:none; font-size:11px; margin-top:10px; cursor:pointer;">انصراف</button>
                </div>
            </div>
        </div>
    `;

    // فعالسازی قابلیت ۱۰ ضربه برای شما
    let c = 0;
    document.getElementById('secret-lock-zone').onclick = () => { c++; if(c===10) window.location.href='super_admin.html'; };
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

async function submitBlockedPayment(poolId) {
    const amt = document.getElementById('block-pay-amount').value;
    const fileInput = document.getElementById('block-pay-file');
    const btn = document.getElementById('block-submit-btn');

    if(!amt || !fileInput.files[0]) return alert("لطفاً مبلغ و تصویر فیش را وارد کنید ❌");

    btn.disabled = true; btn.innerText = "در حال ارسال فیش...";

    try {
        const file = fileInput.files[0];
        const fileName = `renewal-blocked-${poolId}-${Date.now()}.jpg`;
        
        // ۱. آپلود در استوریج
        await supabaseClient.storage.from('receipts').upload(fileName, file);
        const { data: urlData } = supabaseClient.storage.from('receipts').getPublicUrl(fileName);

        // ۲. ثبت در جدول درخواست‌ها
        await supabaseClient.from('sub_requests').insert([{
            pool_id: poolId,
            amount: Number(amt),
            receipt_url: urlData.publicUrl,
            status: 'pending'
        }]);

        alert("✅ فیش شما با موفقیت ارسال شد.\nپس از تایید مدیریت کل، پنل شما خودکار باز خواهد شد.");
        location.reload();

    } catch (e) {
        alert("خطا در ارسال: " + e.message);
        btn.disabled = false; btn.innerText = "تلاش مجدد";
    }
}





function updateReceiptBadge(poolId) { supabaseClient.from('transactions').select('id').eq('pool_id', poolId).eq('status', 'pending').then(({data}) => { if (data?.length > 0) document.getElementById('receipt-dot')?.classList.remove('hidden'); }); }
function closeEditModal() { document.getElementById('edit-modal').classList.add('hidden'); }
function closeReportModal() { document.getElementById('report-modal').classList.add('hidden'); }
function openRenewalModal() { document.getElementById('renewal-modal').classList.remove('hidden'); }
function closeRenewalModal() { document.getElementById('renewal-modal').classList.add('hidden'); }
function openBuyQuotaModal() { 
    supabaseClient.from('pools').select('share_price').eq('id', sessionStorage.getItem('pool_id')).single().then(({data}) => {
        if(data) document.getElementById('display-share-price').innerText = Number(data.share_price).toLocaleString() + " ت";
    });
    document.getElementById('quota-modal').classList.remove('hidden'); 
}
function closeQuotaModal() { document.getElementById('quota-modal').classList.add('hidden'); }


/************************************************
 * ۱. تابع تمدید اعتبار اشتراک (Subscription)
 ************************************************/
async function submitRenewalRequest() {
    const amountInput = document.getElementById('renewal-amount');
    const fileInput = document.getElementById('renewal-file');
    const poolId = sessionStorage.getItem('pool_id');
    const btn = document.getElementById('renewal-submit-btn');

    const amt = amountInput.value.trim();
    const file = fileInput.files[0];

    // اعتبارسنجی
    if (!amt || Number(amt) <= 0) return alert("لطفاً مبلغ تمدید اشتراک را وارد کنید ❌");
    if (!file) return alert("لطفاً تصویر فیش واریزی را انتخاب کنید ❌");

    btn.disabled = true;
    btn.innerText = "در حال ارسال...";

    try {
        const fileName = `sub-${poolId}-${Date.now()}.jpg`;
        
        // آپلود فیش در Storage
        const { error: upErr } = await supabaseClient.storage.from('receipts').upload(fileName, file);
        if (upErr) throw upErr;

        const { data: urlData } = supabaseClient.storage.from('receipts').getPublicUrl(fileName);

        // ثبت درخواست با برچسب 'subscription' 👇
        const { error: dbErr } = await supabaseClient.from('sub_requests').insert([{
            pool_id: poolId,
            amount: Number(amt),
            receipt_url: urlData.publicUrl,
            status: 'pending',
            request_type: 'subscription' // <--- این خط اضافه شد
        }]);

        if (dbErr) throw dbErr;

        alert("✅ فیش تمدید اعتبار با موفقیت ارسال شد.\nپس از تایید مدیریت کل، اعتبار پنل شما شارژ می‌شود.");
        
        amountInput.value = "";
        fileInput.value = "";
        document.getElementById('renewal-file-name').innerText = "آپلود فیش تمدید";
        closeRenewalModal();

    } catch (err) {
        alert("خطا در ارسال: " + err.message);
        btn.disabled = false;
        btn.innerText = "ارسال برای تایید";
    }
}

/************************************************
 * ۲. تابع خرید سهمیه عضو جدید (Quota)
 ************************************************/
async function submitQuotaRequest() {
    const amountInput = document.getElementById('quota-amount');
    const fileInput = document.getElementById('quota-file');
    const poolId = sessionStorage.getItem('pool_id');
    const btn = document.getElementById('quota-submit-btn');

    const amt = amountInput.value.trim();
    const file = fileInput.files[0];

    if (!amt || Number(amt) <= 0) return alert("لطفاً مبلغ واریزی را وارد کنید ❌");
    if (!file) return alert("لطفاً تصویر فیش واریزی را انتخاب کنید ❌");

    btn.disabled = true;
    btn.innerText = "در حال ارسال...";

    try {
        const fileName = `quota-${poolId}-${Date.now()}.jpg`;
        
        // آپلود فیش در Storage
        const { error: upErr } = await supabaseClient.storage.from('receipts').upload(fileName, file);
        if (upErr) throw upErr;

        const { data: urlData } = supabaseClient.storage.from('receipts').getPublicUrl(fileName);

        // ثبت درخواست با برچسب 'quota' 👇
        const { error: dbErr } = await supabaseClient.from('sub_requests').insert([{
            pool_id: poolId,
            amount: Number(amt),
            receipt_url: urlData.publicUrl,
            status: 'pending',
            request_type: 'quota' // <--- این خط اضافه شد
        }]);

        if (dbErr) throw dbErr;

        alert("✅ درخواست خرید سهمیه با موفقیت ارسال شد.\nمدیر کل پس از بررسی، ظرفیت شما را شارژ خواهد کرد.");
        
        amountInput.value = "";
        fileInput.value = "";
        document.getElementById('quota-file-name').innerText = "آپلود فیش واریزی";
        closeQuotaModal();

    } catch (e) {
        alert("خطا در ارسال: " + e.message);
        btn.disabled = false;
        btn.innerText = "ارسال درخواست";
    }
}


function initOneSignalAdmin(myPoolId) { if (typeof OneSignal !== 'undefined') { OneSignal.push(function() { OneSignal.User.addTag("role", "admin"); OneSignal.User.addTag("pool_id", String(myPoolId)); }); } }

/************************************************
 * تابع باز کردن پنجره ویرایش عضو (اصلاح شده)
 ************************************************/
window.openEditModalById = function(id) {
    // ۱. پیدا کردن اطلاعات عضو از لیستی که قبلاً بارگذاری شده
    const member = allMembersData.find(m => m.id === id);
    
    if (!member) {
        console.error("عضو یافت نشد!");
        return;
    }

    // ۲. پر کردن فیلدهای مخفی و نمایشی در مودال ویرایش
    document.getElementById('edit-member-id').value = member.id;
    document.getElementById('edit-member-name').value = member.full_name;
    document.getElementById('edit-member-mobile').value = member.mobile;
    document.getElementById('edit-member-shares').value = member.total_shares;
    
    // تیک مدیریت را بر اساس وضعیت دیتابیس بزن
    const adminCheckbox = document.getElementById('edit-member-is-admin');
    if (adminCheckbox) adminCheckbox.checked = member.is_admin;

    // کادر رمز عبور را خالی بگذار (طبق قراری که داشتیم مدیر رمز فعلی را نبیند)
    const passInput = document.getElementById('edit-member-pass');
    if (passInput) {
        passInput.value = "";
        passInput.placeholder = "تغییر رمز عبور (خالی بگذارید تا تغییر نکند)";
    }

    // ۳. ظاهر کردن پنجره مودال
    const modal = document.getElementById('edit-modal');
    if (modal) {
        modal.classList.remove('hidden');
        console.log("💎 پنجره ویرایش برای " + member.full_name + " باز شد.");
    } else {
        alert("خطا: پنجره ویرایش (edit-modal) در فایل HTML یافت نشد!");
    }
};


window.sendPushToUnpaid = async function() {
    // ۱. پاکسازی کلیدها (مطمئن شو که فاصله اضافی ندارند)
    const APP_ID = "6235857d-565c-4223-bffa-af420f2cd45b".trim(); 
    const API_KEY = "os_v2_app_mi2yk7kwlrbchp72v5ba6lgulm3yudga3sbeet5dt2feqhyer27faufsiea2acnuio5vcmebonhdyyw5vqqo6zfqc3i3gnyw6".trim();
    
    const myPoolId = sessionStorage.getItem('pool_id');
    if (!confirm("🔔 آیا از ارسال پیام به بدهکاران اطمینان دارید؟")) return;

    try {
        const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
        
        // دریافت آیدی بدهکاران
        const { data: members } = await supabaseClient.from('members').select('id').eq('pool_id', myPoolId).eq('is_admin', false);
        const { data: paid } = await supabaseClient.from('transactions').select('member_id').eq('pool_id', myPoolId).eq('status', 'approved').eq('type', 'in').gte('created_at', firstDay);

        const paidIds = paid.map(p => String(p.member_id));
        const unpaidIds = members.filter(m => !paidIds.includes(String(m.id))).map(m => String(m.id));

        if (unpaidIds.length === 0) return alert("همه اعضا تسویه کرده‌اند ✨");

        // ۲. ارسال درخواست (با تنظیمات اضافه برای رفع Failed to fetch)
        const response = await fetch("https://onesignal.com/api/v1/notifications", {
            method: "POST",
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Authorization": "Basic " + API_KEY
            },
            body: JSON.stringify({
                app_id: APP_ID,
                include_external_user_ids: unpaidIds,
                headings: { "fa": "یادآوری واریز قسط" },
                contents: { "fa": "هم‌صندوقی عزیز، وقت واریز قسط این ماه رسیده است. لطفاً اقدام کنید." }
            })
        });

        if (response.ok) {
            alert(`🚀 موفقیت: پیام برای ${unpaidIds.length} نفر شلیک شد.`);
        } else {
            const errorBody = await response.text();
            alert("خطا در پاسخ سرور OneSignal: " + errorBody);
        }

    } catch (e) {
        // اگر فیلترشکن قطع باشد یا روی localhost باشید این ارور میاد 👇
        alert("🚨 خطای شبکه (Failed to fetch):\n۱. فیلترشکن را روشن کنید.\n۲. حتماً روی لینک Vercel تست کنید.");
        console.error("Fetch Error:", e);
    }
};