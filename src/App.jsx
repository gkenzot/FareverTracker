import { useEffect, useState } from "react";
import { CharacterManagerPage } from "./features/characters/CharacterManagerPage";
import { AllMissingPage } from "./features/collections/AllMissingPage";
import { CollectionPage } from "./features/collections/CollectionPage";
import { collectionConfigs, collectionOrder } from "./features/collections/collectionConfigs";
import {
  ALL_MISSING_PAGE_KEY,
  getAccountCollectionKeys,
  getCharacterCollectionKeys,
  getCollectionKeyFromPage,
  getCollectionPageTitle,
  getMissingCollectionKeys,
  getMissingPageKey,
  isAllMissingPage as isAllMissingPageKey,
  isMissingCollectionPage
} from "./features/collections/collectionRegistry";
import { DashboardSettingsPage } from "./features/dashboard/DashboardSettingsPage";
import { HomeDashboardPage } from "./features/dashboard/HomeDashboardPage";
import { useDashboardSettings } from "./shared/hooks/useDashboardSettings";
import { useCharacters, getCharacterStorageKey } from "./shared/hooks/useCharacters";
import { useCollectionStats } from "./shared/hooks/useCollectionStats";
import { STORAGE_KEYS } from "./shared/constants/storageKeys";
import {
  readJsonStorage,
  DASHBOARD_SETTINGS_CHANGE_EVENT,
  PROGRESS_CHANGE_EVENT,
  writeJsonStorage
} from "./shared/utils/storage";
import { hasStoredAppState } from "./shared/utils/savedState";
import {
  clearCharacterProgress,
  createProgressBackup,
  downloadProgressBackup,
  importProgressBackup,
  summarizeProgressBackup
} from "./shared/utils/progressBackup";

function readHiddenCharacterMenus() {
  const value = readJsonStorage(STORAGE_KEYS.hiddenCharacterMenus, []);
  return Array.isArray(value) ? value : [];
}

