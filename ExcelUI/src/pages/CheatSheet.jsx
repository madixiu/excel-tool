import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalculator,
  faChartSimple,
  faHashtag,
  faListCheck,
  faArrowUp,
  faArrowDown,
  faFilter,
  faFilterCircleDollar,
  faCheckDouble,
  faCheckCircle,
  faChartLine,
  faCircleHalfStroke,
  faArrowUpLong,
  faArrowDownLong,
  faRuler,
  faSquareRootVariable,
  faSuperscript,
  faPercent,
  faRankingStar,
  faChartBar,
  faChartPie,
  faAnglesUp,
  faAnglesDown,
  faCodeBranch,
  faDiagramProject,
  faShield,
  faCircleNodes,
  faBan,
  faSquare,
  faMagnifyingGlass,
  faMagnifyingGlassArrowRight,
  faMagnifyingGlassChart,
  faListOl,
  faArrowsToDot,
  faLink,
  faObjectGroup,
  faArrowLeft,
  faArrowRight,
  faScissors,
  faRulerHorizontal,
  faEraser,
  faArrowUpWideShort,
  faArrowDownWideShort,
  faA,
  faRotate,
  faFont,
  faMagnifyingGlassLocation,
  faCalendarDay,
  faClock,
  faCalendarPlus,
  faCalendarWeek,
  faCalendarCheck,
  faCalendar,
  faCalendarAlt,
  faCalendarDays,
  faGlobe,
  faLightbulb,
} from "@fortawesome/free-solid-svg-icons";
// Map your icon string names to the imported icon objects
const ICON_MAP = {
  "fa-calculator": faCalculator,
  "fa-chart-simple": faChartSimple,
  "fa-hashtag": faHashtag,
  "fa-list-check": faListCheck,
  "fa-arrow-up": faArrowUp,
  "fa-arrow-down": faArrowDown,
  "fa-filter": faFilter,
  "fa-filter-circle-dollar": faFilterCircleDollar,
  "fa-check-double": faCheckDouble,
  "fa-check-circle": faCheckCircle,
  "fa-chart-line": faChartLine,
  "fa-circle-half-stroke": faCircleHalfStroke,
  "fa-arrow-up-long": faArrowUpLong,
  "fa-arrow-down-long": faArrowDownLong,
  "fa-ruler": faRuler,
  "fa-square-root-variable": faSquareRootVariable,
  "fa-superscript": faSuperscript,
  "fa-percent": faPercent,
  "fa-ranking-star": faRankingStar,
  "fa-chart-bar": faChartBar,
  "fa-chart-pie": faChartPie,
  "fa-angles-up": faAnglesUp,
  "fa-angles-down": faAnglesDown,
  "fa-code-branch": faCodeBranch,
  "fa-diagram-project": faDiagramProject,
  "fa-shield": faShield,
  "fa-ampersand": faFont,
  "fa-circle-nodes": faCircleNodes,
  "fa-ban": faBan,
  "fa-square": faSquare,
  "fa-7": faHashtag, // fallback — "7" doesn't exist
  "fa-t": faFont, // fallback — "t" doesn't exist
  "fa-magnifying-glass": faMagnifyingGlass,
  "fa-magnifying-glass-arrow-right": faMagnifyingGlassArrowRight,
  "fa-magnifying-glass-chart": faMagnifyingGlassChart,
  "fa-list-ol": faListOl,
  "fa-arrows-to-dot": faArrowsToDot,
  "fa-merge": faObjectGroup,
  "fa-link": faLink,
  "fa-object-group": faObjectGroup,
  "fa-arrow-left": faArrowLeft,
  "fa-arrow-right": faArrowRight,
  "fa-scissors": faScissors,
  "fa-ruler-horizontal": faRulerHorizontal,
  "fa-eraser": faEraser,
  "fa-arrow-up-wide-short": faArrowUpWideShort,
  "fa-arrow-down-wide-short": faArrowDownWideShort,
  "fa-a": faA,
  "fa-rotate": faRotate,
  "fa-font": faFont,
  "fa-magnifying-glass-location": faMagnifyingGlassLocation,
  "fa-calendar-day": faCalendarDay,
  "fa-clock": faClock,
  "fa-calendar-plus": faCalendarPlus,
  "fa-calendar-week": faCalendarWeek,
  "fa-calendar-check": faCalendarCheck,
  "fa-calendar": faCalendar,
  "fa-calendar-alt": faCalendarAlt,
  "fa-calendar-days": faCalendarDays,
  "fa-globe": faGlobe,
  "fa-lightbulb": faLightbulb,
};

// Safe lookup with a fallback so nothing ever breaks
const getIcon = (name) => ICON_MAP[name] || faCalculator;

