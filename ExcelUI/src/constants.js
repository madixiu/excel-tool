export const OPS = [
  { v: "==",           l: "equals" },
  { v: "!=",           l: "not equals" },
  { v: ">",            l: ">" },
  { v: ">=",           l: ">=" },
  { v: "<",            l: "<" },
  { v: "<=",           l: "<=" },
  { v: "contains",     l: "contains" },
  { v: "starts_with",  l: "starts with" },
  { v: "ends_with",    l: "ends with" },
  { v: "is_empty",     l: "is empty" },
  { v: "is_not_empty", l: "is not empty" },
];

// export const FUNCTIONS = [
//   { name: "SUMIFS",   args: 3,  hint: "SUMIFS(Amount, Region, RegionLookup)" },
//   { name: "COUNTIFS", args: 3,  hint: "COUNTIFS(OrderID, Region, RegionLookup)" },
//   { name: "AVGIFS",   args: 3,  hint: "AVGIFS(Price, Category, CategoryLookup)" },
//   { name: "SUM",      args: 1,  hint: "SUM(Sales)" },
//   { name: "AVG",      args: 1,  hint: "AVG(Score)" },
//   { name: "MIN",      args: 1,  hint: "MIN(Temperature)" },
//   { name: "MAX",      args: 1,  hint: "MAX(Revenue)" },
//   { name: "COUNT",    args: 1,  hint: "COUNT(Customer)" },
//   { name: "STD",      args: 1,  hint: "STD(Returns)" },
//   { name: "VAR",      args: 1,  hint: "VAR(Returns)" },
//   { name: "ROWSUM",   args: -1, hint: "ROWSUM(Q1, Q2, Q3, Q4)" },
//   { name: "ROWAVG",   args: -1, hint: "ROWAVG(Math, Science, English)" },
//   { name: "ROWMIN",   args: -1, hint: "ROWMIN(PriceA, PriceB, PriceC)" },
//   { name: "ROWMAX",   args: -1, hint: "ROWMAX(Score1, Score2, Score3)" },
//   { name: "ADD",      args: 2,  hint: "ADD(Price, Tax)" },
//   { name: "SUB",      args: 2,  hint: "SUB(Revenue, Cost)" },
//   { name: "MUL",      args: 2,  hint: "MUL(Quantity, UnitPrice)" },
//   { name: "DIV",      args: 2,  hint: "DIV(Total, Count)" },
// ];

