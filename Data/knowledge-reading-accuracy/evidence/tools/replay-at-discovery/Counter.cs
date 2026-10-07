public static class Counter
{
    // Scratch counter-check only: put each figure's tags on their own lines (DI's own shape) before parsing.
    public static string TagsOnOwnLines(string joined)
        => System.Text.RegularExpressions.Regex.Replace(joined, @"<figure>(.*?)</figure>", m => "<figure>\n" + m.Groups[1].Value + "\n</figure>",
            System.Text.RegularExpressions.RegexOptions.Singleline);
}
