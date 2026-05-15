import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "/Users/paulgao/Documents/augment-projects/20260412-V1.12-LoadProfile/outputs/11543_preinstall_bill";
const outputPath = `${outputDir}/11543_preinstall_baseline_bill_0_20y.xlsx`;

const monthlyLoads = [
  921.8588397150115, 923.6252753036425, 907.7273550059616, 951.0096133576476,
  480.47, 491.73604926348475, 504.2151798375662, 495.0866822817727,
  484.7338669519189, 965.136511636476, 948.3641557590579, 928.0366698691505
];
const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const workbook = Workbook.create();
const summary = workbook.worksheets.add("Summary");
const params = workbook.worksheets.add("Parameters");
const bill = workbook.worksheets.add("Baseline_Bill");

params.getRange("A1:C1").values = [["Parameter", "Value", "Note"]];
params.getRange("A2:C7").values = [
  ["grid_buy", 0.35, "EUR/kWh, year 1 base price"],
  ["grid_sell", 0.07, "Not used in pre-install bill"],
  ["daily_fixed", 0.7, "EUR/day"],
  ["electricity_inflation", 0.02, "Applied to grid_buy only"],
  ["cash_discount_rate", 0.035, "Annual discount rate for present value"],
  ["pv_degradation", 0.004, "Not used before installation"]
];

summary.getRange("A1:D1").values = [["Project 11543 - Pre-install Electricity Bill", "", "", ""]];
summary.getRange("A3:D11").values = [
  ["Item", "Value", "Formula / Meaning", "Code口径"],
  ["Monthly bill", "", "Buy cost + fixed cost", "账单名义金额不使用贴现率"],
  ["Buy cost", "", "Load kWh x grid_buy x inflation factor", "grid_buy = 0.35 EUR/kWh"],
  ["Fixed cost", "", "Days x daily_fixed", "daily_fixed = 0.70 EUR/day"],
  ["Inflation factor", "", "Year 0/1 = 1; Year y>=2 = (1+2%)^(y-1)", "只作用于买电单价"],
  ["Discount factor", "", "(1+3.5%)^(month_index/12)", "只用于现值/NPV，不改变账单"],
  ["Year 0 nominal total", "", "SUM year 0 monthly bills", ""],
  ["Year 1 nominal total", "", "SUM year 1 monthly bills", ""],
  ["Years 1-20 PV total", "", "SUM discounted monthly bills, excluding year 0 reference", ""]
];
summary.getRange("B4:B7").formulas = [
  ["=Baseline_Bill!I14"],
  ["=Baseline_Bill!G14"],
  ["=Baseline_Bill!H14"],
  ["=Baseline_Bill!E14"]
];
summary.getRange("B9:B11").formulas = [
  ["=SUM(Baseline_Bill!I2:I13)"],
  ["=SUM(Baseline_Bill!I14:I25)"],
  ["=SUM(Baseline_Bill!L14:L253)"]
];

bill.getRange("A1:L1").values = [[
  "Year", "Month", "Days", "Load kWh", "Inflation Factor", "Grid Buy Rate",
  "Buy Cost", "Fixed Cost", "Monthly Bill Nominal", "Discount Month Index",
  "Discount Factor", "Present Value"
]];

const valueRows = [];
const formulaRows = [];
for (let y = 0; y <= 20; y++) {
  for (let m = 1; m <= 12; m++) {
    const rowNum = valueRows.length + 2;
    valueRows.push([y, m, days[m - 1], monthlyLoads[m - 1], null, null, null, null, null, null, null, null]);
    formulaRows.push([
      null,
      null,
      null,
      null,
      `=IF(A${rowNum}=0,1,(1+Parameters!$B$5)^(A${rowNum}-1))`,
      `=Parameters!$B$2*E${rowNum}`,
      `=D${rowNum}*F${rowNum}`,
      `=C${rowNum}*Parameters!$B$4`,
      `=G${rowNum}+H${rowNum}`,
      `=IF(A${rowNum}=0,0,(A${rowNum}-1)*12+B${rowNum})`,
      `=(1+Parameters!$B$6)^(J${rowNum}/12)`,
      `=I${rowNum}/K${rowNum}`
    ]);
  }
}
bill.getRange("A2:L253").values = valueRows;
bill.getRange("A2:L253").formulas = formulaRows;

for (const sheet of [summary, params, bill]) {
  sheet.getRange("A1:L253").format = { fontFamily: "Aptos", fontSize: 10 };
}
summary.getRange("A1:D1").format = { bold: true, fontSize: 14 };
summary.getRange("A3:D3").format = { bold: true, fill: { color: "#E8F1FF" } };
params.getRange("A1:C1").format = { bold: true, fill: { color: "#E8F1FF" } };
bill.getRange("A1:L1").format = { bold: true, fill: { color: "#E8F1FF" } };
bill.getRange("D2:L253").numberFormat = "0.000";
bill.getRange("E2:E253").numberFormat = "0.0000";
bill.getRange("F2:L253").numberFormat = "0.000";
params.getRange("B2:B7").numberFormat = "0.0000";

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(outputPath);
