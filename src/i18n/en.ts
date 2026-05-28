export const en = {
  common: {
    loading: 'Loading...',
    optional: 'Optional',
    required: 'Required',
    close: 'Close',
    ok: 'OK',
    save: 'Save',
    saved: 'Saved',
    saving: 'Saving…',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    reset: 'Reset',
    trigger: 'Trigger',
    comingSoon: 'Coming soon',
    act: 'Act',
  },
  settings: {
    title: 'HAGA Settings',
    language: 'Language',
    languageHint: 'Changes UI labels and loads localized game data (gems, items, campaign objectives).',
    languageGameMatchHint:
      'For campaign zone highlights to work, set Path of Exile 2 to the same language as the companion (English with English, Portuguese with Portuguese).',
    shortcuts: 'Shortcuts',
    toggleBuildPanel: 'Toggle Build Panel',
    toggleCampaignPanel: 'Toggle Campaign Panel',
    toggleHud: 'Toggle HUD',
    toggleClickThrough: 'Toggle Click-Through',
    openSettings: 'Open Settings',
    campaignDetection: 'Campaign detection',
    autoDetectAct: 'Auto-detect act from PoE2 Client.txt',
    clientLogPath: 'Client.txt path (optional)',
    clientLogPlaceholder: 'Auto-detect from common install locations',
    clientLogHint:
      'Reads zone changes and character level from the game log. Requires English or Portuguese client text ("You have entered" / "Você entrou em", /whois, level-up lines).',
    build: 'Build',
    activeBuild: 'Active build',
    exportShareCode: 'Export share code',
    importShareCode: 'Import share code',
    shareCodePlaceholder: 'Paste HAGA share code...',
    savedRestartHotkeys: 'Settings saved. Restart app to apply hotkey changes.',
    shareCodeCopied: 'Share code copied to clipboard.',
    importedBuild: 'Imported build: {name}',
    invalidShareCode: 'Invalid share code.',
  },
  hud: {
    allComplete: 'All campaign objectives complete',
    openCampaign: 'Open campaign objectives',
    hideDetails: 'Hide full details',
    showDetails: 'Show full details',
    markComplete: 'Mark complete / unmark',
    objectiveTypes: {
      campaign: 'Main quest',
      reward: 'Permanent reward',
      bench: 'Crafting bench',
      gear: 'Gear & gems',
      trial: 'Trial',
      currency: 'Currency & vendor',
      default: 'Objective',
    },
  },
  campaign: {
    title: 'Campaign Progress',
    progressInSection: '{done}/{total} in this section',
    missingLog: 'PoE2 Client.txt not found — set path in Settings to auto-detect your act.',
    logOk: 'Log OK ({path}) — change zone in-game to capture area.',
    inGameMapped: 'In game: {area} → {arc} ({match})',
    inGameUnmapped: 'In game: {area} (act not mapped yet)',
    inThisZone: 'In this zone',
    noObjectives: 'No objectives for this section.',
    storyProgression: 'Story progression ({done}/{total})',
    optionalPowerSpikes: 'Optional power spikes ({done}/{total})',
  },
  build: {
    newBuild: 'New Build',
    unsavedSuffix: '(unsaved)',
    buildLabel: 'Build',
    buildName: 'Build name',
    saveBuild: 'Save build',
    editBuildName: 'Edit build name',
    createNewBuild: 'Create new build',
    discardChanges: 'Discard unsaved changes to this build?',
    deleteGemGroup: 'Delete this gem group?',
    tabs: { gems: 'Gems', equips: 'Equips', tree: 'Tree' },
    budget: { early: 'Early Budget', medium: 'Medium Budget', high: 'High Budget' },
    gems: {
      characterName: 'In-game character name',
      characterNamePlaceholder: 'Exact character name',
      noGroups: 'No gem groups yet. Add a group with one main gem (active or spirit) and up to 5 linked gems.',
      emptyGroup: 'Empty group',
    },
    gemEditor: {
      addTitle: 'Add Gem Group',
      editTitle: 'Edit Gem Group',
      mainGem: 'Main gem',
      mainGemPlaceholder: 'Search active or spirit gem…',
      mainGemHint: 'Main gem must be active or spirit. Active mains link up to {max} linked gems.',
      groupNotes: 'Group notes',
      selectMainGem: 'Select a main gem (active or spirit).',
      saveFailed: 'Failed to save gem group.',
    },
    equipEditor: {
      selectUnique: 'Select a unique item.',
      selectBase: 'Select a base item type for mod filtering.',
      offHandOnly: 'Off-hand slot only accepts shields or one-handed weapons.',
      unique: 'Unique',
      baseType: 'Base type',
      baseHint: 'Used only to filter valid prefixes and suffixes.',
      prefixes: 'Prefixes (max 3)',
    },
    pobImport: 'PoB import',
  },
  dev: {
    locationCapture: 'Location capture',
    leveling: 'Leveling',
    buildGems: 'Build gems',
    characterLevel: 'Character level',
    setLevel: 'Set level',
    noGems: 'No gems in the active build.',
    logNotFound:
      'Client.txt not found. Open Settings and set the log path (usually Documents/My Games/Path of Exile 2/logs/Client.txt).',
    waitingLog: 'Waiting for game log…',
    levelHint:
      'Level is detected automatically from the game log while you play. Set your character name in the build to ignore party level-ups.',
    levelRestored: 'Character level restored from game log.',
    invalidLevel: 'Enter a valid level (1+).',
    resetTitle: 'Clear saved level and re-read from game log',
    watchingLog: 'Watching Client.txt',
    logNotFoundShort: 'Log not found',
    idle: 'Idle',
  },
  toast: {
    gemUnlocked: 'Gem unlocked',
    canNowUse: 'You can now use',
    levelMeta: 'Level {level} · {type}',
  },
  splash: {
    buildPanel: 'Build panel',
    campaignPanel: 'Campaign panel',
    clickThrough: 'Click-through',
  },
  about: {
    version: 'Version 0.1.0',
    developedBy: 'Developed by FELGOM LTDA',
  },
  panel: {
    minimize: 'Minimize',
    expand: 'Expand',
    minimizeBuild: 'Minimize build panel',
    expandBuild: 'Expand build panel',
    dockLeft: 'Dock panel on the left',
    dockRight: 'Dock panel on the right',
    moveLeft: 'Move build panel to the left',
    moveRight: 'Move build panel to the right',
    maximizeHeight: 'Maximize height',
    restoreHeight: 'Restore height',
    maximizeBuild: 'Maximize build panel height',
    restoreBuild: 'Restore build panel height',
    pinnedItem: 'Pinned item details',
    slotEdit: '{slot} — click to edit',
    occupiedTwoHand: 'Occupied by two-handed weapon',
  },
} as const

export type TranslationDict = {
  common: Record<keyof typeof en.common, string>
  settings: Record<keyof typeof en.settings, string>
  hud: {
    allComplete: string
    openCampaign: string
    hideDetails: string
    showDetails: string
    markComplete: string
    objectiveTypes: Record<keyof typeof en.hud.objectiveTypes, string>
  }
  campaign: Record<keyof typeof en.campaign, string>
  build: {
    newBuild: string
    unsavedSuffix: string
    buildLabel: string
    buildName: string
    saveBuild: string
    editBuildName: string
    createNewBuild: string
    discardChanges: string
    deleteGemGroup: string
    tabs: Record<keyof typeof en.build.tabs, string>
    budget: Record<keyof typeof en.build.budget, string>
    gems: Record<keyof typeof en.build.gems, string>
    gemEditor: Record<keyof typeof en.build.gemEditor, string>
    equipEditor: Record<keyof typeof en.build.equipEditor, string>
    pobImport: string
  }
  dev: Record<keyof typeof en.dev, string>
  toast: Record<keyof typeof en.toast, string>
  splash: Record<keyof typeof en.splash, string>
  about: Record<keyof typeof en.about, string>
  panel: Record<keyof typeof en.panel, string>
}