// ============================================================
// FORMULA DATA — Persian + English
// ============================================================
const FORMULAS = [
  // ============ Math & Stats ============
  {
    cat: "math",
    icon: "fa-calculator",
    name: "SUM",
    fa: "جمع",
    code: "=SUM(number1, [number2], ...)",
    desc: "جمع تمام اعداد در یک محدوده یا لیست.",
  },
  {
    cat: "math",
    icon: "fa-chart-simple",
    name: "AVERAGE",
    fa: "میانگین",
    code: "=AVERAGE(number1, [number2], ...)",
    desc: "میانگین حسابی مقادیر را برمی‌گرداند.",
  },
  {
    cat: "math",
    icon: "fa-hashtag",
    name: "COUNT",
    fa: "شمارش اعداد",
    code: "=COUNT(value1, [value2], ...)",
    desc: "سلول‌های حاوی عدد را می‌شمارد.",
  },
  {
    cat: "math",
    icon: "fa-list-check",
    name: "COUNTA",
    fa: "شمارش غیرخالی",
    code: "=COUNTA(value1, [value2], ...)",
    desc: "سلول‌های غیرخالی را می‌شمارد.",
  },
  {
    cat: "math",
    icon: "fa-arrow-up",
    name: "MAX",
    fa: "بیشترین",
    code: "=MAX(number1, [number2], ...)",
    desc: "بزرگ‌ترین مقدار را برمی‌گرداند.",
  },
  {
    cat: "math",
    icon: "fa-arrow-down",
    name: "MIN",
    fa: "کمترین",
    code: "=MIN(number1, [number2], ...)",
    desc: "کوچک‌ترین مقدار را برمی‌گرداند.",
  },
  {
    cat: "math",
    icon: "fa-filter",
    name: "SUMIF",
    fa: "جمع شرطی",
    code: "=SUMIF(range, criteria, [sum_range])",
    desc: "جمع سلول‌هایی که یک شرط را برآورده می‌کنند.",
  },
  {
    cat: "math",
    icon: "fa-filter-circle-dollar",
    name: "SUMIFS",
    fa: "جمع چندشرطی",
    code: "=SUMIFS(sum_range, criteria_range1, criteria1, ...)",
    desc: "جمع با چندین شرط.",
  },
  {
    cat: "math",
    icon: "fa-check-double",
    name: "COUNTIF",
    fa: "شمارش شرطی",
    code: "=COUNTIF(range, criteria)",
    desc: "سلول‌هایی که یک شرط را برآورده می‌کنند می‌شمارد.",
  },
  {
    cat: "math",
    icon: "fa-check-circle",
    name: "COUNTIFS",
    fa: "شمارش چندشرطی",
    code: "=COUNTIFS(criteria_range1, criteria1, ...)",
    desc: "شمارش با چندین شرط.",
  },
  {
    cat: "math",
    icon: "fa-chart-line",
    name: "AVERAGEIF",
    fa: "میانگین شرطی",
    code: "=AVERAGEIF(range, criteria, [avg_range])",
    desc: "میانگین سلول‌هایی که شرط را برآورده می‌کنند.",
  },
  {
    cat: "math",
    icon: "fa-circle-half-stroke",
    name: "ROUND",
    fa: "گرد کردن",
    code: "=ROUND(number, num_digits)",
    desc: "یک عدد را به تعداد رقم مشخص گرد می‌کند.",
  },
  {
    cat: "math",
    icon: "fa-arrow-up-long",
    name: "ROUNDUP",
    fa: "گرد به بالا",
    code: "=ROUNDUP(number, num_digits)",
    desc: "به سمت بالا گرد می‌کند.",
  },
  {
    cat: "math",
    icon: "fa-arrow-down-long",
    name: "ROUNDDOWN",
    fa: "گرد به پایین",
    code: "=ROUNDDOWN(number, num_digits)",
    desc: "به سمت پایین گرد می‌کند.",
  },
  {
    cat: "math",
    icon: "fa-ruler",
    name: "ABS",
    fa: "قدر مطلق",
    code: "=ABS(number)",
    desc: "قدر مطلق عدد را برمی‌گرداند.",
  },
  {
    cat: "math",
    icon: "fa-square-root-variable",
    name: "SQRT",
    fa: "جذر",
    code: "=SQRT(number)",
    desc: "جذر یک عدد را برمی‌گرداند.",
  },
  {
    cat: "math",
    icon: "fa-superscript",
    name: "POWER",
    fa: "توان",
    code: "=POWER(number, power)",
    desc: "عدد را به توان مشخص می‌رساند.",
  },
  {
    cat: "math",
    icon: "fa-percent",
    name: "MOD",
    fa: "باقیمانده",
    code: "=MOD(number, divisor)",
    desc: "باقیمانده تقسیم را برمی‌گرداند.",
  },
  {
    cat: "math",
    icon: "fa-ranking-star",
    name: "RANK",
    fa: "رتبه",
    code: "=RANK(number, ref, [order])",
    desc: "رتبه یک عدد در یک لیست.",
  },
  {
    cat: "math",
    icon: "fa-chart-bar",
    name: "MEDIAN",
    fa: "میانه",
    code: "=MEDIAN(number1, [number2], ...)",
    desc: "مقدار وسط را برمی‌گرداند.",
  },
  {
    cat: "math",
    icon: "fa-chart-line",
    name: "STDEV.S",
    fa: "انحراف معیار",
    code: "=STDEV.S(number1, [number2], ...)",
    desc: "انحراف معیار نمونه.",
  },
  {
    cat: "math",
    icon: "fa-chart-pie",
    name: "VAR.P",
    fa: "واریانس",
    code: "=VAR.P(number1, [number2], ...)",
    desc: "واریانس جامعه آماری.",
  },
  {
    cat: "math",
    icon: "fa-angles-up",
    name: "CEILING",
    fa: "سقف",
    code: "=CEILING(number, significance)",
    desc: "به نزدیک‌ترین مضرب به بالا گرد می‌کند.",
  },
  {
    cat: "math",
    icon: "fa-angles-down",
    name: "FLOOR",
    fa: "کف",
    code: "=FLOOR(number, significance)",
    desc: "به نزدیک‌ترین مضرب به پایین گرد می‌کند.",
  },

  // ============ Logic ============
  {
    cat: "logic",
    icon: "fa-code-branch",
    name: "IF",
    fa: "اگر",
    code: "=IF(logical_test, value_if_true, value_if_false)",
    desc: "اگر شرط درست باشد یک مقدار، در غیر این صورت مقدار دیگر.",
  },
  {
    cat: "logic",
    icon: "fa-diagram-project",
    name: "IFS",
    fa: "اگرهای چندگانه",
    code: "=IFS(test1, value1, [test2, value2], ...)",
    desc: "چندین شرط را بررسی می‌کند.",
  },
  {
    cat: "logic",
    icon: "fa-shield",
    name: "IFERROR",
    fa: "اگر خطا",
    code: "=IFERROR(value, value_if_error)",
    desc: "اگر خطا بود مقدار جایگزین برمی‌گرداند.",
  },
  {
    cat: "logic",
    icon: "fa-ampersand",
    name: "AND",
    fa: "و",
    code: "=AND(logical1, [logical2], ...)",
    desc: "درست اگر همه آرگومان‌ها درست باشند.",
  },
  {
    cat: "logic",
    icon: "fa-circle-nodes",
    name: "OR",
    fa: "یا",
    code: "=OR(logical1, [logical2], ...)",
    desc: "درست اگر هر یک از آرگومان‌ها درست باشد.",
  },
  {
    cat: "logic",
    icon: "fa-ban",
    name: "NOT",
    fa: "نقیض",
    code: "=NOT(logical)",
    desc: "منطق آرگومان را نقض می‌کند.",
  },
  {
    cat: "logic",
    icon: "fa-square",
    name: "ISBLANK",
    fa: "خالی است؟",
    code: "=ISBLANK(value)",
    desc: "درست اگر سلول خالی باشد.",
  },
  {
    cat: "logic",
    icon: "fa-7",
    name: "ISNUMBER",
    fa: "عدد است؟",
    code: "=ISNUMBER(value)",
    desc: "درست اگر مقدار عدد باشد.",
  },
  {
    cat: "logic",
    icon: "fa-t",
    name: "ISTEXT",
    fa: "متن است؟",
    code: "=ISTEXT(value)",
    desc: "درست اگر مقدار متن باشد.",
  },

  // ============ Lookup ============
  {
    cat: "lookup",
    icon: "fa-magnifying-glass",
    name: "VLOOKUP",
    fa: "جستجوی عمودی",
    code: "=VLOOKUP(value, table, col_index, [range])",
    desc: "جستجو در ستون اول به صورت عمودی.",
  },
  {
    cat: "lookup",
    icon: "fa-magnifying-glass-arrow-right",
    name: "HLOOKUP",
    fa: "جستجوی افقی",
    code: "=HLOOKUP(value, table, row_index, [range])",
    desc: "جستجو در سطر اول به صورت افقی.",
  },
  {
    cat: "lookup",
    icon: "fa-magnifying-glass-chart",
    name: "XLOOKUP",
    fa: "جستجوی مدرن",
    code: "=XLOOKUP(value, lookup, return, [if_not_found])",
    desc: "جستجوی مدرن و انعطاف‌پذیر.",
  },
  {
    cat: "lookup",
    icon: "fa-list-ol",
    name: "INDEX",
    fa: "اندیس",
    code: "=INDEX(array, row_num, [col_num])",
    desc: "مقدار در موقعیت مشخص را برمی‌گرداند.",
  },
  {
    cat: "lookup",
    icon: "fa-arrows-to-dot",
    name: "MATCH",
    fa: "تطبیق",
    code: "=MATCH(value, lookup_array, [match_type])",
    desc: "موقعیت نسبی مقدار را برمی‌گرداند.",
  },
  {
    cat: "lookup",
    icon: "fa-merge",
    name: "INDEX+MATCH",
    fa: "ترکیب",
    code: "=INDEX(return, MATCH(value, lookup, 0))",
    desc: "ترکیب قدرتمند برای جستجو.",
  },

  // ============ Text ============
  {
    cat: "text",
    icon: "fa-link",
    name: "CONCAT",
    fa: "الحاق متن",
    code: "=CONCAT(text1, [text2], ...)",
    desc: "متن‌ها را به هم می‌چسباند.",
  },
  {
    cat: "text",
    icon: "fa-object-group",
    name: "TEXTJOIN",
    fa: "الحاق با جداکننده",
    code: "=TEXTJOIN(delim, ignore_empty, text1, ...)",
    desc: "متن‌ها را با جداکننده الحاق می‌کند.",
  },
  {
    cat: "text",
    icon: "fa-arrow-left",
    name: "LEFT",
    fa: "چپ",
    code: "=LEFT(text, [num_chars])",
    desc: "چند کاراکتر از ابتدا استخراج می‌کند.",
  },
  {
    cat: "text",
    icon: "fa-arrow-right",
    name: "RIGHT",
    fa: "راست",
    code: "=RIGHT(text, [num_chars])",
    desc: "چند کاراکتر از انتها استخراج می‌کند.",
  },
  {
    cat: "text",
    icon: "fa-scissors",
    name: "MID",
    fa: "میانه",
    code: "=MID(text, start, num_chars)",
    desc: "زیرمجموعه‌ای از وسط متن استخراج می‌کند.",
  },
  {
    cat: "text",
    icon: "fa-ruler-horizontal",
    name: "LEN",
    fa: "طول متن",
    code: "=LEN(text)",
    desc: "طول یک رشته متنی را برمی‌گرداند.",
  },
  {
    cat: "text",
    icon: "fa-eraser",
    name: "TRIM",
    fa: "حذف فاصله",
    code: "=TRIM(text)",
    desc: "فاصله‌های اضافه را حذف می‌کند.",
  },
  {
    cat: "text",
    icon: "fa-arrow-up-wide-short",
    name: "UPPER",
    fa: "حروف بزرگ",
    code: "=UPPER(text)",
    desc: "متن را به حروف بزرگ تبدیل می‌کند.",
  },
  {
    cat: "text",
    icon: "fa-arrow-down-wide-short",
    name: "LOWER",
    fa: "حروف کوچک",
    code: "=LOWER(text)",
    desc: "متن را به حروف کوچک تبدیل می‌کند.",
  },
  {
    cat: "text",
    icon: "fa-a",
    name: "PROPER",
    fa: "حروف عنوان",
    code: "=PROPER(text)",
    desc: "حرف اول هر کلمه را بزرگ می‌کند.",
  },
  {
    cat: "text",
    icon: "fa-rotate",
    name: "SUBSTITUTE",
    fa: "جایگزینی",
    code: "=SUBSTITUTE(text, old, new, [instance])",
    desc: "یک متن را با متن دیگر جایگزین می‌کند.",
  },
  {
    cat: "text",
    icon: "fa-font",
    name: "TEXT",
    fa: "قالب‌بندی متن",
    code: '=TEXT(value, "format")',
    desc: "عدد را با قالب دلخواه نمایش می‌دهد.",
  },
  {
    cat: "text",
    icon: "fa-magnifying-glass-location",
    name: "FIND",
    fa: "یافتن",
    code: "=FIND(find_text, within_text, [start])",
    desc: "موقعیت متن را پیدا می‌کند.",
  },

  // ============ Date & Time ============
  {
    cat: "date",
    icon: "fa-calendar-day",
    name: "TODAY",
    fa: "امروز",
    code: "=TODAY()",
    desc: "تاریخ امروز را برمی‌گرداند.",
  },
  {
    cat: "date",
    icon: "fa-clock",
    name: "NOW",
    fa: "الان",
    code: "=NOW()",
    desc: "تاریخ و زمان فعلی را برمی‌گرداند.",
  },
  {
    cat: "date",
    icon: "fa-calendar-plus",
    name: "DATE",
    fa: "تاریخ",
    code: "=DATE(year, month, day)",
    desc: "از اجزا یک تاریخ می‌سازد.",
  },
  {
    cat: "date",
    icon: "fa-calendar-week",
    name: "DATEDIF",
    fa: "تفاضل تاریخ",
    code: "=DATEDIF(start, end, unit)",
    desc: "تفاوت بین دو تاریخ را محاسبه می‌کند.",
  },
  {
    cat: "date",
    icon: "fa-calendar-check",
    name: "EDATE",
    fa: "تاریخ چند ماه قبل",
    code: "=EDATE(start_date, months)",
    desc: "تاریخ چند ماه قبل یا بعد.",
  },
  {
    cat: "date",
    icon: "fa-calendar",
    name: "YEAR",
    fa: "سال",
    code: "=YEAR(serial_number)",
    desc: "سال را از یک تاریخ استخراج می‌کند.",
  },
  {
    cat: "date",
    icon: "fa-calendar-alt",
    name: "MONTH",
    fa: "ماه",
    code: "=MONTH(serial_number)",
    desc: "ماه را (۱ تا ۱۲) استخراج می‌کند.",
  },
  {
    cat: "date",
    icon: "fa-calendar-days",
    name: "DAY",
    fa: "روز",
    code: "=DAY(serial_number)",
    desc: "روز ماه را (۱ تا ۳۱) استخراج می‌کند.",
  },
];

