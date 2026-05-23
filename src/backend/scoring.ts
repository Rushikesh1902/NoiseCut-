/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CompensationEntry, AnalysisResult } from "../data/types.js";

export class TrustScorer {
  private dataset: CompensationEntry[];

  constructor(dataset: CompensationEntry[] = []) {
    this.dataset = dataset;
  }

  /**
   * Helper to convert currencies to USD using provided exchange rate.
   */
  private convertToUsd(amount: number, currency: string, exchangeRate: number | undefined): number {
    if (!amount) return 0;
    if (currency === "USD") return amount;

    if (exchangeRate && exchangeRate > 0) {
      // Direct division as local currency (e.g., INR) / exchangeRate (e.g., 83.94) = USD
      return amount / exchangeRate;
    }
    return amount;
  }

  /**
   * Safe matching of role title or family.
   */
  private getCohortStats(jobTitle: string, level: string, location: string): { mean: number; stdDev: number; count: number } {
    if (!this.dataset || this.dataset.length === 0) {
      return { mean: 0, stdDev: 0, count: 0 };
    }

    const tcs = this.dataset
      .filter(e => {
        const titleMatch = 
          e.title.toLowerCase() === jobTitle.toLowerCase() || 
          (e.jobFamily && e.jobFamily.toLowerCase() === jobTitle.toLowerCase());
        return titleMatch && e.totalCompensation > 0;
      })
      .map(e => e.totalCompensation);

    if (tcs.length === 0) {
      return { mean: 0, stdDev: 0, count: 0 };
    }

    const mean = tcs.reduce((sum, val) => sum + val, 0) / tcs.length;
    const variance = tcs.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / tcs.length;
    const stdDev = Math.sqrt(variance);

    return {
      mean,
      stdDev,
      count: tcs.length,
    };
  }

