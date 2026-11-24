# Iqb.Responses.Differential

Worker that executes coding requests with the native .NET package (`net10.0`
build) for the TypeScript/.NET differential tests. The Node scripts in
`scripts/` start it, feed it the checked-in golden vectors and generated cases,
and compare its results with the TypeScript reference. See
"Differential parity testing" in the repository [README](../../../README.md).

## Requirements

- .NET 10 SDK
- Node.js 24 and npm

## Run

From the repository root:

```sh
# once, and after changes to the TypeScript sources
npm ci
npm run prepare_publish

# after changes to the .NET sources
dotnet build dotnet/differential/Iqb.Responses.Differential --configuration Release

npm run test:differential
```

The scripts start the worker with `dotnet run --no-build`, so build it first.
Expected result:

```text
TypeScript/.NET differential test passed for … results.
Generative TypeScript/.NET parity passed for 20000 case(s).
```

Failures are minimized and written to `artifacts/differential/`.

## Running another worker build

Set `DIFF_WORKER` to a prebuilt worker executable (absolute or relative to the
repository root) to use it instead of `dotnet run`. This is how
[Iqb.Responses.Net48.Differential](../Iqb.Responses.Net48.Differential/README.md)
runs the same tests on .NET Framework 4.8.
