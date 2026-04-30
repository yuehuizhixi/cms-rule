package com.cmsrule.sandbox;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * 脚本执行器沙箱
 * 提供安全的规则条件表达式求值
 *
 * 支持语法：
 * - 比较运算: > < >= <= == !=
 * - 逻辑运算: && || !
 * - 算术运算: + - * / %
 * - 括号分组: ( )
 * - 变量引用: point1, temperature_01 等标识符（由平台点位值替换）
 * - 数值字面量: 10, 3.14, -5
 * - 布尔字面量: true, false
 *
 * 示例:
 *   temperature > 25 && humidity < 80
 *   (point1 + point2) / 2 > 50
 *   device_status == "running"
 */
@Component
@Slf4j
public class ScriptSandbox {

    // 允许的变量名模式（字母数字下划线）
    private static final Pattern VAR_PATTERN = Pattern.compile("^[a-zA-Z_][a-zA-Z0-9_]*$");

    // 禁止的危险关键字（防止注入）
    private static final Set<String> FORBIDDEN_KEYWORDS = Set.of(
            "java.", "Runtime", "System", "Process", "exec", "eval",
            "Class", "forName", "script", "import", "new ", "reflection"
    );

    /**
     * 执行表达式求值
     * @param expression 条件表达式，如 "temperature > 25 && humidity < 80"
     * @param variables 变量名→值的映射（如 "temperature" -> "28.5"）
     * @return 求值结果（true/false）
     */
    public boolean evaluate(String expression, Map<String, String> variables) {
        if (expression == null || expression.isBlank()) {
            return false;
        }

        // 安全检查
        if (!isExpressionSafe(expression)) {
            log.warn("表达式包含危险内容，已拒绝执行: {}", expression);
            return false;
        }

        try {
            // 替换变量为实际值
            String expr = substituteVariables(expression.trim(), variables);
            // 解析并求值
            return evaluateExpression(expr);
        } catch (Exception e) {
            log.warn("表达式求值失败: expression={}, error={}", expression, e.getMessage());
            return false;
        }
    }

    /**
     * 执行表达式求值（支持数值比较）
     * @param expression 条件表达式
     * @param pointValues 点位ID→值的映射
     * @return 求值结果
     */
    public boolean evaluateCondition(String expression, Map<String, String> pointValues) {
        return evaluate(expression, pointValues);
    }

    /**
     * 安全检查：防止注入攻击
     */
    private boolean isExpressionSafe(String expr) {
        String lower = expr.toLowerCase();
        for (String keyword : FORBIDDEN_KEYWORDS) {
            if (lower.contains(keyword.toLowerCase())) {
                log.warn("表达式包含禁止关键字: {}", keyword);
                return false;
            }
        }
        return true;
    }

    /**
     * 变量替换
     */
    private String substituteVariables(String expr, Map<String, String> variables) {
        if (variables == null || variables.isEmpty()) {
            return expr;
        }

        String result = expr;
        for (Map.Entry<String, String> entry : variables.entrySet()) {
            String varName = entry.getKey();
            String value = entry.getValue();

            // 精确替换变量名（周围不是字母数字下划线）
            String pattern = "\\b" + Pattern.quote(varName) + "\\b";
            if (value == null) {
                value = "null";
            } else if (isNumeric(value)) {
                // 数字保持原样
            } else if ("true".equalsIgnoreCase(value) || "false".equalsIgnoreCase(value)) {
                // 布尔值保持原样
            } else {
                // 字符串值需要加引号（如果还没有引号的话）
                if (!value.startsWith("\"") && !value.startsWith("'")) {
                    value = "\"" + value + "\"";
                }
            }
            result = result.replaceAll(pattern, value);
        }
        return result;
    }

    /**
     * 表达式求值（递归下降解析器）
     */
    private boolean evaluateExpression(String expr) {
        // 预处理：移除空白
        expr = expr.trim();

        // 使用递归下降求值
        return parseOr(expr, new int[]{0});
    }

    // ==================== 递归下降解析器 ====================