// ============================================================
// LIVE EXAMPLES — for the AI typing demo
// ============================================================
const EXAMPLES = {
  SUM: {
    input: "=SUM(12, 8, 5, 20, 3)",
    result: "48",
    note: "مجموع فروش هفته",
  },
  AVERAGE: {
    input: "=AVERAGE(85, 90, 78, 92, 88)",
    result: "86.6",
    note: "میانگین نمرات",
  },
  COUNT: {
    input: '=COUNT(5, "سلام", 10, "متن", 15)',
    result: "3",
    note: "فقط اعداد شمرده می‌شوند",
  },
  COUNTA: {
    input: '=COUNTA("علی", "", "سارا", 42)',
    result: "3",
    note: "سلول‌های غیرخالی",
  },
  MAX: {
    input: "=MAX(45, 78, 92, 33, 67)",
    result: "92",
    note: "بالاترین مقدار",
  },
  MIN: {
    input: "=MIN(45, 78, 92, 33, 67)",
    result: "33",
    note: "پایین‌ترین مقدار",
  },
  IF: {
    input: '=IF(85 >= 60, "قبول", "مردود")',
    result: '"قبول"',
    note: "نمره ۸۵ بالاتر از ۶۰",
  },
  SUMIF: {
    input: '=SUMIF(A:A, "تهران", B:B)',
    result: "2450000",
    note: "جمع فروش تهران",
  },
  SUMIFS: {
    input: '=SUMIFS(C:C, A:A, "تهران", B:B, ">100000")',
    result: "1870000",
    note: "دو شرط با هم",
  },
  COUNTIF: {
    input: '=COUNTIF(A:A, ">100")',
    result: "7",
    note: "سفارش‌های بالای ۱۰۰",
  },
  ROUND: { input: "=ROUND(3.14159, 2)", result: "3.14", note: "گرد به ۲ رقم" },
  ABS: { input: "=ABS(-42)", result: "42", note: "قدر مطلق" },
  SQRT: { input: "=SQRT(144)", result: "12", note: "جذر ۱۴۴" },
  POWER: { input: "=POWER(5, 3)", result: "125", note: "۵ به توان ۳" },
  MOD: { input: "=MOD(17, 5)", result: "2", note: "باقیمانده" },
  VLOOKUP: {
    input: '=VLOOKUP("علی", A:D, 3, FALSE)',
    result: '"۰۹۱۲..."',
    note: "جستجوی کد علی",
  },
  XLOOKUP: {
    input: '=XLOOKUP("علی", A:A, B:B, "یافت نشد")',
    result: '"مدیر"',
    note: "جستجوی مدرن",
  },
  INDEX: { input: "=INDEX(A1:A10, 5)", result: '"مریم"', note: "سطر پنجم" },
  MATCH: {
    input: '=MATCH("سارا", A1:A10, 0)',
    result: "3",
    note: "موقعیت سارا",
  },
  CONCAT: {
    input: '=CONCAT("سلام ", "دنیا", "!")',
    result: '"سلام دنیا!"',
    note: "الحاق متن",
  },
  LEFT: {
    input: '=LEFT("A3YOAH050B6", 8)',
    result: '"A3YOAH05"',
    note: "۸ کاراکتر اول",
  },
  RIGHT: {
    input: '=RIGHT("A3YOAH050B6", 4)',
    result: '"050B6"',
    note: "۴ کاراکتر آخر",
  },
  MID: {
    input: '=MID("A3YOAH050B6", 4, 4)',
    result: '"OAH0"',
    note: "۴ کاراکتر از موقعیت ۴",
  },
  LEN: { input: '=LEN("سلام دنیا")', result: "9", note: "طول متن" },
  TRIM: {
    input: '=TRIM("  سلام   دنیا  ")',
    result: '"سلام دنیا"',
    note: "حذف فاصله‌ها",
  },
  UPPER: { input: '=UPPER("excel")', result: '"EXCEL"', note: "حروف بزرگ" },
  LOWER: { input: '=LOWER("EXCEL")', result: '"excel"', note: "حروف کوچک" },
  TODAY: { input: "=TODAY()", result: "1403/07/23", note: "تاریخ امروز" },
  NOW: { input: "=NOW()", result: "1403/07/23 15:30", note: "تاریخ و ساعت" },
  YEAR: { input: '=YEAR("1403/07/14")', result: "1403", note: "سال" },
  MONTH: { input: '=MONTH("1403/07/14")', result: "7", note: "ماه" },
  DAY: { input: '=DAY("1403/07/14")', result: "14", note: "روز" },
  IFERROR: {
    input: '=IFERROR(1/0, "خطا")',
    result: '"خطا"',
    note: "جلوگیری از خطا",
  },
  AND: {
    input: "=AND(TRUE, TRUE, FALSE)",
    result: "FALSE",
    note: "همه باید درست باشند",
  },
  OR: {
    input: "=OR(FALSE, TRUE, FALSE)",
    result: "TRUE",
    note: "یکی کافی است",
  },
  NOT: { input: "=NOT(TRUE)", result: "FALSE", note: "نقیض" },
  ISBLANK: { input: "=ISBLANK(A1)", result: "TRUE", note: "A1 خالی است" },
  ISNUMBER: {
    input: '=ISNUMBER("123")',
    result: "FALSE",
    note: "متن عدد نیست",
  },
  ISTEXT: { input: '=ISTEXT("سلام")', result: "TRUE", note: "متن است" },
  RANK: { input: "=RANK(92, A1:A10)", result: "1", note: "رتبه اول" },
  MEDIAN: {
    input: "=MEDIAN(45, 78, 92, 33, 67)",
    result: "67",
    note: "مقدار وسط",
  },
  CEILING: { input: "=CEILING(7.3, 1)", result: "8", note: "سقف" },
  FLOOR: { input: "=FLOOR(7.9, 1)", result: "7", note: "کف" },
};

