import { PageShell } from "../../components/PageShell";

function getPercent(current, total) {
  return total > 0 ? Math.round((current / total) * 100) : 0;
}

function ProgressSummary({ label, current, total }) {
  const percent = getPercent(current, total);

  return (
    <article className="home-dashboard-card home-dashboard-card--summary">
      <span>{label}</span>
      <strong>
        {current}/{total}
      </strong>
      <div className="progress-track" aria-label={`${label}: ${percent}% complete`}>
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <small>{percent}% complete</small>
    </article>
  );
}

function CollectionCard({ collection, onOpen }) {
  return (
    <button className="home-dashboard-card" type="button" onClick={onOpen}>
      <span>{collection.collectionLabel ?? collection.label}</span>
      <strong>
        {collection.current}/{collection.total}
      </strong>
      <div className="progress-track" aria-label={`${collection.label}: ${collection.percent}% complete`}>
        <div className="progress-fill" style={{ width: `${collection.percent}%` }} />
      </div>
      <small>{collection.percent}% complete</small>
    </button>
  );
}

function CharacterCard({ character, onOpenCollection }) {
  const current = character.collections.reduce((sum, collection) => sum + collection.current, 0);
  const total = character.collections.reduce((sum, collection) => sum + collection.total, 0);
  const percent = getPercent(current, total);

  return (
    <article className="home-dashboard-character">
      <div className="home-dashboard-character-header">
        <div>
          <h2>{character.name}</h2>
          <span>{character.className ?? "No class"}</span>
        </div>
        <strong>
          {current}/{total}
        </strong>
      </div>
      <div className="progress-track" aria-label={`${character.name}: ${percent}% complete`}>
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <div className="home-dashboard-collection-grid">
        {character.collections.map((collection) => (
          <CollectionCard
            collection={collection}
            key={collection.key}
            onOpen={() => onOpenCollection?.(collection.collectionKey, character.id)}
          />
        ))}
      </div>
    </article>
  );
}

function ImportPromptBanner({ onOpenImport }) {
  return (
    <section className="import-prompt-banner">
      <div>
        <strong>No local save found.</strong>
        <span>If you already have a Farever Tracker backup, import it to restore your progress and settings.</span>
      </div>
      <button type="button" onClick={onOpenImport}>
        Import save
      </button>
    </section>
  );
}

export function HomeDashboardPage({
  dashboardStats,
  navigation,
  hiddenCharacterMenus = [],
  isDashboardSettingsPage = false,
  onOpenHome,
  onOpenDashboardSettings,
  onToggleCharacterMenu,
  onOpenCollection,
  showImportPrompt = false,
  onOpenImport
}) {
  return (
    <PageShell
      title="Dashboard"
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
      isHomePage
      isDashboardSettingsPage={isDashboardSettingsPage}
      onOpenHome={onOpenHome}
      onOpenDashboardSettings={onOpenDashboardSettings}
      onToggleCharacterMenu={onToggleCharacterMenu}
    >
      <section className="home-dashboard-page">
        {showImportPrompt ? <ImportPromptBanner onOpenImport={onOpenImport} /> : null}

        <ProgressSummary label="Total progress" current={dashboardStats.current} total={dashboardStats.total} />

        <section className="home-dashboard-section">
          <div className="home-dashboard-section-header">
            <h2>Account</h2>
            <span>{dashboardStats.accountCollections.length} collections</span>
          </div>
          <div className="home-dashboard-collection-grid">
            {dashboardStats.accountCollections.map((collection) => (
              <CollectionCard
                collection={collection}
                key={collection.key}
                onOpen={() => onOpenCollection?.(collection.collectionKey)}
              />
            ))}
          </div>
        </section>

        <section className="home-dashboard-section">
          <div className="home-dashboard-section-header">
            <h2>Characters</h2>
            <span>{dashboardStats.characterCollections.length} characters</span>
          </div>
          <div className="home-dashboard-character-grid">
            {dashboardStats.characterCollections.length > 0 ? (
              dashboardStats.characterCollections.map((character) => (
                <CharacterCard character={character} key={character.id} onOpenCollection={onOpenCollection} />
              ))
            ) : (
              <p className="state">No characters yet.</p>
            )}
          </div>
        </section>
      </section>
    </PageShell>
  );
}
