# Iqb.Responses.Tests

Unit, compatibility, golden-vector and public-API tests for the native .NET
package on .NET 10 (the `net10.0` build of `Iqb.Responses`).

## Requirements

- .NET 10 SDK

The golden vectors are read from the checked-in fixtures in `test/coding`;
Node.js is not needed.

## Run

From the repository root:

```sh
dotnet test dotnet/Iqb.Responses.sln --configuration Release
```

CI additionally enforces coverage (90 % line, 80 % branch); see
`.github/workflows/ci.yml`.

## Related

- [Iqb.Responses.Net48.Tests](../Iqb.Responses.Net48.Tests/README.md) runs this
  suite on .NET Framework 4.8 against the `netstandard2.0` build.
- [Iqb.Responses.Differential](../../differential/Iqb.Responses.Differential/README.md)
  compares the .NET results with the TypeScript reference.
