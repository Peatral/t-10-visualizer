export const SYNONYMS_DICT: Record<string, { de: string[], en: string[] }> = {
  "ki": {
    de: ["ki", "künstliche intelligenz", "künstlichen intelligenz", "künstlicher intelligenz", "künstliches intelligenz", "maschinelles lernen", "k.i."],
    en: ["ai", "artificial intelligence", "artifical intelligence", "machine learning", "deep learning", "a.i."]
  },
  "ai": {
    de: ["ki", "künstliche intelligenz", "künstlichen intelligenz", "künstlicher intelligenz", "künstliches intelligenz", "maschinelles lernen", "k.i."],
    en: ["ai", "artificial intelligence", "artifical intelligence", "machine learning", "deep learning", "a.i."]
  },
  "artificial intelligence": {
    de: ["ki", "künstliche intelligenz", "künstlichen intelligenz", "künstlicher intelligenz", "künstliches intelligenz", "k.i."],
    en: ["ai", "artificial intelligence", "artifical intelligence"]
  },
  "künstliche intelligenz": {
    de: ["ki", "künstliche intelligenz", "künstlichen intelligenz", "künstlicher intelligenz", "künstliches intelligenz", "k.i."],
    en: ["ai", "artificial intelligence", "artifical intelligence"]
  },
  
  "pv": {
    de: ["pv", "photovoltaik", "solar", "solaranlage", "solaranlagen", "solarstrom", "balkonkraftwerk", "balkonkraftwerke"],
    en: ["pv", "photovoltaics", "solar", "solar power"]
  },
  "photovoltaik": {
    de: ["pv", "photovoltaik", "solar", "solaranlage", "solaranlagen", "solarstrom"],
    en: ["pv", "photovoltaics", "solar", "solar power"]
  },
  "solar": {
    de: ["pv", "photovoltaik", "solar", "solaranlage", "solaranlagen", "solarstrom"],
    en: ["pv", "photovoltaics", "solar", "solar power"]
  },
  
  "e-auto": {
    de: ["e-auto", "elektroauto", "elektroautos", "e-mobil", "e-mobilität", "elektromobilität"],
    en: ["ev", "evs", "electric vehicle", "electric vehicles", "e-mobility"]
  },
  "elektroauto": {
    de: ["e-auto", "elektroauto", "elektroautos", "e-mobil", "e-mobilität", "elektromobilität"],
    en: ["ev", "evs", "electric vehicle", "electric vehicles", "e-mobility"]
  },
  "e-mobilität": {
    de: ["e-auto", "elektroauto", "elektroautos", "e-mobil", "e-mobilität", "elektromobilität"],
    en: ["ev", "evs", "electric vehicle", "electric vehicles", "e-mobility"]
  },
  
  "wärmepumpe": {
    de: ["wärmepumpe", "wärmepumpen", "waermepumpe", "waermepumpen"],
    en: ["heat pump", "heat pumps"]
  },
  "heat pump": {
    de: ["wärmepumpe", "wärmepumpen", "waermepumpe", "waermepumpen"],
    en: ["heat pump", "heat pumps"]
  },
  
  "windenergie": {
    de: ["windenergie", "windkraft", "windrad", "windräder", "windkraftanlage", "windkraftanlagen"],
    en: ["wind energy", "wind power", "wind turbine", "wind turbines"]
  },
  "windkraft": {
    de: ["windenergie", "windkraft", "windrad", "windräder", "windkraftanlage", "windkraftanlagen"],
    en: ["wind energy", "wind power", "wind turbine", "wind turbines"]
  },
  
  "auto": {
    de: ["auto", "pkw", "autos", "pkws", "personenkraftwagen", "automobil", "automobile", "pkw-maut"],
    en: ["car", "cars", "automobile", "automobiles"]
  },
  "pkw": {
    de: ["auto", "pkw", "autos", "pkws", "personenkraftwagen", "automobil", "automobile"],
    en: ["car", "cars", "automobile", "automobiles"]
  },
  "car": {
    de: ["auto", "pkw", "autos", "pkws", "personenkraftwagen", "automobil", "automobile"],
    en: ["car", "cars", "automobile", "automobiles"]
  },
  
  "bus": {
    de: ["bus", "busse"],
    en: ["bus", "busses"]
  },
  "busse": {
    de: ["bus", "busse"],
    en: ["bus", "busses"]
  },
  "bahn": {
    de: ["bahn", "bahnen", "zug", "schienenverkehr", "tram", "u-bahn", "s-bahn", "straßenbahn"],
    en: ["train", "trains", "rail", "railway", "railways", "tram", "subway", "metro"]
  },
  "zug": {
    de: ["bahn", "bahnen", "zug", "schienenverkehr", "tram", "u-bahn", "s-bahn", "straßenbahn"],
    en: ["train", "trains", "rail", "railway", "railways", "tram", "subway", "metro"]
  },
  "train": {
    de: ["bahn", "bahnen", "zug", "schienenverkehr", "tram", "u-bahn", "s-bahn", "straßenbahn"],
    en: ["train", "trains", "rail", "railway", "railways", "tram", "subway", "metro"]
  },
  "öpnv": {
    de: ["öpnv", "öffis", "öffentlicher nahverkehr"],
    en: ["public transport", "public transportation"]
  },
  "public transport": {
    de: ["öpnv", "öffis", "öffentlicher nahverkehr"],
    en: ["public transport", "public transportation"]
  },
  
  "fahrrad": {
    de: ["fahrrad", "radverkehr", "e-bike", "velo", "fahrräder", "radeln"],
    en: ["bike", "bicycle", "e-bike", "bicycles", "bikes"]
  },
  "bike": {
    de: ["fahrrad", "radverkehr", "e-bike", "velo", "fahrräder", "radeln"],
    en: ["bike", "bicycle", "e-bike", "bicycles", "bikes"]
  },
  
  "wasserstoff": {
    de: ["wasserstoff", "h2", "wasserstoffantrieb", "wasserstofftechnologie", "brennstoffzelle", "brennstoffzellen"],
    en: ["hydrogen", "h2", "hydrogen fuel cell", "hydrogen power"]
  },
  "h2": {
    de: ["wasserstoff", "h2", "wasserstoffantrieb", "wasserstofftechnologie"],
    en: ["hydrogen", "h2"]
  },
  "hydrogen": {
    de: ["wasserstoff", "h2", "wasserstoffantrieb", "wasserstofftechnologie"],
    en: ["hydrogen", "h2"]
  },
  
  "batterie": {
    de: ["batterie", "batterien", "akku", "akkus", "akkumulator", "stromspeicher", "energiespeicher", "elektrischer speicher", "chemischer speicher"],
    en: ["battery", "batteries", "accumulator", "power storage", "energy storage"]
  },
  "battery": {
    de: ["batterie", "batterien", "akku", "akkus", "akkumulator", "stromspeicher", "energiespeicher", "elektrischer speicher", "chemischer speicher"],
    en: ["battery", "batteries", "accumulator", "power storage", "energy storage"]
  },
  
  "kohle": {
    de: ["kohle", "braunkohle", "steinkohle", "kohlekraftwerk", "kohlekraftwerke", "braunkohle-energie"],
    en: ["coal", "lignite", "coal power plant", "coal power plants"]
  },
  "coal": {
    de: ["kohle", "braunkohle", "steinkohle", "kohlekraftwerk", "kohlekraftwerke"],
    en: ["coal", "lignite", "coal power plant", "coal power plants"]
  },
  
  "kernkraft": {
    de: ["kernkraft", "atomkraft", "atomenergie", "kernenergie", "akw", "kkw"],
    en: ["nuclear", "nuclear energy", "nuclear power", "nuclear power plant", "nuclear power plants"]
  },
  "nuclear": {
    de: ["kernkraft", "atomkraft", "atomenergie", "kernenergie", "akw", "kkw"],
    en: ["nuclear", "nuclear energy", "nuclear power", "nuclear power plant", "nuclear power plants"]
  }
}

