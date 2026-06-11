import { supabase } from './supabase.js'

// --- DOM ЭЛЕМЕНТҮҮДИЙГ БАРИЖ АВАХ ---
const transactionForm = document.getElementById('transaction-form');
const txTypeInput = document.getElementById('tx-type');
const txCategoryInput = document.getElementById('tx-category');
const txAmountInput = document.getElementById('tx-amount');
const txDateInput = document.getElementById('tx-date');
const txDescInput = document.getElementById('tx-desc');

const budgetForm = document.getElementById('budget-form');
const budgetCategoryInput = document.getElementById('budget-category');
const budgetAmountInput = document.getElementById('budget-amount');
const budgetMonthInput = document.getElementById('budget-month');

const btnLogout = document.getElementById('btn-logout');

// --- ХУУДАС АЧААЛАГДАХ ҮЕД АЖИЛЛАХ ЛОГИК ---
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        window.location.href = 'index.html';
        return;
    }

    // Хэрэглэгчийн ирмэйлийг харуулах
    if (document.getElementById('user-email')) {
        document.getElementById('user-email').textContent = user.email;
    }

    // Бүх өгөгдлийг дарааллаар нь дуудаж дэлгэцэнд гаргах
    await fetchTransactions();
    await fetchBudgets(); 
    await checkBadges(user.id);
    await fetchBadges();
});

// --- ГҮЙЛГЭЭ БҮРТГЭХ ФОРМЫН ЛОГИК (ТӨСӨВ ШАЛГАХТАЙ) ---
if (transactionForm) {
    transactionForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const type = txTypeInput.value;
        const category = txCategoryInput.value;
        const amount = parseFloat(txAmountInput.value);
        const date = txDateInput.value;
        const description = txDescInput.value;

        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            alert("Сешн дууссан байна. Дахин нэвтэрнэ үү.");
            window.location.href = 'index.html';
            return;
        }

        // Хэрэв ЗАРЛАГА бол төсөв хэтэрсэн эсэхийг урьдчилан шалгана
        if (type === 'expense') {
            const currentMonthYear = date.substring(0, 7); // "2026-06-11" -> "2026-06"

            // 1. Тухайн сар, ангилалд төсөв байгааг харах
            const { data: budgetData } = await supabase
                .from('budgets')
                .select('limit_amount')
                .eq('user_id', user.id)
                .eq('category', category)
                .eq('month_year', currentMonthYear)
                .maybeSingle();

            if (budgetData) {
                const limitAmount = budgetData.limit_amount;

                // 2. Өмнөх гүйлгээнүүдийн түүхийг татах
                const { data: pastExpenses } = await supabase
                    .from('transactions')
                    .select('amount, date')
                    .eq('user_id', user.id)
                    .eq('type', 'expense')
                    .eq('category', category);
                
                let totalPastExpense = 0;
                if (pastExpenses) {
                    pastExpenses.forEach(tx => {
                        if (tx.date && tx.date.substring(0, 7) === currentMonthYear) {
                            totalPastExpense += Number(tx.amount);
                        }
                    });
                }

                // 3. Хэтрэлт шалгаж Alert/Confirm өгөх
                if (totalPastExpense + amount > limitAmount) {
                    const currentTotal = totalPastExpense + amount;
                    const proceed = confirm(
                        `⚠️ АНХААРУУЛГА!\n\n` +
                        `Таны ${currentMonthYear} сарын "${category}" ангиллын төсвийн хязгаар: ${limitAmount.toLocaleString()} ₮\n` +
                        `Энэ гүйлгээг хийвэл нийт зарцуулалт: ${currentTotal.toLocaleString()} ₮ болох гэж байна.\n\n` +
                        `Төсөв хэтрүүлж гүйлгээг үргэлжлүүлэх үү?`
                    );
                    
                    if (!proceed) return; // Цуцалбал бааз руу хадгалахгүй зогсоно
                }
            }
        }

        // Бааз руу гүйлгээг оруулах
        const { error } = await supabase
            .from('transactions')
            .insert([{
                user_id: user.id,
                type: type,
                category: category,
                amount: amount,
                description: description,
                date: date
            }]);

        if (error) {
            alert("Гүйлгээг хадгалахад алдаа гарлаа: " + error.message);
        } else {
            alert("Гүйлгээ амжилттай бүртгэгдлээ");

            transactionForm.reset();
            await checkBadges(user.id);
            await fetchTransactions();
            await fetchBudgets(); // Төсвийн ахицыг шинэчлэх
            await fetchBadges();
        }
    });
}