    /**
     * 解析 OR 表达式
     * or_expr ::= and_expr ('||' and_expr)*
     */
    private boolean parseOr(String expr, int[] pos) {
        boolean left = parseAnd(expr, pos);

        while (pos[0] < expr.length()) {
            skipWhitespace(expr, pos);
            if (match(expr, pos, "||")) {
                boolean right = parseAnd(expr, pos);
                left = left || right;
                // 短路求值：如果左边已经为true，跳过后续
                if (left) {
                    // 消耗剩余的 || xxx 部分（但不求值）
                    while (pos[0] < expr.length() && !peek(expr, pos, "&&") && !peek(expr, pos, "||") && !peek(expr, pos, ")")) {
                        skipToken(expr, pos);
                    }
                    if (peek(expr, pos, "||")) pos[0] += 2;
                }
            } else {
                break;
            }
        }
        return left;
    }

    /**
     * 解析 AND 表达式
     * and_expr ::= not_expr ('&&' not_expr)*
     */
    private boolean parseAnd(String expr, int[] pos) {
        boolean left = parseNot(expr, pos);

        while (pos[0] < expr.length()) {
            skipWhitespace(expr, pos);
            if (match(expr, pos, "&&")) {
                boolean right = parseNot(expr, pos);
                left = left && right;
                // 短路求值：如果左边已经为false，跳过后续
                if (!left) {
                    while (pos[0] < expr.length() && !peek(expr, pos, "||") && !peek(expr, pos, "&&") && !peek(expr, pos, ")")) {
                        skipToken(expr, pos);
                    }
                    if (peek(expr, pos, "&&")) pos[0] += 2;
                }
            } else {
                break;
            }
        }
        return left;
    }

    /**
     * 解析 NOT 表达式
     * not_expr ::= '!'? primary
     */
    private boolean parseNot(String expr, int[] pos) {
        skipWhitespace(expr, pos);
        if (match(expr, pos, "!")) {
            return !parsePrimary(expr, pos);
        }
        return parsePrimary(expr, pos);
    }

    /**
     * 解析基本表达式
     * primary ::= number | string | boolean | variable | '(' or_expr ')'
     */
    private boolean parsePrimary(String expr, int[] pos) {
        skipWhitespace(expr, pos);

        if (pos[0] >= expr.length()) {
            return false;
        }

        char c = expr.charAt(pos[0]);

        // 括号
        if (c == '(') {
            pos[0]++; // consume '('
            boolean result = parseOr(expr, pos);
            skipWhitespace(expr, pos);
            if (pos[0] < expr.length() && expr.charAt(pos[0]) == ')') {
                pos[0]++; // consume ')'
            }
            return result;
        }

        // 解析比较表达式（最复杂）
        return parseComparison(expr, pos);
    }

    /**
     * 解析比较表达式
     * comparison ::= arithmetic (('>' | '<' | '>=' | '<=' | '==' | '!=') arithmetic)*
     */
    private boolean parseComparison(String expr, int[] pos) {
        // 先解析左边的算术表达式
        Object left = parseArithmetic(expr, pos);
        skipWhitespace(expr, pos);

        while (pos[0] < expr.length()) {
            // 检查比较运算符
            String op = null;
            if (match(expr, pos, ">=")) op = ">=";
            else if (match(expr, pos, "<=")) op = "<=";
            else if (match(expr, pos, "!=")) op = "!=";
            else if (match(expr, pos, "==")) op = "==";
            else if (match(expr, pos, ">")) op = ">";
            else if (match(expr, pos, "<")) op = "<";
            else break;

            Object right = parseArithmetic(expr, pos);
            skipWhitespace(expr, pos);

            if (!compare(left, right, op)) {
                return false;
            }
        }
        return true;
    }

    /**
     * 解析算术表达式
     * arithmetic ::= term (('+' | '-') term)*
     */
    private Object parseArithmetic(String expr, int[] pos) {
        Object left = parseTerm(expr, pos);
        skipWhitespace(expr, pos);

        while (pos[0] < expr.length()) {
            if (match(expr, pos, "+")) {
                Object right = parseTerm(expr, pos);
                left = add(left, right);
            } else if (match(expr, pos, "-")) {
                Object right = parseTerm(expr, pos);
                left = subtract(left, right);
            } else {
                break;
            }
            skipWhitespace(expr, pos);
        }
        return left;
    }