export default function App() {
  const [activePage, setActivePage] = useState("home");
  const [hiddenCharacterMenus, setHiddenCharacterMenus] = useState(readHiddenCharacterMenus);
  const [hasSavedAppState, setHasSavedAppState] = useState(() => hasStoredAppState(collectionConfigs, collectionOrder));
  const {
    characters,
    activeCharacter,
    activeCharacterId,
    setActiveCharacterId,
    createCharacter,
    updateCharacterClass,
    deleteCharacter,
    replaceCharacters
  } = useCharacters();
  const {
    settings: dashboardSettings,
    setPropertyValueExcluded,
    setSourceKindExcluded,
    setGlobalSetting,
    replaceSettings: replaceDashboardSettings
  } = useDashboardSettings();
  const dashboardStats = useCollectionStats(collectionConfigs, collectionOrder, characters, dashboardSettings);
  const isCharacterManagerPage = activePage === "characters";
  const isDashboardSettingsPage = activePage === "dashboard-settings";
  const isHomePage = activePage === "home";
  const isAllMissingPage = isAllMissingPageKey(activePage);
  const isMissingPage = isMissingCollectionPage(activePage);
  const activeCollectionKey = getCollectionKeyFromPage(activePage);
  const activeConfig =
    isCharacterManagerPage || isDashboardSettingsPage || isHomePage || isAllMissingPage
      ? null
      : collectionConfigs[activeCollectionKey];
  const accountCollectionKeys = getAccountCollectionKeys(collectionConfigs, collectionOrder);
  const characterCollectionKeys = getCharacterCollectionKeys(collectionConfigs, collectionOrder);
  const missingCollectionKeys = getMissingCollectionKeys(collectionConfigs, collectionOrder);
  const isCharacterCollection = activeConfig?.scope === "character" && !isMissingPage;
  const progressStorageKey =
    isCharacterCollection && activeCharacterId
      ? getCharacterStorageKey(activeConfig.storageKey, activeCharacterId)
      : activeConfig?.storageKey;
  const pageTitle = getCollectionPageTitle({ activeConfig, activeCharacter, isCharacterCollection, isMissingPage });

  useEffect(() => {
    if (isCharacterCollection && !activeCharacterId) {
      setActivePage("mounts");
    }
  }, [activeCharacterId, isCharacterCollection]);

  useEffect(() => {
    writeJsonStorage(STORAGE_KEYS.hiddenCharacterMenus, hiddenCharacterMenus);
  }, [hiddenCharacterMenus]);

  useEffect(() => {
    function refreshSavedState() {
      setHasSavedAppState(hasStoredAppState(collectionConfigs, collectionOrder));
    }

    window.addEventListener("storage", refreshSavedState);
    window.addEventListener(PROGRESS_CHANGE_EVENT, refreshSavedState);
    window.addEventListener(DASHBOARD_SETTINGS_CHANGE_EVENT, refreshSavedState);

    return () => {
      window.removeEventListener("storage", refreshSavedState);
      window.removeEventListener(PROGRESS_CHANGE_EVENT, refreshSavedState);
      window.removeEventListener(DASHBOARD_SETTINGS_CHANGE_EVENT, refreshSavedState);
    };
  }, []);

  function handleDeleteCharacter(characterId) {
    const character = characters.find((item) => item.id === characterId);
    if (character && !window.confirm(`Delete ${character.name}?`)) {
      return;
    }

    deleteCharacter(characterId);
    clearCharacterProgress({ configs: collectionConfigs, order: collectionOrder, characterId });
    setHiddenCharacterMenus((current) => current.filter((id) => id !== characterId));
    if (isCharacterCollection && characterId === activeCharacterId) {
      setActivePage("mounts");
    }
  }

  function importFullProgress(payload) {
    const result = importProgressBackup({
      payload,
      configs: collectionConfigs,
      order: collectionOrder,
      existingCharacters: characters,
      activeCharacterId,
      replaceCharacters,
      replaceDashboardSettings
    });
    dashboardStats.reload();
    setHasSavedAppState(true);
    return result;
  }

  function createCharacterWithSavedState(name, className) {
    const character = createCharacter(name, className);

    if (character) {
      setHasSavedAppState(true);
    }

    return character;
  }

  function exportFullProgress() {
    const payload = createProgressBackup({
      configs: collectionConfigs,
      order: collectionOrder,
      characters,
      dashboardSettings,
    });
    downloadProgressBackup(payload);
    return summarizeProgressBackup(payload);
  }

  function openHomePage() {
    setActivePage("home");
  }

  function openCollectionPage(collectionKey, characterId = "") {
    if (characterId) {
      setActiveCharacterId(characterId);
    }

    setActivePage(collectionKey);
  }

  const accountNavigation = accountCollectionKeys.map((key) => {
    const config = collectionConfigs[key];

    return (
      <button
        key={key}
        className={!isMissingPage && key === activePage ? "active" : ""}
        type="button"
        onClick={() => setActivePage(key)}
      >
        {config.tabLabel}
      </button>
    );
  });

  function toggleCharacterMenu(characterId) {
    setHiddenCharacterMenus((current) =>
      current.includes(characterId) ? current.filter((id) => id !== characterId) : [...current, characterId]
    );
  }

  const navigation = (
    <>
      <div className="side-section">
        <span className="side-section-title">Account</span>
        {accountNavigation}
      </div>
      <div className="side-section character-manager">
        <div className="side-section-header">
          <span className="side-section-title">Characters</span>
          <button
            className={`manage-characters-button ${isCharacterManagerPage ? "active" : ""}`}
            type="button"
            onClick={() => setActivePage("characters")}
            title="Manage characters"
            aria-label="Manage characters"
          >
            settings
          </button>
        </div>
        {characters.length > 0 ? (
          <>
            {characters.map((character) => {
              const isHidden = hiddenCharacterMenus.includes(character.id);
              const isActiveCharacter = character.id === activeCharacterId;

              return (
                <div className="character-nav" key={character.id}>
                  <div className="character-nav-header">
                    <button
                      type="button"
                      onClick={() => toggleCharacterMenu(character.id)}
                      title={isHidden ? `Show ${character.name} menu` : `Hide ${character.name} menu`}
                    >
                      <span>{character.name}</span>
                      <small>{character.className ?? "No class"}</small>
                    </button>
                  </div>
                  {!isHidden ? (
                    <div className="character-collections">
                      {characterCollectionKeys.map((key) => {
                        const config = collectionConfigs[key];

                        return (
                          <button
                            key={key}
                            className={isActiveCharacter && key === activePage ? "active" : ""}
                            type="button"
                            onClick={() => {
                              setActiveCharacterId(character.id);
                              setActivePage(key);
                            }}
                          >
                            {config.tabLabel}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </>
        ) : (
          <p className="side-empty">No characters yet.</p>
        )}
      </div>
      <div className="side-section">
        <button
          className={`side-section-title-button ${isAllMissingPage ? "active" : ""}`}
          type="button"
          onClick={() => setActivePage(ALL_MISSING_PAGE_KEY)}
        >
          Missing
        </button>
        {missingCollectionKeys.map((key) => {
          const config = collectionConfigs[key];
          const missingPageKey = getMissingPageKey(key);

          return (
            <button
              key={key}
              className={activePage === missingPageKey ? "active" : ""}
              type="button"
              onClick={() => setActivePage(missingPageKey)}
            >
              {config.tabLabel}
            </button>
          );
        })}
      </div>
    </>
  );

  if (isCharacterManagerPage) {
    return (
      <CharacterManagerPage
        characters={characters}
        activeCharacterId={activeCharacterId}
        setActiveCharacterId={setActiveCharacterId}
        createCharacter={createCharacterWithSavedState}
        updateCharacterClass={updateCharacterClass}
        deleteCharacter={handleDeleteCharacter}
        importFullProgress={importFullProgress}
        exportFullProgress={exportFullProgress}
        dashboardStats={dashboardStats}
        navigation={navigation}
        hiddenCharacterMenus={hiddenCharacterMenus}
        onOpenHome={openHomePage}
        onOpenDashboardSettings={() => setActivePage("dashboard-settings")}
        isDashboardSettingsPage={isDashboardSettingsPage}
        onToggleCharacterMenu={toggleCharacterMenu}
      />
    );
  }

  if (isDashboardSettingsPage) {
    return (
      <DashboardSettingsPage
        collectionConfigs={collectionConfigs}
        collectionOrder={collectionOrder}
        dashboardSettings={dashboardSettings}
        dashboardStats={dashboardStats}
        navigation={navigation}
        hiddenCharacterMenus={hiddenCharacterMenus}
        onToggleCharacterMenu={toggleCharacterMenu}
        onOpenHome={openHomePage}
        onOpenDashboardSettings={() => setActivePage("dashboard-settings")}
        onSetPropertyValueExcluded={setPropertyValueExcluded}
        onSetSourceKindExcluded={setSourceKindExcluded}
        onSetGlobalSetting={setGlobalSetting}
        onRefreshDatabase={dashboardStats.reload}
      />
    );
  }

  if (isHomePage) {
    return (
      <HomeDashboardPage
        dashboardStats={dashboardStats}
        navigation={navigation}
        hiddenCharacterMenus={hiddenCharacterMenus}
        isDashboardSettingsPage={isDashboardSettingsPage}
        onOpenHome={openHomePage}
        onOpenDashboardSettings={() => setActivePage("dashboard-settings")}
        onToggleCharacterMenu={toggleCharacterMenu}
        onOpenCollection={openCollectionPage}
        showImportPrompt={!hasSavedAppState}
        onOpenImport={() => setActivePage("characters")}
      />
    );
  }

  if (isAllMissingPage) {
    return (
      <AllMissingPage
        configs={collectionConfigs}
        collectionKeys={missingCollectionKeys}
        dashboardStats={dashboardStats}
        navigation={navigation}
        characters={characters}
        dashboardSettings={dashboardSettings}
        hiddenCharacterMenus={hiddenCharacterMenus}
        onOpenHome={openHomePage}
        onOpenDashboardSettings={() => setActivePage("dashboard-settings")}
        isDashboardSettingsPage={isDashboardSettingsPage}
        onToggleCharacterMenu={toggleCharacterMenu}
      />
    );
  }

  return (
    <CollectionPage
      config={activeConfig}
      dashboardStats={dashboardStats}
      navigation={navigation}
      pageTitle={pageTitle}
      progressStorageKey={progressStorageKey}
      activeCharacter={isCharacterCollection ? activeCharacter : null}
      characters={characters}
      missingMode={isMissingPage}
      dashboardSettings={dashboardSettings}
      hiddenCharacterMenus={hiddenCharacterMenus}
      onOpenHome={openHomePage}
      onOpenDashboardSettings={() => setActivePage("dashboard-settings")}
      isDashboardSettingsPage={isDashboardSettingsPage}
      onToggleCharacterMenu={toggleCharacterMenu}
    />
  );
}
