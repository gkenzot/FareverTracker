import { sourceLabels } from "../../shared/constants/sourceLabels";
import { assetPath } from "../../shared/utils/assets";
import { getPrimarySource, sourceText } from "../../shared/utils/collection";

function ItemNameCell({ item }) {
  return (
    <div className="name-cell">
      {item.iconPath ? (
        <img className="mount-icon" src={assetPath(item.iconPath)} alt="" loading="lazy" />
      ) : (
        <span className="mount-icon mount-icon--empty" />
      )}
      <div className="name-text">
        <a className="mount-name" href={item.pageUrl} target="_blank" rel="noreferrer" title={item.name}>
          {item.name}
        </a>
        <span className="mount-id">{item.id}</span>
      </div>
    </div>
  );
}

function RarityValue({ value }) {
  const rarity = String(value ?? "-");
  const rarityClass = rarity.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <span className={`rarity rarity-${rarityClass}`} title={rarity}>
      {rarity}
    </span>
  );
}

function formatPropertyValue(value) {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return String(value ?? "-");
}

function formatCharacterNames(names) {
  return Array.isArray(names) && names.length > 0 ? names.join(", ") : "-";
}

export function createCollectionColumns({
  collected,
  onToggleCollected,
  statusMode = "collected",
  propertyFields = [],
  showItemLevel = false,
  showSpeed = true
}) {
  const statusColumn =
    statusMode === "missing"
      ? {
          key: "missingCount",
          label: "Missing",
          sortable: true,
          filterable: true,
          widthClassName: "status-col",
          getFilterValue: (item) => String(item.missingCount ?? 0),
          getSortValue: (item) => item.missingCount ?? 0,
          render: (item) => {
            const missingCount = item.missingCount ?? 0;
            return <span title={`${missingCount} missing`}>{missingCount}</span>;
          }
        }
      : {
          key: "collected",
          label: "Status",
          sortable: true,
          filterable: true,
          widthClassName: "status-col",
          getFilterValue: (item) => (collected.has(item.id) ? "Collected" : "Missing"),
          getSortValue: (item) => (collected.has(item.id) ? 1 : 0),
          render: (item) => {
            const isCollected = collected.has(item.id);

            return (
              <label className="check-cell" title={isCollected ? "Collected" : "Mark as collected"}>
                <input type="checkbox" checked={isCollected} onChange={() => onToggleCollected(item.id)} />
              </label>
            );
          }
        };

  const columns = [
    statusColumn,
    {
      key: "name",
      label: "Name",
      sortable: true,
      filterable: true,
      widthClassName: "name-col",
      getFilterValue: (item) => item.name ?? "",
      render: (item) => <ItemNameCell item={item} />
    }
  ];

  if (statusMode === "missing") {
    columns.splice(2, 0, {
      key: "missingCharacters",
      label: "Characters",
      sortable: true,
      filterable: true,
      widthClassName: "characters-col",
      getFilterValue: (item) => item.missingCharacterNames ?? [],
      getSortValue: (item) => formatCharacterNames(item.missingCharacterNames),
      render: (item) => {
        const text = formatCharacterNames(item.missingCharacterNames);
        return <span title={text}>{text}</span>;
      }
    });
  }

  if (showItemLevel) {
    columns.push({
      key: "itemLevel",
      label: "Level",
      sortable: true,
      filterable: true,
      widthClassName: "level-col",
      getFilterValue: (item) => item.itemLevel ?? item.properties?.level ?? "-",
      getSortValue: (item) => item.itemLevel ?? item.properties?.level ?? 0,
      render: (item) => item.itemLevel ?? item.properties?.level ?? "-"
    });
  }

  columns.push(
    ...propertyFields.map((field) => ({
      key: `property:${field.key}`,
      label: field.label,
      sortable: true,
      filterable: true,
      widthClassName: "property-col",
      getFilterValue: (item) => item.properties?.[field.key] ?? "-",
      render: (item) => {
        const value = item.properties?.[field.key] ?? "-";
        if (field.key === "rarity" || field.key === "pickup_rarity") {
          return <RarityValue value={value} />;
        }

        const text = formatPropertyValue(value);
        return <span title={text}>{text}</span>;
      }
    }))
  );

  columns.push(
    {
      key: "source",
      label: "Source",
      sortable: true,
      filterable: true,
      widthClassName: "source-type-col",
      getFilterValue: (item) => sourceLabels[getPrimarySource(item)] ?? getPrimarySource(item),
      render: (item) => {
        const label = sourceLabels[getPrimarySource(item)] ?? getPrimarySource(item);
        return <span title={label}>{label}</span>;
      }
    },
    {
      key: "howToGet",
      label: "How to get",
      sortable: true,
      filterable: true,
      widthClassName: "source-col",
      cellClassName: "source-column",
      getFilterValue: sourceText,
      render: (item) => {
        const text = sourceText(item);
        return <span title={text}>{text}</span>;
      }
    }
  );

  if (showSpeed) {
    columns.push({
      key: "speed",
      label: "Speed",
      sortable: true,
      filterable: true,
      widthClassName: "speed-col",
      getFilterValue: (item) => (item.moveSpeedMultiplier ? `${item.moveSpeedMultiplier}x` : "-"),
      getSortValue: (item) => item.moveSpeedMultiplier ?? 0,
      render: (item) => (item.moveSpeedMultiplier ? `${item.moveSpeedMultiplier}x` : "-")
    });
  }

  return columns;
}