    /**
     * 解析项
     * term ::= factor (('*' | '/' | '%') factor)*
     */
    private Object parseTerm(String expr, int[] pos) {
        Object left = parseFactor(expr, pos);
        skipWhitespace(expr, pos);

        while (pos[0] < expr.length()) {
            if (match(expr, pos, "*")) {
                Object right = parseFactor(expr, pos);
                left = multiply(left, right);
            } else if (match(expr, pos, "/")) {
                Object right = parseFactor(expr, pos);
                left = divide(left, right);
            } else if (match(expr, pos, "%")) {
                Object right = parseFactor(expr, pos);
                left = modulo(left, right);
            } else {
                break;
            }
            skipWhitespace(expr, pos);
        }
        return left;
    }

    /**
     * 解析因子
     * factor ::= number | string | boolean | variable | '(' expression ')'
     */
    private Object parseFactor(String expr, int[] pos) {
        skipWhitespace(expr, pos);

        if (pos[0] >= expr.length()) {
            return 0;
        }

        char c = expr.charAt(pos[0]);

        // 括号
        if (c == '(') {
            pos[0]++;
            Object result = parseOr(expr, pos);
            skipWhitespace(expr, pos);
            if (pos[0] < expr.length() && expr.charAt(pos[0]) == ')') {
                pos[0]++;
            }
            return result;
        }

        // 负号处理
        boolean negative = false;
        if (c == '-') {
            negative = true;
            pos[0]++;
            skipWhitespace(expr, pos);
        }

        // 数字
        if (Character.isDigit(c) || (c == '.' && pos[0] + 1 < expr.length() && Character.isDigit(expr.charAt(pos[0] + 1)))) {
            Object num = parseNumber(expr, pos);
            return negative ? negate(num) : num;
        }

        // 字符串（双引号）
        if (c == '"') {
            String s = parseString(expr, pos, '"');
            return negative ? negate(s) : s;
        }

        // 字符串（单引号）
        if (c == '\'') {
            String s = parseString(expr, pos, '\'');
            return negative ? negate(s) : s;
        }

        // 布尔值或标识符
        String token = parseIdentifier(expr, pos);
        if (token.isEmpty()) {
            return negative ? negate(0) : 0;
        }

        Object result;
        if ("true".equalsIgnoreCase(token)) {
            result = Boolean.TRUE;
        } else if ("false".equalsIgnoreCase(token)) {
            result = Boolean.FALSE;
        } else if ("null".equalsIgnoreCase(token)) {
            result = null;
        } else {
            result = token;
        }
        return negative ? negate(result) : result;
    }

    // ==================== 工具方法 ====================

    private void skipWhitespace(String expr, int[] pos) {
        while (pos[0] < expr.length() && Character.isWhitespace(expr.charAt(pos[0]))) {
            pos[0]++;
        }
    }

    private boolean match(String expr, int[] pos, String token) {
        skipWhitespace(expr, pos);
        if (expr.regionMatches(true, pos[0], token, 0, token.length())) {
            pos[0] += token.length();
            return true;
        }
        return false;
    }

    private boolean peek(String expr, int[] pos, String token) {
        skipWhitespace(expr, pos);
        return expr.regionMatches(true, pos[0], token, 0, token.length());
    }

    private String parseIdentifier(String expr, int[] pos) {
        int start = pos[0];
        while (pos[0] < expr.length() && (Character.isLetterOrDigit(expr.charAt(pos[0])) || expr.charAt(pos[0]) == '_')) {
            pos[0]++;
        }
        return expr.substring(start, pos[0]);
    }

    private void skipToken(String expr, int[] pos) {
        // 跳过配对的小括号内容
        if (pos[0] < expr.length() && expr.charAt(pos[0]) == '(') {
            int depth = 1;
            pos[0]++;
            while (pos[0] < expr.length() && depth > 0) {
                char ch = expr.charAt(pos[0]);
                if (ch == '(') depth++;
                else if (ch == ')') depth--;
                pos[0]++;
            }
        } else {
            while (pos[0] < expr.length() && !Character.isWhitespace(expr.charAt(pos[0])) &&
                    !peek(expr, pos, "||") && !peek(expr, pos, "&&") && !peek(expr, pos, ">=") &&
                    !peek(expr, pos, "<=") && !peek(expr, pos, "!=") && !peek(expr, pos, "==") &&
                    !peek(expr, pos, ">") && !peek(expr, pos, "<")) {
                pos[0]++;
            }
        }
    }

