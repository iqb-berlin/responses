namespace Iqb.Responses;

/// <summary>Provides complete response-set coding, derivation, validation and dependency inspection.</summary>
public static class CodingSchemeFactory
{
    private static readonly HashSet<string> ValidStatesToStartDeriving =
        [ResponseStatus.Unset, ResponseStatus.CodingError, ResponseStatus.CodingIncomplete];

    /// <summary>Builds the ordered dependency graph for a coding scheme.</summary>
    public static List<VariableGraphNode> GetVariableDependencyTree(IReadOnlyList<VariableCodingData> variableCodings)
    {
        var graph = variableCodings.Where(coding => coding.SourceType == "BASE").Select(coding => new VariableGraphNode
        {
            Id = coding.Id,
            Level = 0,
            Sources = [],
            Page = coding.Page ?? string.Empty
        }).ToList();
        var expected = variableCodings.Count(coding => coding.SourceType != "BASE_NO_VALUE");
        while (graph.Count < expected)
        {
            var changed = false;
            foreach (var coding in variableCodings)
            {
                if (coding.SourceType == "BASE_NO_VALUE" || graph.Any(node => node.Id == coding.Id)) continue;
                var sources = coding.DeriveSources ?? [];
                var sourceNodes = sources.Select(source => graph.FirstOrDefault(node => node.Id == source)).ToList();
                if (sourceNodes.Any(node => node is null)) continue;
                var pages = sourceNodes.Select(node => node!.Page).Distinct(StringComparer.Ordinal).ToList();
                graph.Add(new VariableGraphNode
                {
                    Id = coding.Id,
                    Level = sourceNodes.Count == 0 ? 1 : sourceNodes.Max(node => node!.Level) + 1,
                    Sources = [.. sources],
                    Page = pages.Count == 1 ? pages[0] : string.Empty
                });
                changed = true;
            }
            if (!changed) throw new InvalidOperationException("Circular dependency detected in the coding scheme");
        }
        return graph;
    }

    /// <summary>Derives one response from its source responses.</summary>
    public static Response DeriveValue(
        IReadOnlyList<VariableCodingData> variableCodings,
        VariableCodingData coding,
        IReadOnlyList<Response> sourceResponses) =>
        Derivation.DeriveValue(variableCodings, coding, sourceResponses);

    /// <summary>Runs the complete coding pipeline without mutating caller-owned inputs.</summary>
    public static List<Response> Code(
        IReadOnlyList<Response> unitResponses,
        IReadOnlyList<VariableCodingData> variableCodings,
        Action<Exception>? onError = null)
    {
        var responses = IqbJson.Clone(unitResponses.ToList());
        var allCoded = new List<Response>();
        var subformGroups = new Dictionary<string, List<Response>>(StringComparer.Ordinal);
        var withoutSubform = new List<Response>();
        foreach (var response in responses)
        {
            if (!string.IsNullOrEmpty(response.Subform))
            {
                if (!subformGroups.TryGetValue(response.Subform, out var group))
                {
                    group = [];
                    subformGroups.Add(response.Subform, group);
                }
                group.Add(response);
            }
            else withoutSubform.Add(response);
        }

        foreach (var allResponses in subformGroups.Values.Append(withoutSubform))
        {
            var mappedGroup = MapAliasToId(allResponses, variableCodings);
            var isSubformGroup = allResponses.All(response => response.Subform is not null);
            responses = isSubformGroup ? [.. mappedGroup, .. withoutSubform] : mappedGroup;
            NormalizeStatuses(responses, variableCodings);
            responses = RemoveDerivedInputConflicts(responses, variableCodings);

            List<VariableGraphNode> dependencies;
            var globalError = false;
            try
            {
                dependencies = GetVariableDependencyTree(variableCodings);
            }
            catch (Exception error)
            {
                onError?.Invoke(error);
                dependencies = [];
                globalError = true;
            }
            EnsureResponses(responses, variableCodings, dependencies, globalError);
            ApplyDerivationsAndCoding(responses, variableCodings, dependencies, onError);
            responses = RemoveShadowedBaseAliases(responses, variableCodings);
            responses = MapIdToAlias(responses, variableCodings);
            allCoded.AddRange(responses);
        }
        return FinalizeResponses(allCoded, subformGroups, variableCodings);
    }

