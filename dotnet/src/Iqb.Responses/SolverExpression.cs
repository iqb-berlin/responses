using System.Globalization;

namespace Iqb.Responses;

internal static class SolverExpression
{
    public static object? Evaluate(string expression)
    {
        if (expression.Length > 16_384)
        {
            throw new FormatException("SOLVER expression exceeds the maximum length.");
        }
        var parser = new Parser(expression);
        var result = parser.ParseExpression();
        parser.ExpectEnd();
        return result.Kind switch
        {
            ValueKind.Number => result.Number,
            ValueKind.Boolean => result.Boolean,
            ValueKind.Null => null,
            _ => throw new FormatException("Unsupported SOLVER result.")
        };
    }

    private enum ValueKind { Number, Boolean, Null }

    private readonly record struct Value(ValueKind Kind, double Number = 0, bool Boolean = false)
    {
        public static Value FromNumber(double value) => new(ValueKind.Number, value);
        public static Value FromBoolean(bool value) => new(ValueKind.Boolean, Boolean: value);
        public static Value Null => new(ValueKind.Null);
    }

    private sealed class Parser(string text)
    {
        private int _position;
        private int _depth;

        public Value ParseExpression() => ParseTernary();

        public void ExpectEnd()
        {
            SkipWhiteSpace();
            if (_position != text.Length)
            {
                throw Error("Unexpected input");
            }
        }

        private Value ParseTernary()
        {
            Enter();
            try
            {
                var condition = ParseEquality();
                if (!Take("?"))
                {
                    return condition;
                }
                var whenTrue = ParseTernary();
                Require(":");
                var whenFalse = ParseTernary();
                return AsBoolean(condition) ? whenTrue : whenFalse;
            }
            finally
            {
                _depth--;
            }
        }

        private Value ParseEquality()
        {
            var left = ParseComparison();
            while (true)
            {
                if (Take("=="))
                {
                    left = Value.FromBoolean(EqualsValue(left, ParseComparison()));
                }
                else if (Take("!="))
                {
                    left = Value.FromBoolean(!EqualsValue(left, ParseComparison()));
                }
                else
                {
                    return left;
                }
            }
        }

        private Value ParseComparison()
        {
            var left = ParseAdditive();
            while (true)
            {
                if (Take("<=")) left = Compare(left, ParseAdditive(), (a, b) => a <= b);
                else if (Take(">=")) left = Compare(left, ParseAdditive(), (a, b) => a >= b);
                else if (Take("<")) left = Compare(left, ParseAdditive(), (a, b) => a < b);
                else if (Take(">")) left = Compare(left, ParseAdditive(), (a, b) => a > b);
                else return left;
            }
        }

        private Value ParseAdditive()
        {
            var left = ParseMultiplicative();
            while (true)
            {
                if (Take("+")) left = Number(left, ParseMultiplicative(), (a, b) => a + b);
                else if (Take("-")) left = Number(left, ParseMultiplicative(), (a, b) => a - b);
                else return left;
            }
        }

        private Value ParseMultiplicative()
        {
            var left = ParseUnary();
            while (true)
            {
                if (Take("*")) left = Number(left, ParseUnary(), (a, b) => a * b);
                else if (Take("/")) left = Number(left, ParseUnary(), (a, b) => a / b);
                else if (Take("%")) left = Number(left, ParseUnary(), Modulo);
                else return left;
            }
        }

        private Value ParseUnary()
        {
            if (Take("+")) return Value.FromNumber(AsNumber(ParseUnary()));
            if (Take("-")) return Value.FromNumber(-AsNumber(ParseUnary()));
            return ParsePower();
        }

        private Value ParsePower()
        {
            var left = ParsePrimary();
            return Take("^")
                ? Value.FromNumber(Math.Pow(AsNumber(left), AsNumber(ParseUnary())))
                : left;
        }

        private Value ParsePrimary()
        {
            if (Take("("))
            {
                var nested = ParseTernary();
                Require(")");
                return nested;
            }
            if (TakeWord("true")) return Value.FromBoolean(true);
            if (TakeWord("false")) return Value.FromBoolean(false);
            if (TakeWord("null")) return Value.Null;
            if (IsIdentifierStart()) return ParseIdentifier();
            return ParseNumber();
        }

        private Value ParseIdentifier()
        {
            SkipWhiteSpace();
            var start = _position++;
            while (_position < text.Length && IsIdentifierPart(text[_position])) _position++;
            var identifier = text[start.._position];
            if (Take("(")) return EvaluateFunction(identifier, ParseArguments());
            return identifier switch
            {
                "pi" or "PI" => Value.FromNumber(Math.PI),
                "e" or "E" => Value.FromNumber(Math.E),
                "tau" => Value.FromNumber(Math.Tau),
                "phi" => Value.FromNumber((1d + Math.Sqrt(5d)) / 2d),
                "Infinity" => Value.FromNumber(double.PositiveInfinity),
                "NaN" => Value.FromNumber(double.NaN),
                _ => throw Error($"Unknown symbol '{identifier}'")
            };
        }