    private Object parseNumber(String expr, int[] pos) {
        int start = pos[0];
        boolean hasDot = false;
        while (pos[0] < expr.length()) {
            char ch = expr.charAt(pos[0]);
            if (Character.isDigit(ch)) {
                pos[0]++;
            } else if (ch == '.' && !hasDot) {
                hasDot = true;
                pos[0]++;
            } else {
                break;
            }
        }
        String numStr = expr.substring(start, pos[0]);
        if (hasDot) {
            return Double.parseDouble(numStr);
        }
        try {
            return Long.parseLong(numStr);
        } catch (NumberFormatException e) {
            return Double.parseDouble(numStr);
        }
    }

    private String parseString(String expr, int[] pos, char quote) {
        pos[0]++; // skip opening quote
        int start = pos[0];
        while (pos[0] < expr.length() && expr.charAt(pos[0]) != quote) {
            // 处理转义字符
            if (expr.charAt(pos[0]) == '\\' && pos[0] + 1 < expr.length()) {
                pos[0] += 2;
            } else {
                pos[0]++;
            }
        }
        String s = expr.substring(start, pos[0]);
        if (pos[0] < expr.length()) {
            pos[0]++; // skip closing quote
        }
        return s;
    }

    // ==================== 运算方法 ====================

    private boolean compare(Object left, Object right, String op) {
        // 数值比较
        if (isNumeric(left) && isNumeric(right)) {
            double l = toDouble(left);
            double r = toDouble(right);
            return switch (op) {
                case ">" -> l > r;
                case "<" -> l < r;
                case ">=" -> l >= r;
                case "<=" -> l <= r;
                case "==" -> Math.abs(l - r) < 1e-9;
                case "!=" -> Math.abs(l - r) >= 1e-9;
                default -> false;
            };
        }

        // 字符串比较
        String ls = toString(left);
        String rs = toString(right);
        return switch (op) {
            case "==" -> ls.equals(rs);
            case "!=" -> !ls.equals(rs);
            case ">" -> ls.compareTo(rs) > 0;
            case "<" -> ls.compareTo(rs) < 0;
            case ">=" -> ls.compareTo(rs) >= 0;
            case "<=" -> ls.compareTo(rs) <= 0;
            default -> false;
        };
    }

    private Object add(Object a, Object b) {
        if (isNumeric(a) && isNumeric(b)) {
            double sum = toDouble(a) + toDouble(b);
            if (sum == Math.floor(sum)) return (long) sum;
            return sum;
        }
        return toString(a) + toString(b);
    }

    private Object subtract(Object a, Object b) {
        if (isNumeric(a) && isNumeric(b)) {
            double diff = toDouble(a) - toDouble(b);
            if (diff == Math.floor(diff)) return (long) diff;
            return diff;
        }
        return toString(a); // fallback
    }

    private Object multiply(Object a, Object b) {
        if (isNumeric(a) && isNumeric(b)) {
            double prod = toDouble(a) * toDouble(b);
            if (prod == Math.floor(prod)) return (long) prod;
            return prod;
        }
        return 0;
    }

    private Object divide(Object a, Object b) {
        double r = toDouble(b);
        if (Math.abs(r) < 1e-9) {
            log.warn("除以零");
            return 0;
        }
        return toDouble(a) / r;
    }

    private Object modulo(Object a, Object b) {
        double r = toDouble(b);
        if (Math.abs(r) < 1e-9) return 0;
        long la = (long) toDouble(a);
        long lb = (long) r;
        return la % lb;
    }

    private Object negate(Object v) {
        if (isNumeric(v)) {
            double d = toDouble(v);
            return -d;
        }
        return v;
    }

    private boolean isNumeric(Object v) {
        if (v == null) return false;
        if (v instanceof Number) return true;
        if (v instanceof String) {
            try {
                Double.parseDouble((String) v);
                return true;
            } catch (NumberFormatException e) {
                return false;
            }
        }
        return false;
    }

    private double toDouble(Object v) {
        if (v instanceof Number) return ((Number) v).doubleValue();
        if (v instanceof String) {
            try {
                return Double.parseDouble((String) v);
            } catch (NumberFormatException e) {
                return 0;
            }
        }
        if (v instanceof Boolean) return ((Boolean) v) ? 1 : 0;
        return 0;
    }

    private String toString(Object v) {
        if (v == null) return "null";
        return v.toString();
    }
}