// --- ГҮЙЛГЭЭНҮҮДИЙГ УНШИЖ ҮЛДЭГДЭЛ БОДОХ ФУНКЦ ---
async function fetchTransactions() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

    if (error) {
        console.error("Гүйлгээ уншихад алдаа гарлаа:", error.message);
        return;
    }

    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach(tx => {
        if (tx.type === 'income') {
            totalIncome += Number(tx.amount);
        } else if (tx.type === 'expense') {
            totalExpense += Number(tx.amount);
        }
    });

    const totalBalance = totalIncome - totalExpense;

    if (document.getElementById('total-balance')) document.getElementById('total-balance').textContent = `${totalBalance.toLocaleString()} ₮`;
    if (document.getElementById('total-income')) document.getElementById('total-income').textContent = `${totalIncome.toLocaleString()} ₮`;
    if (document.getElementById('total-expense')) document.getElementById('total-expense').textContent = `${totalExpense.toLocaleString()} ₮`;

    renderTransactions(transactions);
}

// --- ГҮЙЛГЭЭНИЙ ХҮСНЭГТ ХЭВЛЭХ ---
function renderTransactions(transactions) {
    const listContainer = document.getElementById('transaction-list');
    if (!listContainer) return;

    if (transactions.length === 0) {
        listContainer.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted py-4">
                    <i class="fa-solid fa-folder-open fs-3 d-block mb-2"></i>
                    Одоогоор ямар нэгэн гүйлгээ бүртгэгдээгүй байна.
                </td>
            </tr>
        `;
        return;
    }

    let htmlContent = '';
    transactions.forEach(tx => {
        const isIncome = tx.type === 'income';
        const badgeColor = isIncome ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger';
        const typeText = isIncome ? 'Орлого' : 'Зарлага';
        const amountSign = isIncome ? '+' : '-';
        const amountColor = isIncome ? 'text-success' : 'text-danger';

        htmlContent += `
            <tr>
                <td>${tx.date}</td>
                <td><span class="badge bg-light text-dark shadow-sm border">${tx.category}</span></td>
                <td class="text-secondary fw-medium">${tx.description}</td>
                <td><span class="badge ${badgeColor}">${typeText}</span></td>
                <td class="text-end fw-bold ${amountColor}">${amountSign}${Number(tx.amount).toLocaleString()} ₮</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-link text-danger p-0" onclick="deleteTransaction('${tx.id}')">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    listContainer.innerHTML = htmlContent;
}

// --- ГҮЙЛГЭЭ УСТГАХ (ЦОЛ БОЛОН ТӨСӨВ ШИНЭЧИЛДЭГ) ---
window.deleteTransaction = async function(id) {
    const confirmDelete = confirm("Та энэ гүйлгээг устгахдаа итгэлтэй байна уу?");
    if (!confirmDelete) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
        const { error } = await supabase.from('transactions').delete().eq('id', id);
        if (error) throw error;

        alert("Гүйлгээ амжилттай устгагдлаа.");
        
        // Бүх жагсаалт, төсөв, цолыг дахин тооцож шинэчилнэ
        await fetchTransactions();
        await fetchBudgets();
        await checkBadges(user.id); 
        await fetchBadges();

    } catch (error) {
        alert("Гүйлгээ устгахад алдаа гарлаа: " + error.message);
    }
}

