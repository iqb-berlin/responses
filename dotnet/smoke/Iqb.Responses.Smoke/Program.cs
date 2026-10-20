using Iqb.Responses;

var coding = CodingFactory.CreateCodingVariable("A1");
coding.Codes =
[
    new CodeData
    {
        Id = 1d,
        Score = 1d,
        RuleSets =
        [
            new RuleSet
            {
                Rules = [new CodingRule { Method = "MATCH", Parameters = ["correct"] }]
            }
        ]
    }
];

var result = CodingFactory.Code(new Response
{
    Id = "A1",
    Status = ResponseStatus.ValueChanged,
    Value = "correct"
}, coding);

if (result.Status != ResponseStatus.CodingComplete || !Equals(result.Code, 1d))
{
    throw new InvalidOperationException("The packaged coding engine returned an unexpected result.");
}

// Exercise the repaired contracts through the installed NuGet package, without a project reference.
var ruleSet = coding.Codes[0].RuleSets![0];
ruleSet.ValueArrayPos = 0;
var arrayResult = CodingFactory.Code(new Response
{
    Id = "A1", Status = ResponseStatus.ValueChanged, Value = new List<object?> { "wrong", "correct" }
}, coding);
Require(arrayResult.Status == ResponseStatus.CodingIncomplete, "Native integer array position was ignored.");

ruleSet.ValueArrayPos = null;
ruleSet.Rules = [new CodingRule { Method = "MATCH_REGEX", Parameters = ["^.$"] }];
var regexResult = CodingFactory.Code(new Response
{
    Id = "A1", Status = ResponseStatus.ValueChanged, Value = "\r"
}, coding);
Require(regexResult.Status == ResponseStatus.CodingIncomplete, "Portable dot accepted a JavaScript line terminator.");

coding.Fragmenting = "(a)?(b)";
ruleSet.Rules = [new CodingRule { Method = "IS_EMPTY", Fragment = 0 }];
var fragmentResult = CodingFactory.Code(new Response
{
    Id = "A1", Status = ResponseStatus.ValueChanged, Value = "b"
}, coding);
Require(fragmentResult.Status == ResponseStatus.CodingIncomplete, "An absent capture became an empty value.");

coding.Fragmenting = "(?<first>a)(b)";
ruleSet.Rules = [new CodingRule { Method = "MATCH", Parameters = ["a"], Fragment = 0 }];
var namedResult = CodingFactory.Code(new Response
{
    Id = "A1", Status = ResponseStatus.ValueChanged, Value = "ab"
}, coding);
Require(namedResult.Status == ResponseStatus.CodingComplete, "Named captures changed fragment order.");

coding.Alias = string.Empty;
var info = new VariableInfo { Id = "A1", Type = "STRING" };
Require(CodingSchemeFactory.Validate([info], [coding]).Count == 0, "Empty alias validation failed.");
Require(CodingSchemeFactory.Code([new Response
{
    Id = "A1", Status = ResponseStatus.ValueChanged, Value = "ab"
}], [coding])[0].Id == "A1", "An empty alias replaced the response identifier.");
ruleSet.ValueArrayPos = 0;
Require(info.Multiple is null && CodingSchemeFactory.Validate([info], [coding]).Count == 0,
    "Omitted multiple metadata became an explicit scalar.");
info.Multiple = false;
Require(CodingSchemeFactory.Validate([info], [coding]).Any(problem => problem.Type == "RULESET_VALUE_ARRAY_POS_INVALID"),
    "An explicit scalar accepted an array position.");

var solver = CodingFactory.CreateBaseCodingVariable("d", "SOLVER");
solver.SourceParameters!.SolverExpression = "true ? 1 : nthRoot(4,0)";
var derived = CodingSchemeFactory.DeriveValue([solver], solver, []);
Require(derived.Status == ResponseStatus.ValueChanged && Equals(derived.Value, 1d), "SOLVER executed the unselected branch.");
solver.SourceParameters.SolverExpression = "1 < 2 < 3 ? 1 : 0";
Require(Equals(CodingSchemeFactory.DeriveValue([solver], solver, []).Value, 1d), "SOLVER comparison chain failed.");
Require(CodingFactory.GetValueAsNumber("\ufeff1") == 1d &&
        CodingFactory.GetValueAsNumber("1\u00852") is null, "Numeric whitespace normalization differed from JavaScript.");
Console.WriteLine("Iqb.Responses package smoke and regression tests passed.");

static void Require(bool condition, string message)
{
    if (!condition) throw new InvalidOperationException(message);
}