export const CUSTOM_TOPIC_GROUPS: Array<{
  id: string;
  nameDe: string;
  nameEn: string;
  keywordsDe: string[];
  keywordsEn: string[];
  categories: string[];
}> = [
  {
    id: "ki",
    nameDe: "KI / Künstliche Intelligenz",
    nameEn: "AI / Artificial Intelligence",
    keywordsDe: ["ki", "künstliche intelligenz", "künstlichen intelligenz", "künstlicher intelligenz", "künstliches intelligenz", "maschinelles lernen", "k.i."],
    keywordsEn: ["ai", "artificial intelligence", "artifical intelligence", "machine learning", "deep learning", "a.i."],
    categories: ["t-10-mobility", "t-10-energy", "t-10-food", "t-10-housing"]
  },
  {
    id: "pv",
    nameDe: "PV / Photovoltaik",
    nameEn: "PV / Photovoltaics",
    keywordsDe: ["pv", "photovoltaik", "solar", "solaranlage", "solaranlagen", "solarstrom", "balkonkraftwerk", "balkonkraftwerke"],
    keywordsEn: ["pv", "photovoltaics", "solar", "solar power"],
    categories: ["t-10-energy", "t-10-housing"]
  },
  {
    id: "e-mobilitaet",
    nameDe: "E-Mobilität / Elektroautos",
    nameEn: "E-Mobility / Electric Vehicles",
    keywordsDe: ["e-auto", "elektroauto", "elektroautos", "e-mobil", "e-mobilität", "elektromobilität"],
    keywordsEn: ["ev", "evs", "electric vehicle", "electric vehicles", "e-mobility"],
    categories: ["t-10-mobility", "t-10-energy"]
  },
  {
    id: "waermepumpe",
    nameDe: "Wärmepumpe",
    nameEn: "Heat pump",
    keywordsDe: ["wärmepumpe", "wärmepumpen", "waermepumpe", "waermepumpen"],
    keywordsEn: ["heat pump", "heat pumps"],
    categories: ["t-10-energy", "t-10-housing"]
  },
  {
    id: "windenergie",
    nameDe: "Windenergie / Windkraft",
    nameEn: "Wind energy / Wind power",
    keywordsDe: ["windenergie", "windkraft", "windrad", "windräder", "windkraftanlage", "windkraftanlagen"],
    keywordsEn: ["wind energy", "wind power", "wind turbine", "wind turbines"],
    categories: ["t-10-energy"]
  },
  {
    id: "auto",
    nameDe: "Auto / PKW",
    nameEn: "Car / Automobile",
    keywordsDe: ["auto", "pkw", "autos", "pkws", "personenkraftwagen", "automobil", "automobile"],
    keywordsEn: ["car", "cars", "automobile", "automobiles"],
    categories: ["t-10-mobility"]
  },
  {
    id: "fahrrad",
    nameDe: "Fahrrad / Radverkehr",
    nameEn: "Bicycle / Cycling",
    keywordsDe: ["fahrrad", "radverkehr", "e-bike", "velo", "fahrräder", "radeln"],
    keywordsEn: ["bike", "bicycle", "e-bike", "bicycles", "bikes"],
    categories: ["t-10-mobility"]
  },
  {
    id: "wasserstoff",
    nameDe: "Wasserstoff",
    nameEn: "Hydrogen",
    keywordsDe: ["wasserstoff", "h2", "wasserstoffantrieb", "wasserstofftechnologie", "brennstoffzelle", "brennstoffzellen"],
    keywordsEn: ["hydrogen", "h2", "hydrogen fuel cell", "hydrogen power"],
    categories: ["t-10-energy", "t-10-mobility"]
  },
  {
    id: "batterie",
    nameDe: "Batterie / Speicher",
    nameEn: "Battery / Storage",
    keywordsDe: ["batterie", "batterien", "akku", "akkus", "akkumulator", "stromspeicher", "energiespeicher", "elektrischer speicher", "chemischer speicher"],
    keywordsEn: ["battery", "batteries", "accumulator", "power storage", "energy storage"],
    categories: ["t-10-energy", "t-10-mobility", "t-10-housing"]
  },
  {
    id: "kohle",
    nameDe: "Kohleenergie",
    nameEn: "Coal energy",
    keywordsDe: ["kohle", "braunkohle", "steinkohle", "kohlekraftwerk", "kohlekraftwerke", "braunkohle-energie"],
    keywordsEn: ["coal", "lignite", "coal power plant", "coal power plants"],
    categories: ["t-10-energy"]
  },
  {
    id: "kernkraft",
    nameDe: "Kernkraft / Atomkraft",
    nameEn: "Nuclear power / Nuclear energy",
    keywordsDe: ["kernkraft", "atomkraft", "atomenergie", "kernenergie", "akw", "kkw"],
    keywordsEn: ["nuclear", "nuclear energy", "nuclear power", "nuclear power plant", "nuclear power plants"],
    categories: ["t-10-energy"]
  }
]
