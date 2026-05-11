const express = require("express");
const OpenAI = require("openai");
const ExcelJS = require("exceljs");

const router = express.Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function calculateAnnualRrspWithdrawal(inputs) {
    const {
      yearsToRetire,
      yearsToPlan,
      rrspInitialBalance,
      rrspContribute,
      rrspRoi,
    } = inputs;
  
    let rrspBalance = Number(rrspInitialBalance);
  
    // Work years: contribute to RRSP from year 0 until retirement
    for (let year = 0; year < Number(yearsToRetire); year++) {
      rrspBalance =
        rrspBalance * (1 + Number(rrspRoi) / 100) +
        Number(rrspContribute);
    }
  
    const retirementYears =
      Number(yearsToPlan) - Number(yearsToRetire) + 1;
  
    if (retirementYears <= 0) {
      return 0;
    }
  
    const r = Number(rrspRoi) / 100;
  
    if (r === 0) {
      return rrspBalance / retirementYears;
    }
  
    return (
      (rrspBalance * r) /
      (1 - Math.pow(1 + r, -retirementYears))
    );
  }

function simulateRetirementPlan(inputs) {
    const annualRrspWithdrawal = calculateAnnualRrspWithdrawal(inputs);
    const {
      currentAge,
      yearsToRetire,
      yearsToPlan,
      incomeAnnual,
      expensesAnnual,
      inflationRate,
      rrspInitialBalance,
      rrspContribute,
      rrspRoi,
      tfsaInitialBalance,
      tfsaContribute,
      tfsaRoi,
      nonRegisteredInitialBalance,
      nonRegisteredRoi,
    } = inputs;
  
    const results = [];
  
    let rrspBalance = Number(rrspInitialBalance);
    let tfsaBalance = Number(tfsaInitialBalance);
    let nonRegisteredBalance = Number(nonRegisteredInitialBalance);
  
    const maxYears =
    yearsToPlan === undefined ||
    yearsToPlan === null ||
    yearsToPlan === ""
        ? 120
        : Number(yearsToPlan);

    for (let year = 0; year <= maxYears; year++) {
      const age = Number(currentAge) + year;
      const retired = year >= Number(yearsToRetire);
  
      const expenses =
        Number(expensesAnnual) *
        Math.pow(1 + Number(inflationRate) / 100, year);
  
      const income = retired ? 0 : Number(incomeAnnual);
  
      let rrspContribution = 0;
      let tfsaContribution = 0;
      let nonRegisteredContribution = 0;
  
      let rrspWithdrawal = 0;
      let tfsaWithdrawal = 0;
      let nonRegisteredWithdrawal = 0;
  
      // growth first
      rrspBalance = rrspBalance * (1 + Number(rrspRoi) / 100);
      tfsaBalance = tfsaBalance * (1 + Number(tfsaRoi) / 100);
      nonRegisteredBalance =
        nonRegisteredBalance * (1 + Number(nonRegisteredRoi) / 100);
  
      if (!retired) {
        rrspContribution = Number(rrspContribute);
        tfsaContribution = Number(tfsaContribute);
  
        const remainingIncome =
          income - expenses - rrspContribution - tfsaContribution;
  
        nonRegisteredContribution = Math.max(remainingIncome, 0);
  
        rrspBalance += rrspContribution;
        tfsaBalance += tfsaContribution;
        nonRegisteredBalance += nonRegisteredContribution;
      } else {
        let amountNeeded = expenses;

        // 1. Fixed RRSP withdrawal first
        const fromRrsp = Math.min(
            rrspBalance,
            annualRrspWithdrawal
        );

        rrspWithdrawal = fromRrsp;
        rrspBalance -= fromRrsp;
        amountNeeded -= fromRrsp;

        // If RRSP withdrawal is greater than expenses,
        // extra cash goes to non-registered
        if (amountNeeded < 0) {
        nonRegisteredContribution += Math.abs(amountNeeded);
        nonRegisteredBalance += nonRegisteredContribution;
        amountNeeded = 0;
        }

        // 2. Use Non-Registered to cover remaining expenses
        if (amountNeeded > 0) {
            const fromNonRegistered = Math.min(
                nonRegisteredBalance,
                amountNeeded
            );

            nonRegisteredWithdrawal = fromNonRegistered;
            nonRegisteredBalance -= fromNonRegistered;
            amountNeeded -= fromNonRegistered;
        }

        // 3. Use TFSA last
        if (amountNeeded > 0) {
        const fromTfsa = Math.min(tfsaBalance, amountNeeded);

        tfsaWithdrawal = fromTfsa;
        tfsaBalance -= fromTfsa;
        amountNeeded -= fromTfsa;
        }

        // 4. If still not enough, assets depleted
        if (amountNeeded > 0) {
        tfsaBalance -= amountNeeded;
        }
    }
  
      const totalAssets =
        rrspBalance + tfsaBalance + nonRegisteredBalance;
  
      results.push({
        year: year + 1,
        age,
        retired,
        income: Number(income.toFixed(2)),
        expenses: Number(expenses.toFixed(2)),
  
        rrspContribution: Number(rrspContribution.toFixed(2)),
        tfsaContribution: Number(tfsaContribution.toFixed(2)),
        nonRegisteredContribution: Number(
          nonRegisteredContribution.toFixed(2)
        ),
  
        rrspWithdrawal: Number(rrspWithdrawal.toFixed(2)),
        tfsaWithdrawal: Number(tfsaWithdrawal.toFixed(2)),
        nonRegisteredWithdrawal: Number(
          nonRegisteredWithdrawal.toFixed(2)
        ),
  
        rrspBalance: Number(rrspBalance.toFixed(2)),
        tfsaBalance: Number(tfsaBalance.toFixed(2)),
        nonRegisteredBalance: Number(
          nonRegisteredBalance.toFixed(2)
        ),
        totalAssets: Number(totalAssets.toFixed(2)),
      });
  
      if (totalAssets <= 0) {
        break;
      }
    }
  
    return results;
}

