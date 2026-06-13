import { useEffect, useMemo, useState } from "react";
import { PageShell } from "../../components/PageShell";
import { sourceLabels } from "../../shared/constants/sourceLabels";
import { getPrimarySource } from "../../shared/utils/collection";
import { getCollectionSettings, getGlobalSettings, getPrepareOptions } from "../../shared/utils/collectionSettings";
import { getCollectionAttributeValue, prepareCollectionItems } from "../../shared/utils/characterClass";
import { fetchJsonData } from "../../shared/utils/dataCache";
import { countValues, getVisiblePropertyFields, sortedCountedValues } from "../collections/collectionFields";

function createAttributeGroups(config, payload, dashboardSettings) {
  const rawItems = payload?.[config.collectionKey] ?? [];
  const items = prepareCollectionItems(
    rawItems,
    getPrepareOptions(config, dashboardSettings, null, { applyCollectionExclusions: false })
  );
  const propertyFields = getVisiblePropertyFields(config, payload?.propertyFields ?? []);
  const collectionSettings = getCollectionSettings(dashboardSettings, config.key);
  const excludedPropertyValues = collectionSettings.excludedPropertyValues ?? {};
  const excludedSourceKinds = collectionSettings.excludedSourceKinds ?? [];
  const groups = [];

  if (config.showItemLevel) {
    const values = sortedCountedValues(
      countValues(items, (item) => getCollectionAttributeValue(item, "itemLevel")),
      (valueA, valueB) => Number(valueA) - Number(valueB) || valueA.localeCompare(valueB)
    );

    groups.push({
      key: "itemLevel",
      label: "Level",
      values,
      excludedValues: excludedPropertyValues.itemLevel ?? [],
      kind: "property"
    });
  }

  for (const field of propertyFields) {
    const values = sortedCountedValues(
      countValues(items, (item) => getCollectionAttributeValue(item, field.key)),
      (valueA, valueB) => valueA.localeCompare(valueB)
    );

    groups.push({
      key: field.key,
      label: field.label,
      values,
      excludedValues: excludedPropertyValues[field.key] ?? [],
      kind: "property"
    });
  }

  const sourceValues = sortedCountedValues(
    countValues(items, (item) => getPrimarySource(item)),
    (valueA, valueB) => (sourceLabels[valueA] ?? valueA).localeCompare(sourceLabels[valueB] ?? valueB)
  );

  groups.push({
    key: "source",
    label: "Source",
    values: sourceValues,
    excludedValues: excludedSourceKinds,
    kind: "source"
  });

  return groups.filter((group) => group.values.length > 0);
}

