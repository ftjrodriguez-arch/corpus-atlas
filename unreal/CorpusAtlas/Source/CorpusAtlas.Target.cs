using UnrealBuildTool;

public class CorpusAtlasTarget : TargetRules
{
	public CorpusAtlasTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Game;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("CorpusAtlas");
	}
}
