import { useRef, useState } from "react";
import { PageShell } from "../../components/PageShell";
import { CHARACTER_CLASSES } from "../../shared/hooks/useCharacters";

export function CharacterManagerPage({
  characters,
  activeCharacterId,
  setActiveCharacterId,
  createCharacter,
  updateCharacterClass,
  deleteCharacter,
  importFullProgress,
  exportFullProgress,
  dashboardStats,
  navigation,
  hiddenCharacterMenus = [],
  isDashboardSettingsPage = false,
  onOpenHome,
  onOpenDashboardSettings,
  onToggleCharacterMenu
}) {
  const [name, setName] = useState("");
  const [className, setClassName] = useState(CHARACTER_CLASSES[0]);
  const [backupMessage, setBackupMessage] = useState("");
  const importInputRef = useRef(null);

  function handleCreateCharacter(event) {
    event.preventDefault();

    const character = createCharacter(name, className);
    if (character) {
      setName("");
      setClassName(CHARACTER_CLASSES[0]);
    }
  }

  async function handleImportFullProgress(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const payload = JSON.parse(await file.text());
      const result = importFullProgress(payload);
      setBackupMessage(
        `Imported full backup: ${result.accountCount} account collections, ${result.characterCount} character groups${
          result.settingsImported ? ", dashboard settings" : ""
        }.`
      );
    } catch (importError) {
      setBackupMessage(`Import failed: ${importError.message}`);
    }
  }

  function handleExportFullProgress() {
    const result = exportFullProgress();
    setBackupMessage(
      `Exported full backup: ${result.accountCount} account collections, ${result.characterCount} character groups${
        result.settingsExported ? ", dashboard settings" : ""
      }.`
    );
  }

  return (
    <PageShell
      title="Characters"
      stat={{
        current: dashboardStats.current,
        total: dashboardStats.total,
        collections: dashboardStats.collections,
        accountCollections: dashboardStats.accountCollections,
        characterCollections: dashboardStats.characterCollections,
        loading: dashboardStats.loading,
        error: dashboardStats.error
      }}
      navigation={navigation}
      hiddenCharacterMenus={hiddenCharacterMenus}
      isDashboardSettingsPage={isDashboardSettingsPage}
      onOpenHome={onOpenHome}
      onOpenDashboardSettings={onOpenDashboardSettings}
      onToggleCharacterMenu={onToggleCharacterMenu}
    >
      <section className="character-page">
        <section className="character-backup-card">
          <div>
            <h2>Progress backup</h2>
            <p>Import or export all account, character and dashboard progress.</p>
          </div>
          <div className="backup-actions">
            <button type="button" onClick={() => importInputRef.current?.click()}>
              Import progress
            </button>
            <button type="button" onClick={handleExportFullProgress}>
              Export progress
            </button>
            <input ref={importInputRef} type="file" accept="application/json" onChange={handleImportFullProgress} hidden />
            {backupMessage ? <span>{backupMessage}</span> : null}
          </div>
        </section>

        <form className="character-form" onSubmit={handleCreateCharacter}>
          <input
            type="text"
            placeholder="Character name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <select value={className} onChange={(event) => setClassName(event.target.value)}>
            {CHARACTER_CLASSES.map((characterClass) => (
              <option key={characterClass} value={characterClass}>
                {characterClass}
              </option>
            ))}
          </select>
          <button type="submit">Create character</button>
        </form>

        <div className="character-list">
          {characters.length > 0 ? (
            characters.map((character) => (
              <article className="character-card" key={character.id}>
                <div>
                  <strong>{character.name}</strong>
                  <span>{character.className ?? "No class"}</span>
                </div>

                <select
                  value={character.className ?? ""}
                  onChange={(event) => updateCharacterClass(character.id, event.target.value)}
                >
                  {CHARACTER_CLASSES.map((characterClass) => (
                    <option key={characterClass} value={characterClass}>
                      {characterClass}
                    </option>
                  ))}
                </select>

                <button type="button" onClick={() => setActiveCharacterId(character.id)}>
                  {character.id === activeCharacterId ? "Active" : "Set active"}
                </button>
                <button type="button" onClick={() => deleteCharacter(character.id)}>
                  Delete
                </button>
              </article>
            ))
          ) : (
            <p className="state">No characters yet.</p>
          )}
        </div>
      </section>
    </PageShell>
  );
}