    /// <summary>Returns the unique base-variable aliases required by the requested target aliases.</summary>
    public static List<string> GetBaseVarsList(
        IReadOnlyList<string> variableAliases,
        IReadOnlyList<VariableCodingData> variableCodings)
    {
        var byId = variableCodings.LastById(coding => coding.Id);
        var byAlias = variableCodings.Where(coding => !string.IsNullOrEmpty(coding.Alias))
            .LastById(coding => coding.Alias!);
        var result = new List<string>();
        void AddSources(VariableCodingData? coding)
        {
            if (coding is null) return;
            if (coding.SourceType == "BASE")
            {
                var alias = coding.Alias ?? coding.Id;
                if (!result.Contains(alias, StringComparer.Ordinal)) result.Add(alias);
                return;
            }
            foreach (var source in coding.DeriveSources ?? [])
            {
                byId.TryGetValue(source, out var sourceCoding);
                AddSources(sourceCoding);
            }
        }
        foreach (var alias in variableAliases)
        {
            byAlias.TryGetValue(alias, out var coding);
            AddSources(coding);
        }
        return result;
    }

    private static void NormalizeStatuses(List<Response> responses, IReadOnlyList<VariableCodingData> codings)
    {
        var byId = codings.LastById(coding => coding.Id);
        foreach (var response in responses)
        {
            if (!byId.TryGetValue(response.Id, out var coding)) continue;
            if (coding.SourceType == "BASE" && response.Status == ResponseStatus.Displayed &&
                coding.SourceParameters?.Processing?.Contains("TAKE_DISPLAYED_AS_VALUE_CHANGED") == true)
                response.Status = ResponseStatus.ValueChanged;
            if (coding.SourceType == "BASE" && response.Status == ResponseStatus.NotReached &&
                coding.SourceParameters?.Processing?.Contains("TAKE_NOT_REACHED_AS_VALUE_CHANGED") == true)
                response.Status = ResponseStatus.ValueChanged;
            if (coding.SourceType == "BASE" && response.Status == ResponseStatus.ValueChanged &&
                ValueTransforms.IsEmptyValue(response.Value) &&
                coding.SourceParameters?.Processing?.Contains("TAKE_EMPTY_AS_VALID") != true)
                response.Status = ResponseStatus.Invalid;
        }
    }

    private static void EnsureResponses(
        List<Response> responses,
        IReadOnlyList<VariableCodingData> codings,
        List<VariableGraphNode> dependencies,
        bool globalError)
    {
        foreach (var coding in codings)
        {
            if (globalError && coding.SourceType == "BASE")
            {
                dependencies.Add(new VariableGraphNode { Id = coding.Id, Level = 0, Page = coding.Page ?? string.Empty });
            }
            if (responses.Any(response => response.Id == coding.Id) || coding.SourceType == "BASE_NO_VALUE") continue;
            responses.Add(new Response
            {
                Id = coding.Id,
                Value = null,
                Status = globalError && coding.SourceType != "BASE" ? ResponseStatus.DeriveError : ResponseStatus.Unset
            });
        }
    }

    private static void ApplyDerivationsAndCoding(
        List<Response> responses,
        IReadOnlyList<VariableCodingData> codings,
        IReadOnlyList<VariableGraphNode> dependencies,
        Action<Exception>? onError)
    {
        var responseById = responses.LastById(response => response.Id);
        var codingById = codings.LastById(coding => coding.Id);
        var maximumLevel = dependencies.Count == 0 ? 0 : dependencies.Max(node => node.Level);
        for (var level = 0; level <= maximumLevel; level++)
        {
            foreach (var node in dependencies.Where(node => node.Level == level))
            {
                if (!responseById.TryGetValue(node.Id, out var target) || !codingById.TryGetValue(node.Id, out var coding)) continue;
                if (node.Sources.Count > 0 && ValidStatesToStartDeriving.Contains(target.Status))
                {
                    if (target.Status != ResponseStatus.CodingError)
                    {
                        try
                        {
                            var sourceResponses = responses.Where(response => node.Sources.Contains(response.Id)).ToList();
                            var derived = Derivation.DeriveValue(codings, coding, sourceResponses);
                            target.Status = derived.Status;
                            target.Subform = derived.Subform;
                            if (derived.Status == ResponseStatus.ValueChanged) target.Value = derived.Value;
                        }
                        catch (Exception error)
                        {
                            onError?.Invoke(error);
                            target.Status = ResponseStatus.DeriveError;
                            target.Value = null;
                        }
                    }
                }
                if (target.Status == ResponseStatus.ValueChanged)
                {
                    if (coding.Codes is { Count: > 0 })
                    {
                        var coded = CodingFactory.Code(target, coding, onError);
                        if (coded.Status != target.Status)
                        {
                            target.Status = coded.Status;
                            target.Code = coded.Code;
                            target.Score = coded.Score;
                        }
                    }
                    else if (coding.SourceType != "BASE" ||
                             coding.SourceParameters?.Processing?.Contains("TAKE_EMPTY_AS_VALID") != true)
                    {
                        target.Status = ResponseStatus.NoCoding;
                    }
                }
            }
        }
    }