        private List<Value> ParseArguments()
        {
            var arguments = new List<Value>();
            if (Take(")")) return arguments;
            while (true)
            {
                arguments.Add(ParseTernary());
                if (Take(")")) return arguments;
                Require(",");
            }
        }

        private Value EvaluateFunction(string name, IReadOnlyList<Value> arguments)
        {
            var numbers = arguments.Select(AsNumber).ToArray();
            double result = name switch
            {
                "abs" => Unary(name, numbers, Math.Abs),
                "sqrt" => Unary(name, numbers, Math.Sqrt),
                "cbrt" => Unary(name, numbers, Math.Cbrt),
                "ceil" => Unary(name, numbers, Math.Ceiling),
                "floor" => Unary(name, numbers, Math.Floor),
                "fix" => Unary(name, numbers, Math.Truncate),
                "sign" => Unary(name, numbers, Sign),
                "exp" => Unary(name, numbers, Math.Exp),
                "log10" => Unary(name, numbers, Math.Log10),
                "log2" => Unary(name, numbers, Math.Log2),
                "sin" => Unary(name, numbers, Math.Sin),
                "cos" => Unary(name, numbers, Math.Cos),
                "tan" => Unary(name, numbers, Math.Tan),
                "asin" => Unary(name, numbers, Math.Asin),
                "acos" => Unary(name, numbers, Math.Acos),
                "atan" => Unary(name, numbers, Math.Atan),
                "square" => Unary(name, numbers, value => value * value),
                "cube" => Unary(name, numbers, value => value * value * value),
                "pow" => Binary(name, numbers, Math.Pow),
                "mod" => Binary(name, numbers, Modulo),
                "atan2" => Binary(name, numbers, Math.Atan2),
                "nthRoot" => OneOrTwo(name, numbers, NthRoot, 2d),
                "log" => Log(numbers),
                "round" => Round(numbers),
                "min" => Aggregate(name, numbers, Math.Min),
                "max" => Aggregate(name, numbers, Math.Max),
                "hypot" => Aggregate(name, numbers, Hypot, 0d),
                _ => throw Error($"Unknown function '{name}'")
            };
            return Value.FromNumber(result);
        }

        private Value ParseNumber()
        {
            SkipWhiteSpace();
            var start = _position;
            var hasDigits = false;
            while (_position < text.Length && char.IsDigit(text[_position]))
            {
                _position++;
                hasDigits = true;
            }
            if (_position < text.Length && text[_position] == '.')
            {
                _position++;
                while (_position < text.Length && char.IsDigit(text[_position]))
                {
                    _position++;
                    hasDigits = true;
                }
            }
            if (!hasDigits)
            {
                throw Error("Expected a number");
            }
            if (_position < text.Length && text[_position] is 'e' or 'E')
            {
                _position++;
                if (_position < text.Length && text[_position] is '+' or '-') _position++;
                var exponentStart = _position;
                while (_position < text.Length && char.IsDigit(text[_position])) _position++;
                if (_position == exponentStart) throw Error("Invalid exponent");
            }
            var token = text[start.._position];
            if (!double.TryParse(token, NumberStyles.Float, CultureInfo.InvariantCulture, out var number))
            {
                throw Error("Invalid number");
            }
            return Value.FromNumber(number);
        }

        private bool Take(string token)
        {
            SkipWhiteSpace();
            if (!text.AsSpan(_position).StartsWith(token, StringComparison.Ordinal)) return false;
            _position += token.Length;
            return true;
        }

        private bool TakeWord(string token)
        {
            SkipWhiteSpace();
            if (!text.AsSpan(_position).StartsWith(token, StringComparison.Ordinal)) return false;
            var end = _position + token.Length;
            if (end < text.Length && (char.IsLetterOrDigit(text[end]) || text[end] == '_')) return false;
            _position = end;
            return true;
        }

        private void Require(string token)
        {
            if (!Take(token)) throw Error($"Expected '{token}'");
        }

        private void SkipWhiteSpace()
        {
            while (_position < text.Length && char.IsWhiteSpace(text[_position])) _position++;
        }

        private void Enter()
        {
            _depth++;
            if (_depth > 64) throw Error("Maximum nesting depth exceeded");
        }

        private FormatException Error(string message) => new($"{message} at position {_position}.");

        private bool IsIdentifierStart()
        {
            SkipWhiteSpace();
            return _position < text.Length && (char.IsAsciiLetter(text[_position]) || text[_position] == '_');
        }

