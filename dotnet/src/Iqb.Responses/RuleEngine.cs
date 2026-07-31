using System.Text.RegularExpressions;

namespace Iqb.Responses;

internal static class RuleEngine
{
    private static readonly TimeSpan RegexTimeout = TimeSpan.FromMilliseconds(500);
    private static readonly object JavaScriptUndefined = new();

    public static bool IsMatchRuleSet(
        object? valueToCheck,
        RuleSet ruleSet,
        bool isValueArray,
        IReadOnlyCollection<string> codingProcessing)
    {
        if (ruleSet.Rules.Count == 0)
        {
            return false;
        }

        var member = ResolveArrayMember(valueToCheck, ruleSet, isValueArray, out var hasMember);
        var valueToEvaluate = hasMember ? member : valueToCheck;
        var arrayForRules = !hasMember && isValueArray;
        var matches = ruleSet.RuleOperatorAnd == true
            ? ruleSet.Rules.All(rule => IsMatchRule(valueToEvaluate, rule, arrayForRules, codingProcessing))
            : ruleSet.Rules.Any(rule => IsMatchRule(valueToEvaluate, rule, arrayForRules, codingProcessing));

        if (!matches || !isValueArray || valueToCheck is not IEnumerable<object?> sequence)
        {
            return matches;
        }

        var values = sequence.ToList();
        var position = ruleSet.ValueArrayPos as string;
        if (position == "ANY_OPEN" && values.Count > 0)
        {
            return values.Any(value => ruleSet.Rules.All(rule => IsMatchRule(value, rule, false, codingProcessing)));
        }
        if (position == "ANY" && values.Count > 1)
        {
            return values.All(value => ruleSet.Rules.All(rule => IsMatchRule(value, rule, false, codingProcessing)));
        }
        return matches;
    }

    private static object? ResolveArrayMember(object? value, RuleSet ruleSet, bool isArray, out bool found)
    {
        found = false;
        if (!isArray || value is not IEnumerable<object?> sequence)
        {
            return null;
        }
        var values = sequence.ToList();
        if (ruleSet.ValueArrayPos is double numericPosition)
        {
            var index = (int)numericPosition;
            if (numericPosition == index && index >= 0 && index < values.Count)
            {
                found = true;
                return values[index];
            }
            return null;
        }
        if (ruleSet.ValueArrayPos is not string position)
        {
            return null;
        }
        if (position == "SUM")
        {
            found = true;
            return values.Sum(value => value is IEnumerable<object?> nested
                ? nested.Sum(item => ValueTransforms.GetValueAsNumber(item) ?? 0d)
                : ValueTransforms.GetValueAsNumber(value) ?? 0d);
        }
        if (position == "LENGTH")
        {
            found = true;
            return (double)values.Count;
        }
        return null;
    }

    private static bool IsMatchRule(
        object? value,
        CodingRule rule,
        bool isValueArray,
        IReadOnlyCollection<string> processing)
    {
        if (value is IEnumerable<object?> sequence)
        {
            var values = sequence.ToList();
            if (isValueArray)
            {
                if (values.Count == 0)
                {
                    return CheckOneValue(string.Empty, rule, processing);
                }
                return values.Any(member => MatchArrayMember(member, rule, processing));
            }

            if (rule.Fragment is null or < 0)
            {
                return values.Any(member => CheckOneValue(member, rule, processing));
            }
            var fragmentIndex = (int)rule.Fragment.Value;
            var fragment = rule.Fragment.Value == fragmentIndex && fragmentIndex >= 0 && fragmentIndex < values.Count
                ? values[fragmentIndex]
                : JavaScriptUndefined;
            return CheckOneValue(fragment, rule, processing);
        }
        return CheckOneValue(value, rule, processing);
    }

    private static bool MatchArrayMember(object? member, CodingRule rule, IReadOnlyCollection<string> processing)
    {
        if (member is not IEnumerable<object?> nested)
        {
            return CheckOneValue(member, rule, processing);
        }
        var fragments = nested.ToList();
        if (rule.Fragment is null or < 0)
        {
            return fragments.Any(fragment => CheckOneValue(fragment, rule, processing));
        }
        var fragmentIndex = (int)rule.Fragment.Value;
        var fragment = rule.Fragment.Value == fragmentIndex && fragmentIndex >= 0 && fragmentIndex < fragments.Count
            ? fragments[fragmentIndex]
            : JavaScriptUndefined;
        return CheckOneValue(fragment, rule, processing);
    }

