/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CompanyInfo {
  name: string;
  slug?: string;
  registered?: boolean;
  icon?: string;
}

export interface AdditionalBonus {
  type: string;
  value: number;
  currency: string;
}

export interface VestingScheduleItem {
  percent: number;
  occurrences: number;
}

export interface CompensationEntry {
  uuid: string;
  company: string;
  title: string;
  jobFamily?: string;
  jobFamilySlug?: string;
  level: string;
  focusTag?: string;
  yearsOfExperience: number;
  yearsAtCompany: number;
  yearsAtLevel?: number | null;
  offerDate?: string;
  location: string;
  locationSlug?: string;
  workArrangement?: string;
  compPerspective?: string;
  exchangeRate?: number;
  baseSalary: number;
  baseSalaryCurrency: string;
  totalCompensation: number; // typically in USD / converted
  avgAnnualStockGrantValue?: number;
  avgAnnualBonusValue?: number;
  firstYearTotalCompensation?: number;
  firstYearStockGrantValue?: number;
  totalStockGrantValue?: number;
  stockGrantCurrency?: string;
  firstYearBonusValue?: number;
  bonusCurrency?: string;
  companyInfo?: CompanyInfo;
  additionalBonuses?: AdditionalBonus[];
  vestingSchedule?: VestingScheduleItem[];
  education?: string | null;
  otherDetails?: string | null;
  userCurrency?: string;
}

export interface AnalysisResult {
  uuid: string;
  trustScore: number; // 0 - 100
  riskLabel: "Low Risk" | "Medium Risk" | "High Risk";
  anomalies: string[];
  explanation?: string;
  confidenceScore: number; // 0 - 100
}

export interface DashboardStats {
  totalEntries: number;
  flaggedEntries: number;
  averageTrustScore: number;
}

export interface SalaryAnalysis {
  entry: CompensationEntry;
  analysis: AnalysisResult;
}
