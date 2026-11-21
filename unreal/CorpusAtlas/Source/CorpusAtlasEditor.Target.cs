using UnrealBuildTool;

public class CorpusAtlasEditorTarget : TargetRules
{
	public CorpusAtlasEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("CorpusAtlas");
	}
}