    private static List<Response> MapAliasToId(IEnumerable<Response> responses, IReadOnlyList<VariableCodingData> codings)
    {
        var byId = codings.LastById(coding => coding.Id);
        var aliases = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var coding in codings.Where(coding => !string.IsNullOrEmpty(coding.Alias)))
        {
            var alias = coding.Alias!;
            byId.TryGetValue(alias, out var shadowed);
            var shadowsBase = shadowed?.SourceType == "BASE" && coding.SourceType is not ("BASE" or "BASE_NO_VALUE") &&
                (coding.DeriveSources ?? []).Contains(shadowed.Id);
            if (!shadowsBase) aliases[alias] = coding.Id;
        }
        return responses.Select(response =>
        {
            var copy = IqbJson.Clone(response);
            if (aliases.TryGetValue(copy.Id, out var id)) copy.Id = id;
            return copy;
        }).ToList();
    }

    private static List<Response> MapIdToAlias(IEnumerable<Response> responses, IReadOnlyList<VariableCodingData> codings)
    {
        var names = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var coding in codings) names[coding.Id] = coding.Alias ?? coding.Id;
        return responses.Select(response =>
        {
            var copy = IqbJson.Clone(response);
            if (names.TryGetValue(copy.Id, out var alias)) copy.Id = alias;
            return copy;
        }).ToList();
    }

    private static List<Response> RemoveDerivedInputConflicts(
        IEnumerable<Response> responses,
        IReadOnlyList<VariableCodingData> codings)
    {
        var derived = codings.Where(coding => coding.SourceType != "BASE").ToList();
        return responses.Where(response => !derived.Any(coding => response.Id == coding.Id &&
            (response.Status == ResponseStatus.Unset ||
             response.Status != ResponseStatus.CodingComplete && response.Code is null && response.Score is null) &&
            response.Status != ResponseStatus.CodingComplete)).ToList();
    }

    private static List<Response> RemoveShadowedBaseAliases(
        List<Response> responses,
        IReadOnlyList<VariableCodingData> codings)
    {
        var baseIds = codings.Where(coding => coding.SourceType == "BASE").Select(coding => coding.Id).ToHashSet();
        var pairs = codings.Where(coding => coding.SourceType is not ("BASE" or "BASE_NO_VALUE") &&
                !string.IsNullOrEmpty(coding.Alias) && coding.Alias != coding.Id && baseIds.Contains(coding.Alias!) &&
                (coding.DeriveSources ?? []).Contains(coding.Alias!))
            .Select(coding => (Base: coding.Alias!, Derived: coding.Id)).ToList();
        return responses.Where(response => !pairs.Any(pair => response.Id == pair.Base &&
            responses.Any(candidate => candidate.Id == pair.Derived && candidate.Subform == response.Subform))).ToList();
    }

    private static List<Response> FinalizeResponses(
        IEnumerable<Response> responses,
        IReadOnlyDictionary<string, List<Response>> subforms,
        IReadOnlyList<VariableCodingData> codings)
    {
        var aliases = codings.Where(coding => coding.SourceType is not ("BASE" or "BASE_NO_VALUE"))
            .Select(coding => coding.Alias ?? coding.Id).ToHashSet();
        var seen = new HashSet<(string Id, string? Subform)>();
        var firstSubform = subforms.Values.FirstOrDefault();
        return responses.Where(response => seen.Add((response.Id, response.Subform))).Where(response =>
        {
            if (subforms.Count == 0) return true;
            var shadowed = firstSubform?.Any(item => item.Id == response.Id) == true || aliases.Contains(response.Id);
            return !(shadowed && response.Status == ResponseStatus.Unset);
        }).ToList();
    }

    /// <summary>Validates a coding scheme against its base-variable descriptions.</summary>
    public static List<CodingSchemeProblem> Validate(
        IReadOnlyList<VariableInfo> baseVariables,
        IReadOnlyList<VariableCodingData> variableCodings) =>
        CodingSchemeValidation.Validate(baseVariables, variableCodings);
}