export const FUNCTIONS = [
  // ============ Conditional Aggregation ============
  { name: "SUMIFS",    args: 3,  hint: "SUMIFS(AmountCol, MatchCol, KeyCol)" },
  { name: "COUNTIFS",  args: 3,  hint: "COUNTIFS(AnyCol, MatchCol, KeyCol)" },
  { name: "AVGIFS",    args: 3,  hint: "AVGIFS(AmountCol, MatchCol, KeyCol)" },
  { name: "MINIFS",    args: 3,  hint: "MINIFS(AmountCol, MatchCol, KeyCol)" },
  { name: "MAXIFS",    args: 3,  hint: "MAXIFS(AmountCol, MatchCol, KeyCol)" },
  { name: "MEDIANIFS", args: 3,  hint: "MEDIANIFS(AmountCol, MatchCol, KeyCol)" },
  { name: "STDIFS",    args: 3,  hint: "STDIFS(AmountCol, MatchCol, KeyCol)" },

  // ============ Simple Aggregates ============
  { name: "SUM",       args: 1,  hint: "SUM(AmountCol)" },
  { name: "AVG",       args: 1,  hint: "AVG(AmountCol)" },
  { name: "MEAN",      args: 1,  hint: "MEAN(AmountCol)" },
  { name: "MIN",       args: 1,  hint: "MIN(AmountCol)" },
  { name: "MAX",       args: 1,  hint: "MAX(AmountCol)" },
  { name: "COUNT",     args: 1,  hint: "COUNT(Col) — non-null count" },
  { name: "COUNTA",    args: 1,  hint: "COUNTA(Col) — total rows" },
  { name: "COUNTBLANK",args: 1,  hint: "COUNTBLANK(Col) — null count" },
  { name: "STD",       args: 1,  hint: "STD(Col) — standard deviation" },
  { name: "VAR",       args: 1,  hint: "VAR(Col) — variance" },
  { name: "MEDIAN",    args: 1,  hint: "MEDIAN(Col)" },
  { name: "MODE",      args: 1,  hint: "MODE(Col) — most frequent value" },
  { name: "PRODUCT",   args: 1,  hint: "PRODUCT(Col) — multiply all values" },
  { name: "RANGE",     args: 1,  hint: "RANGE(Col) — max minus min" },
  { name: "PERCENTILE",args: 2,  hint: "PERCENTILE(Col, 0.90) — 90th percentile" },

  // ============ Row-wise (across columns) ============
  { name: "ROWSUM",    args: -1, hint: "ROWSUM(Q1, Q2, Q3, Q4)" },
  { name: "ROWAVG",    args: -1, hint: "ROWAVG(Math, Science, English)" },
  { name: "ROWMIN",    args: -1, hint: "ROWMIN(A, B, C)" },
  { name: "ROWMAX",    args: -1, hint: "ROWMAX(A, B, C)" },
  { name: "ROWMEDIAN", args: -1, hint: "ROWMEDIAN(A, B, C)" },
  { name: "ROWSTD",    args: -1, hint: "ROWSTD(A, B, C)" },

  // ============ Arithmetic ============
  { name: "ADD",       args: 2,  hint: "ADD(Col1, Col2) — Col1 + Col2" },
  { name: "SUB",       args: 2,  hint: "SUB(Col1, Col2) — Col1 - Col2" },
  { name: "MUL",       args: 2,  hint: "MUL(Col1, Col2) — Col1 * Col2" },
  { name: "DIV",       args: 2,  hint: "DIV(Col1, Col2) — Col1 / Col2" },

  // ============ Math & Rounding ============
  { name: "ABS",       args: 1,  hint: "ABS(Col)" },
  { name: "ROUND",     args: 1,  hint: "ROUND(Col) — to whole number" },
  { name: "ROUNDN",    args: 2,  hint: "ROUNDN(Col, 2) — to N decimals" },
  { name: "ROUNDUP",   args: 1,  hint: "ROUNDUP(Col) — always up" },
  { name: "ROUNDDOWN", args: 1,  hint: "ROUNDDOWN(Col) — always down" },
  { name: "INT",       args: 1,  hint: "INT(Col) — integer part" },
  { name: "SQRT",      args: 1,  hint: "SQRT(Col) — square root" },
  { name: "POWER",     args: 2,  hint: "POWER(Col, 2) — Col²" },
  { name: "MOD",       args: 2,  hint: "MOD(Col, 10) — remainder" },

  // ============ Logic ============
  { name: "IF",        args: 3,  hint: "IF(CondCol, ThenCol, ElseCol)" },
  { name: "AND",       args: -1, hint: "AND(A, B, C) — all non-zero" },
  { name: "OR",        args: -1, hint: "OR(A, B, C) — any non-zero" },
  { name: "NOT",       args: 1,  hint: "NOT(Col)" },
  { name: "COALESCE",  args: -1, hint: "COALESCE(A, B, C) — first non-null" },

  // ============ Text ============
  { name: "CONCAT",    args: -1, hint: "CONCAT(A, B, C) — join strings" },
  { name: "LEN",       args: 1,  hint: "LEN(Col) — character count" },
  { name: "LEFT",      args: 2,  hint: "LEFT(Col, 5) — first 5 chars" },
  { name: "RIGHT",     args: 2,  hint: "RIGHT(Col, 5) — last 5 chars" },
  { name: "MID",       args: 3,  hint: "MID(Col, 2, 5) — 5 chars from pos 2" },
  { name: "UPPER",     args: 1,  hint: "UPPER(Col)" },
  { name: "LOWER",     args: 1,  hint: "LOWER(Col)" },
  { name: "TRIM",      args: 1,  hint: "TRIM(Col) — strip whitespace" },
  { name: "REPLACE",   args: 3,  hint: "REPLACE(Col, find, with)" },

  // ============ Date (from date strings) ============
  { name: "YEAR",      args: 1,  hint: "YEAR(DateCol)" },
  { name: "MONTH",     args: 1,  hint: "MONTH(DateCol)" },
  { name: "DAY",       args: 1,  hint: "DAY(DateCol)" },

  // ============ Percentage / Analysis ============
  { name: "PERCENTAGE",args: 2,  hint: "PERCENTAGE(ValueCol, TotalCol) — %" },
  { name: "GROWTH",    args: 2,  hint: "GROWTH(NewCol, OldCol) — % growth" },
  { name: "CHANGE",    args: 2,  hint: "CHANGE(NewCol, OldCol) — New - Old" },
];