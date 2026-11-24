using System.Text.Json;
using System.Text.Json.Serialization;

namespace Iqb.Responses;

/// <summary>Provides the JSON options required by the IQB wire contracts.</summary>
public static class IqbJson
{
    /// <summary>Gets shared camel-case JSON options with IQB union-value converters.</summary>
    public static JsonSerializerOptions Options { get; } = CreateOptions();

    private static JsonSerializerOptions CreateOptions()
    {
        var options = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = false,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };
        options.Converters.Add(new ResponseValueJsonConverter());
        options.Converters.Add(new ScalarUnionJsonConverter());
        options.Converters.Add(new ExactDoubleJsonConverter());
        return options;
    }

    internal static T Clone<T>(T value)
    {
        var json = JsonSerializer.Serialize(value, Options);
        return JsonSerializer.Deserialize<T>(json, Options)
            ?? throw new JsonException("Could not clone the supplied value.");
    }
}

public sealed class ScalarUnionJsonConverter : JsonConverter<object>
{
    public override object? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        JsonValue.ReadScalar(ref reader);

    public override void Write(Utf8JsonWriter writer, object value, JsonSerializerOptions options) =>
        JsonValue.Write(writer, value, options);
}

public sealed class ResponseValueJsonConverter : JsonConverter<object>
{
    public override object? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType != JsonTokenType.StartArray)
        {
            return JsonValue.ReadScalar(ref reader);
        }

        var result = new List<object?>();
        while (reader.Read() && reader.TokenType != JsonTokenType.EndArray)
        {
            result.Add(JsonValue.ReadScalar(ref reader));
        }
        return result;
    }

    public override void Write(Utf8JsonWriter writer, object value, JsonSerializerOptions options) =>
        JsonValue.Write(writer, value, options);
}

internal static class JsonValue
{
    internal static object? ReadScalar(ref Utf8JsonReader reader) => reader.TokenType switch
    {
        JsonTokenType.Null => null,
        JsonTokenType.String => reader.GetString(),
        JsonTokenType.Number => ReadDouble(ref reader),
        JsonTokenType.True => true,
        JsonTokenType.False => false,
        _ => throw new JsonException($"Unsupported JSON value token {reader.TokenType}.")
    };

    /// <summary>
    /// Reads a JSON number with <see cref="DoubleConversion.TryParse"/>, so that every target rounds it identically.
    /// System.Text.Json parses through the runtime, which on .NET Framework does not round numbers with more than
    /// 15 significant digits correctly.
    /// </summary>
    internal static double ReadDouble(ref Utf8JsonReader reader)
    {
        // Other tokens are rejected by GetDouble exactly as without this converter.
        if (reader.TokenType != JsonTokenType.Number) return reader.GetDouble();
        var bytes = reader.HasValueSequence
            ? System.Buffers.BuffersExtensions.ToArray(reader.ValueSequence)
            : reader.ValueSpan.ToArray();
        // Every JSON number token is valid input; numbers beyond the double range become infinities, as before.
        if (!DoubleConversion.TryParse(System.Text.Encoding.UTF8.GetString(bytes), out var value))
            throw new JsonException("Invalid JSON number.");
        return value;
    }

    /// <summary>
    /// Writes a JSON number in the text form of System.Text.Json on .NET 10, but with digits from
    /// <see cref="DoubleConversion.ToRoundTripString"/>, so that every target and runtime version writes the same text
    /// and the number reads back as the same double.
    /// </summary>
    internal static void WriteDouble(Utf8JsonWriter writer, double value)
    {
        if (double.IsFinite(value))
            writer.WriteRawValue(DoubleConversion.ToRoundTripString(value), skipInputValidation: true);
        else
            writer.WriteNumberValue(value); // rejects NaN and infinities as before
    }

    internal static void Write(Utf8JsonWriter writer, object? value, JsonSerializerOptions options)
    {
        switch (value)
        {
            case null:
                writer.WriteNullValue();
                break;
            case string text:
                writer.WriteStringValue(text);
                break;
            case bool flag:
                writer.WriteBooleanValue(flag);
                break;
            case byte number:
                writer.WriteNumberValue(number);
                break;
            case int number:
                writer.WriteNumberValue(number);
                break;
            case long number:
                writer.WriteNumberValue(number);
                break;
            case float number:
                writer.WriteNumberValue(number);
                break;
            case double number:
                WriteDouble(writer, number);
                break;
            case decimal number:
                writer.WriteNumberValue(number);
                break;
            case IEnumerable<object?> values:
                writer.WriteStartArray();
                foreach (var item in values)
                {
                    Write(writer, item, options);
                }
                writer.WriteEndArray();
                break;
            default:
                JsonSerializer.Serialize(writer, value, value.GetType(), options);
                break;
        }
    }
}

/// <summary>Reads and writes <see cref="double"/> properties like <see cref="JsonValue.ReadDouble"/> and <see cref="JsonValue.WriteDouble"/>.</summary>
internal sealed class ExactDoubleJsonConverter : JsonConverter<double>
{
    public override double Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        JsonValue.ReadDouble(ref reader);

    public override void Write(Utf8JsonWriter writer, double value, JsonSerializerOptions options) =>
        JsonValue.WriteDouble(writer, value);
}