        private static bool IsIdentifierPart(char character) =>
            char.IsAsciiLetterOrDigit(character) || character == '_';

        private static double AsNumber(Value value) => value.Kind == ValueKind.Number
            ? value.Number
            : throw new FormatException("Numeric operand expected.");

        private static bool AsBoolean(Value value) => value.Kind == ValueKind.Boolean
            ? value.Boolean
            : throw new FormatException("Boolean condition expected.");

        private static Value Number(Value left, Value right, Func<double, double, double> operation) =>
            Value.FromNumber(operation(AsNumber(left), AsNumber(right)));

        private static Value Compare(Value left, Value right, Func<double, double, bool> operation) =>
            Value.FromBoolean(operation(AsNumber(left), AsNumber(right)));

        private static double Unary(string name, IReadOnlyList<double> values, Func<double, double> operation)
        {
            RequireCount(name, values, 1);
            return operation(values[0]);
        }

        private static double Binary(string name, IReadOnlyList<double> values, Func<double, double, double> operation)
        {
            RequireCount(name, values, 2);
            return operation(values[0], values[1]);
        }

        private static double OneOrTwo(
            string name,
            IReadOnlyList<double> values,
            Func<double, double, double> operation,
            double defaultSecond)
        {
            if (values.Count is < 1 or > 2) throw new FormatException($"Function '{name}' expects one or two arguments.");
            return operation(values[0], values.Count == 2 ? values[1] : defaultSecond);
        }

        private static double Aggregate(
            string name,
            IReadOnlyList<double> values,
            Func<double, double, double> operation,
            double? seed = null)
        {
            if (values.Count == 0) throw new FormatException($"Function '{name}' expects at least one argument.");
            var result = seed ?? values[0];
            var start = seed is null ? 1 : 0;
            for (var index = start; index < values.Count; index++) result = operation(result, values[index]);
            return result;
        }

        private static double Round(IReadOnlyList<double> values)
        {
            if (values.Count is < 1 or > 2) throw new FormatException("Function 'round' expects one or two arguments.");
            var decimals = values.Count == 1 ? 0 : values[1];
            if (decimals != Math.Truncate(decimals) || decimals is < 0 or > 15)
                throw new FormatException("The number of decimals must be an integer from 0 through 15.");
            if (!double.IsFinite(values[0])) return values[0];
            var textValue = values[0].ToString("R", CultureInfo.InvariantCulture);
            return decimal.TryParse(textValue, NumberStyles.Float, CultureInfo.InvariantCulture, out var decimalValue)
                ? (double)Math.Round(decimalValue, (int)decimals, MidpointRounding.AwayFromZero)
                : Math.Round(values[0], (int)decimals, MidpointRounding.AwayFromZero);
        }

        private static double Log(IReadOnlyList<double> values)
        {
            if (values.Count is < 1 or > 2) throw new FormatException("Function 'log' expects one or two arguments.");
            return values.Count == 1 ? Math.Log(values[0]) : Math.Log(values[0], values[1]);
        }

        private static double Modulo(double value, double divisor) =>
            divisor == 0 ? value : value - divisor * Math.Floor(value / divisor);

        private static double Hypot(double left, double right)
        {
            var maximum = Math.Max(Math.Abs(left), Math.Abs(right));
            if (double.IsInfinity(maximum)) return double.PositiveInfinity;
            if (maximum == 0) return 0;
            var minimum = Math.Min(Math.Abs(left), Math.Abs(right));
            var ratio = minimum / maximum;
            return maximum * Math.Sqrt(1d + ratio * ratio);
        }

        private static double NthRoot(double value, double root)
        {
            if (root == 0) throw new FormatException("Root must be non-zero.");
            var inverse = root < 0;
            var positiveRoot = Math.Abs(root);
            double result;
            if (value < 0)
            {
                if (positiveRoot != Math.Truncate(positiveRoot) || Math.Abs(positiveRoot % 2) != 1)
                    return double.NaN;
                result = -Math.Pow(-value, 1d / positiveRoot);
            }
            else result = Math.Pow(value, 1d / positiveRoot);
            return inverse ? 1d / result : result;
        }

        private static double Sign(double value) => double.IsNaN(value) ? double.NaN : Math.Sign(value);

        private static void RequireCount(string name, IReadOnlyCollection<double> values, int expected)
        {
            if (values.Count != expected) throw new FormatException($"Function '{name}' expects {expected} argument(s).");
        }

        private static bool EqualsValue(Value left, Value right) => left.Kind == right.Kind && left.Kind switch
        {
            ValueKind.Number => left.Number == right.Number,
            ValueKind.Boolean => left.Boolean == right.Boolean,
            ValueKind.Null => true,
            _ => false
        };
    }
}
