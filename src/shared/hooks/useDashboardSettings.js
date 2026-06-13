import { useEffect, useState } from "react";
import { DASHBOARD_SETTINGS_STORAGE_KEY, readDashboardSettings } from "../utils/collectionSettings";
import { dispatchDashboardSettingsChange, writeJsonStorage } from "../utils/storage";

function updateExcludedValue(values = [], value, isExcluded) {
  const nextValues = new Set(values);

  if (isExcluded) {
    nextValues.add(value);
  } else {
    nextValues.delete(value);
  }

  return [...nextValues];
}

export function useDashboardSettings() {
  const [settings, setSettings] = useState(readDashboardSettings);

  useEffect(() => {
    writeJsonStorage(DASHBOARD_SETTINGS_STORAGE_KEY, settings);
    dispatchDashboardSettingsChange();
  }, [settings]);

  function setPropertyValueExcluded(collectionKey, propertyKey, value, isExcluded) {
    setSettings((current) => {
      const collectionSettings = current[collectionKey] ?? {};
      const excludedPropertyValues = collectionSettings.excludedPropertyValues ?? {};
      const nextValues = updateExcludedValue(excludedPropertyValues[propertyKey], value, isExcluded);
      const nextExcludedPropertyValues = { ...excludedPropertyValues };

      if (nextValues.length > 0) {
        nextExcludedPropertyValues[propertyKey] = nextValues;
      } else {
        delete nextExcludedPropertyValues[propertyKey];
      }

      return {
        ...current,
        [collectionKey]: {
          ...collectionSettings,
          excludedPropertyValues: nextExcludedPropertyValues
        }
      };
    });
  }

  function setSourceKindExcluded(collectionKey, value, isExcluded) {
    setSettings((current) => {
      const collectionSettings = current[collectionKey] ?? {};
      const nextValues = updateExcludedValue(collectionSettings.excludedSourceKinds, value, isExcluded);

      return {
        ...current,
        [collectionKey]: {
          ...collectionSettings,
          excludedSourceKinds: nextValues
        }
      };
    });
  }

  function setGlobalSetting(key, value) {
    setSettings((current) => ({
      ...current,
      global: {
        ...(current.global ?? {}),
        [key]: value
      }
    }));
  }

  function replaceSettings(nextSettings) {
    setSettings(nextSettings && typeof nextSettings === "object" && !Array.isArray(nextSettings) ? nextSettings : {});
  }

  return {
    settings,
    setPropertyValueExcluded,
    setSourceKindExcluded,
    setGlobalSetting,
    replaceSettings
  };
}
