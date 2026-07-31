namespace Iqb.Responses;

public static class ResponseStatus
{
    public const string CodingIncomplete = "CODING_INCOMPLETE";
    public const string CodingComplete = "CODING_COMPLETE";
    public const string CodingError = "CODING_ERROR";
    public const string DerivePending = "DERIVE_PENDING";
    public const string DeriveError = "DERIVE_ERROR";
    public const string Displayed = "DISPLAYED";
    public const string PartlyDisplayed = "PARTLY_DISPLAYED";
    public const string NotReached = "NOT_REACHED";
    public const string Invalid = "INVALID";
    public const string IntendedIncomplete = "INTENDED_INCOMPLETE";
    public const string NoCoding = "NO_CODING";
    public const string Unset = "UNSET";
    public const string ValueChanged = "VALUE_CHANGED";

    internal static readonly HashSet<string> ManualValid =
        [Invalid, ValueChanged, NoCoding, CodingError, CodingComplete, IntendedIncomplete];
    internal static readonly HashSet<string> CopySolverValid =
        [ValueChanged, NoCoding, CodingIncomplete, CodingError, CodingComplete, IntendedIncomplete];
    internal static readonly HashSet<string> ConcatSumValid = [CodingComplete, IntendedIncomplete];
    internal static readonly HashSet<string> PartlyDisplayedStatuses = [NotReached, Displayed, PartlyDisplayed];
    internal static readonly HashSet<string> DerivePendingStatuses = [CodingIncomplete, DerivePending];
}
