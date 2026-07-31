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
                else if (Take("%")) left = Number(left, ParseUnary(), (a, b) => a % b);
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
            return ParseNumber();
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

        private static bool EqualsValue(Value left, Value right) => left.Kind == right.Kind && left.Kind switch
        {
            ValueKind.Number => left.Number == right.Number,
            ValueKind.Boolean => left.Boolean == right.Boolean,
            ValueKind.Null => true,
            _ => false
        };
    }
}