router.post("/", async (req, res) => {
  try {
    const {
      currentAge,
      yearsToRetire,
      yearsToPlan,
      incomeAnnual,
      expensesAnnual,
      inflationRate,

      rrspInitialBalance,
      rrspContribute,
      rrspRoi,

      tfsaInitialBalance,
      tfsaContribute,
      tfsaRoi,

      nonRegisteredInitialBalance,
      nonRegisteredRoi,
    } = req.body;

    let results;

    if (req.body.mode === "solve_years") {
        results = simulateRetirementPlan({
            ...req.body,
            yearsToPlan: "",
        });
    } else if (req.body.mode === "solve_expenses") {
        let low = 0;
        let high = 300000;
      
        let bestExpense = 0;
        let bestResults = [];
      
        for (let i = 0; i < 30; i++) {
          const mid = (low + high) / 2;
      
          const testResults = simulateRetirementPlan({
            ...req.body,
            expensesAnnual: mid,
          });
      
          const lastRow =
            testResults[testResults.length - 1];
      
          const depleted =
            lastRow.totalAssets <= 0;
      
          if (!depleted) {
            bestExpense = mid;
            bestResults = testResults;
            low = mid;
          } else {
            high = mid;
          }
        }
      
        results = bestResults;
      
        req.body.calculatedExpense =
          bestExpense.toFixed(2);
    } else if (req.body.mode === "solve_retirement") {
        let bestYearsToRetire = null;
        let bestResults = [];

        for (
            let testYearsToRetire = 0;
            testYearsToRetire <= 60;
            testYearsToRetire++
        ) {
            const testResults = simulateRetirementPlan({
            ...req.body,
            yearsToRetire: testYearsToRetire,
            });

            const lastRow = testResults[testResults.length - 1];

            const survivesFullPlan =
            testResults.length === Number(req.body.yearsToPlan) + 1 &&
            lastRow.totalAssets > 0;

            if (survivesFullPlan) {
            bestYearsToRetire = testYearsToRetire;
            bestResults = testResults;
            break;
            }
        }

        if (bestYearsToRetire === null) {
            bestYearsToRetire = "Not possible within 60 years";
            bestResults = simulateRetirementPlan({
            ...req.body,
            yearsToRetire: 60,
            });
        }

        results = bestResults;
        req.body.calculatedYearsToRetire = bestYearsToRetire;
    } else {
        results = simulateRetirementPlan(req.body);
    }

    const firstNegative = results.find(
        (row) => row.totalAssets <= 0
    );
    
    const finalYear = results[results.length - 1];

    let solvedValue = null;

    if (req.body.mode === "solve_years") {
    solvedValue = {
        type: "asset_duration",
        depletionAge: firstNegative
        ? firstNegative.age
        : "Not depleted",
        yearsLasted: results.length,
    };
    }

    if (req.body.mode === "solve_expenses") {
    solvedValue = {
        type: "max_expenses",
        maxExpenses:
        req.body.calculatedExpense,
    };
    }

    if (req.body.mode === "solve_retirement") {
    solvedValue = {
        type: "retirement_time",
        yearsToRetire: req.body.calculatedYearsToRetire,
        retirementAge:
        typeof req.body.calculatedYearsToRetire === "number"
            ? Number(req.body.currentAge) + req.body.calculatedYearsToRetire
            : "Not possible",
    };
    }

    const aiPrompt = `
You are an AI retirement planning assistant.

Analyze the following retirement projection.

User Inputs:
- Current age: ${currentAge}
- Years to retire: ${yearsToRetire}
- Years to plan: ${yearsToPlan}
- Annual income: ${incomeAnnual}
- Annual expenses: ${expensesAnnual}
- Inflation rate: ${inflationRate}%
- RRSP initial balance: ${rrspInitialBalance}
- RRSP annual contribution: ${rrspContribute}
- RRSP ROI: ${rrspRoi}%
- TFSA initial balance: ${tfsaInitialBalance}
- TFSA annual contribution: ${tfsaContribute}
- TFSA ROI: ${tfsaRoi}%
- Non-registered initial balance: ${nonRegisteredInitialBalance}
- Non-registered ROI: ${nonRegisteredRoi}%

Projection Summary:
- Final age: ${finalYear.age}
- Final total assets: ${finalYear.totalAssets}
- Asset depletion age: ${firstNegative ? firstNegative.age : "Not depleted during projection"}

Return ONLY valid JSON in this exact format:
{
  "summary": "brief summary",
  "riskLevel": "Low / Medium / High",
  "assetDepletionAge": "age or Not depleted",
  "keyFindings": ["finding 1", "finding 2", "finding 3"],
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"]
}
`;

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: aiPrompt }],
      temperature: 0.3,
    });

    const aiText = aiResponse.choices[0].message.content;

    let aiAnalysis;

    try {
      aiAnalysis = JSON.parse(aiText);
    } catch (parseError) {
      aiAnalysis = {
        summary: aiText,
        riskLevel: "Unknown",
        assetDepletionAge: firstNegative
          ? firstNegative.age
          : "Not depleted",
        keyFindings: [],
        recommendations: [],
      };
    }

    res.json({
      success: true,
      mode: req.body.mode,
      solvedValue,
      results,
      aiAnalysis,
    });
  } catch (error) {
    console.error("Analyze retirement error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

router.post("/excel", async (req, res) => {
    try {
      const data = req.body.results;
  
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Retirement Projection");
  
      worksheet.columns = [
        { header: "Age", key: "age", width: 10 },
        { header: "Retired", key: "retired", width: 12 },
        { header: "Income", key: "income", width: 15 },
        { header: "Expenses", key: "expenses", width: 15 },
        { header: "RRSP Balance", key: "rrspBalance", width: 18 },
        { header: "TFSA Balance", key: "tfsaBalance", width: 18 },
        {
          header: "Non-Registered Balance",
          key: "nonRegisteredBalance",
          width: 25,
        },
        { header: "Total Assets", key: "totalAssets", width: 18 },
      ];
  
      data.forEach((row) => {
        worksheet.addRow(row);
      });
  
      worksheet.getRow(1).font = { bold: true };
  
      worksheet.eachRow((row) => {
        row.eachCell((cell) => {
          cell.numFmt = "#,##0.00";
        });
      });
  
      worksheet.getColumn("A").numFmt = "0";
  
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
  
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=retirement_projection.xlsx"
      );
  
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error("Excel generation error:", error);
  
      res.status(500).json({
        success: false,
        message: "Failed to generate Excel",
      });
    }
});

module.exports = router;