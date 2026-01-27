/************************************************
 * نسخه نهایی و تضمینی ستاد فرماندهی (Super Admin)
 ************************************************/
var SUPABASE_URL = 'https://kqnsbnpznkwkwukzokik.supabase.co';
var SUPABASE_KEY = 'sb_publishable_ZqXeccdaSzZUivCwU38WcQ_m05uT4y6';
var supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

var allPoolsCache = [];

document.addEventListener('DOMContentLoaded', async () => {
    const userId = sessionStorage.getItem('user_id');
    const isSuper = sessionStorage.getItem('is_super_admin');
    const MY_SECRET_PASSWORD = "@EddiE-Moradi1993"; 

    // بررسی دسترسی اولیه
    if (!userId || isSuper !== 'true') {
        alert("دسترسی غیرمجاز! ⛔");
        window.location.replace('index.html');
        return;
    }

    // لایه امنیتی رمز عبور
    let entryKey = prompt("لطفاً رمز عبور ستاد فرماندهی را وارد کنید:");
    if (entryKey === MY_SECRET_PASSWORD) {
        const { data: user } = await supabaseClient.from('members').select('is_super_admin').eq('id', userId).maybeSingle();
        if (user && user.is_super_admin) {
            console.log("👑 کمال تشریف‌فرمایی شما را تبریک می‌گوییم.");
            loadMasterStats(); 
            loadBillingHistory(); 
        } else {
            alert("خطا: اکانت شما در دیتابیس ابر-مدیر نیست.");
            window.location.replace('index.html');
        }
    } else {
        alert("رمز اشتباه است");
        window.location.replace('admin.html');
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

function renderPoolsList() {
    const container = document.getElementById('pools-list');
    if (!container) return;
    container.innerHTML = allPoolsCache.map(pool => {
        const isActive = pool.is_active !== false;
        const expiryDate = pool.sub_expiry ? new Date(pool.sub_expiry).toLocaleDateString('fa-IR') : '---';

        return `
            <div class="bg-slate-800/60 p-6 rounded-[2.5rem] gold-border mb-4 space-y-4 shadow-xl backdrop-blur-sm">
                <div class="flex justify-between items-start">
                    <div class="text-right">
                        <h4 class="text-sm font-black text-white">${pool.pool_name}</h4>
                        <p class="text-[9px] text-slate-400 mt-1">کد: <span class="text-yellow-500 font-bold">${pool.pool_code}</span> | انقضا: ${expiryDate}</p>
                    </div>
                    <button onclick="togglePoolStatus(${pool.id}, ${isActive})" 
                        class="w-10 h-10 ${isActive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'} rounded-2xl flex items-center justify-center active:scale-90 transition-all border border-white/5">
                        <i class="fas ${isActive ? 'fa-unlock' : 'fa-lock'} text-xs"></i>
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
                    <button onclick="viewSubRequests(${pool.id}, '${pool.pool_name}')" class="bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 py-3 rounded-2xl text-[9px] font-black active:scale-95 transition-all">بررسی فیش‌ها</button>
                </div>
            </div>`;
    }).join('');
}

window.togglePoolStatus = async function(poolId, currentStatus) {
    try {
        const { error } = await supabaseClient.from('pools').update({ is_active: !currentStatus }).eq('id', poolId);
        if (!error) {
            alert(!currentStatus ? "صندوق باز شد ✅" : "صندوق مسدود شد 🔒");
            loadMasterStats();
        }
    } catch (e) { alert("خطا در تغییر وضعیت"); }
};

window.updatePoolBilling = async function(poolId) {
    const price = document.getElementById(`price-${poolId}`).value;
    const sPrice = document.getElementById(`share-price-${poolId}`).value;
    const { error } = await supabaseClient.from('pools').update({ sub_price: Number(price), share_price: Number(sPrice) }).eq('id', poolId);
    if (!error) alert("تعرفه‌ها با موفقیت ثبت شد ✅");
};

window.viewSubRequests = async function(poolId, poolName) {
    try {
        const { data: requests } = await supabaseClient.from('sub_requests').select('*').eq('pool_id', poolId).eq('status', 'pending');
        if (!requests || requests.length === 0) return alert(`هیچ فیش منتظری برای "${poolName}" وجود ندارد.`);

        const modal = document.createElement('div');
        modal.className = "fixed inset-0 bg-black/95 backdrop-blur-2xl z-[1000] flex items-center justify-center p-6 text-right";
        modal.id = "sub-view-modal";

        let html = `<div class="bg-slate-900 w-full max-w-sm rounded-[3rem] p-8 border border-slate-700 shadow-2xl">
            <h3 class="text-white font-black text-sm mb-6 text-center">فیش‌های ${poolName}</h3>
            <div class="space-y-4 max-h-[50vh] overflow-y-auto pr-2">`;

        requests.forEach(req => {
            html += `
                <div class="bg-slate-800 p-5 rounded-3xl border border-slate-700">
                    <div class="flex justify-between items-center mb-4">
                        <span class="text-yellow-500 font-black text-xs">${Number(req.amount).toLocaleString()} ت</span>
                        <a href="${req.receipt_url}" target="_blank" class="bg-indigo-600 text-white px-3 py-1.5 rounded-xl text-[9px] font-black">مشاهده فیش</a>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="approveSubscription(${req.id}, ${poolId}, 30)" class="flex-1 bg-emerald-500 text-white py-2.5 rounded-xl text-[8px] font-black">تایید (۳۰ روز)</button>
                        <button onclick="approveMemberQuota(${req.id}, ${poolId}, ${req.amount})" class="flex-1 bg-blue-500 text-white py-2.5 rounded-xl text-[8px] font-black">تایید سهمیه</button>
                    </div>
                </div>`;
        });

        html += `</div><button onclick="document.getElementById('sub-view-modal').remove()" class="w-full mt-6 py-2 text-slate-500 font-bold text-xs">بستن پنجره</button></div>`;
        modal.innerHTML = html;
        document.body.appendChild(modal);
    } catch (e) { alert("خطا در لود فیش‌ها"); }
};

window.approveSubscription = async function(requestId, poolId, days) {
    const { data: pool } = await supabaseClient.from('pools').select('sub_expiry').eq('id', poolId).single();
    let start = new Date(pool.sub_expiry) > new Date() ? new Date(pool.sub_expiry) : new Date();
    start.setDate(start.getDate() + days);
    await supabaseClient.from('pools').update({ sub_expiry: start.toISOString(), is_active: true }).eq('id', poolId);
    await supabaseClient.from('sub_requests').update({ status: 'approved' }).eq('id', requestId);
    alert("اشتراک تمدید شد 🚀"); location.reload();
};

window.approveMemberQuota = async function(requestId, poolId, amount) {
    const { data: pool } = await supabaseClient.from('pools').select('member_capacity, share_price').eq('id', poolId).single();
    const newSlots = Math.floor(amount / (pool.share_price || 10000));
    await supabaseClient.from('pools').update({ member_capacity: (pool.member_capacity || 0) + newSlots }).eq('id', poolId);
    await supabaseClient.from('sub_requests').update({ status: 'approved' }).eq('id', requestId);
    alert(`✅ سهمیه اضافه شد.`); location.reload();
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