// ============================================================
// CATEGORIES
// ============================================================
const CATEGORIES = [
  {
    key: "all",
    label: "همه",
    icon: "fa-globe",
    color: "text-slate-600",
    dot: "bg-slate-400",
  },
  {
    key: "math",
    label: "ریاضی و آماری",
    icon: "fa-calculator",
    color: "text-emerald-600",
    dot: "bg-emerald-400",
  },
  {
    key: "lookup",
    label: "جستجو",
    icon: "fa-magnifying-glass",
    color: "text-violet-600",
    dot: "bg-violet-400",
  },
  {
    key: "text",
    label: "متن",
    icon: "fa-font",
    color: "text-orange-600",
    dot: "bg-orange-400",
  },
  {
    key: "date",
    label: "تاریخ",
    icon: "fa-calendar",
    color: "text-amber-600",
    dot: "bg-amber-400",
  },
  {
    key: "logic",
    label: "منطقی",
    icon: "fa-lightbulb",
    color: "text-sky-600",
    dot: "bg-sky-400",
  },
];

const CATEGORY_STYLES = {
  all: {
    icon: "bg-slate-100 text-slate-600 ring-slate-200 group-hover:bg-slate-200",
    label: "text-slate-700",
    code: "text-slate-700",
    modal: "border-slate-200 bg-slate-50 text-slate-700",
    edge: "border-t-slate-300",
  },
  math: {
    icon: "bg-emerald-50 text-emerald-700 ring-emerald-100 group-hover:bg-emerald-100",
    label: "text-emerald-700",
    code: "text-emerald-800",
    modal: "border-emerald-200 bg-emerald-50 text-emerald-700",
    edge: "border-t-emerald-300",
  },
  lookup: {
    icon: "bg-violet-50 text-violet-700 ring-violet-100 group-hover:bg-violet-100",
    label: "text-violet-700",
    code: "text-violet-800",
    modal: "border-violet-200 bg-violet-50 text-violet-700",
    edge: "border-t-violet-300",
  },
  text: {
    icon: "bg-orange-50 text-orange-700 ring-orange-100 group-hover:bg-orange-100",
    label: "text-orange-700",
    code: "text-orange-800",
    modal: "border-orange-200 bg-orange-50 text-orange-700",
    edge: "border-t-orange-300",
  },
  date: {
    icon: "bg-amber-50 text-amber-700 ring-amber-100 group-hover:bg-amber-100",
    label: "text-amber-700",
    code: "text-amber-800",
    modal: "border-amber-200 bg-amber-50 text-amber-700",
    edge: "border-t-amber-300",
  },
  logic: {
    icon: "bg-sky-50 text-sky-700 ring-sky-100 group-hover:bg-sky-100",
    label: "text-sky-700",
    code: "text-sky-800",
    modal: "border-sky-200 bg-sky-50 text-sky-700",
    edge: "border-t-sky-300",
  },
};