// --- ТӨСӨВ ТОГТООХ ФОРМЫН ЛОГИК ---
if (budgetForm) {
    budgetForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const category = budgetCategoryInput.value;
        const limitAmount = parseFloat(budgetAmountInput.value);
        const monthYear = budgetMonthInput.value; 

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return alert("Сешн дууссан байна!");
     
        const { error } = await supabase
            .from('budgets')
            .insert([{ user_id: user.id, category, limit_amount: limitAmount, month_year: monthYear }]);

        if (error) {
            alert("Төсөв тогтооход алдаа гарлаа: " + error.message);
        } else {
            alert(`${monthYear} сарын ${category} ангилалд төсөв амжилттай тогтоогдлоо!`);
            
            budgetForm.reset();
            
            const instance = bootstrap.Offcanvas.getInstance(document.getElementById('offcanvasBudget'));
            if (instance) instance.hide();
            
            await fetchBudgets(); // Төсвүүдийг дахин зурах
            await checkBadges(user.id);
            await fetchBadges();
        }
    });
}

// --- ТОГТООСОН ТӨСВҮҮДИЙГ УНШИЖ ЖАГСААХ ФУНКЦ ---
async function fetchBudgets() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: budgets, error } = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', user.id)
        .order('month_year', { ascending: false });

    if (error) {
        console.error("Төсөв уншихад алдаа гарлаа:", error.message);
        return;
    }

    const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id);

    const budgetsContainer = document.getElementById('current-budgets-list');
    if (!budgetsContainer) return;

    if (!budgets || budgets.length === 0) {
        budgetsContainer.innerHTML = `
            <h6 class="fw-bold text-dark mb-3">Одоогийн тогтоосон төсвүүд:</h6>
            <div class="text-center py-3 text-muted small bg-light rounded">
                Одоогоор төсөв тогтоогоогүй байна.
            </div>
        `;
        return;
    }

    let htmlContent = `<h6 class="fw-bold text-dark mb-3">Одоогийн тогтоосон төсвүүд:</h6>`;

    budgets.forEach(budget => {
        // Зөвхөн тухайн төсвийн САР болон АНГИЛАЛД хамаарах зарлагуудыг шүүж нэмнэ
        const spent = transactions
            ? transactions
                .filter(tx => 
                    tx.type === 'expense' && 
                    tx.category === budget.category &&
                    tx.date && tx.date.substring(0, 7) === budget.month_year
                )
                .reduce((sum, tx) => sum + Number(tx.amount), 0)
            : 0;

        const limit = Number(budget.limit_amount);
        const remaining = limit - spent;
        const percent = Math.min((spent / limit) * 100, 100);

        let progressColor = "bg-success";
        if (percent >= 80) progressColor = "bg-warning";
        if (percent >= 100) progressColor = "bg-danger";

        htmlContent += `
            <div class="card border-0 shadow-sm mb-3">
                <div class="card-body">
                    <div class="d-flex justify-content-between">
                        <div>
                            <h6 class="fw-bold mb-1">${budget.category}</h6>
                            <small class="text-muted">${budget.month_year}</small>
                        </div>
                        <div class="text-end">
                            <div class="fw-bold text-primary">${limit.toLocaleString()} ₮</div>
                        </div>
                    </div>
                    <hr>
                    <div class="small mb-2">
                        Зарцуулсан: <strong>${spent.toLocaleString()} ₮</strong> / ${limit.toLocaleString()} ₮
                    </div>
                    <div class="progress mb-2" style="height: 6px;">
                        <div class="progress-bar ${progressColor}" style="width:${percent}%"></div>
                    </div>
                    <div class="small">
                        Үлдсэн: <strong class="${remaining < 0 ? 'text-danger' : 'text-success'}">
                            ${remaining.toLocaleString()} ₮
                        </strong>
                    </div>
                    ${remaining < 0 ? `<div class="mt-2"><span class="badge bg-danger">Төсөв хэтэрсэн</span></div>` : ''}
                </div>
            </div>
        `;
    });

    budgetsContainer.innerHTML = htmlContent;
}

