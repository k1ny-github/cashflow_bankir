export class Player {
    constructor(professionData) {
        this.profession = professionData.title || professionData.profession;
        this.cash = professionData.cash !== undefined ? professionData.cash : professionData.savings;
        this.salary = professionData.salary;
        this.children = professionData.children || 0;
        this.perChildExpense = professionData.per_child_expense || 0;
        
        this.expenses = { ...professionData.expenses };
        this.liabilities = { ...professionData.liabilities };
        
        this.assets = professionData.assets ? [...professionData.assets] : [];
        this.passiveIncome = professionData.passiveIncome || 0;
    }

    calculateCashflow() {
        const assetsFlow = this.assets.reduce((sum, a) => sum + (a.cashflow * a.quantity), 0);
        const totalIncome = this.salary + this.passiveIncome + assetsFlow;

        let totalExpenses = Object.values(this.expenses).reduce((a, b) => a + b, 0);
        totalExpenses += (this.children * this.perChildExpense);
        
        return totalIncome - totalExpenses;
    }

    payday() {
        const flow = this.calculateCashflow();
        this.cash += flow;
        return flow;
    }

    addChild() {
        if (this.children >= 3) return { success: false, msg: "Максимум 3 детей!" };
        this.children++;
        return { success: true, msg: `Родился ребенок! Расход +$${this.perChildExpense}` };
    }

    // --- КРЕДИТЫ ---

    takeBankLoan(amount) {
        if (amount % 1000 !== 0) return { success: false, msg: "Сумма д.б. кратна 1000" };
        const monthlyPayment = amount * 0.10;
        this.cash += amount;
        this.liabilities["bank_loan"] = (this.liabilities["bank_loan"] || 0) + amount;
        this.expenses["bank_loan_payment"] = (this.expenses["bank_loan_payment"] || 0) + monthlyPayment;
        return { success: true, msg: `Взят кредит $${amount}` };
    }

    // НОВОЕ: Частичное погашение банковского кредита
    repayBankLoan(amount) {
        if (amount % 1000 !== 0) return { success: false, msg: "Погашение должно быть кратно $1000" };
        
        const currentDebt = this.liabilities["bank_loan"] || 0;
        if (currentDebt === 0) return { success: false, msg: "У вас нет банковского кредита" };
        if (amount > currentDebt) return { success: false, msg: `Сумма превышает долг ($${currentDebt})` };
        if (this.cash < amount) return { success: false, msg: "Недостаточно денег" };

        // Списываем
        this.cash -= amount;
        this.liabilities["bank_loan"] -= amount;
        
        // Пересчитываем платеж (10% от остатка)
        if (this.liabilities["bank_loan"] <= 0) {
            this.liabilities["bank_loan"] = 0;
            this.expenses["bank_loan_payment"] = 0;
        } else {
            this.expenses["bank_loan_payment"] = this.liabilities["bank_loan"] * 0.10;
        }

        return { success: true, msg: `Погашено кредита: $${amount}. Платеж уменьшен.` };
    }

    // Погашение обычных долгов (полное)
    repayDebt(liabilityKey) {
        const debtToExpenseMap = {
            "mortgage": "mortgage_payment",
            "school_loans": "school_loan_payment",
            "car_loans": "car_loan_payment",
            "credit_cards": "credit_card_payment",
            "retail_debt": "retail_payment"
        };

        const cost = this.liabilities[liabilityKey];
        if (!cost) return { success: false, msg: "Нет долга" };
        if (this.cash < cost) return { success: false, msg: "Мало денег" };

        this.cash -= cost;
        this.liabilities[liabilityKey] = 0;
        
        const expenseKey = debtToExpenseMap[liabilityKey];
        if (expenseKey && this.expenses[expenseKey] !== undefined) {
            this.expenses[expenseKey] = 0;
        }

        return { success: true, msg: `Долг погашен: -$${cost}` };
    }

    // --- ОПЕРАЦИИ ---

    // НОВОЕ: Просто получить деньги (Продажа карточки)
    receiveMoney(description, amount) {
        this.cash += amount;
        return { success: true, msg: `${description}: +$${amount}` };
    }

    payOneTimeExpense(title, cost) {
        if (this.cash < cost) return { success: false, msg: "Мало денег! Возьми кредит." };
        this.cash -= cost;
        return { success: true, msg: `Оплачено: ${title} (-$${cost})` };
    }

    buyCustomAsset(title, cost, downPayment, cashflow, quantity) {
        const totalDown = downPayment * quantity;
        if (this.cash < totalDown) return { success: false, msg: `Нужно $${totalDown} на взнос` };

        this.cash -= totalDown;
        const assetMortgage = (cost - downPayment); 

        const newAsset = {
            id: Date.now(),
            title: title,
            cost: cost,
            mortgage: assetMortgage,
            cashflow: cashflow,
            quantity: quantity
        };

        this.assets.push(newAsset);
        this.passiveIncome += cashflow; // Увеличиваем общий пассивный доход
        return { success: true, msg: `Куплен: ${title} (${quantity} шт)` };
    }

    sellAsset(assetId, pricePerUnit) {
        const index = this.assets.findIndex(a => a.id === assetId);
        if (index === -1) return { success: false, msg: "Актив не найден" };

        const asset = this.assets[index];
        const totalSalePrice = pricePerUnit * asset.quantity;
        const totalDebtToPay = asset.mortgage * asset.quantity;
        const profit = totalSalePrice - totalDebtToPay;
        
        this.cash += profit;
        this.passiveIncome -= (asset.cashflow * asset.quantity); // Убираем пассивный доход
        this.assets.splice(index, 1);

        return { success: true, msg: `Продан: ${asset.title}. Прибыль: $${profit}` };
    }

    repayAssetLiability(assetId) {
        const asset = this.assets.find(a => a.id === assetId);
        if (!asset) return { success: false, msg: "Ошибка" };
        if (asset.mortgage <= 0) return { success: false, msg: "Кредит уже погашен" };
        
        const totalDebt = asset.mortgage * asset.quantity;
        if (this.cash < totalDebt) return { success: false, msg: `Нужно $${totalDebt}` };

        this.cash -= totalDebt;
        asset.mortgage = 0; 

        if (asset.cashflow < 0) {
            this.passiveIncome -= asset.cashflow; // Убираем минус из общего потока
            asset.cashflow = 0;
            return { success: true, msg: `Кредит актива погашен! Поток выровнялся.` };
        }
        
        return { success: true, msg: `Кредит актива погашен. Поток не изменился.` };
    }

    saveState() { return JSON.parse(JSON.stringify(this)); }
    loadState(data) {
        Object.assign(this, data);
        this.expenses = { ...data.expenses };
        this.liabilities = { ...data.liabilities };
        this.assets = [...data.assets];
    }
}