  /**
   * Analyze custom compensation entry deterministically.
   */
  public analyzeEntry(entry: CompensationEntry): AnalysisResult {
    const anomalies: string[] = [];
    let deductions = 0;

    const company = (entry.company || "").trim();
    const title = (entry.title || "").trim();
    const level = (entry.level || "").trim() || "N/A";
    const yearsExp = entry.yearsOfExperience;
    const yearsComp = entry.yearsAtCompany;
    const tc = entry.totalCompensation || 0;
    const base = entry.baseSalary || 0;
    const baseCurrency = entry.baseSalaryCurrency || "USD";
    const exRate = entry.exchangeRate || 1.0;

    const stock = entry.avgAnnualStockGrantValue || 0;
    const bonus = entry.avgAnnualBonusValue || 0;

    // Rule 1: CRITICAL FIELD CHECKS
    if (!company) {
      anomalies.push("Missing company name");
      deductions += 40;
    }
    if (!title) {
      anomalies.push("Missing job title/role");
      deductions += 30;
    }
    if (tc <= 0) {
      anomalies.push("Total Compensation must be greater than zero");
      deductions += 50;
    }
    if (base <= 0) {
      anomalies.push("Base salary must be greater than zero");
      deductions += 30;
    }

    // Rule 2: EXPERIENCE VS TITLE/LEVEL MISMATCH
    if (yearsExp !== undefined && yearsExp !== null) {
      if (yearsExp < 0) {
        anomalies.push(`Negative years of experience (${yearsExp}) is invalid`);
        deductions += 40;
      }

      const levelUpper = level.toUpperCase();
      const isEntryLevel = ["IC1", "L1", "ENTRY", "JUNIOR", "INTERN", "ASSOCIATE"].some(x => levelUpper.includes(x));
      const isStaffLevel = ["IC6", "IC7", "IC8", "L6", "L7", "L8", "STAFF", "PRINCIPAL", "DIRECTOR"].some(x => levelUpper.includes(x));

      if (isEntryLevel && yearsExp > 8) {
        anomalies.push(`High experience (${yearsExp} YOE) reported for entry level rank (${level})`);
        deductions += 25;
      }

      if (isStaffLevel && yearsExp < 3) {
        anomalies.push(`Unusually low experience (${yearsExp} YOE) reported for staff/leadership rank (${level})`);
        deductions += 35;
      }
    }

    // Rule 3: TENURE SANITY CHECK
    if (yearsExp !== undefined && yearsComp !== undefined && yearsExp !== null && yearsComp !== null) {
      if (yearsComp > yearsExp) {
        anomalies.push(`Tenure at company (${yearsComp} years) cannot exceed total career experience (${yearsExp} years)`);
        deductions += 30;
      }
    }

    // Rule 4: SUM COMPOSITION CHECKS
    const baseUsd = this.convertToUsd(base, baseCurrency, exRate);
    const sumUsd = baseUsd + stock + bonus;

    if (tc > 0) {
      const diffRatio = Math.abs(tc - sumUsd) / tc;
      if (diffRatio > 0.15) {
        // Direct comparison if candidate used pure local currency calculation mismatch
        const rawDiffDirectStr = Math.abs(tc - (base + stock + bonus)) / tc;
        if (baseCurrency !== "USD" && rawDiffDirectStr < 0.15) {
          anomalies.push(`Currency mismatch: Base salary listed as ${baseCurrency}, but its raw numerical value fits the reported TC in USD. Candidate likely forgot to convert base or selected the wrong currency selection.`);
          deductions += 25;
        } else {
          anomalies.push(`Compensation components mismatch: Base (${baseCurrency} ${base.toLocaleString(undefined, { maximumFractionDigits: 0 })}) + Stock (USD ${stock.toLocaleString(undefined, { maximumFractionDigits: 0 })}) + Bonus (${baseCurrency} ${bonus.toLocaleString(undefined, { maximumFractionDigits: 0 })}) sum to equivalent USD ${Math.round(sumUsd).toLocaleString()}, which deviates from reported TC (USD ${tc.toLocaleString()}) by ${Math.round(diffRatio * 100)}%.`);
          deductions += 20;
        }
      }
    }

    // Rule 5: COHORT OUTLIER ANALYSIS
    const cohort = this.getCohortStats(title, level, entry.location);
    if (cohort.count >= 3) {
      const mean = cohort.mean;
      const std = cohort.stdDev;
      if (std > 0) {
        const zScore = Math.abs(tc - mean) / std;
        if (zScore > 3.0) {
          anomalies.push(`Extreme mathematical outlier: Compensation is ${zScore.toFixed(1)} standard deviations away from cohort mean (Mean: USD ${Math.round(mean).toLocaleString()}, StdDev: ${Math.round(std).toLocaleString()})`);
          deductions += 35;
        } else if (zScore > 2.0) {
          anomalies.push(`Outlier warning: Compensation is ${zScore.toFixed(1)} standard deviations away from cohort mean`);
          deductions += 15;
        }
      }
    } else {
      // General safety thresholds for top enterprise firms
      const roleLower = title.toLowerCase();
      if (roleLower.includes("engineer") || roleLower.includes("developer") || roleLower.includes("manager")) {
        if (tc < 5000 && ["servicenow", "google", "meta", "apple", "microsoft", "amazon"].includes(company.toLowerCase())) {
          anomalies.push(`Suspiciously low compensation (USD ${tc.toLocaleString()}) for an enterprise role at ${company}`);
          deductions += 30;
        }
      }
    }

    const trustScore = Math.max(0, 100 - deductions);

    // Confidence Level
    const confidenceScore = Math.max(10, 100 - (anomalies.length * 15));

    let riskLabel: "Low Risk" | "Medium Risk" | "High Risk" = "Low Risk";
    if (trustScore >= 80) {
      riskLabel = "Low Risk";
    } else if (trustScore >= 50) {
      riskLabel = "Medium Risk";
    } else {
      riskLabel = "High Risk";
    }

    return {
      uuid: entry.uuid || Math.random().toString(36).substring(2),
      trustScore: parseFloat(trustScore.toFixed(1)),
      riskLabel,
      anomalies,
      confidenceScore,
    };
  }
}
