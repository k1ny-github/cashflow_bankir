import { professionsDB } from './data/professions.js';
import { Player } from './models/Player.js';

let myPlayer = null;
let turnCount = 1;
let historyStack = [];
let redoStack = [];

// DOM Элементы
const ui = {
    overlay: document.getElementById('modal-overlay'),
    modalProf: document.getElementById('modal-profession'),
    modalTrans: document.getElementById('modal-transaction'),
    profList: document.getElementById('profession-list'),
    
    tabs: document.querySelectorAll('.tab-btn'),
    formExpense: document.getElementById('form-expense'),
    formIncome: document.getElementById('form-income'),
    formAsset: document.getElementById('form-asset'),
    
    inputs: {
        expTitle: document.getElementById('exp-title'),
        expCost: document.getElementById('exp-cost'),
        incTitle: document.getElementById('inc-title'),
        incAmount: document.getElementById('inc-amount'),
        assTitle: document.getElementById('asset-title'),
        assCost: document.getElementById('asset-cost'),
        assDown: document.getElementById('asset-down'),
        assFlow: document.getElementById('asset-flow'),
        assQty: document.getElementById('asset-qty'),
    },

    btnNewOp: document.getElementById('btn-new-op'),
    btnSubmitExpense: document.getElementById('btn-submit-expense'),
    btnSubmitIncome: document.getElementById('btn-submit-income'),
    btnSubmitAsset: document.getElementById('btn-submit-asset'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    
    btnPayday: document.getElementById('btn-payday'),
    btnUndo: document.getElementById('btn-undo'),
    btnRedo: document.getElementById('btn-redo'),
    btnLoan: document.getElementById('btn-loan'),
    btnChild: document.getElementById('btn-child'),
    // Кнопка Reset удалена

    profession: document.getElementById('profession-name'),
    turn: document.getElementById('turn-count'),
    cash: document.getElementById('total-cash'),
    salary: document.getElementById('salary-val'),
    passiveList: document.getElementById('passive-list'),
    totalIncome: document.getElementById('total-income'),
    expensesList: document.getElementById('expenses-list'),
    childCount: document.getElementById('child-count'),
    childExpense: document.getElementById('child-expense-val'),
    totalExpenses: document.getElementById('total-expenses'),
    cashFlow: document.getElementById('cash-flow'),
    assetsList: document.getElementById('assets-list'),
    liabilitiesList: document.getElementById('liabilities-list'),
    assetLiabilitiesList: document.getElementById('asset-liabilities-list'),
    log: document.getElementById('action-log')
};

const labels = {
    "taxes": "Налоги", "mortgage_payment": "Ипотека (дом)", 
    "school_loan_payment": "Учеба", "car_loan_payment": "Авто",
    "credit_card_payment": "Кредитки", "retail_payment": "Мелкие долги",
    "bank_loan_payment": "Банк (10%)", "mortgage": "Ипотека (дом)",
    "school_loans": "Учеба (долг)", "car_loans": "Авто (долг)",
    "credit_cards": "Кредитки", "retail_debt": "Мелкие долги",
    "bank_loan": "Банковский кредит"
};

// --- СОХРАНЕНИЕ / ЗАГРУЗКА ---
function saveGame() {
    if (!myPlayer) return;
    const data = {
        player: myPlayer.saveState(),
        turn: turnCount,
        history: historyStack,
        redo: redoStack
    };
    localStorage.setItem('cashflow_autosave', JSON.stringify(data));
}

function loadGame() {
    const saved = localStorage.getItem('cashflow_autosave');
    if (!saved) return false;
    try {
        const data = JSON.parse(saved);
        myPlayer = new Player(data.player);
        myPlayer.loadState(data.player);
        turnCount = data.turn;
        historyStack = data.history || [];
        redoStack = data.redo || [];
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
}

// --- СТАРТ ---
function init() {
    // ЛОГИКА СБРОСА: 
    // Если есть сохранение -> спрашиваем продолжить?
    // Если нажал "Отмена" -> чистим сохранение и начинаем новую игру
    if (localStorage.getItem('cashflow_autosave')) {
        if (confirm("Найдена прошлая игра. Продолжить?")) {
            loadGame();
            ui.overlay.classList.add('hidden');
            ui.modalProf.classList.add('hidden');
            updateUI();
            logAction("Игра восстановлена!");
        } else {
            localStorage.removeItem('cashflow_autosave');
            renderProfessions();
        }
    } else {
        renderProfessions();
    }
}

function renderProfessions() {
    ui.overlay.classList.remove('hidden');
    ui.modalProf.classList.remove('hidden');
    ui.profList.innerHTML = '';
    professionsDB.forEach(prof => {
        const btn = document.createElement('button');
        btn.classList.add('btn-select');
        btn.textContent = prof.title;
        btn.onclick = () => startGame(prof);
        ui.profList.appendChild(btn);
    });
}

function startGame(prof) {
    myPlayer = new Player(prof);
    turnCount = 1; historyStack = []; redoStack = [];
    ui.modalProf.classList.add('hidden');
    ui.overlay.classList.add('hidden');
    updateUI();
    logAction(`Старт! Вы: ${prof.title}`);
}

// --- ЛОГИКА ---
function saveHistory() {
    historyStack.push({ p: myPlayer.saveState(), t: turnCount });
    redoStack = [];
    if (historyStack.length > 50) historyStack.shift();
    updateButtons();
}

function undo() {
    if(!historyStack.length) return;
    redoStack.push({ p: myPlayer.saveState(), t: turnCount });
    const prev = historyStack.pop();
    myPlayer.loadState(prev.p); turnCount = prev.t;
    updateUI(); logAction('Отмена');
}

function redo() {
    if(!redoStack.length) return;
    historyStack.push({ p: myPlayer.saveState(), t: turnCount });
    const next = redoStack.pop();
    myPlayer.loadState(next.p); turnCount = next.t;
    updateUI(); logAction('Повтор');
}

// --- UI ---
function updateUI() {
    if(!myPlayer) return;

    ui.profession.textContent = myPlayer.profession;
    ui.turn.textContent = turnCount;
    ui.cash.textContent = `$${myPlayer.cash.toLocaleString()}`;
    
    const cashFlow = myPlayer.calculateCashflow();
    
    // Доходы
    ui.salary.textContent = `$${myPlayer.salary.toLocaleString()}`;
    ui.passiveList.innerHTML = '';
    let totalPassive = myPlayer.passiveIncome; 
    const assetsFlow = myPlayer.assets.reduce((sum, a) => sum + (a.cashflow * a.quantity), 0);
    totalPassive += assetsFlow;
    
    myPlayer.assets.forEach(a => {
        const flow = a.cashflow * a.quantity;
        const div = document.createElement('div');
        div.innerHTML = `<span>${a.title} (${a.quantity})</span> <span class="${flow >=0 ? 'val-green' : 'val-red'}">${flow > 0 ? '+' : ''}$${flow}</span>`;
        const btnSell = document.createElement('button');
        btnSell.textContent = 'Продать';
        btnSell.style.fontSize = '0.7em'; btnSell.style.marginLeft = '5px';
        btnSell.onclick = () => handleSell(a);
        div.firstChild.appendChild(btnSell);
        ui.passiveList.appendChild(div);
    });
    ui.totalIncome.textContent = `$${(myPlayer.salary + totalPassive).toLocaleString()}`;

    // Расходы
    ui.expensesList.innerHTML = '';
    for(const [k, v] of Object.entries(myPlayer.expenses)) {
        if(v === 0) continue;
        const div = document.createElement('div');
        div.innerHTML = `<span>${labels[k]||k}</span> <span style="color:#ff8888">-$${v}</span>`;
        ui.expensesList.appendChild(div);
    }
    ui.childCount.textContent = myPlayer.children;
    ui.childExpense.textContent = `-$${(myPlayer.children * myPlayer.perChildExpense)}`;
    
    const totalExp = (myPlayer.salary + totalPassive) - cashFlow;
    ui.totalExpenses.textContent = `-$${totalExp.toLocaleString()}`;
    ui.cashFlow.textContent = `+$${cashFlow.toLocaleString()}`;

    // Активы
    ui.assetsList.innerHTML = '';
    myPlayer.assets.forEach(a => {
        const div = document.createElement('div');
        div.textContent = `${a.title}`;
        ui.assetsList.appendChild(div);
    });

    // Пассивы
    ui.liabilitiesList.innerHTML = '';
    for(const [k, v] of Object.entries(myPlayer.liabilities)) {
        if(v === 0) continue;
        const div = document.createElement('div');
        div.classList.add('clickable-row');
        
        if (k === 'bank_loan') {
            div.style.display = 'flex'; div.style.justifyContent = 'space-between'; div.style.alignItems = 'center';
            div.innerHTML = `<span>${labels[k]||k}</span><div><span>-$${v.toLocaleString()}</span></div>`;
            const btnFull = document.createElement('button');
            btnFull.textContent = 'Закрыть'; btnFull.classList.add('btn-mini');
            btnFull.onclick = (e) => { e.stopPropagation(); handleFullRepayBankLoan(v); };
            div.lastElementChild.appendChild(btnFull);
            div.onclick = () => handleRepayBankLoan(v);
        } else {
            div.innerHTML = `<span>${labels[k]||k}</span> <span>-$${v.toLocaleString()}</span>`;
            div.onclick = () => handleRepayStandard(k, v);
        }
        ui.liabilitiesList.appendChild(div);
    }

    ui.assetLiabilitiesList.innerHTML = '';
    myPlayer.assets.forEach(a => {
        if(a.mortgage > 0) {
            const div = document.createElement('div');
            div.classList.add('clickable-row');
            div.innerHTML = `<span>${a.title} (Кредит)</span> <span>-$${(a.mortgage * a.quantity).toLocaleString()}</span>`;
            div.onclick = () => handleRepayAssetLiability(a);
            ui.assetLiabilitiesList.appendChild(div);
        }
    });

    updateButtons();
    saveGame(); 
}

function updateButtons() {
    ui.btnUndo.disabled = !historyStack.length;
    ui.btnRedo.disabled = !redoStack.length;
}

function logAction(msg) {
    const li = document.createElement('li');
    li.textContent = `[Ход ${turnCount}] ${msg}`;
    ui.log.prepend(li);
}

// --- ОБРАБОТЧИКИ ---
ui.btnNewOp.onclick = () => { ui.overlay.classList.remove('hidden'); ui.modalTrans.classList.remove('hidden'); };
ui.btnCloseModal.onclick = () => { ui.overlay.classList.add('hidden'); ui.modalTrans.classList.add('hidden'); };

ui.tabs.forEach(tab => {
    tab.onclick = () => {
        ui.tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        ui.formExpense.classList.add('hidden');
        ui.formIncome.classList.add('hidden');
        ui.formAsset.classList.add('hidden');
        if(tab.dataset.tab === 'expense') ui.formExpense.classList.remove('hidden');
        if(tab.dataset.tab === 'income') ui.formIncome.classList.remove('hidden');
        if(tab.dataset.tab === 'asset') ui.formAsset.classList.remove('hidden');
    }
});

ui.btnSubmitExpense.onclick = () => {
    const title = ui.inputs.expTitle.value || "Расход";
    const cost = parseInt(ui.inputs.expCost.value);
    if(!cost) return;
    saveHistory();
    const res = myPlayer.payOneTimeExpense(title, cost);
    if(res.success) { logAction(res.msg); ui.overlay.classList.add('hidden'); updateUI(); ui.inputs.expTitle.value = ''; ui.inputs.expCost.value = ''; }
    else { alert(res.msg); historyStack.pop(); }
};

ui.btnSubmitIncome.onclick = () => {
    const title = ui.inputs.incTitle.value || "Доход";
    const amount = parseInt(ui.inputs.incAmount.value);
    if(!amount) return;
    saveHistory();
    const res = myPlayer.receiveMoney(title, amount);
    if(res.success) { logAction(res.msg); ui.overlay.classList.add('hidden'); updateUI(); ui.inputs.incTitle.value = ''; ui.inputs.incAmount.value = ''; }
};

ui.btnSubmitAsset.onclick = () => {
    const title = ui.inputs.assTitle.value || "Актив";
    const cost = parseInt(ui.inputs.assCost.value);
    const down = parseInt(ui.inputs.assDown.value) || 0;
    const flow = parseInt(ui.inputs.assFlow.value) || 0;
    const qty = parseInt(ui.inputs.assQty.value) || 1;
    if(!cost) return;
    saveHistory();
    const res = myPlayer.buyCustomAsset(title, cost, down, flow, qty);
    if(res.success) { logAction(res.msg); ui.overlay.classList.add('hidden'); updateUI(); ui.inputs.assTitle.value = ''; ui.inputs.assCost.value = ''; ui.inputs.assDown.value = ''; ui.inputs.assFlow.value = ''; ui.inputs.assQty.value = 1; }
    else { alert(res.msg); historyStack.pop(); }
};

function handleSell(asset) {
    const price = prompt(`Почем продаем 1 шт "${asset.title}"?`);
    if(price) { saveHistory(); const res = myPlayer.sellAsset(asset.id, parseInt(price)); if(res.success) { logAction(res.msg); updateUI(); } else { alert(res.msg); historyStack.pop(); } }
}

function handleRepayStandard(key, amount) {
    if(confirm(`Погасить "${labels[key]||key}" за $${amount}?`)) {
        saveHistory(); const res = myPlayer.repayDebt(key);
        if(res.success) { logAction(res.msg); updateUI(); } else { alert(res.msg); historyStack.pop(); }
    }
}

function handleRepayBankLoan(currentDebt) {
    const input = prompt(`Ваш долг банку: $${currentDebt}.\nСколько погасить?\n(Кратно 1000)`, "1000");
    if(input) {
        const amount = parseInt(input);
        if(isNaN(amount) || amount <= 0) return;
        saveHistory();
        const res = myPlayer.repayBankLoan(amount);
        if(res.success) { logAction(res.msg); updateUI(); }
        else { alert(res.msg); historyStack.pop(); }
    }
}

function handleFullRepayBankLoan(totalDebt) {
    if(confirm(`Погасить ВЕСЬ банковский кредит ($${totalDebt}) разом?`)) {
        saveHistory();
        const res = myPlayer.repayBankLoan(totalDebt);
        if(res.success) { logAction(`🚀 Кредит полностью закрыт!`); updateUI(); } 
        else { alert(res.msg); historyStack.pop(); }
    }
}

function handleRepayAssetLiability(asset) {
    if(confirm(`Погасить долг за "${asset.title}"?`)) {
        saveHistory(); const res = myPlayer.repayAssetLiability(asset.id);
        if(res.success) { logAction(res.msg); updateUI(); } else { alert(res.msg); historyStack.pop(); }
    }
}

ui.btnPayday.onclick = () => { saveHistory(); const v = myPlayer.payday(); turnCount++; logAction(`ЗП: +$${v}`); updateUI(); };
ui.btnUndo.onclick = undo;
ui.btnRedo.onclick = redo;

ui.btnLoan.onclick = () => {
    const val = prompt("Сумма кредита (кратно 1000):", "1000");
    if(val) { saveHistory(); const res = myPlayer.takeBankLoan(parseInt(val)); if(res.success) { logAction(res.msg); updateUI(); } else { alert(res.msg); historyStack.pop(); } }
};

ui.btnChild.onclick = () => {
    if(confirm("Добавить ребенка?")) { saveHistory(); const res = myPlayer.addChild(); if(res.success) { logAction(res.msg); updateUI(); } else { alert(res.msg); historyStack.pop(); } }
};

init();