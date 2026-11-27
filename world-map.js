/*
====================================================
 SUPREMACY WORLD ONLINE - CARTE MONDIALE
 210 PROVINCES - 10 NATIONS
 Fichier indépendant : world-map.js
====================================================
*/

const RESOURCE_TYPES = [
  "food",
  "wood",
  "iron",
  "oil",
  "coal",
  "money"
];

const RESOURCE_NAMES = {
  food: "Nourriture",
  wood: "Bois",
  iron: "Fer",
  oil: "Pétrole",
  coal: "Charbon",
  money: "Argent"
};

// Chaque pays possède 21 provinces.
// Les coordonnées définissent des zones approximatives
// sur une carte de 1000 x 500 pixels.

const nations = [
  {
    id: "france",
    name: "France",
    flag: "🇫🇷",
    color: "#3159a5",
    x: 440, y: 145,
    provinces: [
      "Paris", "Normandie", "Bretagne", "Bordeaux",
      "Nantes", "Lyon", "Marseille", "Toulouse",
      "Lille", "Strasbourg", "Nice", "Grenoble",
      "Dijon", "Limoges", "Tours", "Reims",
      "Montpellier", "Rennes", "Clermont", "Metz",
      "Orléans"
    ]
  },
  {
    id: "germany",
    name: "Allemagne",
    flag: "🇩🇪",
    color: "#777777",
    x: 510, y: 115,
    provinces: [
      "Berlin", "Hambourg", "Munich", "Francfort",
      "Cologne", "Dresde", "Stuttgart", "Leipzig",
      "Hanovre", "Bremen", "Nuremberg", "Dortmund",
      "Essen", "Bonn", "Rostock", "Kiel",
      "Magdebourg", "Freiburg", "Augsbourg", "Erfurt",
      "Sarrebruck"
    ]
  },
  {
    id: "uk",
    name: "Royaume-Uni",
    flag: "🇬🇧",
    color: "#9b3434",
    x: 375, y: 75,
    provinces: [
      "Londres", "Manchester", "Liverpool", "Birmingham",
      "Édimbourg", "Glasgow", "Cardiff", "Bristol",
      "Leeds", "Newcastle", "Oxford", "Cambridge",
      "Plymouth", "Norwich", "York", "Aberdeen",
      "Dover", "Belfast", "Sheffield", "Nottingham",
      "Brighton"
    ]
  },
  {
    id: "russia",
    name: "Russie",
    flag: "🇷🇺",
    color: "#a34d4d",
    x: 690, y: 100,
    provinces: [
      "Moscou", "Saint-Pétersbourg", "Mourmansk",
      "Arkhangelsk", "Kazan", "Samara", "Volgograd",
      "Rostov", "Sotchi", "Oural", "Perm",
      "Ekaterinbourg", "Novossibirsk", "Omsk",
      "Krasnoïarsk", "Irkoutsk", "Vladivostok",
      "Yakoutsk", "Khabarovsk", "Saratov", "Tomsk"
    ]
  },
  {
    id: "italy",
    name: "Italie",
    flag: "🇮🇹",
    color: "#37865a",
    x: 510, y: 205,
    provinces: [
      "Rome", "Milan", "Venise", "Turin",
      "Gênes", "Florence", "Naples", "Palerme",
      "Bologne", "Bari", "Pise", "Vérone",
      "Trieste", "Cagliari", "Catane", "Pérouse",
      "Ancône", "Tarente", "Parme", "Salerne",
      "Messine"
    ]
  },
  {
    id: "spain",
    name: "Espagne",
    flag: "🇪🇸",
    color: "#d4a332",
    x: 370, y: 230,
    provinces: [
      "Madrid", "Barcelone", "Valence", "Séville",
      "Malaga", "Bilbao", "Saragosse", "Grenade",
      "Murcie", "Cordoue", "Valladolid", "Tolède",
      "Alicante", "Cadix", "La Corogne", "Vigo",
      "Salamanque", "Burgos", "Gijón", "Pampelune",
      "Almería"
    ]
  },
  {
    id: "ottoman",
    name: "Empire ottoman",
    flag: "🇹🇷",
    color: "#a52e38",
    x: 590, y: 255,
    provinces: [
      "Constantinople", "Ankara", "Izmir", "Adana",
      "Smyrne", "Bursa", "Antalya", "Trabzon",
      "Aleppo", "Damas", "Bagdad", "Mossoul",
      "Jérusalem", "Beyrouth", "Amman", "Erzurum",
      "Konya", "Samsun", "Gaziantep", "Basra",
      "Rhodes"
    ]
  },
  {
    id: "usa",
    name: "États-Unis",
    flag: "🇺🇸",
    color: "#4269a5",
    x: 125, y: 160,
    provinces: [
      "New York", "Washington", "Boston", "Chicago",
      "Detroit", "Miami", "Atlanta", "Dallas",
      "Houston", "Denver", "Phoenix", "Los Angeles",
      "San Francisco", "Seattle", "Portland", "Las Vegas",
      "New Orleans", "Kansas City", "Minneapolis",
      "Philadelphia", "San Diego"
    ]
  },
  {
    id: "japan",
    name: "Japon",
    flag: "🇯🇵",
    color: "#d85b65",
    x: 885, y: 200,
    provinces: [
      "Tokyo", "Osaka", "Kyoto", "Hiroshima",
      "Nagoya", "Sapporo", "Sendai", "Fukuoka",
      "Kobe", "Nagasaki", "Niigata", "Kanazawa",
      "Kagoshima", "Nara", "Shizuoka", "Yokohama",
      "Kumamoto", "Matsuyama", "Aomori", "Akita",
      "Okinawa"
    ]
  },
  {
    id: "brazil",
    name: "Brésil",
    flag: "🇧🇷",
    color: "#42965a",
    x: 220, y: 350,
    provinces: [
      "Brasilia", "Rio de Janeiro", "São Paulo",
      "Salvador", "Manaus", "Recife", "Fortaleza",
      "Curitiba", "Belém", "Porto Alegre", "Goiânia",
      "Cuiabá", "Natal", "Maceió", "Santos",
      "Florianópolis", "Campinas", "Teresina",
      "João Pessoa", "Aracaju", "Macapá"
    ]
  }
];

