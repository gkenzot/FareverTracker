import { useEffect, useState } from "react";

function DashboardRow({ collection }) {
  return (
    <div className="dashboard-row">
      <div className="dashboard-row-header">
        <span>{collection.collectionLabel ?? collection.label}</span>
        <strong>
          {collection.current}/{collection.total}
        </strong>
      </div>
      <div className="dashboard-row-meta">
        <span>{collection.percent}%</span>
      </div>
      <div className="progress-track" aria-label={`${collection.label}: ${collection.percent}% complete`}>
        <div className="progress-fill" style={{ width: `${collection.percent}%` }} />
      </div>
    </div>
  );
}

export function PageShell({
  title,
  stat,
  navigation,
  actions,
  syncInfo,
  isHomePage = false,
  isDashboardSettingsPage = false,
  onOpenHome,
  onOpenDashboardSettings,
  hiddenCharacterMenus = [],
  onToggleCharacterMenu,
  children
}) {
  const [activePanel, setActivePanel] = useState("");

  useEffect(() => {
    if (!activePanel) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setActivePanel("");
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activePanel]);

  function togglePanel(panel) {
    setActivePanel((current) => (current === panel ? "" : panel));
  }

  return (
    <div className={`app-layout ${isHomePage ? "app-layout--home" : ""}`}>
      <header className="app-header">
        <button
          className={`panel-toggle menu-toggle ${activePanel === "navigation" ? "is-active" : ""}`}
          type="button"
          onClick={() => togglePanel("navigation")}
          aria-label="Open navigation menu"
          aria-expanded={activePanel === "navigation"}
        >
          ☰
        </button>
        <button className="app-brand" type="button" onClick={onOpenHome}>
          Farever Tracker
        </button>
      </header>

      <div className={`app-body ${activePanel ? "has-open-panel" : ""}`}>
        {activePanel ? (
          <button
            className="panel-backdrop"
            type="button"
            onClick={() => setActivePanel("")}
            aria-label="Close open menu"
          />
        ) : null}

        <button
          className={`panel-toggle dashboard-toggle ${activePanel === "dashboard" ? "is-active" : ""}`}
          type="button"
          onClick={() => togglePanel("dashboard")}
          aria-label="Open dashboard menu"
          aria-expanded={activePanel === "dashboard"}
        >
          Dashboard
        </button>

        <aside className={`sidebar ${activePanel === "navigation" ? "is-open" : ""}`}>
          <nav className="side-nav">{navigation}</nav>
        </aside>

        <main className="content-shell">
          <section className="page-heading">
            <h1>{title}</h1>
          </section>

          {children}
        </main>

        <aside className={`dashboard-sidebar ${activePanel === "dashboard" ? "is-open" : ""}`}>
          {stat ? (
            <section className="progress-card">
              <div className="dashboard-card-header">
                <span className="dashboard-label">Dashboard</span>
                <button
                  className={`dashboard-settings-button ${isDashboardSettingsPage ? "active" : ""}`}
                  type="button"
                  onClick={onOpenDashboardSettings}
                  title="Configure dashboard"
                  aria-label="Configure dashboard"
                >
                  settings
                </button>
              </div>
              {stat.error ? <p className="state error">{stat.error}</p> : null}
              <div className="dashboard-list">
                {(stat.accountCollections ?? []).map((collection) => (
                  <DashboardRow collection={collection} key={collection.key} />
                ))}
                {(stat.characterCollections ?? []).map((character) => {
                  const isHidden = hiddenCharacterMenus.includes(character.id);
                  const characterCurrent = character.collections.reduce((sum, collection) => sum + collection.current, 0);
                  const characterTotal = character.collections.reduce((sum, collection) => sum + collection.total, 0);
                  const characterPercent = characterTotal > 0 ? Math.round((characterCurrent / characterTotal) * 100) : 0;

                  return (
                    <section className="dashboard-character-section" key={character.id}>
                      <button
                        className="dashboard-character-header"
                        type="button"
                        onClick={() => onToggleCharacterMenu?.(character.id)}
                      >
                        <span>{character.name}</span>
                        <small>{character.className ?? "No class"}</small>
                      </button>
                      {isHidden ? (
                        <div className="dashboard-row dashboard-row--summary">
                          <div className="progress-track" aria-label={`${character.name}: ${characterPercent}% complete`}>
                            <div className="progress-fill" style={{ width: `${characterPercent}%` }} />
                          </div>
                        </div>
                      ) : (
                        character.collections.map((collection) => (
                          <DashboardRow collection={collection} key={collection.key} />
                        ))
                      )}
                    </section>
                  );
                })}
              </div>
            </section>
          ) : null}
          {syncInfo ? <p className="sync-info">{syncInfo}</p> : null}
          {actions ? <div className="dashboard-actions">{actions}</div> : null}
        </aside>
      </div>
    </div>
  );
}