export function DashboardSettingsPage({
  collectionConfigs,
  collectionOrder,
  dashboardSettings,
  dashboardStats,
  navigation,
  hiddenCharacterMenus = [],
  onToggleCharacterMenu,
  onOpenDashboardSettings,
  onSetPropertyValueExcluded,
  onSetSourceKindExcluded,
  onSetGlobalSetting,
  onOpenHome,
  onRefreshDatabase
}) {
  const [payloads, setPayloads] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openCollectionKeys, setOpenCollectionKeys] = useState([]);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [databaseMessage, setDatabaseMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError("");

    Promise.all(
      collectionOrder.map(async (key) => {
        const config = collectionConfigs[key];
        return [key, await fetchJsonData(config.dataPath, reloadNonce)];
      })
    )
      .then((entries) => {
        if (!cancelled) {
          setPayloads(Object.fromEntries(entries));
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setError(fetchError.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [collectionConfigs, collectionOrder, reloadNonce]);

  const collections = useMemo(
    () =>
      collectionOrder.map((key) => {
        const config = collectionConfigs[key];
        return {
          config,
          attributeGroups: createAttributeGroups(config, payloads[key], dashboardSettings)
        };
      }),
    [collectionConfigs, collectionOrder, dashboardSettings, payloads]
  );
  const globalSettings = getGlobalSettings(dashboardSettings);
  const accountCollections = collections.filter(({ config }) => config.scope === "account");
  const characterCollections = collections.filter(({ config }) => config.scope === "character");

  function toggleCollectionSettings(collectionKey) {
    setOpenCollectionKeys((current) =>
      current.includes(collectionKey)
        ? current.filter((key) => key !== collectionKey)
        : [...current, collectionKey]
    );
  }

  function refreshDatabase() {
    setReloadNonce((current) => current + 1);
    onRefreshDatabase?.();
    setDatabaseMessage("Database reloaded.");
  }

  function renderCollectionCard({ config, attributeGroups }) {
    const isOpen = openCollectionKeys.includes(config.key);

    return (
      <article className="settings-card" key={config.key}>
        <button
          className="settings-card-header"
          type="button"
          onClick={() => toggleCollectionSettings(config.key)}
          aria-expanded={isOpen}
        >
          <div>
            <h2>{config.title}</h2>
            <span>{config.scope === "account" ? "Account collection" : "Character collection"}</span>
          </div>
          <span className="settings-card-toggle" aria-hidden="true">
            {isOpen ? "▲" : "▼"}
          </span>
        </button>

        {isOpen ? (
          <div className="settings-attribute-list">
            {attributeGroups.map((group) => (
              <section className="settings-attribute" key={group.key}>
                <h3>{group.label}</h3>
                <div className="settings-values">
                  {group.values.map(({ value, count }) => {
                    const isExcluded = group.excludedValues.includes(value);
                    const label = group.kind === "source" ? sourceLabels[value] ?? value : value;
                    const displayLabel = `${label} (${count})`;

                    return (
                      <label className={isExcluded ? "is-excluded" : ""} key={value} title={displayLabel}>
                        <input
                          type="checkbox"
                          checked={!isExcluded}
                          onChange={(event) => {
                            if (group.kind === "source") {
                              onSetSourceKindExcluded(config.key, value, !event.target.checked);
                            } else {
                              onSetPropertyValueExcluded(config.key, group.key, value, !event.target.checked);
                            }
                          }}
                        />
                        <span>{displayLabel}</span>
                      </label>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <PageShell
      title="Dashboard Settings"
      stat={{
        accountCollections: dashboardStats.accountCollections,
        characterCollections: dashboardStats.characterCollections,
        error: dashboardStats.error
      }}
      navigation={navigation}
      hiddenCharacterMenus={hiddenCharacterMenus}
      onToggleCharacterMenu={onToggleCharacterMenu}
      isDashboardSettingsPage
      onOpenHome={onOpenHome}
      onOpenDashboardSettings={onOpenDashboardSettings}
    >
      <section className="dashboard-settings-page">
        <p className="settings-intro">
          Choose which values should count in the tracker. Hidden values are removed from collection lists, imports,
          exports, and dashboard totals.
        </p>

        {loading ? <p className="state">Loading dashboard settings...</p> : null}
        {error ? <p className="state error">{error}</p> : null}

        {!loading && !error ? (
          <>
            <article className="settings-card settings-card--general">
              <button
                className="settings-card-header"
                type="button"
                onClick={() => toggleCollectionSettings("account-general")}
                aria-expanded={openCollectionKeys.includes("account-general")}
              >
                <div>
                  <h2>Account General</h2>
                </div>
                <span className="settings-card-toggle" aria-hidden="true">
                  {openCollectionKeys.includes("account-general") ? "▲" : "▼"}
                </span>
              </button>
              {openCollectionKeys.includes("account-general") ? (
                <div className="settings-values">
                  <label>
                    <input
                      type="checkbox"
                      checked={globalSettings.accountShowCollectible}
                      onChange={(event) => onSetGlobalSetting("accountShowCollectible", event.target.checked)}
                    />
                    <span>Collectible</span>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={globalSettings.accountShowNotInGame}
                      onChange={(event) => onSetGlobalSetting("accountShowNotInGame", event.target.checked)}
                    />
                    <span>Not in game</span>
                  </label>
                </div>
              ) : null}
            </article>

            {accountCollections.map(renderCollectionCard)}

            <article className="settings-card settings-card--general">
              <button
                className="settings-card-header"
                type="button"
                onClick={() => toggleCollectionSettings("character-general")}
                aria-expanded={openCollectionKeys.includes("character-general")}
              >
                <div>
                  <h2>Character General</h2>
                </div>
                <span className="settings-card-toggle" aria-hidden="true">
                  {openCollectionKeys.includes("character-general") ? "▲" : "▼"}
                </span>
              </button>
              {openCollectionKeys.includes("character-general") ? (
                <div className="settings-values">
                  <label>
                    <input
                      type="checkbox"
                      checked={globalSettings.characterFilterByVocation}
                      onChange={(event) => onSetGlobalSetting("characterFilterByVocation", event.target.checked)}
                    />
                    <span>Filter equipment by character vocation</span>
                  </label>
                </div>
              ) : null}
            </article>

            {characterCollections.map(renderCollectionCard)}
          </>
        ) : null}
      </section>
    </PageShell>
  );
}
