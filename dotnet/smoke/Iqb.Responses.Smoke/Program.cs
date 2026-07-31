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

Console.WriteLine("Iqb.Responses package smoke test passed.");