    private static bool CheckOneValue(object? value, CodingRule rule, IReadOnlyCollection<string> processing)
    {
        var parameters = rule.Parameters ?? [];
        if (ReferenceEquals(value, JavaScriptUndefined))
        {
            if (rule.Method.StartsWith("NUMERIC_", StringComparison.Ordinal))
                throw new InvalidOperationException("A numeric rule cannot evaluate an undefined fragment.");
            return rule.Method == "MATCH_REGEX" && FindRegex("undefined", parameters, processing.Contains("IGNORE_CASE"));
        }
        switch (rule.Method)
        {
            case "IS_NULL":
                return value is null;
            case "IS_EMPTY":
                return ValueTransforms.IsEmptyValue(value);
            case "MATCH":
                return value is not null && !Equals(value, string.Empty) && FindString(value, parameters, processing);
            case "MATCH_REGEX":
                return value is not null && !Equals(value, string.Empty) && FindRegex(value, parameters, processing.Contains("IGNORE_CASE"));
            case "NUMERIC_MATCH":
                return FindNumeric(value, parameters);
            case "NUMERIC_LESS_THAN":
                return Compare(value, parameters, (left, right) => left < right, prefixParse: true);
            case "NUMERIC_MAX":
                return Compare(value, parameters, (left, right) => left <= right, prefixParse: true);
            case "NUMERIC_MORE_THAN":
                return Compare(value, parameters, (left, right) => left > right, prefixParse: true);
            case "NUMERIC_MIN":
                return Compare(value, parameters, (left, right) => left >= right, prefixParse: true);
            case "NUMERIC_RANGE":
                return Range(value, parameters, includeLower: false);
            case "NUMERIC_FULL_RANGE":
                return Range(value, parameters, includeLower: true);
            case "IS_TRUE":
                return Equals(value, 1d) || Equals(value, "1") || Equals(value, true) || Equals(value, "true");
            case "IS_FALSE":
                return Equals(value, 0d) || Equals(value, "0") || Equals(value, false) || Equals(value, "false");
            default:
                return false;
        }
    }

    private static bool FindString(object value, IEnumerable<string> parameters, IReadOnlyCollection<string> processing)
    {
        var text = ValueTransforms.GetValueAsString(value) ?? string.Empty;
        var transformed = (string)ValueTransforms.TransformString(text, processing);
        return parameters.SelectMany(SplitLines)
            .Select(item => (string)ValueTransforms.TransformString(item, processing))
            .Contains(transformed, StringComparer.Ordinal);
    }

    private static bool FindRegex(object value, IEnumerable<string> parameters, bool ignoreCase)
    {
        var text = ValueTransforms.GetValueAsString(value) ?? string.Empty;
        var options = ignoreCase ? RegexOptions.IgnoreCase : RegexOptions.None;
        return parameters.SelectMany(SplitLines).Any(pattern =>
        {
            try
            {
                return Regex.IsMatch(text, pattern, options, RegexTimeout);
            }
            catch (ArgumentException)
            {
                return false;
            }
            catch (RegexMatchTimeoutException)
            {
                return false;
            }
        });
    }

    private static bool FindNumeric(object? value, IEnumerable<string> parameters)
    {
        if (value is null || Equals(value, string.Empty))
        {
            return false;
        }
        var number = ValueTransforms.GetValueAsNumber(value);
        return number is not null && parameters.SelectMany(SplitLines)
            .Select(ValueTransforms.GetValueAsNumber)
            .Any(candidate => candidate == number);
    }

    private static bool Compare(object? value, IReadOnlyList<string> parameters, Func<double, double, bool> compare, bool prefixParse)
    {
        if (value is null || Equals(value, string.Empty) || parameters.Count == 0)
        {
            return false;
        }
        var left = ValueTransforms.GetValueAsNumber(value);
        var right = prefixParse ? ValueTransforms.ParseFloatPrefix(parameters[0]) : ValueTransforms.GetValueAsNumber(parameters[0]);
        return left is not null && right is not null && compare(left.Value, right.Value);
    }

    private static bool Range(object? value, IReadOnlyList<string> parameters, bool includeLower)
    {
        if (value is null || Equals(value, string.Empty) || parameters.Count < 2)
        {
            return false;
        }
        var number = ValueTransforms.GetValueAsNumber(value);
        var lower = ValueTransforms.GetValueAsNumber(parameters[0]);
        var upper = ValueTransforms.GetValueAsNumber(parameters[1]);
        return number is not null && lower is not null && upper is not null &&
               (includeLower ? number >= lower : number > lower) && number <= upper;
    }

    private static IEnumerable<string> SplitLines(string value) => value.Split(["\r\n", "\n"], StringSplitOptions.None);
}
