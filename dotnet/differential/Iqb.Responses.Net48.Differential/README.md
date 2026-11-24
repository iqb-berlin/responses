# Iqb.Responses.Net48.Differential

The [differential worker](../Iqb.Responses.Differential/README.md) built for
.NET Framework 4.8. It runs the TypeScript/.NET differential tests against the
`netstandard2.0` build of `Iqb.Responses`.

The project compiles the `.cs` files of `Iqb.Responses.Differential` as links;
APIs that .NET Framework 4.8 lacks are supplied by the test-only polyfills it
shares with `Iqb.Responses.Net48.Tests` (`../../test/Iqb.Responses.Net48.Tests/Polyfills`).

The project is Windows only and is therefore not part of
`Iqb.Responses.sln`; use `dotnet/Iqb.Responses.Net48.sln`.

## Requirements

- Windows with .NET Framework 4.8 (no developer pack needed)
- .NET 10 SDK
- Node.js 24 and npm

## Run

From the repository root in `cmd` or PowerShell:

```bat
:: once, and after changes to the TypeScript sources
npm ci
npm run prepare_publish

:: after changes to the .NET sources
dotnet build dotnet\differential\Iqb.Responses.Net48.Differential --configuration Release

npm run test:differential:net48
```

`test:differential:net48` sets `DIFF_WORKER` to
`dotnet\differential\Iqb.Responses.Net48.Differential\bin\Release\net48\Iqb.Responses.Net48.Differential.exe`
and runs `npm run test:differential`. Expected result:

```text
TypeScript/.NET differential test passed for … results.
Generative TypeScript/.NET parity passed for 20000 case(s).
```

Failures are minimized and written to `artifacts/differential/`. To replay one
on .NET Framework 4.8, set `DIFF_WORKER` the same way before
`npm run test:differential:generated -- --case <minimized.request.json>`.
