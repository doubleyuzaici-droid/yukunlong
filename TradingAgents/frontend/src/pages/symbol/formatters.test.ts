// 数字格式 formatter 单测
// 对应 copy-review.md §2 (数字单位与精度统一)
import {
  fmtMarketCap,
  fmtRatio,
  fmtTurnover,
  fmtDividendYield,
  fmtMultiple,
  fmtValuation,
  fmtPercentile,
  fmtShares,
  classOfChange,
  fmtPct,
  fmtPrice,
  fmtNumber,
  fmtSignedNumber,
  fmtCny,
  fmtCompact,
} from "./formatters.js";

function assertEqual(actual: string, expected: string, msg: string) {
  if (actual !== expected) {
    throw new Error(`${msg}: expected "${expected}", got "${actual}"`);
  }
}

// fmtMarketCap
(function testMarketCap() {
  // ≥ 1 万亿 用 "万亿"
  assertEqual(fmtMarketCap(2_038_400_000_000), "2.04 万亿", "2 万亿");
  assertEqual(fmtMarketCap(1_500_000_000_000), "1.50 万亿", "1.5 万亿");
  // 100 ~ 9999 亿用整数
  assertEqual(fmtMarketCap(85_000_000_000), "850 亿", "850 亿");
  // < 100 亿保留 2 位
  assertEqual(fmtMarketCap(8_500_000_000), "85.00 亿", "85 亿");
  assertEqual(fmtMarketCap(50_000_000), "0.50 亿", "5 千万");
  assertEqual(fmtMarketCap(null), "-", "null");
})();

// fmtRatio
(function testRatio() {
  assertEqual(fmtRatio(0.0089), "0.89%", "正数");
  assertEqual(fmtRatio(-0.123), "-12.30%", "负数");
  assertEqual(fmtRatio(0), "0.00%", "零");
  assertEqual(fmtRatio(0.0001), "0.10‰", "小于 0.1% 用千分号");
  assertEqual(fmtRatio(null), "-", "null");
})();

// fmtTurnover / fmtDividendYield (= fmtRatio 2 位)
(function testTurnover() {
  assertEqual(fmtTurnover(0.0042), "0.42%", "换手率");
  assertEqual(fmtDividendYield(0.024), "2.40%", "股息率");
})();

// fmtMultiple
(function testMultiple() {
  assertEqual(fmtMultiple(1.4), "1.4×", "量比");
  assertEqual(fmtMultiple(null), "-", "null");
})();

// fmtValuation (PE/PB)
(function testValuation() {
  assertEqual(fmtValuation(26.4), "26.4", "PE");
  assertEqual(fmtValuation(9.1, 2), "9.10", "PB 2 位");
  assertEqual(fmtValuation(null), "-", "null");
})();

// fmtPercentile
(function testPercentile() {
  assertEqual(fmtPercentile(0.42), "P42", "百分位 42");
  assertEqual(fmtPercentile(1), "P100", "百分位 100");
  assertEqual(fmtPercentile(null), "-", "null");
})();

// fmtShares
(function testShares() {
  assertEqual(fmtShares(5300), "5,300 股 (53 手)", "整百");
  assertEqual(fmtShares(100), "100 股 (1 手)", "单手");
  assertEqual(fmtShares(50, 100), "50 股", "不足 1 手");
  assertEqual(fmtShares(1000, 1), "1,000 股", "港股 lot=1");
})();

// classOfChange (替代 toneOfChange 避免色彩双语义)
(function testClassOfChange() {
  assertEqual(classOfChange(0.01), "sw-rise", "涨");
  assertEqual(classOfChange(-0.01), "sw-fall", "跌");
  assertEqual(classOfChange(0), "sw-flat", "平");
  assertEqual(classOfChange(null), "sw-flat", "null");
})();

// fmtPct
(function testPct() {
  assertEqual(fmtPct(0.0089), "+0.9%", "正");
  assertEqual(fmtPct(-0.0089), "-0.9%", "负");
  assertEqual(fmtPct(0.0089, 2), "+0.89%", "2 位");
})();

// fmtPrice / fmtNumber / fmtSignedNumber / fmtCny / fmtCompact
(function testBasicFormatters() {
  assertEqual(fmtPrice(1623.5), "¥1623.50", "价格");
  assertEqual(fmtPrice(null), "-", "null");
  assertEqual(fmtNumber(48.2, 1), "48.2", "fmtNumber");
  assertEqual(fmtSignedNumber(14.5), "+14.50", "正号");
  assertEqual(fmtSignedNumber(-14.5), "-14.50", "负号");
  assertEqual(fmtCny(200_000), "¥200,000", "fmtCny");
  assertEqual(fmtCompact(150_000_000), "1.5 亿", "1.5 亿");
  assertEqual(fmtCompact(50_000), "5.0 万", "5 万");
  assertEqual(fmtCompact(500), "500", "无单位");
})();

// eslint-disable-next-line no-console
console.log("formatters tests: PASS");