// ============================================================
// AI TYPING HOOK
// ============================================================
function useAITyping(example, active, speed = 55) {
  const [typed, setTyped] = useState("");
  const [showResult, setResult] = useState(false);
  const [calculating, setCalc] = useState(false);

  useEffect(() => {
    if (!active || !example) {
      setTyped("");
      setResult(false);
      setCalc(false);
      return;
    }
    setTyped("");
    setResult(false);
    setCalc(false);

    let i = 0;
    const target = example.input;
    const id = setInterval(() => {
      if (i >= target.length) {
        clearInterval(id);
        setCalc(true);
        setTimeout(() => {
          setCalc(false);
          setResult(true);
        }, 600);
        return;
      }
      setTyped(target.slice(0, i + 1));
      i++;
    }, speed);

    return () => clearInterval(id);
  }, [example, active, speed]);

  return { typed, showResult, calculating };
}

// ============================================================
// MAIN PAGE
// ============================================================
export default function CheatSheet() {
  const [query, setQuery] = useState("");
  const [activeCat, setActive] = useState("all");
  const [selected, setSelected] = useState(null);
  const [favorites, setFavs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("cs_favs") || "[]");
    } catch {
      return [];
    }
  });
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    localStorage.setItem("cs_favs", JSON.stringify(favorites));
  }, [favorites]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FORMULAS.filter((f) => {
      if (activeCat !== "all" && f.cat !== activeCat) return false;
      if (!q) return true;
      return (
        f.name.toLowerCase().includes(q) ||
        f.fa.toLowerCase().includes(q) ||
        f.desc.includes(q)
      );
    });
  }, [query, activeCat]);

  const toggleFav = (name) => {
    setFavs((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  };

  const copy = async (code, name) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(name);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  };

  return (
    <div dir="rtl">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-line-subtle mb-8 pb-8">
        <div className="flex items-center gap-5 mb-6">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-emerald-400/20 to-emerald-600/20 border border-emerald-400/40 flex items-center justify-center text-3xl shadow-lg shadow-emerald-500/10">
            📗
          </div>
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight">
              راهنمای فرمول‌های اکسل
            </h1>
            <p className="text-slate-500 mt-1 text-sm lg:text-base">
              {FORMULAS.length} فرمول ضروری — با مثال
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-2xl">
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            🔍
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجو در فرمول‌ها... (مثلاً: SUM، جمع، میانگین)"
            className="w-full bg-white border border-line-strong rounded-2xl pr-12 pl-4 py-4 text-slate-800 placeholder:text-slate-400 outline-hidden focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 transition-all"
          />
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2 mb-8">
        {CATEGORIES.map((c) => {
          const count =
            c.key === "all"
              ? FORMULAS.length
              : FORMULAS.filter((f) => f.cat === c.key).length;
          const active = activeCat === c.key;
          return (
            <button
              key={c.key}
              onClick={() => setActive(c.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm border transition-all ${
                active
                  ? "bg-white border-blue-400 text-slate-900 shadow-md"
                  : "bg-white/60 border-line-subtle text-slate-600 hover:border-line-strong"
              }`}
            >
              <i className={`fa-solid ${c.icon} ${active ? c.color : ""}`} />
              <span>{c.label}</span>
              <span
                className={`text-[11px] px-1.5 py-0.5 rounded-md ${
                  active
                    ? "bg-blue-100 text-blue-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-24 text-slate-400">
          <div className="text-5xl mb-4 opacity-40">🔍</div>
          <div>چیزی پیدا نشد</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((f, i) => (
            <FormulaCard
              key={f.name}
              formula={f}
              index={i}
              isFav={favorites.includes(f.name)}
              onToggleFav={() => toggleFav(f.name)}
              onCopy={() => copy(f.code, f.name)}
              copied={copied === f.name}
              onClick={() => setSelected(f)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {selected &&
        createPortal(
          <FormulaModal formula={selected} onClose={() => setSelected(null)} />,
          document.body,
        )}
    </div>
  );
}

// ============================================================
// CARD
// ============================================================

function FormulaCard({
  formula,
  index,
  isFav,
  onToggleFav,
  onCopy,
  copied,
  onClick,
}) {
  const categoryStyle = CATEGORY_STYLES[formula.cat] || CATEGORY_STYLES.all;

  return (
    <div
      className={`group relative cursor-pointer rounded-xl border border-line-subtle border-t-2 ${categoryStyle.edge} bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[0_10px_24px_-12px_rgba(0,0,0,0.14)] anim-fade-up`}
      style={{ animationDelay: `${Math.min(index, 12) * 0.03}s` }}
      onClick={onClick}
    >
      <div className="mb-3 flex items-start gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset transition-colors ${categoryStyle.icon}`}
        >
          <FontAwesomeIcon
            icon={getIcon(formula.icon)}
            className="text-xl"
            aria-hidden="true"
          />
        </span>

        <div className="min-w-0 flex-1 pt-0.5">
          <div
            dir="ltr"
            className="truncate font-mono text-[15px] font-semibold leading-5 text-slate-900"
          >
            {formula.name}
          </div>
          <div
            dir="rtl"
            className={`mt-1 text-right text-[13px] font-medium leading-5 ${categoryStyle.label}`}
          >
            {formula.fa}
          </div>
        </div>

        <button
          type="button"
          aria-label={
            isFav ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"
          }
          aria-pressed={isFav}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFav();
          }}
          className={`-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg transition-colors hover:bg-amber-50 ${
            isFav ? "text-amber-500" : "text-slate-300 hover:text-amber-500"
          }`}
        >
          {isFav ? "★" : "☆"}
        </button>
      </div>

      <div
        dir="ltr"
        onClick={(e) => {
          e.stopPropagation();
          onCopy();
        }}
        className={`relative mb-3 overflow-x-auto rounded-lg border border-line-subtle bg-slate-50 px-3 py-2.5 font-mono text-[12.5px] leading-5 transition-colors group-hover:bg-slate-100 cursor-copy ${categoryStyle.code}`}
      >
        <code className="whitespace-nowrap">{formula.code}</code>
        {copied && (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-medium text-white shadow-sm">
            کپی شد
          </span>
        )}
      </div>

      <p className="text-[13px] leading-5 text-slate-600">{formula.desc}</p>

      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400 transition-colors group-hover:text-slate-500">
        <i className="fa-regular fa-hand-pointer" aria-hidden="true" />
        <span>برای مثال زنده کلیک کنید</span>
      </div>
    </div>
  );
}

// ============================================================
// MODAL — AI Typing Demo
// ============================================================

function FormulaModal({ formula, onClose }) {
  const example = EXAMPLES[formula.name] || null;
  const categoryStyle = CATEGORY_STYLES[formula.cat] || CATEGORY_STYLES.all;
  const { typed, showResult, calculating } = useAITyping(example, true, 55);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center
        overflow-y-auto bg-slate-950/45 p-3 backdrop-blur-sm
        anim-fade-in sm:p-5"
      onClick={onClose}
    >
      <div
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-label={`${formula.name} — ${formula.fa}`}
        onClick={(e) => e.stopPropagation()}
        className="relative flex w-full max-w-2xl max-h-[85vh]
          flex-col overflow-hidden rounded-2xl border
          border-slate-200 bg-white shadow-2xl anim-modal-in"
      >
        {/* Header */}
        <header
          className="relative flex shrink-0 items-center gap-3
          border-b border-slate-200 px-5 py-4"
        >
          <span
            className={`flex h-10 w-10 shrink-0 items-center
              justify-center rounded-xl border text-lg
              ${categoryStyle.modal}`}
            aria-hidden="true"
          >
            <FontAwesomeIcon icon={getIcon(formula.icon)} />
          </span>

          <div className="min-w-0 flex-1">
            <div
              dir="ltr"
              className="font-mono text-lg font-semibold
                leading-6 text-slate-900"
            >
              {formula.name}
            </div>
            <div className="mt-0.5 text-sm leading-5 text-slate-600">
              {formula.fa}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="بستن پنجره"
            className="flex h-9 w-9 shrink-0 items-center
              justify-center rounded-lg border border-slate-200
              bg-white text-lg text-slate-500 transition-colors
              hover:border-slate-300 hover:bg-slate-50
              hover:text-slate-900 focus-visible:outline-none
              focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            ×
          </button>
        </header>

        {/* Scrollable content */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
          {/* Syntax */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">
              سینتکس
            </h3>

            <div
              dir="ltr"
              className="overflow-x-auto rounded-xl border
                border-slate-200 bg-slate-50 px-4 py-3
                font-mono text-sm leading-6 text-emerald-800"
            >
              <code className="whitespace-pre">{formula.code}</code>
            </div>
          </section>

          {/* Description */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">توضیح</h3>

            <p className="text-sm leading-7 text-slate-600">{formula.desc}</p>
          </section>

          {/* Live example */}
          {example && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-700">
                  مثال زنده
                </h3>

                <span
                  className="inline-flex h-2 w-2 rounded-full
                    bg-violet-500"
                  aria-hidden="true"
                />
              </div>

              <div
                className="overflow-hidden rounded-xl border
                border-slate-200 bg-white"
              >
                {/* Formula input */}
                <div
                  className="flex min-w-0 items-stretch border-b
                  border-slate-200"
                >
                  <div
                    dir="ltr"
                    className="flex w-14 shrink-0 items-center
                      justify-center border-l border-slate-200
                      bg-slate-50 px-2 py-3 font-mono text-xs
                      text-slate-500"
                  >
                    A1
                  </div>

                  <div
                    dir="ltr"
                    className="flex w-10 shrink-0 items-center
                      justify-center border-l border-slate-200
                      bg-slate-50 font-mono text-sm text-slate-500"
                  >
                    fx
                  </div>

                  <div
                    dir="ltr"
                    className="flex min-h-12 min-w-0 flex-1
                      items-center overflow-x-auto px-3 py-3
                      font-mono text-sm leading-6 text-emerald-800"
                  >
                    <span className="whitespace-pre">{typed}</span>

                    {!showResult && (
                      <span
                        className="mr-0.5 inline-block h-4
                        w-0.5 shrink-0 animate-pulse bg-emerald-600"
                      />
                    )}
                  </div>
                </div>

                {/* Result */}
                <div className="flex min-w-0 items-stretch">
                  <div
                    className="flex w-20 shrink-0 items-center
                    justify-center border-l border-slate-200
                    bg-slate-50 px-2 py-3 text-xs font-medium
                    text-slate-600"
                  >
                    نتیجه
                  </div>

                  <div
                    dir="ltr"
                    aria-live="polite"
                    className="flex min-h-12 min-w-0 flex-1
                      items-center px-4 py-3 font-mono text-sm"
                  >
                    {calculating && (
                      <span
                        className="flex items-center gap-1.5
                        text-slate-500"
                      >
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="h-1.5 w-1.5 animate-pulse
                              rounded-full bg-violet-500"
                            style={{
                              animationDelay: `${i * 0.15}s`,
                            }}
                          />
                        ))}

                        <span className="mr-1 text-xs">در حال محاسبه...</span>
                      </span>
                    )}

                    {showResult && (
                      <span
                        className="font-semibold text-emerald-800
                        anim-pop-in"
                      >
                        {example.result}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Explanation */}
              {showResult && (
                <div
                  className="mt-3 flex items-start gap-2 rounded-xl
                    border border-amber-200 bg-amber-50 px-4 py-3
                    text-sm leading-6 text-slate-700 anim-fade-up"
                >
                  <span className="shrink-0" aria-hidden="true">
                    <i className="fa-regular fa-lightbulb text-amber-700" />
                  </span>

                  <p>{example.note}</p>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