// Productions horaires de base.
const productionProfiles = {
  food:  { min: 20, max: 65 },
  wood:  { min: 10, max: 35 },
  iron:  { min: 8, max: 30 },
  oil:   { min: 5, max: 25 },
  coal:  { min: 8, max: 28 },
  money: { min: 15, max: 55 }
};

function createProduction(index) {
  const production = {};

  // Chaque province produit au moins deux ressources
  // et peut en produire jusqu'à quatre.
  const count = 2 + (index % 3);

  for (let i = 0; i < count; i++) {
    const resourceIndex = (index * 3 + i * 2) % RESOURCE_TYPES.length;
    const resource = RESOURCE_TYPES[resourceIndex];
    const profile = productionProfiles[resource];

    const amount =
      profile.min +
      ((index * 7 + i * 13) % (profile.max - profile.min + 1));

    production[resource] = amount;
  }

  return production;
}

function createProvince(nation, name, index) {
  const column = index % 7;
  const row = Math.floor(index / 7);

  // Légère variation pour éviter un quadrillage trop rigide.
  const offsetX = ((index * 17) % 13) - 6;
  const offsetY = ((index * 11) % 11) - 5;

  return {
    id: nation.id + "_" + (index + 1),
    name: name,

    nation: nation.id,
    country: nation.name,
    flag: nation.flag,
    color: nation.color,

    x: nation.x + column * 13 + offsetX,
    y: nation.y + row * 17 + offsetY,

    population: 50000 + ((index * 19371) % 450000),

    units: {
      infantry: 1000 + ((index * 137) % 5000),
      artillery: index % 4,
      tanks: index % 3,
      aircraft: index % 2,
      ships: 0
    },

    buildings: {
      barracks: 1,
      factory: index % 3 === 0 ? 1 : 0,
      port: index % 5 === 0 ? 1 : 0,
      railway: 0,
      fort: 0
    },

    resources: {
      food: 1000,
      wood: 800,
      iron: 500,
      oil: 300,
      coal: 400,
      money: 2000
    },

    production: createProduction(index),

    // Temps de production en heures.
    lastProduction: Date.now()
  };
}

// Création automatique des 210 provinces.
const provinces = [];

for (const nation of nations) {
  nation.provinces.forEach((provinceName, index) => {
    provinces.push(
      createProvince(nation, provinceName, index)
    );
  });
}

// Recherche d'une province par son identifiant.
function getProvince(id) {
  return provinces.find(province => province.id === id);
}

// Recherche des provinces d'un pays.
function getNationProvinces(nationId) {
  return provinces.filter(
    province => province.nation === nationId
  );
}

// Calcul de la production totale d'un pays.
function getNationProduction(nationId) {
  const result = {
    food: 0,
    wood: 0,
    iron: 0,
    oil: 0,
    coal: 0,
    money: 0
  };

  const ownedProvinces = getNationProvinces(nationId);

  for (const province of ownedProvinces) {
    for (const resource of RESOURCE_TYPES) {
      result[resource] += province.production[resource] || 0;
    }
  }

  return result;
}

// Production des ressources selon le temps écoulé.
function updateProvinceProduction(province, elapsedHours = 1) {
  for (const resource of RESOURCE_TYPES) {
    const amount = province.production[resource] || 0;

    province.resources[resource] += amount * elapsedHours;
  }

  province.lastProduction = Date.now();

  return province.resources;
}

// Production de toutes les provinces.
function updateAllProduction(elapsedHours = 1) {
  for (const province of provinces) {
    updateProvinceProduction(province, elapsedHours);
  }

  return provinces;
}

// Résumé général de la carte.
function getWorldSummary() {
  return {
    totalNations: nations.length,
    totalProvinces: provinces.length,
    nations: nations.map(nation => ({
      id: nation.id,
      name: nation.name,
      flag: nation.flag,
      provinces: getNationProvinces(nation.id).length,
      production: getNationProduction(nation.id)
    }))
  };
}

// Export pour Node.js.
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    nations,
    provinces,
    RESOURCE_TYPES,
    RESOURCE_NAMES,
    getProvince,
    getNationProvinces,
    getNationProduction,
    updateProvinceProduction,
    updateAllProduction,
    getWorldSummary
  };
}

// Export pour navigateur.
if (typeof window !== "undefined") {
  window.WorldMap = {
    nations,
    provinces,
    RESOURCE_TYPES,
    RESOURCE_NAMES,
    getProvince,
    getNationProvinces,
    getNationProduction,
    updateProvinceProduction,
    updateAllProduction,
    getWorldSummary
  };
}
