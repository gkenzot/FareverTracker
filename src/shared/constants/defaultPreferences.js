export const DEFAULT_DASHBOARD_SETTINGS = {
  global: {
    accountHideUnavailable: true,
    accountShowNotInGame: false,
    characterFilterByVocation: true
  },
  weapons: {
    excludedPropertyValues: {},
    excludedSourceKinds: ["unknown"]
  },
  jewellery: {
    excludedPropertyValues: {
      rarity: ["Uncommon"],
      itemLevel: ["6", "10"],
      type: ["Finger"]
    }
  },
  companions: {
    excludedSourceKinds: [],
    excludedPropertyValues: {
      variant: ["Demon"],
      species: ["Rabbit"]
    }
  },
  armor: {
    excludedPropertyValues: {
      itemLevel: ["6", "10", "15"],
      rarity: ["Common", "Uncommon"]
    }
  },
  recipes: {
    excludedPropertyValues: {
      pickup_rarity: ["-"]
    }
  },
  mounts: {
    excludedPropertyValues: {}
  },
  gliders: {
    excludedPropertyValues: {}
  }
};

export const DEFAULT_HIDDEN_COLUMN_KEYS = {
  companions: [],
  mounts: ["property:rarity", "property:type"],
  armor: ["property:type"],
  recipes: ["property:type", "source"],
  weapons: ["itemLevel", "property:classes", "property:subcategory"]
};

export const DEFAULT_COLUMN_ORDER_KEYS = {
  "collection:mounts": [
    "collected",
    "name",
    "property:subcategory",
    "property:type",
    "property:rarity",
    "source",
    "howToGet",
    "speed"
  ],
  "missing:weapons": [
    "missingCount",
    "name",
    "itemLevel",
    "missingCharacters",
    "property:subcategory",
    "property:type",
    "property:classes",
    "property:rarity",
    "source",
    "howToGet"
  ],
  "collection:weapons": [
    "collected",
    "name",
    "itemLevel",
    "property:subcategory",
    "property:type",
    "property:rarity",
    "weaponStatus",
    "source",
    "howToGet"
  ]
};

export const DEFAULT_VIEW_STATES = {
  "account:gliders": {
    query: "",
    columnFilters: {},
    sortConfig: { key: "name", direction: "asc" }
  },
  "account:mounts": {
    query: "",
    columnFilters: {},
    sortConfig: { key: "name", direction: "asc" }
  },
  "account:appearance": {
    query: "",
    columnFilters: {},
    sortConfig: { key: "name", direction: "asc" }
  },
  "character:weapons": {
    query: "",
    columnFilters: {
      collected: ["Missing", "Collected"]
    },
    sortConfig: { key: "name", direction: "asc" }
  },
  "character:armor": {
    query: "",
    columnFilters: {
      collected: ["Missing", "Collected"]
    },
    sortConfig: { key: "property:subcategory", direction: "asc" }
  },
  "character:recipes": {
    query: "",
    columnFilters: {},
    sortConfig: { key: "property:subcategory", direction: "asc" }
  },
  "missing:weapons": {
    query: "",
    columnFilters: {},
    sortConfig: { key: "missingCount", direction: "desc" }
  }
};
