# Iqb.Responses.Net48.Tests

Runs the complete [Iqb.Responses.Tests](../Iqb.Responses.Tests/README.md) suite
on .NET Framework 4.8. This exercises the `netstandard2.0` build of
`Iqb.Responses`, including its polyfills in `src/Iqb.Responses/Polyfills`.

The project contains no tests of its own: it compiles the `.cs` files of
`Iqb.Responses.Tests` as links, so new tests there are picked up automatically.
APIs that the test code uses but .NET Framework 4.8 lacks are supplied by the
test-only polyfills in `Polyfills/`; keep the shared test code free of `#if`.

The project is Windows only and is therefore not part of
`Iqb.Responses.sln`, which CI builds and tests on Linux. Use
`dotnet/Iqb.Responses.Net48.sln`, which contains all .NET projects.

## Requirements

- Windows with .NET Framework 4.8 (no developer pack needed)
- .NET 10 SDK

## Run

From the repository root:

```bat
dotnet test dotnet\test\Iqb.Responses.Net48.Tests --configuration Release
```

To run the `net10.0` and `net48` suites together:

```bat
dotnet test dotnet\Iqb.Responses.Net48.sln --configuration Release
```

In Visual Studio, open `dotnet\Iqb.Responses.Net48.sln`; the Test Explorer
lists both test projects.