// --- ЦОЛНЫ СИСТЕМ (АВАХ / ХУРААХ) ---
async function awardBadge(userId, badgeName) {
    const { data: existing } = await supabase
        .from('badges')
        .select('id')
        .eq('user_id', userId)
        .eq('badge_name', badgeName)
        .maybeSingle();

    if (existing) return;

    const { error } = await supabase
        .from('badges')
        .insert([{ user_id: userId, badge_name: badgeName, awarded_at: new Date() }]);

    if (!error) {
        alert(`🎉 Шинэ цол авлаа: ${badgeName}`);
    }
}

async function removeBadge(userId, badgeName) {
    await supabase.from('badges').delete().eq('user_id', userId).eq('badge_name', badgeName);
}

async function checkBadges(userId) {
    const { data: transactions } = await supabase.from('transactions').select('*').eq('user_id', userId);
    const { data: budgets } = await supabase.from('budgets').select('*').eq('user_id', userId);

    if (!transactions) return;

    const transactionCount = transactions.length;
    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach(tx => {
        if (tx.type === 'income') totalIncome += Number(tx.amount);
        if (tx.type === 'expense') totalExpense += Number(tx.amount);
    });

    const balance = totalIncome - totalExpense;

    // Цолны нөхцөлүүд шалгах
    if (transactionCount >= 1) await awardBadge(userId, "Анхны алхам"); else await removeBadge(userId, "Анхны алхам");
    if (transactionCount >= 10) await awardBadge(userId, "10 гүйлгээ"); else await removeBadge(userId, "10 гүйлгээ");
    if (transactionCount >= 50) await awardBadge(userId, "50 гүйлгээ"); else await removeBadge(userId, "50 гүйлгээ");
    if (budgets && budgets.length > 0) await awardBadge(userId, "Анхны төсөв"); else await removeBadge(userId, "Анхны төсөв");
    if (balance > 0) await awardBadge(userId, "Эерэг үлдэгдэл"); else await removeBadge(userId, "Эерэг үлдэгдэл");
    if (totalIncome >= 1000000) await awardBadge(userId, "1 сая төгрөгийн орлого"); else await removeBadge(userId, "1 сая төгрөгийн орлого");
}

async function fetchBadges() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: badges } = await supabase
        .from('badges')
        .select('*')
        .eq('user_id', user.id)
        .order('awarded_at', { ascending: false });

    const badgeList = document.getElementById('badge-list');
    if (!badgeList) return;

    if (!badges || badges.length === 0) {
        badgeList.innerHTML = `<div class="text-muted small">Цол байхгүй байна</div>`;
        return;
    }

    badgeList.innerHTML = badges.map(b => {
        let icon = "bi-award";
        switch (b.badge_name) {
            case "Анхны алхам": icon = "bi-award-fill"; break;
            case "10 гүйлгээ": icon = "bi-journal-check"; break;
            case "50 гүйлгээ": icon = "bi-trophy-fill"; break;
            case "Анхны төсөв": icon = "bi-bullseye"; break;
            case "Эерэг үлдэгдэл": icon = "bi-piggy-bank-fill"; break;
            case "1 сая төгрөгийн орлого": icon = "bi-cash-stack"; break;
        }
        return `
            <div class="card border-0 shadow-sm mb-2">
                <div class="card-body py-2">
                    <i class="bi ${icon} text-warning fs-4 me-2"></i>
                    <span class="fw-semibold">${b.badge_name}</span>
                </div>
            </div>
        `;
    }).join('');
}

// --- СИСТЕМЭЭС ГАРАХ ЛОГИК ---
if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        const confirmLogout = confirm("Та системээс гарахдаа итгэлтэй байна уу?");
        if (!confirmLogout) return;

        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            window.location.href = 'index.html';
        } catch (error) {
            alert("Системээс гарахад алдаа гарлаа: " + error.message);
        }
    });
}