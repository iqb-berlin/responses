namespace System.IO;

internal static class PathPolyfills
{
    extension(Path)
    {
        public static string GetRelativePath(string relativeTo, string path)
        {
            var root = Path.GetFullPath(relativeTo).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) +
                       Path.DirectorySeparatorChar;
            var relative = new Uri(root).MakeRelativeUri(new Uri(Path.GetFullPath(path)));
            return Uri.UnescapeDataString(relative.ToString()).Replace('/', Path.DirectorySeparatorChar);
        }
    }
}
